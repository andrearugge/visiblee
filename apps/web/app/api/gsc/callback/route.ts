import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CSRF_COOKIE = 'gsc_csrf';

interface OAuthState {
  projectId: string;
  userId: string;
  csrf: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const stateB64 = searchParams.get('state');
  const error = searchParams.get('error');

  // Parse state early so we can redirect to the right project on error
  let state: OAuthState | null = null;
  try {
    state = JSON.parse(Buffer.from(stateB64 ?? '', 'base64').toString()) as OAuthState;
  } catch {
    return NextResponse.redirect(new URL('/app', req.url));
  }

  const settingsUrl = `/app/projects/${state.projectId}/settings`;

  // User denied consent
  if (error) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gsc=denied`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gsc=error`, req.url));
  }

  // CSRF validation
  const csrfCookie = req.cookies.get(CSRF_COOKIE)?.value;
  if (!csrfCookie || csrfCookie !== state.csrf) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gsc=error`, req.url));
  }

  // Session / ownership validation
  if (state.userId !== session.user.id) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gsc=error`, req.url));
  }

  const project = await db.project.findFirst({
    where: { id: state.projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gsc=error`, req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.AUTH_URL}/api/gsc/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens: GoogleTokenResponse = await tokenRes.json();

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(new URL(`${settingsUrl}?gsc=error`, req.url));
  }

  // Persist encrypted tokens
  await db.gscConnection.upsert({
    where: { projectId: state.projectId },
    create: {
      projectId: state.projectId,
      userId: state.userId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      status: 'active',
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      status: 'active',
      lastSyncError: null,
    },
  });

  // Clear CSRF cookie and redirect to settings
  const response = NextResponse.redirect(new URL(`${settingsUrl}?gsc=connected`, req.url));
  response.cookies.delete(CSRF_COOKIE);
  return response;
}
