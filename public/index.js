/* eslint-env browser */
/* Peak admin portal. Hand-crafted, dependency-free frontend logic. */
(function () {
  'use strict';

  const PANEL_TITLES = {
    'panel-status': 'Overview',
    'panel-core': 'Providers & defaults',
    'panel-quality': 'Quality & filters',
    'panel-keys': 'API keys',
    'panel-febbox': 'FebBox',
    'panel-advanced': 'Advanced',
    'panel-live': 'Live configuration',
    'panel-iptv': 'IPTV Live TV'
  };
  const PANEL_IDS = Object.keys(PANEL_TITLES);
  const RESET_SKIP_KEY = 'peak_confirmReset_skip';
  const LEGACY_RESET_SKIP_KEY = 'ns_confirmReset_skip';

  const PROVIDER_META = {
    showbox: 'Cloud library',
    '4khdhub': '4K catalog',
    castletv: 'Live catalog',
    dahmermovies: 'Movie archive',
    hdghartv: 'HD catalog',
    netmirror: 'Mirror library',
    onetouchtv: 'Streaming index',
    streamflix: 'Streaming index',
    vaplayer: 'Player index',
    videasy: 'Embed source',
    vidlink: 'Embed source',
    vixsrc: 'Embed source',
    zxcstreams: 'Streaming index'
  };

  const state = {
    data: null,
    providers: [],
    status: null,
    metrics: null,
    activePanel: 'panel-status',
    tmdbKeys: [],
    febboxCookies: [],
    revealedKeys: new Set(),
    revealedCookies: new Set(),
    functionalChecks: Object.create(null),
    lastFocus: null,
    dashboardLoading: false,
    checksRunning: false,
    iptvPlaylists: [],
    iptvChannels: [],
    iptvGroups: [],
    iptvChannelSearch: '',
    iptvChannelGroup: '',
    iptvLoading: false
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHTML(value).replace(/`/g, '&#96;');
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : '0';
  }

  function formatUptime(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s}s`;
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function timeAgo(value) {
    if (!value) return 'No requests yet';
    const then = new Date(value).getTime();
    if (!Number.isFinite(then)) return 'Unknown';
    const diff = Math.round((Date.now() - then) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(then));
    } catch (_) {
      return new Date(then).toLocaleDateString();
    }
  }

  function clockTime(date) {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
    } catch (_) {
      return date.toLocaleTimeString();
    }
  }

  function initials(name) {
    const text = String(name || '?').replace(/[^a-z0-9]/gi, '');
    return (text.slice(0, 2) || '?').toUpperCase();
  }

  async function fetchJSON(url, options) {
    const opts = Object.assign({ cache: 'no-store' }, options || {});
    const response = await fetch(url, opts);
    let body = null;
    try { body = await response.json(); } catch (_) { body = null; }
    if (response.status === 401) {
      window.location.replace('/?expired=1');
      throw new Error('Session expired');
    }
    if (!response.ok) {
      throw new Error((body && body.error) || `Request failed (${response.status})`);
    }
    return body;
  }

  /* ------------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------------ */

  function syncThemeControls() {
    const theme = window.PeakTheme ? window.PeakTheme.current : 'light';
    $$('[data-theme-value]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme));
    });
    $$('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
    });
  }

  function initThemeControls() {
    if (!window.PeakTheme) return;
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-theme-toggle]');
      if (toggle) {
        window.PeakTheme.toggle();
        return;
      }
      const choice = event.target.closest('[data-theme-value]');
      if (choice) window.PeakTheme.set(choice.dataset.themeValue);
    });
    window.addEventListener('peak-themechange', syncThemeControls);
    syncThemeControls();
  }

  /* ------------------------------------------------------------------------
     Navigation and mobile drawer
     ------------------------------------------------------------------------ */

  const mobileNav = window.matchMedia('(max-width: 900px)');
  let lastNavTrigger = null;

  function drawerIsOpen() {
    const sidebar = $('#sidebar');
    return Boolean(sidebar && sidebar.classList.contains('open'));
  }

  function setDrawer(open, returnFocus) {
    const sidebar = $('#sidebar');
    const scrim = $('.sidebar-scrim');
    const toggle = $('#navToggle');
    if (!sidebar) return;
    if (open && mobileNav.matches) lastNavTrigger = document.activeElement;
    sidebar.classList.toggle('open', Boolean(open) && mobileNav.matches);
    if (scrim) scrim.classList.toggle('show', Boolean(open) && mobileNav.matches);
    if (toggle) toggle.setAttribute('aria-expanded', String(Boolean(open) && mobileNav.matches));
    if (mobileNav.matches) {
      sidebar.setAttribute('aria-hidden', String(!open));
      if ('inert' in sidebar) sidebar.inert = !open;
    } else {
      sidebar.removeAttribute('aria-hidden');
      if ('inert' in sidebar) sidebar.inert = false;
    }
    if (open && mobileNav.matches) {
      const close = $('.sidebar-close', sidebar);
      if (close) close.focus();
    } else if (returnFocus) {
      const target = lastNavTrigger && document.contains(lastNavTrigger) ? lastNavTrigger : toggle;
      if (target) target.focus();
    }
  }

  function syncDrawerToViewport() {
    if (!mobileNav.matches) setDrawer(false, false);
    else if (!drawerIsOpen()) setDrawer(false, false);
  }

  function trapDrawerFocus(event) {
    if (event.key !== 'Tab' || !mobileNav.matches || !drawerIsOpen()) return;
    const sidebar = $('#sidebar');
    const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', sidebar)
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function navTo(panelId, options) {
    const opts = options || {};
    let id = PANEL_IDS.includes(panelId) ? panelId : 'panel-status';
    if (!document.getElementById(id)) id = 'panel-status';
    state.activePanel = id;
    $$('.panel').forEach((panel) => {
      const active = panel.id === id;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    $$('.nav-item[data-target]').forEach((button) => {
      const active = button.dataset.target === id;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const title = PANEL_TITLES[id] || 'Overview';
    const heading = $('#topbarTitle');
    if (heading) heading.textContent = title;
    document.title = `${title} · Peak`;
    document.body.dataset.activePanel = id;
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
    setDrawer(false, false);
    if (id === 'panel-status') loadDashboard({ silent: Boolean(opts.initial) });
    if (id === 'panel-live') renderLiveConfig();
    if (id === 'panel-iptv') loadIptv();
    if (!opts.initial) {
      const main = $('#mainContent');
      if (main) main.focus({ preventScroll: true });
    }
  }

  function bindNavigation() {
    document.addEventListener('click', (event) => {
      const nav = event.target.closest('[data-target]');
      if (nav) {
        navTo(nav.dataset.target);
        return;
      }
      const jump = event.target.closest('[data-nav-target]');
      if (jump) navTo(jump.dataset.navTarget);
    });
    const toggle = $('#navToggle');
    if (toggle) toggle.addEventListener('click', () => setDrawer(!drawerIsOpen(), true));
    $$('[data-close-nav]').forEach((el) => el.addEventListener('click', () => setDrawer(false, true)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && drawerIsOpen()) {
        setDrawer(false, true);
        return;
      }
      trapDrawerFocus(event);
    });
    if (typeof mobileNav.addEventListener === 'function') {
      mobileNav.addEventListener('change', syncDrawerToViewport);
    } else if (typeof mobileNav.addListener === 'function') {
      mobileNav.addListener(syncDrawerToViewport);
    }
    window.addEventListener('hashchange', () => {
      const id = location.hash.replace('#', '');
      if (PANEL_IDS.includes(id) && id !== state.activePanel) navTo(id);
    });
    syncDrawerToViewport();
  }

  /* ------------------------------------------------------------------------
     Toasts and inline status
     ------------------------------------------------------------------------ */

  function toast(message, type) {
    const region = $('#toastRegion');
    if (!region) return;
    const item = document.createElement('div');
    item.className = `toast ${type || 'success'}`;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'icon');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `/assets/icons.svg#${type === 'error' ? 'i-alert' : 'i-check'}`);
    icon.appendChild(use);
    const text = document.createElement('span');
    text.textContent = message;
    item.appendChild(icon);
    item.appendChild(text);
    region.appendChild(item);
    requestAnimationFrame(() => item.classList.add('is-visible'));
    setTimeout(() => {
      item.classList.remove('is-visible');
      setTimeout(() => item.remove(), 240);
    }, type === 'error' ? 5200 : 3400);
  }

  function setStatus(message, type) {
    const el = $('#status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  async function copyText(text, successMessage) {
    const value = String(text == null ? '' : text);
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch (err) { toast('Could not copy to clipboard', 'error'); return; }
      textarea.remove();
    }
    toast(successMessage || 'Copied to clipboard');
  }

  /* ------------------------------------------------------------------------
     Secret lists
     ------------------------------------------------------------------------ */

  function maskSecret(value) {
    const text = String(value || '');
    if (text.length <= 8) return '••••••••';
    return `${text.slice(0, 3)}••••••••${text.slice(-4)}`;
  }

  function updateSecretHidden(kind) {
    if (kind === 'key') {
      const hidden = document.querySelector('input[name="tmdbApiKeysHidden"]');
      if (hidden) hidden.value = state.tmdbKeys.join(',');
      const count = $('#tmdbKeyCount');
      if (count) count.textContent = `${state.tmdbKeys.length} ${state.tmdbKeys.length === 1 ? 'key' : 'keys'}`;
      return;
    }
    const hidden = document.querySelector('input[name="febboxCookiesHidden"]');
    if (hidden) hidden.value = state.febboxCookies.join(',');
    const count = $('#febboxCookieCount');
    if (count) count.textContent = `${state.febboxCookies.length} ${state.febboxCookies.length === 1 ? 'cookie' : 'cookies'}`;
  }

  function renderSecrets(kind) {
    const list = kind === 'key' ? $('#tmdbKeyList') : $('#febboxCookieList');
    if (!list) return;
    const values = kind === 'key' ? state.tmdbKeys : state.febboxCookies;
    const revealed = kind === 'key' ? state.revealedKeys : state.revealedCookies;
    const noun = kind === 'key' ? 'key' : 'cookie';
    if (!values.length) {
      list.innerHTML = `<div class="secret-empty">No ${noun}s configured yet.</div>`;
    } else {
      list.innerHTML = values.map((value, index) => {
        const isRevealed = revealed.has(index);
        const display = isRevealed ? escapeHTML(value) : escapeHTML(maskSecret(value));
        const label = `${isRevealed ? 'Hide' : 'Reveal'} ${noun} ${index + 1}`;
        return `<div class="secret-item" data-secret-kind="${kind}" data-index="${index}">
          <div class="secret-main">
            <span class="secret-icon"><svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${kind === 'key' ? 'i-key' : 'i-cloud'}"></use></svg></span>
            <code class="secret-value" data-secret-value="${index}">${display}</code>
          </div>
          <div class="secret-actions">
            <button class="secret-btn" type="button" data-action="reveal-secret" data-kind="${kind}" data-index="${index}" aria-label="${label}" aria-pressed="${isRevealed}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${isRevealed ? 'i-eye-off' : 'i-eye'}"></use></svg>
            </button>
            <button class="secret-btn" type="button" data-action="copy-secret" data-kind="${kind}" data-index="${index}" aria-label="Copy ${noun} ${index + 1}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-copy"></use></svg>
            </button>
            <button class="secret-btn danger" type="button" data-action="remove-secret" data-kind="${kind}" data-index="${index}" aria-label="Remove ${noun} ${index + 1}">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-close"></use></svg>
            </button>
          </div>
        </div>`;
      }).join('');
    }
    updateSecretHidden(kind);
  }

  function addSecret(kind) {
    const input = kind === 'key' ? $('#tmdbKeyInput') : $('#febboxCookieInput');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const values = kind === 'key' ? state.tmdbKeys : state.febboxCookies;
    if (values.includes(value)) {
      input.value = '';
      toast(`That ${kind === 'key' ? 'key' : 'cookie'} is already in the list`, 'error');
      return;
    }
    values.push(value);
    input.value = '';
    if (kind === 'key') state.revealedKeys.clear();
    else state.revealedCookies.clear();
    renderSecrets(kind);
    validate();
    toast(`${kind === 'key' ? 'Key' : 'Cookie'} added — save overrides to apply`);
  }

  function bindSecretActions() {
    document.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (!action) return;
      const kind = action.dataset.kind;
      const index = Number(action.dataset.index);
      if (action.dataset.action === 'reveal-secret') {
        const set = kind === 'key' ? state.revealedKeys : state.revealedCookies;
        if (set.has(index)) set.delete(index);
        else set.add(index);
        renderSecrets(kind);
        return;
      }
      if (action.dataset.action === 'copy-secret') {
        const values = kind === 'key' ? state.tmdbKeys : state.febboxCookies;
        if (values[index] !== undefined) copyText(values[index], `${kind === 'key' ? 'Key' : 'Cookie'} copied`);
        return;
      }
      if (action.dataset.action === 'remove-secret') {
        const values = kind === 'key' ? state.tmdbKeys : state.febboxCookies;
        if (index >= 0 && index < values.length) {
          values.splice(index, 1);
          if (kind === 'key') state.revealedKeys.clear();
          else state.revealedCookies.clear();
          renderSecrets(kind);
          validate();
          toast(`${kind === 'key' ? 'Key' : 'Cookie'} removed — save overrides to apply`);
        }
      }
    });

    ['tmdbKeyInput', 'febboxCookieInput'].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addSecret(id === 'tmdbKeyInput' ? 'key' : 'cookie');
      });
    });
    const addKey = $('#addTmdbKeyBtn');
    if (addKey) addKey.addEventListener('click', () => addSecret('key'));
    const addCookie = $('#addFebboxCookieBtn');
    if (addCookie) addCookie.addEventListener('click', () => addSecret('cookie'));
  }

  /* ------------------------------------------------------------------------
     Form population
     ------------------------------------------------------------------------ */

  function parseCookieValue(value) {
    let result = value;
    if (typeof result === 'string') {
      const trimmed = result.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) result = parsed;
        } catch (_) { /* keep as a raw string */ }
      } else if (trimmed.includes(',') || trimmed.includes('\n') || trimmed.includes(';')) {
        result = trimmed.split(/[\n;,]+/).map((part) => part.trim()).filter(Boolean);
      } else {
        result = trimmed ? [trimmed] : [];
      }
    }
    if (!Array.isArray(result)) result = [];
    return result.filter((item) => typeof item === 'string' && item);
  }

  function qualityPresetFor(raw) {
    const value = String(raw || '');
    const lower = value.toLowerCase();
    return ['all', '480p', '720p', '1080p', '1440p', '2160p'].includes(lower) ? lower : (value ? 'custom' : 'all');
  }

  function codecPresetFor(raw) {
    if (!raw) return 'none';
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      const extras = keys.some((key) => key !== 'excludeDV' && key !== 'excludeHDR');
      if (extras) return 'advanced';
      const dv = parsed.excludeDV === true;
      const hdr = parsed.excludeHDR === true;
      if (!dv && !hdr) return 'none';
      if (dv && hdr) return 'all';
      if (dv) return 'dv';
      if (hdr) return 'hdr';
    }
    if (typeof raw === 'string') {
      if (/excludeDV"\s*:\s*true/.test(raw) && !/excludeHDR"\s*:\s*true/.test(raw)) return 'dv';
      if (/excludeHDR"\s*:\s*true/.test(raw) && !/excludeDV"\s*:\s*true/.test(raw)) return 'hdr';
    }
    return 'advanced';
  }

  function setChecked(name, value) {
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }

  function updateEditorVisibility() {
    const quality = document.querySelector('input[name="qualityPreset"]:checked');
    const qualityEditor = $('[data-editor="quality"]');
    const qualityText = document.querySelector('textarea[name="minQualitiesRaw"]');
    if (qualityEditor && qualityText) {
      const custom = quality && quality.value === 'custom';
      qualityEditor.classList.toggle('is-visible', Boolean(custom));
      qualityText.disabled = !custom;
      if (!custom) qualityText.value = '';
    }
    const codec = document.querySelector('input[name="codecPreset"]:checked');
    const codecEditor = $('[data-editor="codec"]');
    const codecText = document.querySelector('textarea[name="excludeCodecsRaw"]');
    if (codecEditor && codecText) {
      const advanced = codec && codec.value === 'advanced';
      codecEditor.classList.toggle('is-visible', Boolean(advanced));
      codecText.disabled = !advanced;
      if (!advanced) codecText.value = '';
    }
  }

  function updateBanners(merged) {
    const cookies = Array.isArray(merged.febboxCookies) ? merged.febboxCookies : [];
    const keys = Array.isArray(merged.tmdbApiKeys) ? merged.tmdbApiKeys : (merged.tmdbApiKey ? [merged.tmdbApiKey] : []);
    const showboxEnabled = merged.enableShowboxProvider !== false;
    const tmdbProvidersEnabled = merged.enableShowboxProvider !== false || merged.enable4khdhubProvider !== false;
    const bootWarn = $('#bootWarn');
    if (bootWarn) bootWarn.style.display = !cookies.length && showboxEnabled ? 'flex' : 'none';
    const cacheBanner = $('#cacheDisabledBanner');
    if (cacheBanner) cacheBanner.style.display = merged.disableCache ? 'flex' : 'none';
    const tmdbBanner = $('#tmdbMissingBanner');
    if (tmdbBanner) tmdbBanner.style.display = !keys.length && tmdbProvidersEnabled ? 'flex' : 'none';
  }

  function fillForm(data) {
    const merged = data.merged || {};
    const override = data.override || {};
    const form = $('#cfgForm');
    if (!form) return;
    const port = override.port !== undefined ? override.port : merged.port;
    if (form.elements.port) form.elements.port.value = port == null ? '' : port;
    if (form.elements.defaultRegion) {
      form.elements.defaultRegion.value = (override.defaultRegion !== undefined ? override.defaultRegion : merged.defaultRegion) || '';
    }
    const defaults = override.defaultProviders || merged.defaultProviders || [];
    if (form.elements.defaultProviders) form.elements.defaultProviders.value = defaults.join(',');

    const keySource = override.tmdbApiKeys !== undefined ? override.tmdbApiKeys : merged.tmdbApiKeys;
    if (Array.isArray(keySource)) state.tmdbKeys = keySource.filter((key) => typeof key === 'string' && key);
    else if (override.tmdbApiKey || merged.tmdbApiKey) state.tmdbKeys = [override.tmdbApiKey || merged.tmdbApiKey];
    else state.tmdbKeys = [];
    state.revealedKeys.clear();
    renderSecrets('key');

    const cookieSource = override.febboxCookies !== undefined ? override.febboxCookies : merged.febboxCookies;
    state.febboxCookies = parseCookieValue(cookieSource);
    state.revealedCookies.clear();
    renderSecrets('cookie');

    const qualityRaw = override.minQualitiesRaw !== undefined ? override.minQualitiesRaw : (merged.minQualitiesRaw || '');
    const qualityPreset = qualityPresetFor(qualityRaw);
    setChecked('qualityPreset', qualityPreset);
    const qualityText = form.elements.minQualitiesRaw;
    if (qualityText) qualityText.value = qualityPreset === 'custom' ? qualityRaw : '';

    const codecRaw = override.excludeCodecsRaw !== undefined ? override.excludeCodecsRaw : (merged.excludeCodecsRaw || '');
    const codecPreset = codecPresetFor(codecRaw);
    setChecked('codecPreset', codecPreset);
    const codecText = form.elements.excludeCodecsRaw;
    if (codecText) codecText.value = codecPreset === 'advanced' ? (codecRaw || '') : '';
    updateEditorVisibility();

    const flagValues = {
      adv_disableCache: 'disableCache',
      adv_disableUrlValidation: 'disableUrlValidation',
      adv_disable4khdhubValidation: 'disable4khdhubUrlValidation',
      adv_enableProxy: 'enableProxy'
    };
    Object.entries(flagValues).forEach(([inputName, key]) => {
      const input = form.elements[inputName];
      if (!input) return;
      input.checked = Boolean(override[key] !== undefined ? override[key] : merged[key]);
    });
    if (form.elements.adv_showboxCacheDir) {
      const value = override.showboxCacheDir !== undefined ? override.showboxCacheDir : merged.showboxCacheDir;
      form.elements.adv_showboxCacheDir.value = value || '';
    }

    renderLiveConfig(data);
    updateBanners(merged);
    renderProviderMatrix(merged);
    renderReadiness();
    if (state.status) {
      const health = determineHealth(state.status, data);
      setHealth(health.kind, health.text);
    }
    validate();
  }

  async function loadConfig(options) {
    const opts = options || {};
    try {
      const [data, providerData] = await Promise.all([fetchJSON('/api/config'), fetchJSON('/api/providers').catch(() => ({ providers: [] }))]);
      state.data = data;
      state.providers = Array.isArray(providerData.providers) ? providerData.providers : [];
      fillForm(data);
      if (!opts.silent) setStatus('');
      return data;
    } catch (error) {
      setStatus(`Load failed: ${error.message}`, 'error');
      if (!opts.silent) toast(`Could not load configuration: ${error.message}`, 'error');
      const save = $('#saveBtn');
      if (save) save.disabled = true;
      throw error;
    }
  }

  async function reload(options) {
    const opts = options || {};
    try {
      await loadConfig({ silent: true });
      setStatus('Configuration reloaded', 'success');
      if (!opts.quiet) toast('Configuration reloaded');
    } catch (_) { /* status is already set */ }
  }

  /* ------------------------------------------------------------------------
     Provider matrix
     ------------------------------------------------------------------------ */

  function renderProviderMatrix(merged) {
    const container = $('#providerMatrix');
    if (!container) return;
    const config = merged || (state.data && state.data.merged) || {};
    const defaults = (config.defaultProviders || []).map((name) => String(name));
    const providers = state.providers.length
      ? state.providers
      : Array.from(new Set(Object.keys(config).filter((key) => /^enable.+Provider$/.test(key)).map((key) => key.slice(6, -7))));
    if (!providers.length) {
      container.innerHTML = '<div class="provider-loading">No providers reported by the API.</div>';
      return;
    }
    const enabledCount = providers.filter((provider) => config[`enable${provider.name.charAt(0).toUpperCase()}${provider.name.slice(1)}Provider`] !== false).length;
    const enabledEl = $('#providerEnabledCount');
    if (enabledEl) enabledEl.textContent = String(enabledCount);
    const defaultEl = $('#providerDefaultCount');
    if (defaultEl) defaultEl.textContent = String(defaults.length);
    container.innerHTML = providers.map((provider) => {
      const name = provider.name;
      const flag = `enable${name.charAt(0).toUpperCase()}${name.slice(1)}Provider`;
      const enabled = config[flag] !== false;
      const isDefault = defaults.some((item) => item.toLowerCase() === name.toLowerCase());
      const meta = PROVIDER_META[name] || (provider.cookieRequired ? 'Credential required' : 'Streaming source');
      return `<div class="provider-matrix-item ${enabled ? 'is-enabled' : ''} ${isDefault ? 'is-default' : ''}" data-prov="${escapeAttr(name)}" data-flag="${escapeAttr(flag)}" data-enabled="${enabled}" data-default="${isDefault}">
        <div class="pm-identity">
          <span class="provider-glyph" aria-hidden="true">${escapeHTML(initials(name))}</span>
          <span class="pm-copy"><strong>${escapeHTML(name)}</strong><span>${escapeHTML(meta)}</span></span>
        </div>
        <div class="pm-actions">
          <button class="pm-btn pm-default" type="button" data-action="toggle-default" aria-pressed="${isDefault}" aria-label="${isDefault ? 'Remove' : 'Make'} ${escapeAttr(name)} a default">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-star"></use></svg>
          </button>
          <button class="pm-btn pm-enable" type="button" data-action="toggle-enable" aria-pressed="${enabled}" aria-label="${enabled ? 'Disable' : 'Enable'} ${escapeAttr(name)}">
            <span class="pm-dot" aria-hidden="true"></span>
            <span>${enabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  async function toggleProvider(button) {
    const item = button.closest('.provider-matrix-item');
    if (!item) return;
    const provider = item.dataset.prov;
    const flag = item.dataset.flag;
    button.disabled = true;
    try {
      const data = await fetchJSON('/api/config');
      const merged = data.merged || {};
      let defaults = Array.isArray(merged.defaultProviders) ? merged.defaultProviders.slice() : [];
      const patch = {};
      if (button.dataset.action === 'toggle-enable') {
        const enabled = item.dataset.enabled === 'true';
        patch[flag] = !enabled;
        if (enabled) {
          defaults = defaults.filter((name) => String(name).toLowerCase() !== provider.toLowerCase());
          patch.defaultProviders = defaults;
        }
      } else {
        const isDefault = item.dataset.default === 'true';
        if (isDefault) defaults = defaults.filter((name) => String(name).toLowerCase() !== provider.toLowerCase());
        else {
          if (!defaults.some((name) => String(name).toLowerCase() === provider.toLowerCase())) defaults.push(provider);
          patch[flag] = true;
        }
        patch.defaultProviders = defaults;
      }
      const result = await fetchJSON('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!result.success) throw new Error(result.error || 'Update failed');
      await loadConfig({ silent: true });
      setStatus('Provider settings updated', 'success');
      toast(button.dataset.action === 'toggle-default'
        ? `${provider} default ${item.dataset.default === 'true' ? 'removed' : 'set'}`
        : `${provider} ${item.dataset.enabled === 'true' ? 'disabled' : 'enabled'}`);
    } catch (error) {
      setStatus(`Provider update failed: ${error.message}`, 'error');
      toast(`Provider update failed: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  /* ------------------------------------------------------------------------
     Validation and save
     ------------------------------------------------------------------------ */

  function markInvalid(element) {
    if (!element) return;
    element.classList.add('invalid');
    setTimeout(() => element.classList.remove('invalid'), 3000);
  }

  function validate() {
    const form = $('#cfgForm');
    if (!form) return true;
    if (!state.data) return false;
    const errors = [];
    const quality = document.querySelector('input[name="qualityPreset"]:checked');
    if (quality && quality.value === 'custom') {
      const raw = form.elements.minQualitiesRaw.value.trim();
      if (raw && /[{\[]/.test(raw)) {
        try { JSON.parse(raw); } catch (_) { errors.push('Minimum quality JSON is invalid'); markInvalid(form.elements.minQualitiesRaw); }
      }
    }
    const codec = document.querySelector('input[name="codecPreset"]:checked');
    if (codec && codec.value === 'advanced') {
      const raw = form.elements.excludeCodecsRaw.value.trim();
      if (raw && /[{\[]/.test(raw)) {
        try { JSON.parse(raw); } catch (_) { errors.push('Codec exclusion JSON is invalid'); markInvalid(form.elements.excludeCodecsRaw); }
      }
    }
    const port = form.elements.port.value.trim();
    if (port) {
      const n = Number(port);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        errors.push('Port must be between 1 and 65535');
        markInvalid(form.elements.port);
      }
    }
    const defaults = form.elements.defaultProviders.value.trim();
    if (defaults && !/^[a-z0-9_,\-\s]+$/i.test(defaults)) {
      errors.push('Default providers contain invalid characters');
      markInvalid(form.elements.defaultProviders);
    }
    const summary = $('#validationSummary');
    if (summary) {
      summary.textContent = errors.join(' · ');
      summary.classList.toggle('has-errors', errors.length > 0);
    }
    const save = $('#saveBtn');
    if (save) save.disabled = errors.length > 0;
    return errors.length === 0;
  }

  async function save() {
    if (!validate()) return;
    const form = $('#cfgForm');
    const payload = {};
    const defaults = form.elements.defaultProviders.value.trim();
    if (defaults) payload.defaultProviders = defaults.split(/[\s,]+/).filter(Boolean);
    const port = form.elements.port.value.trim();
    payload.port = port || null;
    const quality = document.querySelector('input[name="qualityPreset"]:checked');
    if (quality) {
      if (quality.value === 'custom') payload.minQualitiesRaw = form.elements.minQualitiesRaw.value.trim() || null;
      else payload.minQualitiesRaw = quality.value;
    }
    const codec = document.querySelector('input[name="codecPreset"]:checked');
    if (codec) {
      if (codec.value === 'none') payload.excludeCodecsRaw = JSON.stringify({ excludeDV: false, excludeHDR: false });
      else if (codec.value === 'all') payload.excludeCodecsRaw = JSON.stringify({ excludeDV: true, excludeHDR: true });
      else if (codec.value === 'dv') payload.excludeCodecsRaw = JSON.stringify({ excludeDV: true, excludeHDR: false });
      else if (codec.value === 'hdr') payload.excludeCodecsRaw = JSON.stringify({ excludeDV: false, excludeHDR: true });
      else payload.excludeCodecsRaw = form.elements.excludeCodecsRaw.value.trim() || null;
    }
    payload.defaultRegion = form.elements.defaultRegion.value || null;
    payload.febboxCookies = state.febboxCookies.slice();
    payload.tmdbApiKeys = state.tmdbKeys.slice();
    payload.tmdbApiKey = null;
    const flags = {
      adv_disableCache: 'disableCache',
      adv_disableUrlValidation: 'disableUrlValidation',
      adv_disable4khdhubValidation: 'disable4khdhubUrlValidation',
      adv_enableProxy: 'enableProxy'
    };
    Object.entries(flags).forEach(([inputName, key]) => {
      if (form.elements[inputName]) payload[key] = Boolean(form.elements[inputName].checked);
    });
    payload.showboxCacheDir = form.elements.adv_showboxCacheDir.value.trim() || null;

    const saveButton = $('#saveBtn');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.setAttribute('aria-busy', 'true');
    }
    setStatus('Saving overrides…');
    try {
      const result = await fetchJSON('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.success) throw new Error(result.error || 'Save failed');
      await loadConfig({ silent: true });
      setStatus('Overrides saved', 'success');
      toast('Overrides saved and applied');
    } catch (error) {
      setStatus(`Save failed: ${error.message}`, 'error');
      toast(`Save failed: ${error.message}`, 'error');
      validate();
    } finally {
      if (saveButton) saveButton.removeAttribute('aria-busy');
    }
  }

  function confirmModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return Promise.resolve(false);
    state.lastFocus = document.activeElement;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const windowEl = $('.modal-window', modal);
    const focusables = () => $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
      .filter((el) => !el.disabled && el.offsetParent !== null);
    const first = focusables()[0];
    if (first) first.focus();
    else if (windowEl) windowEl.focus();

    return new Promise((resolve) => {
      function finish(value) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', onKey);
        modal.removeEventListener('click', onClick);
        const target = state.lastFocus && document.contains(state.lastFocus) ? state.lastFocus : null;
        if (target) target.focus();
        resolve(value);
      }
      function onClick(event) {
        const action = event.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'confirm') finish(true);
        if (action.dataset.action === 'cancel') finish(false);
      }
      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const items = focusables();
        if (!items.length) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
      modal.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    });
  }

  async function clearAll() {
    let skip = false;
    try {
      skip = localStorage.getItem(RESET_SKIP_KEY) === '1' || localStorage.getItem(LEGACY_RESET_SKIP_KEY) === '1';
      if (localStorage.getItem(LEGACY_RESET_SKIP_KEY) === '1') {
        localStorage.setItem(RESET_SKIP_KEY, '1');
        localStorage.removeItem(LEGACY_RESET_SKIP_KEY);
      }
    } catch (_) { skip = false; }
    if (!skip) {
      const confirmed = await confirmModal('confirmReset');
      if (!confirmed) return;
      if ($('#confirmResetDontAsk') && $('#confirmResetDontAsk').checked) {
        try { localStorage.setItem(RESET_SKIP_KEY, '1'); } catch (_) { /* noop */ }
      }
    }
    const payload = {
      port: null,
      defaultRegion: null,
      defaultProviders: [],
      minQualitiesRaw: 'all',
      excludeCodecsRaw: JSON.stringify({ excludeDV: false, excludeHDR: false }),
      febboxCookies: [],
      tmdbApiKeys: [],
      tmdbApiKey: null,
      enableShowboxProvider: true,
      enable4khdhubProvider: true,
      enableVixsrcProvider: true,
      enableProxy: false,
      disableCache: false,
      enablePStreamApi: true,
      disableUrlValidation: false,
      disable4khdhubUrlValidation: false,
      showboxCacheDir: null,
      providerCheckTmdbId: null
    };
    setStatus('Resetting overrides…');
    try {
      const result = await fetchJSON('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.success) throw new Error(result.error || 'Reset failed');
      state.functionalChecks = Object.create(null);
      await loadConfig({ silent: true });
      setStatus('All settings reset to defaults', 'success');
      toast('All settings reset to defaults');
    } catch (error) {
      setStatus(`Reset failed: ${error.message}`, 'error');
      toast(`Reset failed: ${error.message}`, 'error');
    }
  }

  async function restartServer() {
    const confirmed = await confirmModal('confirmRestart');
    if (!confirmed) return;
    setStatus('Restarting server…');
    toast('Restart requested — waiting for Peak to come back');
    try {
      const response = await fetch('/api/restart', { method: 'POST' });
      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(text || `HTTP ${response.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const started = Date.now();
      const timeout = 60000;
      (function poll() {
        fetch('/api/health', { cache: 'no-store' })
          .then((health) => {
            if (health.ok) {
              window.location.reload();
              return;
            }
            throw new Error('Not ready');
          })
          .catch(() => {
            if (Date.now() - started > timeout) {
              setStatus('Restart timed out — check the process supervisor', 'error');
              toast('Restart timed out', 'error');
              return;
            }
            setTimeout(poll, 1000);
          });
      })();
    } catch (error) {
      setStatus(`Restart failed: ${error.message}`, 'error');
      toast(`Restart failed: ${error.message}`, 'error');
    }
  }

  function bindFormControls() {
    const saveButton = $('#saveBtn');
    if (saveButton) saveButton.addEventListener('click', save);
    const reloadButton = $('#reloadBtn');
    if (reloadButton) reloadButton.addEventListener('click', () => reload());
    const clearButton = $('#clearBtn');
    if (clearButton) clearButton.addEventListener('click', clearAll);
    const logout = $('#logoutBtn');
    if (logout) {
      logout.addEventListener('click', async () => {
        try { await fetch('/auth/logout', { method: 'POST' }); } catch (_) { /* noop */ }
        window.location.replace('/?loggedOut=1');
      });
    }
    const restart = $('#restartBtn');
    if (restart) restart.addEventListener('click', restartServer);
    const dashboardRestart = $('#dashboardRestartBtn');
    if (dashboardRestart) dashboardRestart.addEventListener('click', restartServer);

    document.addEventListener('input', (event) => {
      if (event.target.closest('#cfgForm')) validate();
    });
    document.addEventListener('change', (event) => {
      const target = event.target;
      if (target.name === 'qualityPreset') {
        const textarea = document.querySelector('textarea[name="minQualitiesRaw"]');
        if (target.value === 'custom' && textarea) {
          textarea.disabled = false;
          if (!textarea.value.trim()) textarea.value = '{"default":"1080p"}';
        }
        updateEditorVisibility();
        validate();
      }
      if (target.name === 'codecPreset') {
        const textarea = document.querySelector('textarea[name="excludeCodecsRaw"]');
        if (target.value === 'advanced' && textarea) {
          textarea.disabled = false;
          if (!textarea.value.trim()) textarea.value = JSON.stringify({ excludeDV: false, excludeHDR: false });
        }
        updateEditorVisibility();
        validate();
      }
    });

    document.addEventListener('click', (event) => {
      const providerButton = event.target.closest('#providerMatrix [data-action]');
      if (providerButton) {
        toggleProvider(providerButton);
        return;
      }
      const copy = event.target.closest('[data-copy-value]');
      if (copy) copyText(copy.dataset.copyValue, 'Endpoint copied');
      const copyLive = event.target.closest('#copyLiveBtn');
      if (copyLive) copyActiveLiveConfig();
      const downloadLive = event.target.closest('#downloadLiveBtn');
      if (downloadLive) downloadActiveLiveConfig();
      const tab = event.target.closest('[data-live-tab]');
      if (tab) showLiveTab(tab.dataset.liveTab);
    });
  }

  /* ------------------------------------------------------------------------
     Live configuration
     ------------------------------------------------------------------------ */

  function renderLiveConfig(data) {
    const source = data || state.data;
    if (!source) return;
    const merged = $('#currentCfg');
    const override = $('#overrideCfg');
    if (merged) merged.textContent = JSON.stringify(source.merged || {}, null, 2);
    if (override) {
      override.textContent = source.override && Object.keys(source.override).length
        ? JSON.stringify(source.override, null, 2)
        : '(none)';
    }
  }

  function showLiveTab(name) {
    const valid = name === 'override' ? 'override' : 'merged';
    $$('[data-live-tab]').forEach((button) => {
      const active = button.dataset.liveTab === valid;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('[data-live-panel]').forEach((panel) => {
      const active = panel.dataset.livePanel === valid;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  function currentLiveText() {
    const visible = $('.live-panel.active pre');
    return visible ? visible.textContent : '';
  }

  function copyActiveLiveConfig() {
    const text = currentLiveText();
    if (!text) return;
    copyText(text, 'Configuration JSON copied');
  }

  function downloadActiveLiveConfig() {
    const active = $('[data-live-tab].active');
    const name = active ? active.dataset.liveTab : 'merged';
    const text = currentLiveText();
    if (!text) return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `peak-config-${name}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${name} configuration`);
  }

  /* ------------------------------------------------------------------------
     Dashboard
     ------------------------------------------------------------------------ */

  function configReady() {
    if (!state.data) return null;
    const merged = state.data.merged || {};
    const keys = Array.isArray(merged.tmdbApiKeys) ? merged.tmdbApiKeys : (merged.tmdbApiKey ? [merged.tmdbApiKey] : []);
    const cookies = Array.isArray(merged.febboxCookies) ? merged.febboxCookies : [];
    const showboxEnabled = merged.enableShowboxProvider !== false;
    const anyProvider = state.providers.some((provider) => {
      const flag = `enable${provider.name.charAt(0).toUpperCase()}${provider.name.slice(1)}Provider`;
      return merged[flag] !== false;
    });
    return {
      merged,
      hasKeys: keys.length > 0,
      hasCookies: cookies.length > 0,
      showboxEnabled,
      anyProvider,
      cacheEnabled: !merged.disableCache,
      proxyEnabled: Boolean(merged.enableProxy)
    };
  }

  function setHealth(kind, text) {
    ['#topbarHealth', '#dashboardHealthChip'].forEach((selector) => {
      const element = $(selector);
      if (!element) return;
      element.classList.remove('is-ok', 'is-warn', 'is-bad', 'is-neutral');
      element.classList.add(kind);
      const label = element.querySelector('span:last-child');
      if (label) label.textContent = text;
    });
    const topbarText = $('#topbarHealthText');
    if (topbarText) topbarText.textContent = text;
    const dashboardText = $('#dashboardHealthText');
    if (dashboardText) dashboardText.textContent = text;
  }

  function renderReadiness() {
    const list = $('#readinessList');
    const score = $('#readinessScore');
    const footnote = $('#readinessFootnote');
    if (!list || !score) return;
    const ready = configReady();
    if (!ready) {
      list.innerHTML = '<div class="provider-loading">Loading configuration…</div>';
      score.textContent = '—';
      return;
    }
    const items = [
      {
        icon: 'i-key',
        title: 'TMDB credential',
        detail: ready.hasKeys ? 'Key rotation active' : 'No metadata key configured',
        state: ready.hasKeys ? 'ok' : 'warn',
        stateLabel: ready.hasKeys ? 'Ready' : 'Action',
        target: 'panel-keys'
      },
      {
        icon: 'i-cloud',
        title: 'FebBox session',
        detail: ready.hasCookies ? 'Cookie available' : 'Showbox will be limited',
        state: ready.hasCookies || !ready.showboxEnabled ? 'ok' : 'warn',
        stateLabel: ready.hasCookies ? 'Ready' : (ready.showboxEnabled ? 'Action' : 'Optional'),
        target: 'panel-febbox'
      },
      {
        icon: 'i-server',
        title: 'Provider coverage',
        detail: ready.anyProvider ? 'At least one source is live' : 'All providers are disabled',
        state: ready.anyProvider ? 'ok' : 'warn',
        stateLabel: ready.anyProvider ? 'Ready' : 'Action',
        target: 'panel-core'
      },
      {
        icon: 'i-database',
        title: 'Response cache',
        detail: ready.cacheEnabled ? 'Caching is on' : 'Caching is off',
        state: ready.cacheEnabled ? 'ok' : 'warn',
        stateLabel: ready.cacheEnabled ? 'Ready' : 'Recommended',
        target: 'panel-advanced'
      },
      {
        icon: 'i-globe',
        title: 'Stream proxy',
        detail: ready.proxyEnabled ? 'Proxy is enabled' : 'Proxy is optional',
        state: ready.proxyEnabled ? 'ok' : 'neutral',
        stateLabel: ready.proxyEnabled ? 'On' : 'Optional',
        target: 'panel-advanced'
      }
    ];
    list.innerHTML = items.map((item) => `<button class="readiness-row is-${item.state}" type="button" data-nav-target="${item.target}">
      <span class="readiness-icon"><svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${item.icon}"></use></svg></span>
      <span class="readiness-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.detail)}</small></span>
      <span class="readiness-state">${escapeHTML(item.stateLabel)}</span>
    </button>`).join('');
    const graded = items.filter((item) => item.state === 'ok' || item.state === 'warn').slice(0, 4);
    const readyCount = graded.filter((item) => item.state === 'ok').length;
    score.textContent = `${readyCount}/4`;
    score.setAttribute('aria-label', `${readyCount} of 4 readiness checks ready`);
    if (footnote) {
      const attention = graded.filter((item) => item.state === 'warn').length;
      footnote.textContent = attention
        ? `${attention} item${attention === 1 ? '' : 's'} need attention before a clean launch.`
        : 'Everything required for a clean launch is in place.';
    }
  }

  function providerBadge(status, label) {
    const kind = status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : status === 'bad' ? 'fail' : 'neutral';
    return `<span class="badge ${kind}" data-role="${status === 'ok' ? 'cookie' : status}">${escapeHTML(label)}</span>`;
  }

  function functionalBadge(name, enabled) {
    if (!enabled) return '<span class="badge off" data-role="functional">Skipped</span>';
    const result = state.functionalChecks[name];
    if (!result) return '<span class="badge neutral" data-role="functional">Not run</span>';
    if (result.status === 'checking') return '<span class="badge warn" data-role="functional">Checking</span>';
    if (result.status === 'ok') return '<span class="badge ok" data-role="functional">Passed</span>';
    if (result.status === 'skip') return '<span class="badge off" data-role="functional">Skipped</span>';
    return '<span class="badge fail" data-role="functional">Failed</span>';
  }

  function renderStatusProviders(providers) {
    const container = $('#statusProvidersEnhanced');
    if (!container) return;
    if (!Array.isArray(providers) || !providers.length) {
      container.innerHTML = '<div class="provider-loading">No providers reported.</div>';
      return;
    }
    const rows = providers.map((provider) => {
      const name = provider.name;
      const enabled = provider.enabled !== false;
      const result = state.functionalChecks[name];
      const cookieBadge = !provider.cookieRequired
        ? '<span class="badge neutral" data-role="cookie">Optional</span>'
        : provider.cookieOk
          ? '<span class="badge ok" data-role="cookie">Ready</span>'
          : '<span class="badge fail" data-role="cookie">Missing</span>';
      const notes = result && result.notes ? result.notes : (PROVIDER_META[name] || 'Streaming source');
      return `<div class="provider-row" data-provider="${escapeAttr(name)}" data-enabled="${enabled}">
        <span class="provider-identity">
          <span class="provider-glyph" aria-hidden="true">${escapeHTML(initials(name))}</span>
          <span class="provider-name"><strong>${escapeHTML(name)}</strong><span>${escapeHTML(PROVIDER_META[name] || 'Streaming source')}</span></span>
        </span>
        <span class="badge ${enabled ? 'ok' : 'off'}" data-role="enabled">${enabled ? 'Live' : 'Off'}</span>
        ${cookieBadge}
        ${functionalBadge(name, enabled)}
        <span class="provider-notes" data-role="notes" title="${escapeAttr(notes)}">${escapeHTML(notes)}</span>
      </div>`;
    }).join('');
    container.innerHTML = `<div class="provider-table-head" aria-hidden="true"><span>Provider</span><span>State</span><span>Cookie</span><span>Functional</span><span>Notes</span></div>${rows}`;
  }

  function renderEndpoints(endpoints) {
    const container = $('#statusEndpoints');
    if (!container) return;
    if (!Array.isArray(endpoints) || !endpoints.length) {
      container.innerHTML = '<div class="provider-loading">No endpoints reported.</div>';
      return;
    }
    container.innerHTML = endpoints.map((endpoint) => {
      const parts = String(endpoint).split(/\s+/);
      const method = parts.shift() || 'GET';
      const path = parts.join(' ');
      return `<div class="endpoint-row">
        <span class="endpoint-method">${escapeHTML(method)}</span>
        <code class="endpoint-path" title="${escapeAttr(path)}">${escapeHTML(path)}</code>
        <button class="endpoint-copy" type="button" data-copy-value="${escapeAttr(path)}" aria-label="Copy ${escapeAttr(path)}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-copy"></use></svg>
        </button>
      </div>`;
    }).join('');
  }

  function updateKpis(metrics) {
    const m = metrics || {};
    const uptime = $('#kpiUptime');
    if (uptime) uptime.textContent = formatUptime(m.uptimeSeconds);
    const uptimeNote = $('#kpiUptimeNote');
    if (uptimeNote) uptimeNote.textContent = 'Since last restart';
    const requests = $('#kpiRequests');
    if (requests) requests.textContent = number(m.requestsTotal);
    const requestsNote = $('#kpiRequestsNote');
    if (requestsNote) requestsNote.textContent = `${number(m.streamRequests)} stream requests`;
    const streams = $('#kpiStreams');
    if (streams) streams.textContent = number(m.streamsReturned);
    const streamsNote = $('#kpiStreamsNote');
    if (streamsNote) streamsNote.textContent = `${number(m.providerCalls)} provider calls`;
    const memory = $('#kpiMemory');
    if (memory) memory.textContent = `${number(m.memoryMB)} MB`;
    const memoryNote = $('#kpiMemoryNote');
    if (memoryNote && m.loadAvg && Array.isArray(m.loadAvg) && m.loadAvg.length) {
      memoryNote.textContent = `Load ${Number(m.loadAvg[0]).toFixed(2)} · 1m`;
    }
  }

  function updateActivity(metrics) {
    const m = metrics || {};
    const last = $('#activityLastRequest');
    if (last) last.textContent = m.lastRequestAt ? timeAgo(m.lastRequestAt) : 'No requests yet';
    const streams = $('#activityStreamRequests');
    if (streams) streams.textContent = number(m.streamRequests);
    const calls = $('#activityProviderCalls');
    if (calls) calls.textContent = number(m.providerCalls);
    const lookups = $('#activityLookups');
    if (lookups) lookups.textContent = number(m.tmdbToImdbLookups);
    const node = $('#activityNode');
    if (node) node.textContent = m.nodeVersion || 'Unknown';
    const refreshed = $('#dashboardLastRefresh');
    if (refreshed) refreshed.textContent = clockTime(new Date());
  }

  function determineHealth(status, config) {
    const ready = configReady();
    if (!ready) return { kind: 'is-neutral', text: 'Checking' };
    const providerProblem = Array.isArray(status.providers) && status.providers.some((provider) => {
      if (provider.enabled === false) return false;
      if (provider.cookieRequired && !provider.cookieOk) return true;
      const result = state.functionalChecks[provider.name];
      return result && result.status === 'fail';
    });
    const needsAttention = !ready.hasKeys || (ready.showboxEnabled && !ready.hasCookies) || !ready.anyProvider || providerProblem;
    return needsAttention
      ? { kind: 'is-warn', text: 'Needs attention' }
      : { kind: 'is-ok', text: 'Operational' };
  }

  async function loadDashboard(options) {
    if (state.dashboardLoading) return;
    const opts = options || {};
    state.dashboardLoading = true;
    const refresh = $('#refreshStatusBtn');
    const quickRefresh = $('#dashboardRefreshBtn');
    [refresh, quickRefresh].forEach((button) => { if (button) button.setAttribute('aria-busy', 'true'); });
    try {
      const [status, metrics] = await Promise.all([
        fetchJSON('/api/status'),
        fetchJSON('/api/metrics').catch(() => null)
      ]);
      if (!status || !status.success) throw new Error((status && status.error) || 'Status unavailable');
      state.status = status;
      state.metrics = metrics || status.metrics || {};
      renderStatusProviders(status.providers);
      renderEndpoints(status.endpoints);
      updateKpis(metrics || status.metrics);
      updateActivity(metrics || status.metrics);
      const checkInput = $('#providerCheckTmdbId');
      if (checkInput && document.activeElement !== checkInput) checkInput.value = status.providerCheckTmdbId || '278';
      const metricsPre = $('#statusMetrics');
      if (metricsPre) metricsPre.textContent = JSON.stringify(state.metrics, null, 2);
      const health = determineHealth(status, state.data);
      setHealth(health.kind, health.text);
      renderReadiness();
      if (!opts.silent) setStatus('');
    } catch (error) {
      state.status = null;
      setHealth('is-bad', 'API unreachable');
      const metricsPre = $('#statusMetrics');
      if (metricsPre) metricsPre.textContent = `Failed: ${error.message}`;
      const providers = $('#statusProvidersEnhanced');
      if (providers) providers.innerHTML = `<div class="provider-loading">Could not reach the API: ${escapeHTML(error.message)}</div>`;
      const endpoints = $('#statusEndpoints');
      if (endpoints) endpoints.innerHTML = '<div class="provider-loading">Unavailable while the API is unreachable.</div>';
      if (!opts.silent) toast(`Status unavailable: ${error.message}`, 'error');
    } finally {
      state.dashboardLoading = false;
      [refresh, quickRefresh].forEach((button) => {
        if (button) button.removeAttribute('aria-busy');
      });
    }
  }

  function updateFunctionalRow(name, status, notes) {
    const row = document.querySelector(`#statusProvidersEnhanced .provider-row[data-provider="${CSS.escape(name)}"]`);
    if (!row) return;
    const badge = $('[data-role="functional"]', row);
    if (badge) {
      const labels = { checking: 'Checking', ok: 'Passed', fail: 'Failed', skip: 'Skipped' };
      const classes = { checking: 'warn', ok: 'ok', fail: 'fail', skip: 'off' };
      badge.className = `badge ${classes[status] || 'neutral'}`;
      badge.textContent = labels[status] || 'Not run';
    }
    const notesEl = $('[data-role="notes"]', row);
    if (notesEl && notes !== undefined) {
      notesEl.textContent = notes;
      notesEl.title = notes;
    }
  }

  async function runProviderChecks() {
    if (state.checksRunning) return;
    const targetInput = $('#providerCheckTmdbId');
    const targetId = ((targetInput && targetInput.value) || '278').trim();
    if (!/^\d+$/.test(targetId)) {
      toast('The provider check title ID must be numeric', 'error');
      if (targetInput) targetInput.focus();
      return;
    }
    const rows = $$('#statusProvidersEnhanced .provider-row');
    if (!rows.length) {
      toast('Provider data is not loaded yet', 'error');
      return;
    }
    state.checksRunning = true;
    state.functionalChecks = Object.create(null);
    const runButtons = [$('#runProviderChecksBtn'), $('#dashboardRunChecksBtn')];
    runButtons.forEach((button) => {
      if (!button) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    });
    const summary = $('#providerCheckSummary');
    let completed = 0;
    let passed = 0;
    let skipped = 0;
    if (summary) summary.textContent = `Running checks against TMDB ${targetId}…`;
    for (const row of rows) {
      const name = row.dataset.provider;
      const enabled = row.dataset.enabled === 'true';
      if (!enabled) {
        skipped += 1;
        state.functionalChecks[name] = { status: 'skip', notes: 'Provider disabled' };
        updateFunctionalRow(name, 'skip', 'Provider disabled');
        completed += 1;
        continue;
      }
      state.functionalChecks[name] = { status: 'checking', notes: 'Testing…' };
      updateFunctionalRow(name, 'checking', 'Testing…');
      try {
        const result = await fetchJSON(`/api/streams/${encodeURIComponent(name)}/movie/${encodeURIComponent(targetId)}`);
        const streams = result && Array.isArray(result.streams) ? result.streams : [];
        if (streams.length) {
          passed += 1;
          state.functionalChecks[name] = { status: 'ok', notes: `${streams.length} streams` };
          updateFunctionalRow(name, 'ok', `${streams.length} streams`);
        } else {
          state.functionalChecks[name] = { status: 'fail', notes: 'No streams returned' };
          updateFunctionalRow(name, 'fail', 'No streams returned');
        }
      } catch (error) {
        state.functionalChecks[name] = { status: 'fail', notes: error.message };
        updateFunctionalRow(name, 'fail', error.message);
      }
      completed += 1;
      if (summary) summary.textContent = `Progress: ${completed}/${rows.length} · ${passed} passed · ${skipped} skipped`;
    }
    state.checksRunning = false;
    runButtons.forEach((button) => {
      if (!button) return;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    });
    if (summary) summary.textContent = `Checks complete · ${passed} passed · ${skipped} skipped · ${rows.length} total`;
    const health = determineHealth(state.status || {}, state.data);
    setHealth(health.kind, health.text);
    if (passed > 0) toast(`Provider checks complete — ${passed} passed`);
    else toast('Provider checks finished with no passing sources', 'error');
  }

  async function saveProviderCheckId() {
    const input = $('#providerCheckTmdbId');
    const value = (input ? input.value : '').trim();
    if (!value) {
      toast('Enter a TMDB ID first', 'error');
      return;
    }
    if (!/^\d+$/.test(value)) {
      toast('The provider check title ID must be numeric', 'error');
      input.focus();
      return;
    }
    try {
      const result = await fetchJSON('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCheckTmdbId: value })
      });
      if (!result.success) throw new Error(result.error || 'Save failed');
      toast(`Provider check title saved: TMDB ${value}`);
      setStatus(`Provider check TMDB ID saved: ${value}`, 'success');
    } catch (error) {
      toast(`Could not save provider check ID: ${error.message}`, 'error');
    }
  }

  function bindDashboardControls() {
    const refresh = $('#refreshStatusBtn');
    if (refresh) refresh.addEventListener('click', () => loadDashboard());
    const quickRefresh = $('#dashboardRefreshBtn');
    if (quickRefresh) quickRefresh.addEventListener('click', () => loadDashboard());
    const run = $('#runProviderChecksBtn');
    if (run) run.addEventListener('click', runProviderChecks);
    const quickRun = $('#dashboardRunChecksBtn');
    if (quickRun) quickRun.addEventListener('click', runProviderChecks);
    const saveId = $('#saveProviderCheckTmdbBtn');
    if (saveId) saveId.addEventListener('click', saveProviderCheckId);
    const input = $('#providerCheckTmdbId');
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveProviderCheckId();
        }
      });
    }
    setInterval(() => {
      if (!document.hidden && state.activePanel === 'panel-status') loadDashboard({ silent: true });
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.activePanel === 'panel-status') loadDashboard({ silent: true });
    });
  }

  /* ------------------------------------------------------------------------
     Session
     ------------------------------------------------------------------------ */

  async function verifySession() {
    try {
      const response = await fetch('/auth/session', { cache: 'no-store' });
      const body = await response.json();
      if (!body.authenticated) window.location.replace('/?expired=1');
    } catch (_) {
      window.location.replace('/?expired=1');
    }
  }

  function bindSessionRevalidation() {
    window.addEventListener('pageshow', (event) => { if (event.persisted) verifySession(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifySession();
    });
  }

  /* ------------------------------------------------------------------------
     IPTV Live TV
     ------------------------------------------------------------------------ */

  async function loadIptv() {
    if (state.iptvLoading) return;
    state.iptvLoading = true;
    const refresh = $('#iptvRefreshBtn');
    if (refresh) refresh.setAttribute('aria-busy', 'true');
    try {
      const [playlistRes, channelRes, groupRes] = await Promise.all([
        fetchJSON('/api/admin/iptv/playlists').catch(() => ({ success: false })),
        fetchJSON('/api/admin/iptv/channels').catch(() => ({ success: false })),
        fetchJSON('/api/admin/iptv/groups').catch(() => ({ success: false }))
      ]);
      state.iptvPlaylists = Array.isArray(playlistRes.playlists) ? playlistRes.playlists : [];
      state.iptvChannels = Array.isArray(channelRes.channels) ? channelRes.channels : [];
      state.iptvGroups = Array.isArray(groupRes.groups) ? groupRes.groups : [];
      renderIptv();
    } catch (error) {
      renderIptvEmpty(error.message);
    } finally {
      state.iptvLoading = false;
      if (refresh) refresh.removeAttribute('aria-busy');
    }
  }

  function renderIptvEmpty(message) {
    const pl = $('#iptvPlaylistList');
    const ch = $('#iptvChannelList');
    const gr = $('#iptvGroupList');
    if (pl) pl.innerHTML = `<div class="iptv-empty">Could not load IPTV data: ${escapeHTML(message)}</div>`;
    if (ch) ch.innerHTML = '';
    if (gr) gr.innerHTML = '';
  }

  function formatSyncStatus(playlist) {
    const last = playlist.lastSyncAt ? new Date(playlist.lastSyncAt) : null;
    const ago = last ? timeAgo(last.toISOString()) : 'Never';
    let status = playlist.enabled ? 'Enabled' : 'Disabled';
    if (playlist.lastError) status = `Error: ${playlist.lastError}`;
    return `${status} · Last sync: ${ago}`;
  }

  function renderIptvPlaylists() {
    const container = $('#iptvPlaylistList');
    if (!container) return;
    const count = $('#iptvPlaylistCount');
    if (count) count.textContent = `${state.iptvPlaylists.length} playlists`;
    if (!state.iptvPlaylists.length) {
      container.innerHTML = '<div class="iptv-empty">No playlists added yet.</div>';
      return;
    }
    container.innerHTML = state.iptvPlaylists.map((playlist, index) => {
      const enabled = playlist.enabled !== false;
      const syncing = playlist.syncing;
      return `
        <div class="iptv-playlist-item" data-iptv-index="${index}">
          <div class="iptv-playlist-info">
            <div class="iptv-playlist-name">${escapeHTML(playlist.name || playlist.url)}</div>
            <div class="iptv-playlist-url">${escapeHTML(playlist.url)}</div>
            <div class="iptv-playlist-meta">${formatSyncStatus(playlist)}</div>
          </div>
          <div class="iptv-playlist-actions">
            <button class="btn btn-sm btn-ghost" type="button" data-iptv-action="toggle" data-iptv-index="${index}" aria-pressed="${enabled}" title="${enabled ? 'Disable' : 'Enable'} playlist" ${syncing ? 'disabled' : ''}>
              <span class="iptv-dot ${enabled ? 'is-on' : ''}" aria-hidden="true"></span>
              <span>${enabled ? 'On' : 'Off'}</span>
            </button>
            <button class="btn btn-sm btn-ghost" type="button" data-iptv-action="sync" data-iptv-index="${index}" title="Sync now" ${syncing ? 'disabled' : ''}>
              ${syncing ? '<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-clock"></use></svg>' : '<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-refresh"></use></svg>'}
            </button>
            <button class="btn btn-sm btn-ghost" type="button" data-iptv-action="remove" data-iptv-index="${index}" title="Remove playlist">
              <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#i-close"></use></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function renderIptvChannels() {
    const container = $('#iptvChannelList');
    if (!container) return;
    const count = $('#iptvChannelCount');
    if (count) count.textContent = `${state.iptvChannels.length} channels`;
    const search = (state.iptvChannelSearch || '').toLowerCase();
    const group = state.iptvChannelGroup || '';
    const visible = state.iptvChannels.filter((ch) => {
      if (search && !(ch.name?.toLowerCase().includes(search) || ch.id?.toLowerCase().includes(search))) return false;
      if (group && ch.groupTitle !== group) return false;
      return true;
    });
    if (!visible.length) {
      container.innerHTML = '<div class="iptv-empty">No matching channels found.</div>';
      return;
    }
    container.innerHTML = visible.map((ch) => {
      const enabled = ch.enabled !== false;
      return `
        <div class="iptv-channel-item" data-iptv-channel="${escapeAttr(ch.id)}">
          <div class="iptv-channel-logo">${ch.logo ? `<img src="${escapeAttr(ch.logo)}" alt="${escapeAttr(ch.name)} logo" loading="lazy" />` : '<span class="iptv-channel-placeholder" aria-hidden="true"></span>'}</div>
          <div class="iptv-channel-info">
            <div class="iptv-channel-name">${escapeHTML(ch.name)}</div>
            <div class="iptv-channel-meta">${escapeHTML(ch.groupTitle || 'Uncategorized')}</div>
          </div>
          <button class="btn btn-sm btn-ghost" type="button" data-iptv-action="toggle-channel" data-iptv-channel="${escapeAttr(ch.id)}" aria-pressed="${enabled}" title="${enabled ? 'Disable' : 'Enable'} channel">
            <span class="iptv-dot ${enabled ? 'is-on' : ''}" aria-hidden="true"></span>
            <span>${enabled ? 'On' : 'Off'}</span>
          </button>
        </div>`;
    }).join('');
  }

  function renderIptvGroups() {
    const container = $('#iptvGroupList');
    if (!container) return;
    if (!state.iptvGroups.length) {
      container.innerHTML = '<div class="iptv-empty">No groups found.</div>';
      return;
    }
    container.innerHTML = state.iptvGroups.map((g) => `
      <div class="iptv-group-item">
        <span class="iptv-group-name">${escapeHTML(g.title || '(no group)')}</span>
        <span class="iptv-group-count">${number(g.count || 0)} channels</span>
      </div>`).join('');
    const groupFilter = $('#iptvChannelGroup');
    if (groupFilter) {
      const allOption = '<option value="">All groups</option>';
      const options = state.iptvGroups.map((g) =>
        `<option value="${escapeAttr(g.title || '')}">${escapeHTML(g.title || '(no group)')} (${number(g.count || 0)})</option>`
      ).join('');
      groupFilter.innerHTML = allOption + options;
    }
  }

  function renderIptv() {
    renderIptvPlaylists();
    renderIptvChannels();
    renderIptvGroups();
  }

  async function handleIptvAddPlaylist() {
    const nameInput = $('#iptvPlaylistName');
    const urlInput = $('#iptvPlaylistUrl');
    const name = (nameInput ? nameInput.value.trim() : '');
    const url = (urlInput ? urlInput.value.trim() : '');
    if (!name || !url) {
      toast('Both name and URL are required', 'error');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast('Playlist URL must be an HTTP(S) address', 'error');
      return;
    }
    const btn = $('#iptvAddPlaylistBtn');
    if (btn) btn.disabled = true;
    try {
      const result = await fetchJSON('/api/admin/iptv/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
      });
      if (!result.success) throw new Error(result.error || 'Failed to add playlist');
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      await loadIptv();
      toast(`Playlist "${name}" added`);
    } catch (error) {
      toast(`Failed to add playlist: ${error.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleIptvRemovePlaylist(index) {
    const playlist = state.iptvPlaylists[index];
    if (!playlist) return;
    if (!confirm(`Remove playlist "${playlist.name || 'Untitled'}"? This cannot be undone.`)) return;
    try {
      const result = await fetchJSON(`/api/admin/iptv/playlists/${encodeURIComponent(playlist.id)}`, {
        method: 'DELETE'
      });
      if (!result.success) throw new Error(result.error || 'Failed to remove playlist');
      await loadIptv();
      toast(`Playlist "${playlist.name || 'Untitled'}" removed`);
    } catch (error) {
      toast(`Failed to remove playlist: ${error.message}`, 'error');
    }
  }

  async function handleIptvTogglePlaylist(index) {
    const playlist = state.iptvPlaylists[index];
    if (!playlist) return;
    const wasEnabled = playlist.enabled !== false;
    try {
      const result = await fetchJSON(`/api/admin/iptv/playlists/${encodeURIComponent(playlist.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !wasEnabled })
      });
      if (!result.success) throw new Error(result.error || 'Failed to update playlist');
      playlist.enabled = !wasEnabled;
      renderIptvPlaylists();
      toast(`Playlist ${wasEnabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast(`Failed to update playlist: ${error.message}`, 'error');
    }
  }

  async function handleIptvSyncPlaylist(index) {
    const playlist = state.iptvPlaylists[index];
    if (!playlist) return;
    try {
      playlist.syncing = true;
      renderIptvPlaylists();
      await fetchJSON(`/api/admin/iptv/playlists/${encodeURIComponent(playlist.id)}/sync`, {
        method: 'POST'
      });
      await loadIptv();
      toast(`Playlist "${playlist.name || 'Untitled'}" synced`);
    } catch (error) {
      playlist.lastError = error.message;
      renderIptvPlaylists();
      toast(`Sync failed: ${error.message}`, 'error');
    } finally {
      playlist.syncing = false;
      renderIptvPlaylists();
    }
  }

  async function handleIptvToggleChannel(channelId) {
    const channel = state.iptvChannels.find((ch) => ch.id === channelId);
    if (!channel) return;
    const wasEnabled = channel.enabled !== false;
    try {
      const result = await fetchJSON(`/api/admin/iptv/channels/${encodeURIComponent(channelId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !wasEnabled })
      });
      if (!result.success) throw new Error(result.error || 'Failed to update channel');
      channel.enabled = !wasEnabled;
      renderIptvChannels();
      toast(`Channel ${wasEnabled ? 'disabled' : 'enabled'}`);
    } catch (error) {
      toast(`Failed to update channel: ${error.message}`, 'error');
    }
  }

  function bindIptvControls() {
    const addName = $('#iptvPlaylistName');
    if (addName) addName.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); handleIptvAddPlaylist(); }
    });
    const addUrl = $('#iptvPlaylistUrl');
    if (addUrl) addUrl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); handleIptvAddPlaylist(); }
    });
    const addBtn = $('#iptvAddPlaylistBtn');
    if (addBtn) addBtn.addEventListener('click', handleIptvAddPlaylist);

    const search = $('#iptvChannelSearch');
    if (search) {
      search.addEventListener('input', () => {
        state.iptvChannelSearch = search.value;
        renderIptvChannels();
      });
    }
    const group = $('#iptvChannelGroup');
    if (group) {
      group.addEventListener('change', () => {
        state.iptvChannelGroup = group.value;
        renderIptvChannels();
      });
    }

    document.addEventListener('click', (event) => {
      const action = event.target.closest('[data-iptv-action]');
      if (!action) return;
      const kind = action.dataset.iptvAction;
      const index = Number(action.dataset.iptvIndex);
      const channel = action.dataset.iptvChannel;
      if (kind === 'remove') { event.preventDefault(); handleIptvRemovePlaylist(index); return; }
      if (kind === 'toggle') { event.preventDefault(); handleIptvTogglePlaylist(index); return; }
      if (kind === 'sync') { event.preventDefault(); handleIptvSyncPlaylist(index); return; }
      if (kind === 'toggle-channel') { event.preventDefault(); handleIptvToggleChannel(channel); return; }
    });

    const refresh = $('#iptvRefreshBtn');
    if (refresh) refresh.addEventListener('click', loadIptv);

    setInterval(() => {
      if (!document.hidden && state.activePanel === 'panel-iptv') loadIptv();
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.activePanel === 'panel-iptv') loadIptv();
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', async () => {
    initThemeControls();
    bindNavigation();
    bindSecretActions();
    bindFormControls();
    bindDashboardControls();
    bindSessionRevalidation();
    bindIptvControls();

    const hash = location.hash.replace('#', '');
    const initialPanel = PANEL_IDS.includes(hash) ? hash : 'panel-status';
    await loadConfig({ silent: true }).catch(() => null);
    navTo(initialPanel, { initial: true });
    await loadDashboard({ silent: true });
  });
})();
