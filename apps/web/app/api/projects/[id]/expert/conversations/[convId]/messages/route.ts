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

  // Save user message
  await db.expertMessage.create({
    data: { conversationId: convId, role: 'user', content: userText },
  });

  // Build history for Gemini (exclude system messages — passed as systemInstruction)
  const systemMsg = conversation.messages.find((m) => m.role === 'system');
  // Rename 'assistant' → 'model' for Gemini SDK
  const geminiHistory = conversation.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    }));

  let assistantContent = 'I was unable to generate a response. Please try again.';

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'LLM not configured' }, { status: 503 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-2.0-flash',
      history: geminiHistory,
      config: {
        systemInstruction: systemMsg?.content ?? '',
      },
    });
    const response = await chat.sendMessage({ message: userText });
    const text = response.text;
    if (text) assistantContent = text;
  } catch (err) {
    console.error('[GEO Expert] Gemini error:', err);
    return NextResponse.json({ error: 'LLM error' }, { status: 502 });
  }

  const assistantMessage = await db.expertMessage.create({
    data: { conversationId: convId, role: 'assistant', content: assistantContent },
  });

  // Touch updatedAt on conversation
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
