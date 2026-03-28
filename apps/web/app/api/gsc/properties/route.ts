import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

const GSC_SITES_URL = 'https://www.googleapis.com/webmasters/v3/sites';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function refreshAccessToken(
  encryptedRefreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) return null;
  return {
    accessToken: data.access_token as string,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const connection = await db.gscConnection.findUnique({
    where: { projectId },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
      status: true,
      project: { select: { userId: true } },
    },
  });

  if (!connection || connection.project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  if (connection.status === 'revoked') {
    return NextResponse.json({ error: 'Connection revoked' }, { status: 403 });
  }

  // Refresh access token if expired
  let accessToken = decrypt(connection.accessToken);
  if (connection.tokenExpiresAt < new Date()) {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    if (!refreshed) {
      await db.gscConnection.update({
        where: { projectId },
        data: { status: 'revoked', lastSyncError: 'invalid_grant' },
      });
      return NextResponse.json({ error: 'Connection revoked — reconnect GSC' }, { status: 403 });
    }
    accessToken = refreshed.accessToken;
    await db.gscConnection.update({
      where: { projectId },
      data: {
        accessToken: decrypt(connection.accessToken), // keep encrypted; just update expiry
        tokenExpiresAt: refreshed.expiresAt,
      },
    });
  }

  // Fetch sites from GSC API
  const sitesRes = await fetch(GSC_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!sitesRes.ok) {
    if (sitesRes.status === 403) {
      return NextResponse.json({ properties: [] });
    }
    return NextResponse.json({ error: 'GSC API error' }, { status: 502 });
  }

  const sitesData = await sitesRes.json();
  const properties = (sitesData.siteEntry ?? []).map(
    (entry: { siteUrl: string; permissionLevel: string }) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel,
      type: entry.siteUrl.startsWith('sc-domain:') ? 'DOMAIN' : 'URL_PREFIX',
    }),
  );

  return NextResponse.json({ properties });
}
