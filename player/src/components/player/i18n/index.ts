import { messages } from './messages.en';

export { messages };

export type MessageKey = keyof typeof messages;

const PLACEHOLDER = /\{([^}]+)\}/g;

/**
 * Returns a catalogue entry, interpolating `{name}` placeholders from `params`.
 * Unknown placeholders are left untouched so a missing value is visible rather
 * than silently blanked.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template: string = messages[key];
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match: string, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}
