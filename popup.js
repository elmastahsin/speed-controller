const PRESETS = [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const CONTENT_FILES = ['settings.js', 'content.js'];

const STATUS = {
  inactive: 'Bu sekmede kapalı. Diğer sekmeler etkilenmez.',
  noMedia: 'Sayfada video/audio bulunamadı.',
  restricted: 'Bu sayfada çalıştırılamaz (brave:// ve Web Store sayfaları gibi).',
};

const $ = (id) => document.getElementById(id);

let tabId = null;
let settings = { ...SC_DEFAULTS };
let state = { active: false };

function formatSpeed(speed) {
  return `${speed.toFixed(2)}x`;
}

async function send(message) {
  if (tabId === null) return undefined;
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Not turned on in this tab yet, or the page was reloaded since.
    return undefined;
  }
}

async function inject() {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
  } catch {
    return { active: false, restricted: true };
  }
  return send({ type: 'get' });
}

function render(next) {
  state = next ?? { active: false };
  const ok = Boolean(state.active && state.mediaCount);
  document.querySelectorAll('[data-speed-control]').forEach((b) => {
    b.disabled = !ok;
  });
  $('speed').textContent = ok ? formatSpeed(state.speed) : '—';
  document.querySelectorAll('#presets button').forEach((b) => {
    b.classList.toggle('active', ok && Number(b.dataset.speed) === state.speed);
  });

  const toggle = $('toggle');
  toggle.disabled = Boolean(state.restricted);
  toggle.textContent = state.active ? 'Bu sekmede kapat' : 'Bu sekmede aç';
  toggle.classList.toggle('on', Boolean(state.active));

  let status = '';
  if (state.restricted) status = STATUS.restricted;
  else if (!state.active) status = STATUS.inactive;
  else if (!state.mediaCount) status = STATUS.noMedia;
  $('status').textContent = status;
  $('status').hidden = !status;
}

async function toggleActive() {
  $('toggle').disabled = true;
  if (state.active) {
    render(await send({ type: 'deactivate' }));
    return;
  }
  render((await send({ type: 'activate' })) ?? (await inject()));
}

function renderPresets() {
  for (const speed of PRESETS) {
    const button = document.createElement('button');
    button.textContent = formatSpeed(speed);
    button.dataset.speed = String(speed);
    button.dataset.speedControl = '';
    button.addEventListener('click', async () => render(await send({ type: 'set', speed })));
    $('presets').append(button);
  }
}

function fillSettings() {
  $('step').value = settings.step;
  $('preferredSpeed').value = settings.preferredSpeed;
  $('rememberSpeed').checked = settings.rememberSpeed;
  $('showOverlay').checked = settings.showOverlay;
}

function readSettings() {
  const step = Number($('step').value);
  return {
    step: step > 0 && step <= 1 ? Math.round(step * 100) / 100 : settings.step,
    preferredSpeed: clampSpeed($('preferredSpeed').value),
    rememberSpeed: $('rememberSpeed').checked,
    showOverlay: $('showOverlay').checked,
  };
}

async function init() {
  renderPresets();

  $('toggle').addEventListener('click', toggleActive);
  $('down').addEventListener('click', async () =>
    render(await send({ type: 'adjust', delta: -settings.step })),
  );
  $('up').addEventListener('click', async () =>
    render(await send({ type: 'adjust', delta: settings.step })),
  );
  $('reset').addEventListener('click', async () => render(await send({ type: 'set', speed: 1 })));

  $('settings').addEventListener('change', async () => {
    const next = readSettings();
    settings = { ...settings, ...next };
    fillSettings();
    await chrome.storage.local.set(next);
  });

  settings = await loadSettings();
  fillSettings();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  render(await send({ type: 'get' }));
}

init();
