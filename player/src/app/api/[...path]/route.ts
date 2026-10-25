import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function apiBase(): string {
  return (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

function shouldPassthroughSSE(target: string): boolean {
  const suffix = target.split('/').pop() || '';
  return suffix.includes('events');
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const suffix = path.map((segment) => encodeURIComponent(segment)).join('/');
  const target = `${apiBase()}/api/${suffix}${request.nextUrl.search}`;

  const headers = new Headers();
  const range = request.headers.get('range');
  if (range) headers.set('range', range);
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: 'API is unreachable' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'connection',
  ];
  for (const name of passthroughHeaders) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  if (shouldPassthroughSSE(target)) {
    responseHeaders.set('content-type', 'text/event-stream');
    responseHeaders.set('cache-control', 'no-cache');
    responseHeaders.set('connection', 'keep-alive');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');
  }

  responseHeaders.set('access-control-allow-origin', '*');

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
