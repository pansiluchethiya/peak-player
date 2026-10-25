/* eslint-env browser */
(function () {
  'use strict';

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  let lockoutTimer = null;

  function setStatus(element, message, kind) {
    if (!element) return;
    element.textContent = message || '';
    element.className = 'status' + (kind ? ' ' + kind : '');
  }

  async function checkSession() {
    try {
      const response = await fetch('/auth/session', { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (data && data.authenticated) {
        window.location.href = '/config.html';
        return true;
      }
    } catch (error) {
      /* A failed check should never block the sign-in form. */
    }
    return false;
  }

  async function login(username, password) {
    const status = $('#status');
    const button = $('#loginBtn');
    setStatus(status, 'Signing in…');
    if (button) {
      button.disabled = true;
      button.dataset.label = button.textContent;
      button.textContent = 'Signing in…';
    }

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!data.success) {
        if (data.error === 'LOCKED' || data.error === 'TOO_MANY_ATTEMPTS') {
          showLockout(data.retryAfter);
          setStatus(status, 'Locked after too many attempts. Wait for the timer, then try again.', 'error');
        } else if (data.error === 'INVALID_CREDENTIALS') {
          const suffix = typeof data.remaining === 'number'
            ? ` · ${data.remaining} attempt${data.remaining === 1 ? '' : 's'} left`
            : '';
          setStatus(status, 'That username or password is not right' + suffix, 'error');
          const passwordInput = $('#password');
          if (passwordInput) {
            passwordInput.focus();
            passwordInput.select();
          }
        } else {
          setStatus(status, data.error || 'Sign in failed', 'error');
        }
        return false;
      }

      setStatus(status, 'Signed in. Redirecting…', 'success');
      window.setTimeout(() => { window.location.href = '/config.html'; }, 350);
      return true;
    } catch (error) {
      setStatus(status, 'Could not reach the Peak API. Check the server and try again.', 'error');
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.label || 'Sign in';
      }
    }
  }

  function showLockout(retryAfterSeconds) {
    const banner = $('#lockoutBanner');
    const countdown = $('#lockoutCountdown');
    if (!banner || !countdown) return;

    const seconds = Number(retryAfterSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      banner.hidden = true;
      return;
    }

    const end = Date.now() + seconds * 1000;
    banner.hidden = false;

    const tick = () => {
      const remaining = end - Date.now();
      if (remaining <= 0) {
        window.clearInterval(lockoutTimer);
        lockoutTimer = null;
        banner.hidden = true;
        countdown.textContent = '00:00';
        return;
      }
      const total = Math.ceil(remaining / 1000);
      const minutes = String(Math.floor(total / 60)).padStart(2, '0');
      const rest = String(total % 60).padStart(2, '0');
      countdown.textContent = minutes + ':' + rest;
    };

    if (lockoutTimer) window.clearInterval(lockoutTimer);
    tick();
    lockoutTimer = window.setInterval(tick, 1000);
  }

  async function changePassword(oldPassword, newPassword) {
    const status = $('#pwStatus');
    const button = $('#pwBtn');
    setStatus(status, 'Updating…');
    if (button) button.disabled = true;

    try {
      const response = await fetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await response.json();

      if (!data.success) {
        setStatus(status, data.error || 'Could not update the password', 'error');
        return false;
      }

      setStatus(status, 'Password updated', 'success');
      const form = $('#pwForm');
      if (form) form.reset();
      return true;
    } catch (error) {
      setStatus(status, 'Could not reach the Peak API. Try again.', 'error');
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function syncThemeControls() {
    const theme = window.PeakTheme ? window.PeakTheme.current : 'light';
    $$('[data-theme-toggle]').forEach((button) => {
      const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
    $$('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
    });
  }

  function bindTheme() {
    syncThemeControls();
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-theme-toggle]') || !window.PeakTheme) return;
      window.PeakTheme.toggle();
    });
    window.addEventListener('peak-themechange', syncThemeControls);
  }

  function bindPasswordToggles() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-password-toggle]');
      if (!button) return;
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      const label = show
        ? button.getAttribute('aria-label').replace(/^Show /, 'Hide ')
        : button.getAttribute('aria-label').replace(/^Hide /, 'Show ');
      button.setAttribute('aria-label', label);
    });
  }

  function syncPasswordUsername() {
    const source = $('#username');
    const target = $('#pwForm input[name="username"]');
    if (target) target.value = source ? source.value : '';
  }

  function setPasswordPanel(open) {
    const panel = $('#pwChange');
    const toggle = $('#togglePw');
    if (!panel || !toggle) return;

    if (open) syncPasswordUsername();
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close password form' : 'Change password';

    if (open) {
      const first = $('#oldPw');
      if (first) first.focus();
    } else {
      toggle.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindTheme();
    bindPasswordToggles();

    const params = new URLSearchParams(window.location.search);
    const status = $('#status');
    if (params.has('loggedOut')) {
      setStatus(status, 'Signed out. Your session has ended.', 'success');
    } else if (params.has('expired')) {
      setStatus(status, 'Your session expired. Sign in again to continue.', 'error');
    }
    if (params.has('loggedOut') || params.has('expired')) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    checkSession();
    syncPasswordUsername();

    const loginForm = $('#loginForm');
    if (loginForm) {
      const usernameInput = $('#username');
      if (usernameInput) usernameInput.addEventListener('input', syncPasswordUsername);
      loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const username = $('#username').value.trim();
        const password = $('#password').value;
        if (!username || !password) {
          setStatus(status, 'Enter your username and password.', 'error');
          return;
        }
        login(username, password);
      });
    }

    const togglePw = $('#togglePw');
    if (togglePw) {
      togglePw.addEventListener('click', () => {
        const panel = $('#pwChange');
        setPasswordPanel(Boolean(panel && panel.hidden));
      });
    }

    $$('[data-close-password]').forEach((button) => {
      button.addEventListener('click', () => setPasswordPanel(false));
    });

    const pwForm = $('#pwForm');
    if (pwForm) {
      pwForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const oldPassword = $('#oldPw').value;
        const newPassword = $('#newPw').value;
        const pwStatus = $('#pwStatus');
        if (!oldPassword) {
          setStatus(pwStatus, 'Enter your current password.', 'error');
          $('#oldPw').focus();
          return;
        }
        if (newPassword.length < 8) {
          setStatus(pwStatus, 'Use at least 8 characters for the new password.', 'error');
          $('#newPw').focus();
          return;
        }
        if (newPassword === oldPassword) {
          setStatus(pwStatus, 'Choose a password different from the current one.', 'error');
          $('#newPw').focus();
          return;
        }
        changePassword(oldPassword, newPassword);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const panel = $('#pwChange');
      if (panel && !panel.hidden) setPasswordPanel(false);
    });
  });
})();
