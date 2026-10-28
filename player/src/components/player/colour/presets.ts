/**
 * Colour correction presets (spec §6.4).
 *
 * Each preset maps to a set of CSS filter values applied to the video
 * element through `CssFilterPipeline`. AMOLED: monochrome, so every preset
 * leans on a grayscale base with a tuned brightness/contrast lift.
 */

export interface ColourPreset {
  id: string;
  label: string;
  filters: Record<string, number | string>;
}

export type PresetId =
  | 'standard'
  | 'warm'
  | 'cool'
  | 'cinema'
  | 'dark'
  | 'bright'
  | 'high-contrast';

export const COLOUR_PRESETS: ColourPreset[] = [
  {
    id: 'standard',
    label: 'Standard',
    filters: { contrast: 1.05, saturate: 1, brightness: 1.02 },
  },
  {
    id: 'warm',
    label: 'Warm',
    filters: { contrast: 1.05, sepia: 0.25, hueRotate: 15, saturate: 1.1 },
  },
  {
    id: 'cool',
    label: 'Cool',
    filters: { contrast: 1.05, hueRotate: -15, saturate: 0.9, brightness: 0.98 },
  },
  {
    id: 'cinema',
    label: 'Cinema',
    filters: { contrast: 1.2, brightness: 0.9, saturate: 0.8, sepia: 0.1 },
  },
  {
    id: 'dark',
    label: 'Dark',
    filters: { contrast: 1.1, brightness: 0.82, saturate: 0.95 },
  },
  {
    id: 'bright',
    label: 'Bright',
    filters: { contrast: 1.0, brightness: 1.18, saturate: 1 },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    filters: { contrast: 1.4, brightness: 0.88, saturate: 0.9 },
  },
];

export const DEFAULT_COLOUR_PRESET: PresetId = 'standard';

export function getColourPreset(id?: string | null): ColourPreset {
  return COLOUR_PRESETS.find((preset) => preset.id === id) ?? COLOUR_PRESETS[0];
}
