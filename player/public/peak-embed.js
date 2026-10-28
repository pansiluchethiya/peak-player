(function (global) {
  'use strict';

  var CHANNEL = 'peak-player';
  var VERSION = 2;
  var REQUEST_TIMEOUT_MS = 10000;

  function resolveTarget(target) {
    if (typeof target === 'string') {
      var element = document.querySelector(target);
      if (!element) throw new Error('PeakEmbed: target element was not found');
      return element;
    }
    if (target && target.nodeType === 1) return target;
    throw new Error('PeakEmbed: target must be an element or selector');
  }

  function parseOrigin(url) {
    var parsed;
    try {
      parsed = new URL(url, global.location.href);
    } catch (error) {
      throw new Error('PeakEmbed: url must be a valid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('PeakEmbed: url must use HTTP or HTTPS');
    }
    return parsed.origin;
  }

  var REQUEST_COMMANDS = {
    togglePlay: ['togglePlay'],
    seek: ['seek'],
    setVolume: ['setVolume'],
    setMuted: ['setMuted'],
    setBoost: ['setBoost'],
    unlockBoost: ['unlockBoost'],
    setSpeed: ['setSpeed'],
    setQuality: ['setQuality'],
    setAudioTrack: ['setAudioTrack'],
    setCaptions: ['setCaptions'],
    setColourPreset: ['setColourPreset'],
    setAspect: ['setAspect'],
    switchServer: ['switchServer'],
  };

  function generateId() {
    return 'req_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
  }

  function createError(code, message) {
    var err = new Error(message || code);
    err.code = code;
    return err;
  }

  // ---- v1 mount (synchronous command API) ----

  function mountV1(options) {
    options = options || {};
    var target = resolveTarget(options.target);
    if (!options.url) throw new Error('PeakEmbed: url is required');

    var origin = parseOrigin(options.url);
    var iframe = document.createElement('iframe');
    iframe.src = options.url;
    iframe.title = options.title || 'Peak player';
    iframe.allow = options.allow || 'autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write';
    iframe.allowFullscreen = true;
    iframe.loading = options.loading || 'lazy';
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '100%';
    iframe.style.border = '0';
    iframe.setAttribute('data-peak-embed', '');

    var listeners = Object.create(null);
    var destroyed = false;

    function onMessage(event) {
      if (destroyed || event.source !== iframe.contentWindow || event.origin !== origin) return;
      var data = event.data;
      if (!data || data.channel !== CHANNEL) return;
      if (data.type === 'event') {
        var handlers = listeners[data.event];
        if (!handlers) return;
        handlers.slice().forEach(function (handler) {
          try { handler(data.payload, data); } catch (error) { setTimeout(function () { throw error; }, 0); }
        });
      }
    }

    global.addEventListener('message', onMessage);
    target.appendChild(iframe);

    function send(command, value) {
      if (destroyed || !iframe.contentWindow) return false;
      var message = { channel: CHANNEL, type: 'command', command: command };
      if (value !== undefined) message.value = value;
      iframe.contentWindow.postMessage(message, origin);
      return true;
    }

    var api = {
      on: function (event, handler) {
        if (typeof handler !== 'function') return api;
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
        return api;
      },
      off: function (event, handler) {
        if (!listeners[event]) return api;
        listeners[event] = listeners[event].filter(function (item) { return item !== handler; });
        return api;
      },
      play: function () { return send('play'); },
      pause: function () { return send('pause'); },
      seek: function (seconds) { return send('seek', Number(seconds)); },
      setVolume: function (value) { return send('setVolume', Number(value)); },
      setSubtitle: function (value) { return send('setSubtitle', value); },
      setQuality: function (value) { return send('setQuality', String(value)); },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        global.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        listeners = Object.create(null);
      },
      get element() { return iframe; },
      get origin() { return origin; },
    };

    return api;
  }

  // ---- v2 mount (promise-based request API) ----

  function mountV2(options) {
    options = options || {};
    var target = resolveTarget(options.target);
    if (!options.url) throw new Error('PeakEmbed: url is required');

    var origin = parseOrigin(options.url);
    var iframe = document.createElement('iframe');
    iframe.src = options.url;
    iframe.title = options.title || 'Peak player';
    iframe.allow = options.allow || 'autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write';
    iframe.allowFullscreen = true;
    iframe.loading = options.loading || 'lazy';
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '100%';
    iframe.style.border = '0';
    iframe.setAttribute('data-peak-embed', '');
    iframe.setAttribute('data-peak-v2', '');

    var listeners = Object.create(null);
    var pending = Object.create(null);
    var destroyed = false;

    function onMessage(event) {
      if (destroyed || event.source !== iframe.contentWindow || event.origin !== origin) return;
      var data = event.data;
      if (!data || data.channel !== CHANNEL) return;

      // v2 response
      if (data.type === 'response') {
        var cb = pending[data.id];
        if (!cb) return;
        clearTimeout(cb.timeout);
        delete pending[data.id];
        if (data.ok) {
          cb.resolve(data.result === undefined ? true : data.result);
        } else {
          var err = createError((data.error && data.error.code) || 'UNKNOWN', (data.error && data.error.message) || 'Request failed');
          cb.reject(err);
        }
        return;
      }

      // v2 event
      if (data.type === 'event') {
        var handlers = listeners[data.event];
        if (!handlers) return;
        handlers.slice().forEach(function (handler) {
          try { handler(data.payload, data); } catch (error) { setTimeout(function () { throw error; }, 0); }
        });
      }
    }

    global.addEventListener('message', onMessage);
    target.appendChild(iframe);

    function sendRequest(command, value) {
      if (destroyed || !iframe.contentWindow) {
        return Promise.reject(createError('NOT_READY', 'Player is not ready'));
      }
      var id = generateId();
      var message = { channel: CHANNEL, type: 'request', id: id, command: command };
      if (value !== undefined) message.value = value;
      iframe.contentWindow.postMessage(message, origin);
      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () {
          if (pending[id]) {
            delete pending[id];
            reject(createError('NOT_READY', 'Player did not respond in time'));
          }
        }, REQUEST_TIMEOUT_MS);
        pending[id] = { resolve: resolve, reject: reject, timeout: timeout };
      });
    }

    function rejectAll(message) {
      var keys = Object.keys(pending);
      for (var i = 0; i < keys.length; i += 1) {
        var cb = pending[keys[i]];
        clearTimeout(cb.timeout);
        cb.reject(message);
      }
      pending = Object.create(null);
    }

    var api = {
      on: function (event, handler) {
        if (typeof handler !== 'function') return api;
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
        return api;
      },
      off: function (event, handler) {
        if (!listeners[event]) return api;
        listeners[event] = listeners[event].filter(function (item) { return item !== handler; });
        return api;
      },
      play: function () { return sendRequest('play'); },
      pause: function () { return sendRequest('pause'); },
      seek: function (seconds) { return sendRequest('seek', Number(seconds)); },
      seekBy: function (delta) { return sendRequest('seekBy', Number(delta)); },
      setVolume: function (value) { return sendRequest('setVolume', Number(value)); },
      setMuted: function (value) { return sendRequest('setMuted', Boolean(value)); },
      setBoost: function (value) { return sendRequest('setBoost', Number(value)); },
      unlockBoost: function (value) { return sendRequest('unlockBoost', Boolean(value)); },
      setSpeed: function (value) { return sendRequest('setSpeed', Number(value)); },
      setQuality: function (value) { return sendRequest('setQuality', String(value)); },
      setAudioTrack: function (id) { return sendRequest('setAudioTrack', String(id)); },
      setCaptions: function (options) { return sendRequest('setCaptions', options); },
      setColourPreset: function (value) { return sendRequest('setColourPreset', String(value)); },
      setAspect: function (value) { return sendRequest('setAspect', String(value)); },
      switchServer: function (codename) { return sendRequest('switchServer', String(codename)); },
      nextEpisode: function () { return sendRequest('nextEpisode'); },
      previousEpisode: function () { return sendRequest('previousEpisode'); },
      goToLive: function () { return sendRequest('goToLive'); },
      requestFullscreen: function () { return sendRequest('requestFullscreen'); },
      exitFullscreen: function () { return sendRequest('exitFullscreen'); },
      requestPictureInPicture: function () { return sendRequest('requestPictureInPicture'); },
      snapshot: function () { return sendRequest('snapshot'); },
      getShareLink: function () { return sendRequest('getShareLink'); },
      copyEmbedLink: function () { return sendRequest('copyEmbedLink'); },
      getState: function () { return sendRequest('getState'); },
      getPreferences: function () { return sendRequest('getPreferences'); },
      setPreferences: function (patch) { return sendRequest('setPreferences', patch); },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        rejectAll(createError('NOT_READY', 'Player was destroyed'));
        global.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        listeners = Object.create(null);
      },
      get element() { return iframe; },
      get origin() { return origin; },
    };

    return api;
  }

  global.PeakEmbedError = createError;
  global.PeakEmbed = { version: VERSION, mount: mountV1, v2: { version: VERSION, mount: mountV2 } };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
