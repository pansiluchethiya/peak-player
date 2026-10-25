'use strict';

const MAX_EVENTS = 2000;
const events = [];

function recordPlaybackEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.event !== 'string') return null;
  const entry = {
    ...event,
    event: event.event,
    at: Number.isFinite(event.at) ? event.at : Date.now(),
  };
  events.push(entry);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return entry;
}

function getTelemetrySummary() {
  const byEvent = {};
  const byProvider = {};
  let firstSourceMs = null;
  let firstPlayableMs = null;
  let rebufferCount = 0;
  let errorCount = 0;

  for (const entry of events) {
    byEvent[entry.event] = (byEvent[entry.event] || 0) + 1;
    if (entry.provider) {
      const provider = String(entry.provider).toLowerCase();
      byProvider[provider] = (byProvider[provider] || 0) + 1;
    }
    if (entry.event === 'first_source' && Number.isFinite(entry.value)) {
      firstSourceMs = entry.value;
    }
    if (entry.event === 'first_playable' && Number.isFinite(entry.value)) {
      firstPlayableMs = entry.value;
    }
    if (entry.event === 'rebuffer') rebufferCount += 1;
    if (entry.event === 'error') errorCount += 1;
  }

  return {
    total: events.length,
    byEvent,
    byProvider,
    firstSourceMs,
    firstPlayableMs,
    rebufferCount,
    errorCount,
    lastEventAt: events.length ? events[events.length - 1].at : null,
  };
}

function resetTelemetry() {
  events.length = 0;
}

module.exports = {
  MAX_EVENTS,
  getTelemetrySummary,
  recordPlaybackEvent,
  resetTelemetry,
};
