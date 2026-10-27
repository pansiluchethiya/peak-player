export interface VttCue { id: string; start: number; end: number; text: string }

function parseTimestamp(token: string): number | null {
  const m = /^(-?\d+):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(token);
  if (!m) return null;
  const sign = token.startsWith('-') ? -1 : 1;
  const h = Number(m[1]); const mi = Number(m[2]); const s = Number(m[3]);
  return sign * (h * 3600 + mi * 60 + s);
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export function parseWebVtt(input: string): VttCue[] {
  const lines = input.split(/\r?\n/);
  const cues: VttCue[] = [];
  let i = 0;
  if (i < lines.length && /^WEBVTT/i.test(lines[i])) i += 1;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i += 1;
    if (i >= lines.length) break;
    let id = '';
    const isTimestamp = /-->/.test(lines[i]);
    if (!isTimestamp) id = lines[i].trim();
    if (!isTimestamp) i += 1;
    const timing = lines[i];
    i += 1;
    const arrowIdx = timing.indexOf('-->');
    if (arrowIdx === -1) continue;
    const start = parseTimestamp(timing.slice(0, arrowIdx).trim());
    const stop = parseTimestamp(timing.slice(arrowIdx + 3).trim());
    if (start === null || stop === null) continue;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') { textLines.push(lines[i]); i += 1; }
    cues.push({ id, start, end: stop, text: stripTags(textLines.join('\n')) });
  }
  return cues;
}

export function activeCues(cues: VttCue[], time: number): VttCue[] {
  return cues.filter((c) => c.start <= time && time < c.end);
}
