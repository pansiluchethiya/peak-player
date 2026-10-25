/* Peak theme bootstrap — runs before paint to avoid a flash of the wrong theme. */
(function () {
  'use strict';

  var STORAGE_KEY = 'peak_theme';
  var LEGACY_KEY = 'ns_theme';
  var root = document.documentElement;

  function readStored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      if (value === 'light' || value === 'dark') return value;
      var legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === 'light' || legacy === 'dark') {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        return legacy;
      }
    } catch (_) { /* storage can be unavailable */ }
    return null;
  }

  function systemTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  }

  var media = null;
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) { /* noop */ }

  function current() {
    var explicit = readStored();
    if (explicit) return explicit;
    return root.dataset.theme === 'dark' || root.dataset.theme === 'light'
      ? root.dataset.theme
      : systemTheme();
  }

  function apply(theme, persist) {
    var next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* noop */ }
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0a0a0a' : '#ffffff');
    try {
      window.dispatchEvent(new CustomEvent('peak-themechange', { detail: { theme: next } }));
    } catch (_) { /* older browsers */ }
    return next;
  }

  function set(theme) {
    return apply(theme, true);
  }

  function toggle() {
    return set(current() === 'dark' ? 'light' : 'dark');
  }

  // Initial paint theme. If there is no saved preference, follow the OS.
  apply(readStored() || systemTheme(), false);

  if (media) {
    var onChange = function (event) {
      if (!readStored()) apply(event.matches ? 'dark' : 'light', false);
    };
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    else if (typeof media.addListener === 'function') media.addListener(onChange);
  }

  window.PeakTheme = {
    get current() { return current(); },
    set: set,
    toggle: toggle,
    system: systemTheme
  };
})();
