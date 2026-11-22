const DEFAULTS = {
  format: 'png',
  quality: 92,
  hideFixed: true,
  prescroll: true,
  settleMs: 220,
  maxMegapixels: 120,
  saveAs: false,
};

const FIELDS = Object.keys(DEFAULTS);
const el = (id) => document.getElementById(id);
const isBool = (k) => typeof DEFAULTS[k] === 'boolean';
const isNum = (k) => typeof DEFAULTS[k] === 'number';

function paint(values) {
  for (const k of FIELDS) {
    const node = el(k);
    if (!node) continue;
    if (isBool(k)) node.checked = !!values[k];
    else node.value = values[k];
  }
  el('qualityRow').classList.toggle('hidden', values.format !== 'jpeg');
}

function read() {
  const out = {};
  for (const k of FIELDS) {
    const node = el(k);
    if (!node) continue;
    if (isBool(k)) out[k] = node.checked;
    else if (isNum(k)) {
      const n = Number(node.value);
      const lo = Number(node.min);
      const hi = Number(node.max);
      out[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[k];
    } else out[k] = node.value;
  }
  return out;
}

let timer = null;
function flashSaved() {
  const s = el('saved');
  s.classList.add('on');
  clearTimeout(timer);
  timer = setTimeout(() => s.classList.remove('on'), 900);
}

async function save() {
  const values = read();
  await chrome.storage.sync.set(values);
  paint(values);
  flashSaved();
}

(async () => {
  const stored = await chrome.storage.sync.get(null);
  paint({ ...DEFAULTS, ...stored });
  for (const k of FIELDS) {
    const node = el(k);
    if (node) node.addEventListener('change', save);
  }
  el('reset').addEventListener('click', async () => {
    await chrome.storage.sync.set(DEFAULTS);
    paint(DEFAULTS);
    flashSaved();
  });
})();
