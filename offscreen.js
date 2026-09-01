/*
 * Uncropped: the canvas.
 *
 * This document exists for one missing function. A service worker has
 * OffscreenCanvas and createImageBitmap but no URL.createObjectURL, and the
 * downloads API wants a URL. So the pixels live here.
 */

const MAX_DIM = 16384; // Chrome refuses a canvas with a side longer than this

let canvas = null;
let ctx = null;
let dpr = 1;
let scale = 1;
let drawn = 0;

function init({ width, height, dpr: ratio, maxMegapixels }) {
  dpr = ratio || 1;
  const pw = width * dpr;
  const ph = height * dpr;
  const area = (maxMegapixels || 120) * 1e6;

  // Two ceilings apply: the browser's per side limit, and an area limit that
  // keeps peak memory sane, because the bitmap costs four bytes per pixel while
  // the encoder holds a second copy. Long pages meet the area one first.
  scale = Math.min(1, MAX_DIM / pw, MAX_DIM / ph, Math.sqrt(area / (pw * ph)));

  const w = Math.max(1, Math.floor(pw * scale));
  const h = Math.max(1, Math.floor(ph * scale));
  canvas = new OffscreenCanvas(w, h);
  ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff'; // shows only where a page paints nothing at all
  ctx.fillRect(0, 0, w, h);
  drawn = 0;
  return { width: w, height: h, scale };
}

async function draw({ dataUrl, dx, dy, crop }) {
  if (!ctx) throw new Error('no canvas: INIT first');
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  try {
    // Source rectangle inside the viewport capture, in device pixels, clamped
    // so a fractional devicePixelRatio cannot ask for a pixel that is not there.
    const sx = Math.max(0, Math.round(crop.x * dpr));
    const sy = Math.max(0, Math.round(crop.y * dpr));
    const sw = Math.min(Math.round(crop.w * dpr), bmp.width - sx);
    const sh = Math.min(Math.round(crop.h * dpr), bmp.height - sy);
    if (sw <= 0 || sh <= 0) return { drawn: false };

    const tx = Math.round(dx * dpr * scale);
    const ty = Math.round(dy * dpr * scale);
    const tw = Math.max(1, Math.round(sw * scale));
    const th = Math.max(1, Math.round(sh * scale));

    ctx.drawImage(bmp, sx, sy, sw, sh, tx, ty, tw, th);
    drawn++;
    return { drawn: true, tx, ty, tw, th };
  } finally {
    bmp.close();
  }
}

async function finish({ format, quality }) {
  if (!canvas) throw new Error('no canvas: INIT first');
  const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await canvas.convertToBlob(
    type === 'image/jpeg' ? { type, quality: (quality || 92) / 100 } : { type }
  );
  const out = {
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
    tiles: drawn,
    scale,
  };
  canvas = null; // let the bitmap go before the file is written
  ctx = null;
  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || msg.target !== 'offscreen') return;
  (async () => {
    try {
      if (msg.type === 'INIT') reply({ ok: true, data: init(msg) });
      else if (msg.type === 'DRAW') reply({ ok: true, data: await draw(msg) });
      else if (msg.type === 'FINISH') reply({ ok: true, data: await finish(msg) });
      else if (msg.type === 'REVOKE') {
        URL.revokeObjectURL(msg.url);
        reply({ ok: true });
      } else reply({ ok: false, error: 'unknown message ' + msg.type });
    } catch (e) {
      reply({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});
