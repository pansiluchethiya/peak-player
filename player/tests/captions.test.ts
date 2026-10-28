import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeCues, parseSubtitles, parseWebVtt } from '../src/lib/webvtt';

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

const srt = `1
00:00:01,000 --> 00:00:03,500
Hello from SRT

2
00:01:02,250 --> 00:01:04,000
Second cue
with two lines`;

describe('SubRip', () => {
  it('normalises SRT timestamps and cue indices', () => {
    const cues = parseSubtitles(srt);
    assert.deepEqual(cues.map((c) => c.text), ['Hello from SRT', 'Second cue\nwith two lines']);
    assert.deepEqual(cues.map((c) => c.start), [1, 62.25]);
    assert.deepEqual(cues.map((c) => c.end), [3.5, 64]);
  });
  it('still parses WebVTT input', () => {
    assert.equal(parseSubtitles(vtt).length, 2);
  });
});
