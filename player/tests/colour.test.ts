import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFilterString } from '../src/components/player/colour/CssFilterPipeline';
import { COLOUR_PRESETS, getColourPreset } from '../src/components/player/colour/presets';

describe('buildFilterString', () => {
  it('serialises numeric filters as CSS functions', () => {
    assert.equal(buildFilterString({ contrast: 1.2, brightness: 0.9 }), 'contrast(1.2) brightness(0.9)');
  });

  it('converts camelCase keys to kebab-case CSS functions', () => {
    assert.equal(buildFilterString({ hueRotate: 15 }), 'hue-rotate(15deg)');
  });

  it('builds every preset into a valid filter declaration', () => {
    assert.equal(
      buildFilterString(getColourPreset('warm').filters),
      'contrast(1.05) sepia(0.25) hue-rotate(15deg) saturate(1.1)',
    );
  });

  it('keeps every preset valid for the CSS filter property', () => {
    for (const preset of COLOUR_PRESETS) {
      const filter = buildFilterString(preset.filters);
      assert.doesNotMatch(filter, /[A-Z]/, `${preset.id} contains a camelCase function`);
      assert.equal(getColourPreset(preset.id).id, preset.id);
    }
  });
});
