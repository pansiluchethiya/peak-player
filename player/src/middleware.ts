import { NextRequest, NextResponse } from 'next/server';
import {
  buildFrameAncestors,
  normalizeEmbedOrigins,
  verifyEmbedToken,
} from './lib/embedToken';

export const config = {
  matcher: ['/embed/:path*'],
};

const EMBED_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Referrer-Policy': 'origin',
  'X-Content-Type-Options': 'nosniff',
};

function deny(message: string, status: number): NextResponse {
  const response = new NextResponse(message, {
    status,
    headers: {
      ...EMBED_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  });
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // The demo page is a first-party page. The player it frames still requires
  // its own signed token, so the demo route itself is not token-gated.
  if (pathname === '/embed/demo' || pathname.startsWith('/embed/demo/')) {
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', buildFrameAncestors([]));
    for (const [name, value] of Object.entries(EMBED_HEADERS)) response.headers.set(name, value);
    return response;
  }

  const token = request.nextUrl.searchParams.get('token');
  const result = await verifyEmbedToken(token);
  if (!result.ok) {
    if (result.error === 'SECRET_MISSING') {
      return deny('Embed tokens are not configured.', 500);
    }
    return deny('A valid embed token is required.', 401);
  }

  const origins = normalizeEmbedOrigins(result.payload.origins);
  if (!origins.length) {
    return deny('The embed token has no allowed origins.', 401);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-peak-embed-origins', origins.join(','));
  requestHeaders.set('x-peak-embed-partner', result.payload.partnerId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildFrameAncestors(origins));
  for (const [name, value] of Object.entries(EMBED_HEADERS)) response.headers.set(name, value);
  return response;
}
