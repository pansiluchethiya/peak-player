'use strict';

const DISABLE_AFTER_FAILURES = 3;
const DISABLE_WINDOW_MS = 5 * 60 * 1000;
const MAX_SAMPLES = 50;

const health = new Map();

function entryFor(name) {
  const key = String(name || 'unknown').toLowerCase();
  if (!health.has(key)) {
    health.set(key, {
      name: key,
      samples: 0,
      successes: 0,
      failures: 0,
      consecutiveFailures: 0,
      totalLatencyMs: 0,
      latencySamples: 0,
      disabledUntil: 0,
      lastError: null,
      lastCheckedAt: 0,
    });
  }
  return health.get(key);
}

function recordProviderResult(name, { ok, latencyMs = 0, error = null } = {}) {
  const entry = entryFor(name);
  entry.samples += 1;
  entry.lastCheckedAt = Date.now();
  if (Number.isFinite(latencyMs) && latencyMs >= 0) {
    entry.totalLatencyMs += latencyMs;
    entry.latencySamples += 1;
  }
  if (ok) {
    entry.successes += 1;
    entry.consecutiveFailures = 0;
    entry.disabledUntil = 0;
    entry.lastError = null;
  } else {
    entry.failures += 1;
    entry.consecutiveFailures += 1;
    entry.lastError = error ? String(error) : 'unknown error';
    if (entry.consecutiveFailures >= DISABLE_AFTER_FAILURES) {
      entry.disabledUntil = Date.now() + DISABLE_WINDOW_MS;
    }
  }
  if (entry.samples > MAX_SAMPLES) {
    entry.samples = MAX_SAMPLES;
    entry.successes = Math.min(entry.successes, MAX_SAMPLES);
    entry.failures = Math.min(entry.failures, MAX_SAMPLES);
  }
  return getProviderHealth(name);
}

function getProviderHealth(name) {
  const entry = entryFor(name);
  const now = Date.now();
  const disabled = entry.disabledUntil > now;
  const successRate = entry.samples ? entry.successes / entry.samples : 0.5;
  const avgLatencyMs = entry.latencySamples
    ? Math.round(entry.totalLatencyMs / entry.latencySamples)
    : 0;
  const latencyScore = avgLatencyMs ? Math.max(0, 100 - Math.min(avgLatencyMs, 10000) / 100) : 50;
  const score = disabled ? 0 : Math.round(successRate * 70 + latencyScore * 0.3);
  return {
    name: entry.name,
    score,
    disabled,
    disabledUntil: entry.disabledUntil || null,
    successRate,
    avgLatencyMs,
    samples: entry.samples,
    consecutiveFailures: entry.consecutiveFailures,
    lastError: entry.lastError,
    lastCheckedAt: entry.lastCheckedAt || null,
  };
}

function isProviderHealthy(name) {
  return !getProviderHealth(name).disabled;
}

function getAllProviderHealth() {
  return Array.from(health.keys())
    .sort()
    .map((name) => getProviderHealth(name));
}

function resetProviderHealth() {
  health.clear();
}

module.exports = {
  DISABLE_AFTER_FAILURES,
  DISABLE_WINDOW_MS,
  getAllProviderHealth,
  getProviderHealth,
  isProviderHealthy,
  recordProviderResult,
  resetProviderHealth,
};
