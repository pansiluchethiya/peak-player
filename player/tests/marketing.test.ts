import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const allStyles = [
  'tokens.css', 'reset.css', 'base.css', 'chrome.css', 'chrome-2.css', 'chrome-3.css',
  'chrome-4.css', 'player.css', 'player-stage.css', 'player-feedback.css',
  'player-2.css', 'player-3.css', 'marketing.css',
  'embed.css', 'embed-2.css', 'landing.css', 'landing-2.css', 'landing-3.css',
  'landing-4.css', 'landing-5.css', 'landing-6.css', 'landing-7.css', 'landing-8.css',
  'landing-9.css', 'landing-10.css', 'landing-11.css', 'landing-12.css', 'landing-13.css',
  'landing-14.css', 'theme.css',
].map((f) => readFileSync(new URL(`../src/styles/${f}`, import.meta.url), 'utf8')).join('\n');
const player = readFileSync(new URL('../src/components/player/PlayerRoot.tsx', import.meta.url), 'utf8');

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

  it('defines Vercel monochrome tokens and removes the retired Peak palette', () => {
    assert.match(css, /--color-accent/);
    assert.match(css, /--color-fg/);
    assert.match(css, /--color-muted/);
    assert.match(css, /--color-border/);
    assert.match(css, /--color-bg/);
    assert.match(css, /--color-success/);
    assert.match(css, /--color-error/);
    assert.match(css, /--font-sans/);
    assert.match(css, /--font-mono/);
    assert.match(css, /--peak-max/);
    assert.match(css, /--peak-ease/);
    assert.match(css, /data-theme/);
    assert.doesNotMatch(css, /#e50914/i);
    assert.doesNotMatch(css, /#0070f3/i);
    assert.doesNotMatch(css, /#0c4a34/i);
    assert.doesNotMatch(css, /#c9f26d/i);
    assert.doesNotMatch(css, /--peak-forest|--peak-ink\b|--peak-ivory|--peak-amber\b|--peak-lime\b|--peak-line\b|--peak-surface|#1b5c42|#163f30|#05060a|#f5f6fb|#030a07|#07130f|#f2efe6/i);
    assert.match(allStyles, /prefers-reduced-motion/);
    assert.doesNotMatch(
      allStyles,
      /#05060a|#f5f6fb|#0c4a34|#1b5c42|#163f30|#030a07|#c9f26d|#d69e2d|#f2efe6|#07130f|#1b3027|#0c1b16|#040908|#050c09|#06100c|#040a08|#0a1712|#13231d|#07100d|#030706|#1a2f25|#d9e7dc|#d7e7dd|#f0b8a8|#0070f3/i
    );
  });

  it('loads the Geist display and UI faces from next/font/google', () => {
    assert.match(layout, /Geist/);
    assert.match(layout, /Geist_Mono/);
    assert.match(layout, /variable:/);
    assert.match(layout, /--font-sans/);
    assert.match(layout, /--font-mono/);
    assert.match(layout, /data-theme/);
    assert.match(layout, /suppressHydrationWarning/);
  });
});
