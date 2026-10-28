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
  | 'INVALID_PAYLOAD'
  | 'EXPIRED'
  | 'SECRET_MISSING';

export type EmbedTokenResult =
  | { ok: true; payload: EmbedTokenPayload }
  | { ok: false; error: EmbedTokenError; payload?: EmbedTokenPayload };

interface VerifyOptions {
  secret?: string;
  now?: number;
}

const TOKEN_VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const keyCache = new Map<string, Promise<CryptoKey>>();

function tokenSecret(options: VerifyOptions): string {
  return String(options.secret ?? process.env.EMBED_TOKEN_SECRET ?? '').trim();
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const imported = crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  keyCache.set(secret, imported);
  return imported;
}

function isPayload(value: unknown): value is EmbedTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<EmbedTokenPayload>;
  if (payload.v !== 1) return false;
  if (typeof payload.partnerId !== 'string' || !payload.partnerId) return false;
  if (typeof payload.type !== 'string' || !payload.type) return false;
  if (typeof payload.id !== 'string' || !payload.id) return false;
  if (!Array.isArray(payload.origins)) return false;
  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return false;
  return true;
}

export async function verifyEmbedToken(
  token: string | null | undefined,
  options: VerifyOptions = {},
): Promise<EmbedTokenResult> {
  if (!token || typeof token !== 'string') return { ok: false, error: 'MISSING_TOKEN' };

  const secret = tokenSecret(options);
  if (!secret) return { ok: false, error: 'SECRET_MISSING' };

  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, error: 'INVALID_TOKEN' };
  const [version, ivPart, cipherPart, tagPart] = parts;
  if (version !== TOKEN_VERSION || !ivPart || !cipherPart || !tagPart) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  const iv = base64UrlToBytes(ivPart);
  const ciphertext = base64UrlToBytes(cipherPart);
  const tag = base64UrlToBytes(tagPart);
  if (!iv || !ciphertext || !tag) return { ok: false, error: 'INVALID_TOKEN' };
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  const combined = new Uint8Array(new ArrayBuffer(ciphertext.length + tag.length));
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  let plaintext: ArrayBuffer;
  try {
    const key = await importKey(secret);
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      combined,
    );
  } catch {
    return { ok: false, error: 'INVALID_SIGNATURE' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return { ok: false, error: 'INVALID_PAYLOAD' };
  }
  if (!isPayload(parsed)) return { ok: false, error: 'INVALID_PAYLOAD' };

  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  if (parsed.exp * 1000 <= now) return { ok: false, error: 'EXPIRED', payload: parsed };

  return { ok: true, payload: parsed };
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
