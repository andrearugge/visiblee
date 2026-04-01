import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

const MAX_MESSAGES_PER_CONVERSATION = 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; convId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId, convId } = await params;

  // Ownership check
  const conversation = await db.expertConversation.findFirst({
    where: {
      id: convId,
      projectId,
      project: { userId: session.user.id },
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userMessages = conversation.messages.filter((m) => m.role !== 'system');
  if (userMessages.length >= MAX_MESSAGES_PER_CONVERSATION) {
    return NextResponse.json(
      { error: 'message_limit_reached', limit: MAX_MESSAGES_PER_CONVERSATION },
      { status: 429 },
    );
  }

  const body = await req.json();
  const userText: string = body.content?.trim();
  if (!userText) return NextResponse.json({ error: 'content required' }, { status: 400 });

  // Build history for Gemini — exclude system messages (used as systemInstruction)
  // and ensure alternating user/model turns to avoid invalid history errors.
  const systemMsg = conversation.messages.find((m) => m.role === 'system');
  const nonSystemMessages = conversation.messages.filter((m) => m.role !== 'system');

  // Drop trailing user messages left over from previous failed requests
  const cleanHistory = [...nonSystemMessages];
  while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
    cleanHistory.pop();
  }

  const geminiHistory = cleanHistory.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 });
  }

  let assistantContent: string;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: geminiHistory,
      config: {
        systemInstruction: systemMsg?.content ?? '',
      },
    });
    const response = await chat.sendMessage({ message: userText });
    const text = response.text;
    if (!text) throw new Error('empty_response');
    assistantContent = text;
  } catch (err) {
    console.error('[GEO Expert] Gemini error:', err);
    return NextResponse.json({ error: 'LLM error' }, { status: 502 });
  }

  // Save both messages only after a successful Gemini response
  const [, assistantMessage] = await db.$transaction([
    db.expertMessage.create({
      data: { conversationId: convId, role: 'user', content: userText },
    }),
    db.expertMessage.create({
      data: { conversationId: convId, role: 'assistant', content: assistantContent },
    }),
  ]);

  await db.expertConversation.update({
    where: { id: convId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message: assistantMessage }, { status: 201 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; convId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId, convId } = await params;

  const conversation = await db.expertConversation.findFirst({
    where: {
      id: convId,
      projectId,
      project: { userId: session.user.id },
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ conversation });
}
