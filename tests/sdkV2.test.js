'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');

function loadSdk() {
  const dom = new JSDOM('<!doctype html><div id="target"></div>', { url: 'https://host.example/page', runScripts: 'dangerously' });
  const code = fs.readFileSync(path.join(__dirname, '../player/public/peak-embed.js'), 'utf8');
  dom.window.eval(code);
  return dom;
}

test('v2 mounts a promise API and advertises version 2', async () => {
  const dom = loadSdk();
  const api = dom.window.PeakEmbed.v2.mount({ target: '#target', url: 'https://player.example/embed/movie/550?token=x' });
  assert.equal(dom.window.PeakEmbed.version, 2);
  const iframe = dom.window.document.querySelector('iframe');
  const sent = [];
  iframe.contentWindow.postMessage = (message) => sent.push(message);
  const promise = api.pause();
  assert.equal(typeof promise.then, 'function');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent[0].type, 'request');
  dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'https://player.example',
    data: { channel: 'peak-player', type: 'response', id: sent[0].id, ok: false, error: { code: 'NOT_READY', message: 'not ready' } },
  }));
  await assert.rejects(promise, (error) => error.code === 'NOT_READY');
});

test('v2 resolves a successful request with the result', async () => {
  const dom = loadSdk();
  const api = dom.window.PeakEmbed.v2.mount({ target: '#target', url: 'https://player.example/embed/movie/550?token=x' });
  const iframe = dom.window.document.querySelector('iframe');
  const sent = [];
  iframe.contentWindow.postMessage = (message) => sent.push(message);
  const promise = api.getState();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent[0].type, 'request');
  assert.equal(sent[0].command, 'getState');
  dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'https://player.example',
    data: { channel: 'peak-player', type: 'response', id: sent[0].id, ok: true, result: { playing: true, currentTime: 5 } },
  }));
  const state = await promise;
  assert.equal(state.playing, true);
  assert.equal(state.currentTime, 5);
});

test('v1 methods stay synchronous', () => {
  const dom = loadSdk();
  const api = dom.window.PeakEmbed.mount({ target: '#target', url: 'https://player.example/embed/movie/550?token=x' });
  assert.equal(api.play(), true);
  assert.equal(dom.window.PeakEmbed.version, 2);
});

test('destroy rejects pending v2 requests', async () => {
  const dom = loadSdk();
  const api = dom.window.PeakEmbed.v2.mount({ target: '#target', url: 'https://player.example/embed/movie/550?token=x' });
  const promise = api.pause();
  api.destroy();
  await assert.rejects(promise, (error) => error.code === 'NOT_READY');
});
