/* eslint-env browser */
/* Shared admin flag helper. Loaded before /index.js in config.html. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.peakIptvFlags = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // SQLite stores flags as 0/1 while the playlists API returns booleans.
  function isEnabled(value) {
    return !(value === false || value === 0 || value === '0' || value === 'false');
  }

  return { isEnabled };
});
