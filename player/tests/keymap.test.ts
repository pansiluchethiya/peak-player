import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_KEYMAP, commandForKey, mergeKeymap } from '../src/lib/keymap';

describe('keymap', () => {
  it('documents the core control plane', () => {
    assert.equal(commandForKey(DEFAULT_KEYMAP, ' ')?.[0], 'togglePlay');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'k')?.[0], 'togglePlay');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'ArrowLeft')?.[0], 'seekBack');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'j')?.[0], 'seekBack');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'ArrowRight')?.[0], 'seekForward');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'l')?.[0], 'seekForward');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'm')?.[0], 'mute');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'f')?.[0], 'fullscreen');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'p')?.[0], 'pip');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'c')?.[0], 'captions');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 's')?.[0], 'speed');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'n')?.[0], 'nextEpisode');
    assert.equal(commandForKey(DEFAULT_KEYMAP, 'b')?.[0], 'previousEpisode');
    assert.equal(commandForKey(DEFAULT_KEYMAP, '?')?.[0], 'shortcuts');
  });

  it('mergeKeymap overlays custom bindings', () => {
    const resolved = mergeKeymap(DEFAULT_KEYMAP, { x: ['captions'] });
    assert.equal(commandForKey(resolved.map, 'x')?.[0], 'captions');
    assert.equal(commandForKey(resolved.map, ' ')?.[0], 'togglePlay');
  });

  it('handleKeydown returns true for mapped, false for unmapped', () => {
    const { handleKeydown } = mergeKeymap(DEFAULT_KEYMAP);
    const makeEvent = (key: string) =>
      ({ key, target: null, preventDefault: () => {}, stopPropagation: () => {} }) as unknown as KeyboardEvent;
    const mapped = makeEvent('k');
    const unmapped = makeEvent('z');
    assert.equal(handleKeydown(mapped), true);
    assert.equal(handleKeydown(unmapped), false);
  });
});
