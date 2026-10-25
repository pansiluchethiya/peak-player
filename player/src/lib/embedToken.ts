export interface EmbedTokenPayload {
  v: 1;
  partnerId: string;
  type: string;
  id: string;
  season?: number;
  episode?: number;
  origins: string[];
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export type EmbedTokenError =
  | 'MISSING_TOKEN'
  | 'INVALID_TOKEN'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'SECRET_MISSING';

export type EmbedTokenResult =
  | { ok: true; payload: EmbedTokenPayload }
  | { ok: false; error: EmbedTokenError; payload?: EmbedTokenPayload };

interface VerifyOptions {
  secret?: string;
  now?: number;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function tokenSecret(options: VerifyOptions): string {
  return String(options.secret ?? process.env.EMBED_TOKEN_SECRET ?? '').trim();
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function importKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const imported = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  keyCache.set(secret, imported);
  return imported;
}

function parsePayload(encoded: string): EmbedTokenPayload | null {
  const bytes = base64UrlToBytes(encoded);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const payload = parsed as Partial<EmbedTokenPayload>;
    if (payload.v !== 1) return null;
    if (typeof payload.partnerId !== 'string' || !payload.partnerId) return null;
    if (typeof payload.type !== 'string' || !payload.type) return null;
    if (typeof payload.id !== 'string' || !payload.id) return null;
    if (!Array.isArray(payload.origins)) return null;
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return null;
    return payload as EmbedTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyEmbedToken(
  token: string | null | undefined,
  options: VerifyOptions = {},
): Promise<EmbedTokenResult> {
  if (!token || typeof token !== 'string') return { ok: false, error: 'MISSING_TOKEN' };

  const secret = tokenSecret(options);
  if (!secret) return { ok: false, error: 'SECRET_MISSING' };

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  const [encoded, signature] = parts;
  const payload = parsePayload(encoded);
  if (!payload) return { ok: false, error: 'INVALID_TOKEN' };

  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  if (payload.exp * 1000 <= now) return { ok: false, error: 'EXPIRED', payload };

  const signatureBytes = base64UrlToBytes(signature);
  if (!signatureBytes) return { ok: false, error: 'INVALID_SIGNATURE' };

  try {
    const key = await importKey(secret);
    const signatureBuffer = new Uint8Array(signatureBytes).buffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      new TextEncoder().encode(encoded),
    );
    if (!valid) return { ok: false, error: 'INVALID_SIGNATURE' };
  } catch {
    return { ok: false, error: 'INVALID_SIGNATURE' };
  }

  return { ok: true, payload };
}

export function normalizeEmbedOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const origins = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const candidate = entry.trim();
    if (!candidate || candidate.includes('*')) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      if (parsed.username || parsed.password) continue;
      origins.add(parsed.origin);
    } catch {
      // Ignore malformed origins.
    }
  }
  return [...origins];
}

export function buildFrameAncestors(origins: unknown): string {
  const allowed = normalizeEmbedOrigins(origins);
  return ["frame-ancestors 'self'", ...allowed].join(' ');
}
