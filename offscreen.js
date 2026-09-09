/*
 * Uncropped: the canvas.
 *
 * This document exists for one missing function. A service worker has
 * OffscreenCanvas and createImageBitmap but no URL.createObjectURL, and the
 * downloads API wants a URL. So the pixels live here.
 */

// MAX_CANVAS_DIM, canvasFit and tileRect come from geometry.js, loaded first by
// offscreen.html. The arithmetic lives there because the page side needs the
// same numbers and because it is the half worth testing.

let canvas = null;
let ctx = null;
let dpr = 1;
let scale = 1;
let drawn = 0;

function init({ width, height, dpr: ratio, maxMegapixels }) {
  dpr = ratio || 1;
  const fit = canvasFit(width, height, dpr, maxMegapixels);
  scale = fit.scale;

  const w = fit.width;
  const h = fit.height;
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
  // The only fetch in the extension, and it reaches no network: captureVisibleTab
  // hands back a data: URL, and fetch is the documented way to decode one into a
  // Blob. scripts/check-package.mjs allows this exact shape and nothing wider.
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  try {
    const r = tileRect(crop, dx, dy, dpr, scale, bmp.width, bmp.height);
    if (!r) return { drawn: false };
    const { sx, sy, sw, sh, tx, ty, tw, th } = r;

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
