import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('vendored skin', () => {
  it('wraps the generated entry', () => {
    assert.match(readFileSync('src/components/player/VideoSkin.tsx', 'utf8'), /videojs\/video\/skin/);
  });
  it('binds AMOLED tokens', () => {
    const css = readFileSync('src/styles/skin.css', 'utf8');
    assert.match(css, /--media-accent-color:\s*var\(--color-accent\)/);
    assert.match(css, /--media-border-color:\s*var\(--color-border\)/);
  });
});
