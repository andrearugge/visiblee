import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const MAX_CONVERSATIONS_FREE = 50;

function buildSystemPrompt(contextPayload: Record<string, unknown>, language: string): string {
  const lang = language === 'it' ? 'italiano' : 'English';
  return `You are GEO Expert, an AI specialist in Generative Engine Optimization (GEO) — helping content rank in Google AI Mode, AI Overviews, and Gemini responses.

You are working with the following context:
${JSON.stringify(contextPayload, null, 2)}

Respond in ${lang}. Be concrete and actionable. Focus on what the user can do immediately to improve their AI citation chances.`;
}

function buildInitialMessage(contextPayload: Record<string, unknown>, language: string): string {
  const payload = contextPayload as {
    recommendation?: { title?: string; description?: string; type?: string; suggestedAction?: string };
    query?: { queryText?: string };
    content?: { url?: string; title?: string };
    topCompetitor?: { name?: string };
  };

  const rec = payload.recommendation;
  const query = payload.query;
  const content = payload.content;
  const competitor = payload.topCompetitor;

  if (language === 'it') {
    let msg = `Ho analizzato il tuo progetto per la query **"${query?.queryText ?? 'selezionata'}"**.`;
    if (rec) {
      msg += `\n\nHo trovato una raccomandazione prioritaria: **${rec.title}**.\n${rec.description ?? ''}`;
      if (rec.suggestedAction) msg += `\n\n**Azione suggerita**: ${rec.suggestedAction}`;
    }
    if (content) {
      msg += `\n\n**Contenuto coinvolto**: ${content.title ?? content.url}`;
    }
    if (competitor) {
      msg += `\n\nIl tuo principale competitor per questa query è **${competitor.name}**. Analizzando le sue citazioni possiamo capire cosa manca al tuo contenuto.`;
    }
    msg += `\n\nCome vuoi procedere? Posso aiutarti a riscrivere un passaggio, generare un brief per un nuovo contenuto, o approfondire uno degli aspetti sopra.`;
    return msg;
  }

  let msg = `I've analyzed your project for the query **"${query?.queryText ?? 'selected'}"**.`;
  if (rec) {
    msg += `\n\nI found a priority recommendation: **${rec.title}**.\n${rec.description ?? ''}`;
    if (rec.suggestedAction) msg += `\n\n**Suggested action**: ${rec.suggestedAction}`;
  }
  if (content) {
    msg += `\n\n**Content involved**: ${content.title ?? content.url}`;
  }
  if (competitor) {
    msg += `\n\nYour main competitor for this query is **${competitor.name}**. By analyzing their citations we can identify what your content is missing.`;
  }
  msg += `\n\nHow would you like to proceed? I can help you rewrite a passage, generate a brief for new content, or dive deeper into any of the above.`;
  return msg;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true, targetLanguage: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Plan limit: max 50 conversations (free)
  const existingCount = await db.expertConversation.count({ where: { projectId } });
  if (existingCount >= MAX_CONVERSATIONS_FREE) {
    return NextResponse.json(
      { error: 'conversation_limit_reached', limit: MAX_CONVERSATIONS_FREE },
      { status: 429 },
    );
  }

  const body = await req.json();
  const { recommendationId, targetQueryId, contextPayload } = body as {
    recommendationId?: string;
    targetQueryId?: string;
    contextPayload: Record<string, unknown>;
  };

  if (!contextPayload || typeof contextPayload !== 'object') {
    return NextResponse.json({ error: 'contextPayload required' }, { status: 400 });
  }

  // Auto-generate title from context
  const payload = contextPayload as {
    recommendation?: { title?: string };
    query?: { queryText?: string };
  };
  const title =
    payload.recommendation?.title
      ? `${payload.recommendation.title}`
      : payload.query?.queryText
        ? `Query: ${payload.query.queryText}`
        : 'GEO Expert conversation';

  // Create conversation + system message + initial assistant message in a transaction
  const initialAssistantText = buildInitialMessage(contextPayload, project.targetLanguage);
  const systemPromptText = buildSystemPrompt(contextPayload, project.targetLanguage);

  // Optionally use Gemini to generate a richer initial message (best-effort)
  let assistantContent = initialAssistantText;
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: 'Start the conversation by introducing yourself and analyzing the provided context.' }] }],
        config: { systemInstruction: systemPromptText },
      });
      const text = response.text;
      if (text) assistantContent = text;
    } catch {
      // fall back to static initial message
    }
  }

  const conversation = await db.expertConversation.create({
    data: {
      projectId,
      recommendationId: recommendationId ?? null,
      targetQueryId: targetQueryId ?? null,
      title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contextPayload: contextPayload as any,
      messages: {
        createMany: {
          data: [
            { role: 'system', content: systemPromptText },
            { role: 'assistant', content: assistantContent },
          ],
        },
      },
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const conversations = await db.expertConversation.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      targetQueryId: true,
      recommendationId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ conversations });
}
