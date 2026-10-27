import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmbedEvent,
  createEmbedEventV2,
  isAllowedOrigin,
  parseEmbedCommand,
  parseEmbedRequest,
  postToParent,
} from '../src/lib/embedBridge';

describe('embed bridge events', () => {
  it('creates namespaced events without source URLs', () => {
    assert.deepEqual(createEmbedEvent('timeupdate', { currentTime: 12.5, duration: 100 }), {
      channel: 'peak-player',
      type: 'event',
      event: 'timeupdate',
      payload: { currentTime: 12.5, duration: 100 },
    });

    assert.deepEqual(createEmbedEvent('sourcechange', { index: 1, quality: '1080p', provider: 'alpha' }), {
      channel: 'peak-player',
      type: 'event',
      event: 'sourcechange',
      payload: { index: 1, quality: '1080p', provider: 'alpha' },
    });
  });

  it('accepts valid playback commands', () => {
    assert.deepEqual(parseEmbedCommand({ channel: 'peak-player', type: 'command', command: 'play' }), {
      ok: true,
      command: 'play',
    });
    assert.deepEqual(
      parseEmbedCommand({ channel: 'peak-player', type: 'command', command: 'seek', value: 42.5 }),
      { ok: true, command: 'seek', value: 42.5 },
    );
    assert.deepEqual(
      parseEmbedCommand({ channel: 'peak-player', type: 'command', command: 'setVolume', value: 0.4 }),
      { ok: true, command: 'setVolume', value: 0.4 },
    );
    assert.deepEqual(
      parseEmbedCommand({ channel: 'peak-player', type: 'command', command: 'setSubtitle', value: 2 }),
      { ok: true, command: 'setSubtitle', value: 2 },
    );
    assert.deepEqual(
      parseEmbedCommand({ channel: 'peak-player', type: 'command', command: 'setQuality', value: 'source:1' }),
      { ok: true, command: 'setQuality', value: 'source:1' },
    );
  });

  it('rejects malformed or out-of-range commands', () => {
    const invalid = [
      null,
      {},
      { channel: 'other', type: 'command', command: 'play' },
      { channel: 'peak-player', type: 'event', event: 'play' },
      { channel: 'peak-player', type: 'command', command: 'explode' },
      { channel: 'peak-player', type: 'command', command: 'seek', value: -1 },
      { channel: 'peak-player', type: 'command', command: 'seek', value: 'soon' },
      { channel: 'peak-player', type: 'command', command: 'setVolume', value: 2 },
      { channel: 'peak-player', type: 'command', command: 'setSubtitle', value: 1.5 },
      { channel: 'peak-player', type: 'command', command: 'setQuality', value: '' },
    ];

    for (const message of invalid) {
      const result = parseEmbedCommand(message);
      assert.equal(result.ok, false, JSON.stringify(message));
    }
  });

  it('only accepts exact allowlisted origins', () => {
    const origins = ['https://partner.example', 'http://localhost:3000'];

    assert.equal(isAllowedOrigin('https://partner.example', origins), true);
    assert.equal(isAllowedOrigin('http://localhost:3000', origins), true);
    assert.equal(isAllowedOrigin('https://evil.example', origins), false);
    assert.equal(isAllowedOrigin('https://partner.example.evil.test', origins), false);
    assert.equal(isAllowedOrigin('null', origins), false);
    assert.equal(isAllowedOrigin('https://partner.example', ['*']), false);
  });

  it('posts to an exact parent origin and never to a wildcard', () => {
    const calls: unknown[][] = [];
    const target = {
      postMessage: (...args: unknown[]) => {
        calls.push(args);
      },
    } as unknown as Window;

    assert.equal(postToParent(target, 'https://partner.example', createEmbedEvent('ready')), true);
    assert.deepEqual(calls, [
      [
        { channel: 'peak-player', type: 'event', event: 'ready' },
        'https://partner.example',
      ],
    ]);

    assert.equal(postToParent(target, '*', createEmbedEvent('ready')), false);
    assert.equal(postToParent(null, 'https://partner.example', createEmbedEvent('ready')), false);
  });

  it('parses v2 request envelopes', () => {
    assert.deepEqual(
      parseEmbedRequest({ channel: 'peak-player', type: 'request', id: 'req_1', command: 'getState' }),
      { channel: 'peak-player', type: 'request', id: 'req_1', command: 'getState' },
    );
    assert.equal(
      parseEmbedRequest({ channel: 'peak-player', type: 'request', id: 'req_2', command: 'explode' }),
      null,
    );
    assert.equal(
      parseEmbedRequest({ channel: 'peak-player', type: 'command', id: 'req_3', command: 'play' }),
      null,
    );
  });

  it('creates v2 events with version and timestamp', () => {
    const event = createEmbedEventV2('ready', { title: 'Test' });
    assert.equal(event.channel, 'peak-player');
    assert.equal(event.type, 'event');
    assert.equal(event.version, 2);
    assert.equal(typeof event.timestamp, 'number');
    assert.equal(event.event, 'ready');
    assert.deepEqual(event.payload, { title: 'Test' });
  });
});
