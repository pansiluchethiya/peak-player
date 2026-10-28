'use strict';

// Live TV guide endpoints. The player calls this with a catalogue channel id
// (for example `cnn.us`). Unknown ids are not an error: they return an empty
// schedule with 200 so the UI can show "no guide data" without a failure state.

const { getEpg: defaultGetEpg } = require('../utils/iptvEpg');

function emptyEpg() {
  return { now: null, next: null, schedule: [] };
}

function createLiveRoutes(app, deps = {}) {
  const getEpg = deps.getEpg || defaultGetEpg;

  app.get('/api/v1/live/tv/epg/:id', async (req, res) => {
    try {
      const epg = await getEpg(String(req.params.id), { now: Date.now() });
      const payload = epg && typeof epg === 'object' ? epg : emptyEpg();
      return res.json({
        success: true,
        epg: {
          now: payload.now ?? null,
          next: payload.next ?? null,
          schedule: Array.isArray(payload.schedule) ? payload.schedule : [],
        },
      });
    } catch {
      return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
    }
  });
}

module.exports = { createLiveRoutes };
