import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');

describe('single player root', () => {
  it('deletes both legacy players and their orphaned chrome', () => {
    for (const p of ['VideoJsPlayer.tsx', 'Player.tsx', 'ControlBar.tsx', 'SettingsMenu.tsx', 'MobilePlayerControls.tsx', 'PlayerHeader.tsx', 'ProgressBar.tsx', 'ThumbnailPreview.tsx']) {
      assert.equal(existsSync(`src/components/${p}`), false, p);
    }
  });
  it('routes every surface through PlayerRoot', () => {
    for (const p of ['src/app/movie/[id]/page.tsx', 'src/app/tv/[id]/[season]/[episode]/page.tsx', 'src/app/live/[id]/page.tsx']) {
      assert.match(read(p), /PlayerRoot/);
      assert.doesNotMatch(read(p), /VideoJsPlayer|from '@\/components\/Player'/);
    }
  });
  it('exposes presets', () => {
    assert.match(read('src/components/player/PlayerRoot.tsx'), /'video' \| 'live-video' \| 'bg'/);
  });
  it('makes the background preset chrome-free, muted, looping, and autoplaying', () => {
    const root = read('src/components/player/PlayerRoot.tsx');
    assert.match(root, /autoPlay/);
    assert.match(root, /loop/);
    assert.match(root, /controls=\{false\}/);
    assert.match(root, /muted/);
  });
});
