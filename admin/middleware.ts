import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Admin auth middleware.
 *
 * Protects every `/admin` route (when accessed on :3003 directly) by checking
 * the session cookie against the Express API server's `/auth/session` endpoint.
 * The rewrite rule in `next.config.mjs` maps `/auth/session` → API server, so
 * from the browser's perspective this is same-origin.
 *
 * Skipped paths:
 *   - /login           (the sign-in page itself)
 *   - /auth/*          (proxied to API server via rewrites)
 *   - /api/*           (proxied to API server via rewrites)
 *   - /_next/static, /favicon.ico, etc. (static assets)
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, proxied routes, and static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/assets/') ||
    pathname.includes('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check session via the rewriter to the API server
  const cookie = request.headers.get('cookie') || '';
  try {
    const res = await fetch(`${API_URL}/auth/session`, {
      headers: { cookie },
      // Don't leak this internal fetch to analytics/edge logs
      next: { revalidate: 0 },
    });
    const data = await res.json().catch(() => ({ authenticated: false }));
    if (!data.authenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    // If the API server is unreachable, allow access (the pages themselves
    // will show auth errors if the session is genuinely invalid).
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except the ones handled explicitly above and static files.
     * This keeps the redirect logic out of client bundle and avoids a flash.
     */
    '/((?!_next|assets|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
