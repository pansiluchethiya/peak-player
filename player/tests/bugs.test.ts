import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');
const style = (name: string) => read(`src/styles/${name}`);
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Secondary text on a surface that follows the theme (landing canvas).
const READABLE_ON_THEME = 'color-mix(in srgb, var(--color-fg) 62%, transparent)';
// Secondary text on the player's fixed near-black layers (loading/error/next).
const READABLE_ON_DARK = 'color-mix(in srgb, #ffffff 62%, transparent)';

function block(css: string, selector: string) {
  const pattern = new RegExp(`${escapeRe(selector)}[^{]*\\{([^}]*)\\}`, 's');
  const match = css.match(pattern);
  assert.ok(match, `expected a CSS rule for ${selector}`);
  return match[1];
}

describe('folded visual bugs', () => {
  it('landing canvas follows the theme background token', () => {
    const site = block(style('landing.css'), '.peak-site');
    assert.match(site, /background:[^;]*var\(--color-bg\)/s);
    assert.doesNotMatch(site, /background:[^;]*var\(--color-fg\)/s);
  });

  it('error copy is readable', () => {
    const css = style('player-2.css');
    const copy = block(css, '.error-card p');
    assert.match(copy, new RegExp(`color:\\s*${escapeRe(READABLE_ON_DARK)};`));
    assert.doesNotMatch(copy, /var\(--color-muted\)/);
    assert.doesNotMatch(css, /var\(--color-fg\) 7%/);
  });

  it('landing secondary text is readable on the themed canvas', () => {
    const css = style('landing.css');
    for (const selector of ['.peak-brand small', '.peak-nav a', '.peak-status-pill']) {
      const rule = block(css, selector);
      assert.match(
        rule,
        new RegExp(`color:\\s*${escapeRe(READABLE_ON_THEME)};`),
        `${selector} should use the readable mid-tone`,
      );
      assert.doesNotMatch(rule, /var\(--color-muted\)/, `${selector} must not use the border token`);
    }
  });

  it('the Next dev badge is disabled', () => {
    assert.match(read('next.config.mjs'), /devIndicators:\s*false/);
  });
});
