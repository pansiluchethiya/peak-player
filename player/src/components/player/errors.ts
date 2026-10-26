export type PlayerErrorCode =
  | 'NOT_READY'
  | 'UNSUPPORTED'
  | 'INVALID_ARGUMENT'
  | 'STREAM_UNAVAILABLE'
  | 'TOKEN_EXPIRED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export class PeakPlayerError extends Error {
  readonly code: PlayerErrorCode;

  constructor(code: PlayerErrorCode, message: string) {
    super(message);
    this.name = 'PeakPlayerError';
    this.code = code;
  }
}

/**
 * Normalises anything thrown by the player into a typed `PeakPlayerError`.
 * Existing player errors are preserved so callers can branch on their code.
 */
export function toPlayerError(error: unknown): PeakPlayerError {
  if (error instanceof PeakPlayerError) return error;
  return new PeakPlayerError('UNKNOWN', error instanceof Error ? error.message : String(error));
}
