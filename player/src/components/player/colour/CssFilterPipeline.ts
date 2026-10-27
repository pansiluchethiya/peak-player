/**
 * CSS filter pipeline (spec §6.4).
 *
 * Applies a `ColourPreset`'s filter values to a video element via a single
 * `filter` property string. The GL pipeline (`WebGlPipeline`) is a future
 * fallback for devices that ban CSS filters in favour of a canvas shader.
 */

import { getColourPreset, type ColourPreset, type PresetId } from './presets';

export function buildFilterString(filters: Record<string, number | string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(filters)) {
    parts.push(`${key}(${value}${typeof value === 'number' ? '' : ''})`);
  }
  return parts.join(' ');
}

export class CssFilterPipeline {
  private element: HTMLVideoElement | HTMLElement;
  private preset: ColourPreset;

  constructor(element: HTMLVideoElement | HTMLElement, preset: PresetId | ColourPreset = 'standard') {
    this.element = element;
    this.preset = typeof preset === 'string' ? getColourPreset(preset) : preset;
    this.apply(this.preset);
  }

  apply(preset: PresetId | ColourPreset): void {
    this.preset = typeof preset === 'string' ? getColourPreset(preset) : preset;
    this.element.style.filter = buildFilterString(this.preset.filters);
  }

  get active(): ColourPreset {
    return this.preset;
  }

  dispose(): void {
    this.element.style.filter = '';
  }
}
