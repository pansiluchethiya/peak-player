(function (global) {
  'use strict';

  var CHANNEL = 'peak-player';
  var VERSION = '1.0.0';

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

  function mount(options) {
    options = options || {};
    var target = resolveTarget(options.target);
    if (!options.url) throw new Error('PeakEmbed: url is required');

    var origin = parseOrigin(options.url);
    var iframe = document.createElement('iframe');
    iframe.src = options.url;
    iframe.title = options.title || 'Peak player';
    iframe.allow = options.allow || 'autoplay; fullscreen; picture-in-picture; encrypted-media';
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
      if (!data || data.channel !== CHANNEL || data.type !== 'event') return;
      var handlers = listeners[data.event];
      if (!handlers) return;
      handlers.slice().forEach(function (handler) {
        try {
          handler(data.payload, data);
        } catch (error) {
          setTimeout(function () {
            throw error;
          }, 0);
        }
      });
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
        listeners[event] = listeners[event].filter(function (item) {
          return item !== handler;
        });
        return api;
      },
      play: function () {
        return send('play');
      },
      pause: function () {
        return send('pause');
      },
      seek: function (seconds) {
        return send('seek', Number(seconds));
      },
      setVolume: function (value) {
        return send('setVolume', Number(value));
      },
      setSubtitle: function (value) {
        return send('setSubtitle', value);
      },
      setQuality: function (value) {
        return send('setQuality', String(value));
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        global.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        listeners = Object.create(null);
      },
      get element() {
        return iframe;
      },
      get origin() {
        return origin;
      },
    };

    return api;
  }

  global.PeakEmbed = { mount: mount, version: VERSION };
})(window);
