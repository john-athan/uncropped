/*
 * Uncropped: the part that does the arithmetic.
 *
 * A service worker cannot hold a canvas result long enough to hand it to the
 * downloads API, because it has no URL.createObjectURL. So the shape is:
 * this worker drives the page and the capture API, and an offscreen document
 * owns the canvas and produces the file.
 *
 *   action click
 *     -> inject content.js            (activeTab, granted by the click)
 *     -> PREPARE: plan the tiles
 *     -> per tile: GOTO, captureVisibleTab, DRAW
 *     -> RESTORE the page, FINISH the canvas, download
 */

const DEFAULTS = {
  format: 'png',
  quality: 92,
  hideFixed: true,
  prescroll: true,
  settleMs: 220,
  maxMegapixels: 120,
  saveAs: false,
};

// captureVisibleTab is rate limited, and the published limit is lower than what
// the browser actually serves. Rather than pay the worst case on every tile, we
// start optimistic and let the browser teach us the real number.
const GAP_MIN = 120;
const GAP_MAX = 950;
let gap = 150;
let clean = 0;

const busy = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const have = await chrome.storage.sync.get(null);
  await chrome.storage.sync.set({ ...DEFAULTS, ...have });
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener((tab) => {
  run(tab).catch(async (err) => {
    console.error('[uncropped]', err);
    flag('ERR', '#8b1d1d');
    await toast(tab.id, 'Uncropped: ' + ((err && err.message) || err), true);
    setTimeout(() => flag(''), 7000);
  });
});

function flag(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

const toPage = (tabId, msg) => chrome.tabs.sendMessage(tabId, { target: 'page', ...msg });

async function ask(tabId, msg) {
  const res = await toPage(tabId, msg);
  if (!res || !res.ok) throw new Error((res && res.error) || 'the page stopped answering');
  return res.data;
}

const toast = (tabId, text, bad) => toPage(tabId, { type: 'TOAST', text, bad }).catch(() => {});

// ------------------------------------------------------------- offscreen doc

let creating = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['BLOBS'],
        justification: 'Stitch the captured tiles onto one canvas and encode the file.',
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

async function toCanvas(msg) {
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', ...msg });
  if (!res || !res.ok) throw new Error((res && res.error) || 'stitching failed');
  return res.data;
}

// ------------------------------------------------------------------ capture

const isQuota = (e) => /MAX_CAPTURE|quota|too many|rate/i.test(String(e));

async function captureTile(windowId, format, quality) {
  const opts = format === 'jpeg' ? { format: 'jpeg', quality } : { format: 'png' };
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const url = await chrome.tabs.captureVisibleTab(windowId, opts);
      if (++clean >= 4) {
        clean = 0;
        gap = Math.max(GAP_MIN, gap - 40); // the browser is keeping up, push
      }
      return url;
    } catch (e) {
      last = e;
      if (!isQuota(e)) throw e;
      clean = 0;
      gap = Math.min(GAP_MAX, gap + 180); // it is not keeping up, back off
      await sleep(gap);
    }
  }
  throw new Error('the browser kept refusing captures: ' + ((last && last.message) || last));
}

async function assertStillInFront(tabId, href) {
  const t = await chrome.tabs.get(tabId);
  if (!t.active) throw new Error('the tab left the foreground, so there was nothing to photograph');
  if (t.url && href && t.url !== href) throw new Error('the page navigated away mid capture');
  return t;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

const human = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' kB' : (n / 1048576).toFixed(1) + ' MB');

// --------------------------------------------------------------------- run

async function run(tab) {
  if (!tab || !tab.id) throw new Error('no active tab');
  if (!/^(https?|file):/.test(tab.url || '')) {
    throw new Error(
      'Chrome does not let any extension read this page. That covers chrome:// pages, the Web Store, and other extensions.'
    );
  }
  if (busy.has(tab.id)) throw new Error('already capturing this tab');
  busy.add(tab.id);

  const t0 = performance.now();
  const opts = { ...DEFAULTS, ...(await chrome.storage.sync.get(null)) };

  try {
    flag('...', '#2b6cb0');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

    const plan = await ask(tab.id, {
      type: 'PREPARE',
      opts: { prescroll: opts.prescroll },
    });

    await ensureOffscreen();
    const sheet = await toCanvas({
      type: 'INIT',
      width: plan.total.w,
      height: plan.total.h,
      dpr: plan.dpr,
      maxMegapixels: opts.maxMegapixels,
    });

    try {
      for (let i = 0; i < plan.tiles.length; i++) {
        const tile = plan.tiles[i];
        await assertStillInFront(tab.id, plan.href);
        const at = await ask(tab.id, {
          type: 'GOTO',
          x: tile.x,
          y: tile.y,
          hideFixed: opts.hideFixed && i > 0,
          settleMs: opts.settleMs,
        });
        const dataUrl = await captureTile(tab.windowId, opts.format, opts.quality);
        await toCanvas({ type: 'DRAW', dataUrl, dx: at.x, dy: at.y, crop: at.crop });
        flag(Math.round(((i + 1) / plan.tiles.length) * 100) + '%', '#2b6cb0');
        if (i < plan.tiles.length - 1) await sleep(gap);
      }
    } finally {
      await ask(tab.id, { type: 'RESTORE' }).catch(() => {});
    }

    const out = await toCanvas({ type: 'FINISH', format: opts.format, quality: opts.quality });
    const ext = opts.format === 'jpeg' ? 'jpg' : 'png';
    const id = await chrome.downloads.download({
      url: out.url,
      filename: `Uncropped/${plan.host}-${stamp()}.${ext}`,
      saveAs: !!opts.saveAs,
    });

    chrome.downloads.onChanged.addListener(function done(delta) {
      if (delta.id !== id) return;
      if (!delta.state || delta.state.current === 'in_progress') return;
      chrome.downloads.onChanged.removeListener(done);
      chrome.runtime
        .sendMessage({ target: 'offscreen', type: 'REVOKE', url: out.url })
        .catch(() => {});
    });

    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const note =
      `${out.width} x ${out.height}, ${human(out.bytes)}, ${plan.tiles.length} tiles, ${secs}s` +
      (out.scale < 1 ? ` (scaled to ${Math.round(out.scale * 100)}%, canvas ceiling)` : '') +
      (plan.isDocument ? '' : `, inner scroller ${plan.scroller}`);
    flag('');
    await toast(tab.id, 'Uncropped: ' + note, false);
    console.log('[uncropped]', { plan, out, gap, seconds: +secs });
  } finally {
    busy.delete(tab.id);
  }
}
