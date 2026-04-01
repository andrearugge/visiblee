import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

interface CreateIntentProfileBody {
  name: string;
  description: string;
  sampleQueries: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function generateContextPrompt(
  name: string,
  description: string,
  sampleQueries: string[],
  language: string,
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    // Fallback: build a simple heuristic context prompt
    const sample = sampleQueries.slice(0, 3).map((q) => `"${q}"`).join(', ');
    return `The user is "${name}". ${description} They have previously searched for: ${sample}.`;
  }

  const ai = new GoogleGenAI({ apiKey });
  const lang = language === 'it' ? 'Italian' : 'English';

  const prompt = `Generate a search context prompt (2-3 sentences) for simulating a user with this profile during an AI citation check.

Persona name: ${name}
Description: ${description}
Example searches: ${sampleQueries.slice(0, 3).join(', ')}

Write in ${lang}, third person. Describe who the user is, what they are looking for, and how they typically search. Keep it concise and focused on search behavior. Do not include introductory phrases.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return response.text?.trim() ?? `The user is "${name}". ${description}`;
}

// POST /api/projects/[id]/intent-profiles — create a manual intent profile
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true, targetLanguage: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: CreateIntentProfileBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, description, sampleQueries } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 422 });
  }
  if (!Array.isArray(sampleQueries) || sampleQueries.length === 0) {
    return NextResponse.json({ error: 'at least one sample query is required' }, { status: 422 });
  }

  // Generate unique slug with 'manual-' prefix
  const baseSlug = `manual-${slugify(name)}`;
  // Ensure uniqueness by appending a timestamp suffix if needed
  const existingCount = await db.intentProfile.count({
    where: { projectId, slug: { startsWith: baseSlug } },
  });
  const slug = existingCount > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;

  // Generate contextPrompt via Gemini Flash
  const contextPrompt = await generateContextPrompt(
    name.trim(),
    description.trim(),
    sampleQueries.filter((q) => q.trim()),
    project.targetLanguage ?? 'en',
  );

  const profile = await db.intentProfile.create({
    data: {
      projectId,
      name: name.trim(),
      slug,
      description: description.trim(),
      source: 'manual',
      manualDescription: description.trim(),
      manualSampleQueries: sampleQueries.filter((q) => q.trim()),
      // Manual personas don't have GSC-derived stats — set to neutral defaults
      dominantIntent: 'informational',
      avgQueryLength: 0,
      queryCount: 0,
      totalImpressions: 0,
      topPatterns: [],
      sampleQueries: sampleQueries.filter((q) => q.trim()),
      contextPrompt,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      source: true,
      manualDescription: true,
      manualSampleQueries: true,
      dominantIntent: true,
      dominantDevice: true,
      dominantCountry: true,
      avgQueryLength: true,
      queryCount: true,
      totalImpressions: true,
      topPatterns: true,
      sampleQueries: true,
      contextPrompt: true,
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
}
