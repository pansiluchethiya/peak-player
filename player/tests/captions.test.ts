import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeCues, parseWebVtt } from '../src/lib/webvtt';

const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello

00:00:02.500 --> 00:00:04.000
World`;

describe('WebVTT', () => {
  it('parses cues', () => {
    assert.deepEqual(parseWebVtt(vtt).map((c) => c.text), ['Hello', 'World']);
  });
  it('returns overlapping cues', () => {
    assert.deepEqual(activeCues(parseWebVtt(vtt), 2.7).map((c) => c.text), ['Hello', 'World']);
    assert.deepEqual(activeCues(parseWebVtt(vtt), 4.1), []);
  });
});
