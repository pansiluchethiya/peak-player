import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const allStyles = [
  'tokens.css', 'reset.css', 'base.css', 'chrome.css', 'chrome-2.css', 'chrome-3.css',
  'chrome-4.css', 'player.css', 'player-2.css', 'player-3.css', 'marketing.css',
  'embed.css', 'embed-2.css', 'landing.css', 'landing-2.css', 'landing-3.css',
  'landing-4.css', 'landing-5.css', 'landing-6.css', 'landing-7.css', 'landing-8.css',
  'landing-9.css', 'landing-10.css', 'landing-11.css', 'landing-12.css', 'landing-13.css',
  'landing-14.css', 'theme.css',
].map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8')).join('\n');
const player = readFileSync(new URL('../src/components/Player.tsx', import.meta.url), 'utf8');

describe('embed landing page', () => {
  it('presents the Peak player, signed embed flow, and quick start', () => {
    assert.match(page, /Peak/);
    assert.match(page, /embed/i);
    assert.match(page, /PeakEmbed\.mount/);
    assert.match(page, /\/api\/v1\/embed\/sessions/);
    assert.match(page, /x-api-key/i);
    assert.match(page, /short-lived|signed/i);
  });

  it('includes the full landing narrative', () => {
    const required = [
      'Source health',
      'Failover',
      'Signed URLs',
      'Partner auth',
      'frame-ancestors',
      'Provider',
      'Live TV',
      'Docs',
      'FAQ',
      'Status',
    ];
    for (const phrase of required) {
      assert.match(page, new RegExp(phrase, 'i'), `missing landing section: ${phrase}`);
    }
  });

  it('keeps Magic UI marketing imports out of the player chrome', () => {
    assert.match(page, /@\/components\/marketing\//);
    assert.doesNotMatch(player, /components\/marketing/);
  });

  it('defines Peak design tokens and removes the Netflix red fallback', () => {
    assert.match(css, /--peak-forest/);
    assert.match(css, /--peak-ink/);
    assert.match(css, /--peak-ivory/);
    assert.match(css, /--peak-amber/);
    assert.doesNotMatch(css, /#e50914/i);
    assert.match(allStyles, /prefers-reduced-motion/);
  });

  it('loads the display and UI faces from next/font/google', () => {
    assert.match(layout, /Bricolage_Grotesque/);
    assert.match(layout, /DM_Sans/);
    assert.match(layout, /variable:/);
  });
});
