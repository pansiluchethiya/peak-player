'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Eye, EyeOff, Lock, Clock, Activity, Sliders, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginStatus {
  message: string;
  kind: 'success' | 'error' | 'neutral';
}

const features = [
  { icon: Activity, title: 'Live provider health', body: 'Know which sources are answering before playback does.' },
  { icon: Sliders, title: 'Precision controls', body: 'Quality floors, codec rules, and per-provider defaults.' },
  { icon: ShieldCheck, title: 'Local by design', body: 'Your keys and sessions stay inside your deployment.' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<LoginStatus>({ message: '', kind: 'neutral' });
  const [submitting, setSubmitting] = useState(false);
  const [lockout, setLockout] = useState<{ until: number } | null>(null);
  const [pwPanelOpen, setPwPanelOpen] = useState(false);

  useEffect(() => {
    // Mirror login.js #checkSession: if already authenticated, go to dashboard.
    fetch('/auth/session', { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.authenticated) window.location.href = '/';
      })
      .catch(() => {
        /* A failed check should never block the sign-in form. */
      });
  }, []);

  useEffect(() => {
    if (!lockout) return;
    const id = setInterval(() => {
      if (Date.now() >= lockout.until) setLockout(null);
    }, 1000);
    return () => clearInterval(id);
  }, [lockout]);

  function setStatusMsg(message: string, kind: LoginStatus['kind']) {
    setStatus({ message, kind });
  }

  async function login(username: string, password: string) {
    setStatusMsg('Signing in…', 'neutral');
    setSubmitting(true);
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!data.success) {
        if (data.error === 'LOCKED' || data.error === 'TOO_MANY_ATTEMPTS') {
          const retry = Number(data.retryAfter);
          if (Number.isFinite(retry) && retry > 0) setLockout({ until: Date.now() + retry * 1000 });
          setStatusMsg('Locked after too many attempts. Wait for the timer, then try again.', 'error');
        } else if (data.error === 'INVALID_CREDENTIALS') {
          const suffix =
            typeof data.remaining === 'number'
              ? ` · ${data.remaining} attempt${data.remaining === 1 ? '' : 's'} left`
              : '';
          setStatusMsg(`That username or password is not right${suffix}`, 'error');
        } else {
          setStatusMsg(data.error || 'Sign in failed', 'error');
        }
        return;
      }

      setStatusMsg('Signed in. Redirecting…', 'success');
      window.setTimeout(() => {
        window.location.href = '/';
      }, 350);
    } catch {
      setStatusMsg('Could not reach the Peak API. Check the server and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <a className="skip-link" href="#mainContent">
        Skip to sign in
      </a>

      <section className="auth-story" aria-label="About Peak">
        <div className="auth-story-top">
          <a className="brand brand-on-dark" href="/" aria-label="Peak home">
            <img className="brand-mark" src="/assets/peak-mark.svg" alt="" width={42} height={42} />
            <span className="brand-word">peak</span>
            <span className="brand-tag">admin</span>
          </a>
          <span className="auth-edition">Self-hosted · v1.0.0</span>
        </div>

        <div className="auth-story-copy">
          <p className="auth-kicker">
            <span /> Streaming control plane
          </p>
          <h1>
            Everything you stream,
            <br />
            <em>at its peak.</em>
          </h1>
          <p className="auth-lede">
            One quiet dashboard for provider health, smart filtering, and the credentials that keep
            your sources flowing.
          </p>
          <ul className="auth-features">
            {features.map((f) => (
              <li key={f.title}>
                <span className="auth-feature-icon"><f.icon className="icon" aria-hidden /></span>
                <span>
                  <strong>{f.title}</strong>
                  <small>{f.body}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-scenery" aria-hidden="true">
          <svg viewBox="0 0 760 240" preserveAspectRatio="none">
            <path
              className="ridge-back"
              d="M0 238 110 126l62 60 98-112 79 91 62-44 110 117Z"
            />
            <path
              className="ridge-front"
              d="M0 240 132 150l52 38 88-90 67 85 74-50 90 64 95-45 162 88Z"
            />
            <circle className="auth-sun" cx="642" cy="65" r="27" />
          </svg>
        </div>
        <p className="auth-copyright">
          Peak <span aria-hidden="true">·</span> MIT licensed <span aria-hidden="true">·</span> Built for your own
          infrastructure
        </p>
      </section>

      <main className="auth-main" id="mainContent" tabIndex={-1}>
        <div className="auth-toolbar">
          <span className="auth-toolbar-label">Admin access</span>
          <ThemeToggle />
        </div>

        <div className="auth-card-wrap">
          <div className="login-card" id="loginCard">
            <div className="auth-mobile-brand">
              <img className="brand-mark" src="/assets/peak-mark.svg" alt="" width={36} height={36} />
              <span className="brand-word">peak</span>
            </div>
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to Peak</h2>
            <p className="auth-card-sub">Manage sources, filtering, and runtime settings.</p>

            {lockout && (
              <div className="alert danger" role="alert">
                <Lock />
                <div>
                  <strong>Too many attempts.</strong> Try again in{' '}
                  <span id="lockoutCountdown">{Math.max(0, Math.ceil((lockout.until - Date.now()) / 1000))}</span>
                  <span>s.</span>
                </div>
              </div>
            )}

            <form
              id="loginForm"
              className="auth-form"
              autoComplete="on"
              onSubmit={(e) => {
                e.preventDefault();
                const u = username.trim();
                if (!u || !password) {
                  setStatusMsg('Enter your username and password.', 'error');
                  return;
                }
                login(u, password);
              }}
            >
              <div className="field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="password-field">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <button id="loginBtn" className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
              <div className="status" id="status" aria-live="polite">
                {status.message && <span className={`status-${status.kind}`}>{status.message}</span>}
              </div>
            </form>

            <div className="auth-divider">
              <span>Session</span>
            </div>
            <div className="auth-meta-row">
              <span className="auth-expiry">
                <Clock /> Expires after 12 hours or a restart
              </span>
              <button
                id="togglePw"
                className="link-btn"
                type="button"
                aria-expanded={pwPanelOpen}
                onClick={() => setPwPanelOpen(!pwPanelOpen)}
              >
                {pwPanelOpen ? 'Close password form' : 'Change password'}
              </button>
            </div>

            {pwPanelOpen && (
              <div className="pw-change" id="pwChange">
                <div className="pw-change-head">
                  <h3>Change password</h3>
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label="Close password form"
                    onClick={() => setPwPanelOpen(false)}
                  >
                    <AlertCircle />
                  </button>
                </div>
                <form
                  id="pwForm"
                  className="auth-form"
                  autoComplete="on"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const oldPw = (e.target.elements.oldPw as HTMLInputElement).value;
                    const newPw = (e.target.elements.newPw as HTMLInputElement).value;
                    if (!oldPw) return;
                    if (newPw.length < 8) return;
                    if (newPw === oldPw) return;
                    // Wired in Sub-project C (requires API session).
                  }}
                >
                  <input className="sr-only" type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
                  <div className="field">
                    <label htmlFor="oldPw">Current password</label>
                    <div className="password-field">
                      <input id="oldPw" type="password" autoComplete="current-password" required />
                      <button className="password-toggle" type="button" aria-label="Show current password" aria-pressed="false">
                        <Eye />
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="newPw">New password</label>
                    <div className="password-field">
                      <input id="newPw" type="password" autoComplete="new-password" minLength={8} required />
                      <button className="password-toggle" type="button" aria-label="Show new password" aria-pressed="false">
                        <Eye />
                      </button>
                    </div>
                    <p className="hint">Use at least 8 characters.</p>
                  </div>
                  <button id="pwBtn" className="btn btn-primary btn-block" type="submit">
                    Update password
                  </button>
                  <div className="status" id="pwStatus" aria-live="polite" />
                </form>
              </div>
            )}

            <div className="auth-default-note">
              <Lock />
              <p>
                First run? The default account is <strong>admin</strong> with password <strong>change-me</strong>
                . Change it immediately.
              </p>
            </div>
          </div>
        </div>

        <footer className="auth-footer">
          <span>Peak admin</span>
          <span>Protected by local sessions</span>
        </footer>
      </main>
    </div>
  );
}
