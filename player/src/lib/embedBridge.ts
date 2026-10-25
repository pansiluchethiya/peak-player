import { normalizeEmbedOrigins } from './embedToken';

export const EMBED_CHANNEL = 'peak-player';

export type EmbedEventName =
  | 'ready'
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'sourcechange'
  | 'error';

export type EmbedCommandName =
  | 'play'
  | 'pause'
  | 'seek'
  | 'setVolume'
  | 'setSubtitle'
  | 'setQuality';

export type EmbedEventPayload = Record<string, unknown>;

export interface EmbedEventMessage {
  channel: typeof EMBED_CHANNEL;
  type: 'event';
  event: EmbedEventName;
  payload?: EmbedEventPayload;
}

export interface EmbedCommandMessage {
  channel: typeof EMBED_CHANNEL;
  type: 'command';
  command: EmbedCommandName;
  value?: number | string;
}

export type EmbedCommandResult =
  | { ok: true; command: EmbedCommandName; value?: number | string }
  | { ok: false; error: 'INVALID_COMMAND' };

const COMMANDS = new Set<EmbedCommandName>([
  'play',
  'pause',
  'seek',
  'setVolume',
  'setSubtitle',
  'setQuality',
]);

export function createEmbedEvent(
  event: EmbedEventName,
  payload?: EmbedEventPayload,
): EmbedEventMessage {
  const message: EmbedEventMessage = { channel: EMBED_CHANNEL, type: 'event', event };
  if (payload !== undefined) message.payload = payload;
  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseEmbedCommand(data: unknown): EmbedCommandResult {
  if (!isRecord(data)) return { ok: false, error: 'INVALID_COMMAND' };
  if (data.channel !== EMBED_CHANNEL || data.type !== 'command') {
    return { ok: false, error: 'INVALID_COMMAND' };
  }
  if (typeof data.command !== 'string' || !COMMANDS.has(data.command as EmbedCommandName)) {
    return { ok: false, error: 'INVALID_COMMAND' };
  }

  const command = data.command as EmbedCommandName;
  const value = data.value;

  if (command === 'play' || command === 'pause') {
    return { ok: true, command };
  }

  if (command === 'seek') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: 'INVALID_COMMAND' };
    }
    return { ok: true, command, value };
  }

  if (command === 'setVolume') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return { ok: false, error: 'INVALID_COMMAND' };
    }
    return { ok: true, command, value };
  }

  if (command === 'setSubtitle') {
    const validNumber = typeof value === 'number' && Number.isInteger(value) && value >= -1;
    const validString = typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
    if (!validNumber && !validString) return { ok: false, error: 'INVALID_COMMAND' };
    return { ok: true, command, value };
  }

  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) {
    return { ok: false, error: 'INVALID_COMMAND' };
  }
  return { ok: true, command, value };
}

export function isAllowedOrigin(origin: string, origins: unknown): boolean {
  if (!origin || origin === '*' || origin === 'null') return false;
  return normalizeEmbedOrigins(origins).includes(origin);
}

export function postToParent(
  target: Window | null,
  origin: string,
  message: EmbedEventMessage,
): boolean {
  if (!target || typeof target.postMessage !== 'function') return false;
  const [safeOrigin] = normalizeEmbedOrigins([origin]);
  if (!safeOrigin) return false;
  target.postMessage(message, safeOrigin);
  return true;
}
