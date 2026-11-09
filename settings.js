// Shared by content.js and popup.js (loaded as a classic script in both).
// `var`, not `const`: the popup may inject this file again into a tab whose previous
// copy came from an older version of the extension, and `const` would throw there.

var SC_DEFAULTS = {
  step: 0.1,
  preferredSpeed: 1.8,
  rememberSpeed: false,
  showOverlay: true,
  lastSpeed: 1.0,
};

var SC_MIN_SPEED = 0.1;
var SC_MAX_SPEED = 16;

function clampSpeed(speed) {
  const n = Number(speed);
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(SC_MAX_SPEED, Math.max(SC_MIN_SPEED, n));
  return Math.round(clamped * 100) / 100;
}

function loadSettings() {
  return chrome.storage.local.get(SC_DEFAULTS);
}
