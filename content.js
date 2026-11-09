(() => {
  const SEEK_SECONDS = 10;
  const OVERLAY_FLASH_MS = 1500;
  const OVERLAY_MIN_WIDTH = 120;
  const OVERLAY_MIN_HEIGHT = 60;
  const GUARD_WINDOW_MS = 1000;
  const GUARD_MAX_CORRECTIONS = 5;

  const OVERLAY_CSS = `
    :host { all: initial; }
    .ctrl {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px 6px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font: 600 13px/1.2 system-ui, -apple-system, sans-serif;
      opacity: 0.35;
      transition: opacity 0.2s;
      user-select: none;
      cursor: default;
    }
    .ctrl:hover, .ctrl.flash { opacity: 1; }
    button {
      display: none;
      border: 0;
      margin: 0;
      padding: 0 5px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ctrl:hover button { display: inline-block; }
    button:hover { color: #7cc4ff; }
  `;

  const media = new Set();
  const overlays = new Map();
  let settings = { ...SC_DEFAULTS };
  let currentSpeed = 1;
  let overlayVisible = true;
  let corrections = [];
  let active = false;
  let ready = Promise.resolve();

  // --- Speed ---

  function applyTo(el) {
    if (el.defaultPlaybackRate !== currentSpeed) el.defaultPlaybackRate = currentSpeed;
    if (el.playbackRate !== currentSpeed) el.playbackRate = currentSpeed;
  }

  function setSpeed(speed, { persist = true } = {}) {
    currentSpeed = clampSpeed(speed);
    media.forEach(applyTo);
    overlays.forEach((o) => updateOverlay(o, true));
    if (persist && settings.rememberSpeed) {
      try {
        chrome.storage.local.set({ lastSpeed: currentSpeed });
      } catch {
        // Extension was reloaded; this orphaned script can no longer reach storage.
      }
    }
    return currentSpeed;
  }

  function onReapply(e) {
    applyTo(e.target);
    const o = overlays.get(e.target);
    if (o) placeOverlay(o);
  }

  // Sites (e.g. YouTube) reset playbackRate on their own. Put ours back, but if the
  // site keeps fighting, accept its value instead of ping-ponging forever.
  function onRateChange(e) {
    if (isOrphaned()) return stop();
    const el = e.target;
    if (el.playbackRate === currentSpeed) return;
    const now = performance.now();
    corrections = corrections.filter((t) => now - t < GUARD_WINDOW_MS);
    if (corrections.length >= GUARD_MAX_CORRECTIONS) {
      corrections = [];
      setSpeed(el.playbackRate, { persist: false });
      return;
    }
    corrections.push(now);
    applyTo(el);
  }

  function seek(delta) {
    const target = primaryMedia();
    if (!target) return;
    const end = target.duration || Infinity;
    target.currentTime = Math.max(0, Math.min(end, target.currentTime + delta));
  }

  function primaryMedia() {
    const list = [...media];
    const playing = list.find((m) => !m.paused);
    if (playing) return playing;
    const area = (m) => m.offsetWidth * m.offsetHeight;
    return list.sort((a, b) => area(b) - area(a))[0];
  }

  // --- Activation ---

  // After the extension is reloaded or updated, this copy loses its chrome.* APIs.
  // It must step aside so a freshly injected copy can take over the same media.
  function isOrphaned() {
    return !chrome.runtime?.id;
  }

  function activate() {
    if (active) return ready;
    active = true;
    ready = loadSettings().then((loaded) => {
      if (!active) return;
      settings = loaded;
      currentSpeed = settings.rememberSpeed ? clampSpeed(settings.lastSpeed) : 1;
      overlayVisible = settings.showOverlay;
      document.querySelectorAll('video, audio').forEach(track);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
    return ready;
  }

  function stop() {
    active = false;
    observer.disconnect();
    media.forEach(untrack);
  }

  function deactivate() {
    currentSpeed = 1;
    media.forEach(applyTo);
    stop();
  }

  // --- Media tracking ---

  function track(el) {
    if (media.has(el)) {
      const o = overlays.get(el);
      if (o) placeOverlay(o);
      return;
    }
    media.add(el);
    el.addEventListener('loadedmetadata', onReapply);
    el.addEventListener('play', onReapply);
    el.addEventListener('ratechange', onRateChange);
    applyTo(el);
    if (el instanceof HTMLVideoElement) createOverlay(el);
  }

  function untrack(el) {
    if (!media.delete(el)) return;
    el.removeEventListener('loadedmetadata', onReapply);
    el.removeEventListener('play', onReapply);
    el.removeEventListener('ratechange', onRateChange);
    removeOverlay(el);
  }

  function scan(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('video, audio')) track(node);
    node.querySelectorAll('video, audio').forEach(track);
  }

  const observer = new MutationObserver((records) => {
    let removed = false;
    for (const record of records) {
      record.addedNodes.forEach(scan);
      if (record.removedNodes.length) removed = true;
    }
    if (removed) {
      media.forEach((m) => {
        if (!m.isConnected) untrack(m);
      });
    }
  });

  // --- Overlay ---

  function createOverlay(video) {
    const host = document.createElement('sc-overlay');
    host.style.cssText = 'position:absolute;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });

    // Built with DOM APIs, not innerHTML: YouTube enforces Trusted Types.
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    const ctrl = document.createElement('div');
    ctrl.className = 'ctrl';
    const down = document.createElement('button');
    down.textContent = '−';
    down.title = 'Yavaşlat (S)';
    down.addEventListener('click', () => setSpeed(currentSpeed - settings.step));
    const label = document.createElement('span');
    const up = document.createElement('button');
    up.textContent = '+';
    up.title = 'Hızlandır (D)';
    up.addEventListener('click', () => setSpeed(currentSpeed + settings.step));
    ctrl.append(down, label, up);
    root.append(style, ctrl);

    // Keep clicks on the overlay from reaching the player (play/pause, fullscreen).
    for (const type of ['click', 'dblclick', 'mouseup', 'pointerdown', 'pointerup']) {
      host.addEventListener(type, (e) => e.stopPropagation());
    }
    host.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const o = { video, host, ctrl, label, timer: 0, resizeObserver: null };
    o.resizeObserver = new ResizeObserver(() => placeOverlay(o));
    o.resizeObserver.observe(video);
    overlays.set(video, o);
    updateOverlay(o, false);
  }

  function placeOverlay(o) {
    const { video, host } = o;
    if (!video.parentNode) return;
    if (host.parentNode !== video.parentNode) video.parentNode.insertBefore(host, video);
    const bigEnough =
      video.offsetWidth >= OVERLAY_MIN_WIDTH && video.offsetHeight >= OVERLAY_MIN_HEIGHT;
    host.style.display = overlayVisible && bigEnough ? '' : 'none';
    host.style.top = `${video.offsetTop + 8}px`;
    host.style.left = `${video.offsetLeft + 8}px`;
  }

  function updateOverlay(o, flash) {
    o.label.textContent = `${currentSpeed.toFixed(2)}x`;
    placeOverlay(o);
    if (!flash) return;
    o.ctrl.classList.add('flash');
    clearTimeout(o.timer);
    o.timer = setTimeout(() => o.ctrl.classList.remove('flash'), OVERLAY_FLASH_MS);
  }

  function removeOverlay(video) {
    const o = overlays.get(video);
    if (!o) return;
    clearTimeout(o.timer);
    o.resizeObserver.disconnect();
    o.host.remove();
    overlays.delete(video);
  }

  function toggleOverlay() {
    overlayVisible = !overlayVisible;
    overlays.forEach((o) => updateOverlay(o, overlayVisible));
  }

  // --- Keyboard ---

  const KEY_ACTIONS = {
    s: () => setSpeed(currentSpeed - settings.step),
    d: () => setSpeed(currentSpeed + settings.step),
    r: () => setSpeed(1),
    g: () => {
      const preferred = clampSpeed(settings.preferredSpeed);
      setSpeed(currentSpeed === preferred ? 1 : preferred);
    },
    z: () => seek(-SEEK_SECONDS),
    x: () => seek(SEEK_SECONDS),
    v: toggleOverlay,
  };

  function isEditable(target) {
    if (!(target instanceof Element)) return false;
    if (target.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!active || media.size === 0) return;
      if (isOrphaned()) return stop();
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
      if (typeof e.key !== 'string') return;
      const action = KEY_ACTIONS[e.key.toLowerCase()];
      if (!action || isEditable(e.composedPath()[0])) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    },
    true,
  );

  // --- Popup messages ---

  // Injected into the top frame only, so every message gets this frame's state back.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    ready
      .then(() => {
        if (msg?.type === 'activate') return activate();
        if (msg?.type === 'deactivate') return deactivate();
        if (!active || media.size === 0) return;
        if (msg?.type === 'set') setSpeed(msg.speed);
        else if (msg?.type === 'adjust') setSpeed(currentSpeed + Number(msg.delta));
      })
      .then(() => sendResponse({ active, speed: currentSpeed, mediaCount: media.size }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) settings[key] = newValue ?? SC_DEFAULTS[key];
    }
    if (changes.showOverlay) {
      overlayVisible = settings.showOverlay;
      overlays.forEach((o) => updateOverlay(o, false));
    }
  });

  // --- Init ---

  // The popup injects this script when the user turns the extension on for this tab.
  activate();
})();
