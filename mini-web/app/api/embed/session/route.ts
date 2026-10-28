import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
const API_KEY = process.env.EMBED_PARTNER_API_KEY || 'demo-key-change-me';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const apiRes = await fetch(`${API_URL}/api/v1/embed/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        type: body.type || 'movie',
        id: body.id || '550',
        ...(body.season && { season: body.season }),
        ...(body.episode && { episode: body.episode }),
        ...(body.source && { source: body.source }),
      }),
      // Don't cache — we want fresh tokens
      cache: 'no-store',
    });

    const data = await apiRes.json();

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error || 'SESSION_FAILED', message: data.message },
        { status: apiRes.status }
      );
    }

    return NextResponse.json({ success: true, embedUrl: data.embedUrl, token: data.token });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
