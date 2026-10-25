import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = String(process.env.EMBED_DEMO_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'DEMO_NOT_CONFIGURED',
        message: 'Set EMBED_DEMO_API_KEY to mint demo embed sessions.',
      },
      { status: 501 },
    );
  }

  const apiBase = String(process.env.API_URL || 'http://localhost:8787').replace(/\/+$/, '');
  const tmdbId = String(process.env.EMBED_DEMO_TMDB_ID || '550');
  try {
    const response = await fetch(`${apiBase}/api/v1/embed/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ type: 'movie', id: tmdbId }),
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      message?: string;
      embedUrl?: string;
      token?: string;
      expiresAt?: string;
      partner?: { id: string; name: string };
      origins?: string[];
    };
    if (!response.ok || !data.success || !data.embedUrl) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || 'DEMO_SESSION_FAILED',
          message: data.message || 'Could not create a demo embed session.',
        },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({
      success: true,
      embedUrl: data.embedUrl,
      token: data.token,
      expiresAt: data.expiresAt,
      partner: data.partner,
      origins: data.origins,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'DEMO_SESSION_FAILED',
        message: 'The player API could not be reached.',
      },
      { status: 502 },
    );
  }
}
