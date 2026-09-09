/*
 * Uncropped: the arithmetic.
 *
 * The page side decides where to park the scroller; the canvas side decides
 * where each picture lands and how much the whole thing has to shrink to fit.
 * Both are pure functions of numbers, and both are the part of this extension
 * that can be wrong while everything still looks like it worked: a seam, a
 * doubled strip, a row of missing pixels down one edge. There is no way to
 * notice that in a manifest check, so it lives here where it can be run.
 *
 * No DOM and no chrome APIs, on purpose. Loaded as a plain script beside
 * content.js and inside offscreen.html, and required directly by test.js.
 */

// Chrome refuses a canvas with a side longer than this.
const MAX_CANVAS_DIM = 16384;

/**
 * Where to park the scroller for each picture.
 *
 * Tiles land on exact viewport steps and the last one in each axis is clamped
 * to the end of the content, so it overlaps its neighbour rather than running
 * past it. The overlap is drawn at its true scroll offset, which paints the
 * same pixels over themselves: no seam, and no arithmetic to get wrong about
 * how much of the final tile is new.
 */
function tilePlan(total, crop) {
  // A scroller with no width or height cannot be stepped through, and the loops
  // below would never advance. This happened to be unreachable rather than
  // handled: a container that measures zero (collapsed, or mid-transition) took
  // the tab with it. An empty plan is the honest answer.
  if (!(crop.w > 0) || !(crop.h > 0)) {
    return { tiles: [], columns: 0, rows: 0 };
  }

  const maxX = Math.max(0, total.w - crop.w);
  const maxY = Math.max(0, total.h - crop.h);

  const xs = [];
  const ys = [];
  for (let x = 0; x < maxX; x += crop.w) xs.push(x);
  xs.push(maxX);
  for (let y = 0; y < maxY; y += crop.h) ys.push(y);
  ys.push(maxY);

  const tiles = [];
  for (const y of ys) for (const x of xs) tiles.push({ x, y });
  return { tiles, columns: xs.length, rows: ys.length };
}

/**
 * How big the stitched canvas can be, and what it costs to get there.
 *
 * Two ceilings apply: the browser's per-side limit, and an area limit that
 * keeps peak memory sane, because the bitmap costs four bytes per pixel while
 * the encoder holds a second copy. Long pages meet the area one first.
 *
 * `scale` is never above 1: a short page is drawn at its own size rather than
 * blown up to fill the allowance.
 */
function canvasFit(width, height, dpr, maxMegapixels, maxDim = MAX_CANVAS_DIM) {
  const ratio = dpr || 1;
  const pw = width * ratio;
  const ph = height * ratio;
  if (!(pw > 0) || !(ph > 0)) {
    return { width: 1, height: 1, scale: 1 };
  }
  const area = (maxMegapixels || 120) * 1e6;
  const scale = Math.min(1, maxDim / pw, maxDim / ph, Math.sqrt(area / (pw * ph)));
  return {
    width: Math.max(1, Math.floor(pw * scale)),
    height: Math.max(1, Math.floor(ph * scale)),
    scale,
  };
}

/**
 * Which pixels of one viewport capture to copy, and where they go.
 *
 * `crop` is the part of the capture that belongs to the scroller, in CSS
 * pixels; `dx`/`dy` are the scroll offsets that picture was taken at. The
 * source rectangle is clamped to the bitmap, because a fractional
 * devicePixelRatio rounds to a pixel the capture does not have. Returns null
 * when there is nothing to draw.
 */
function tileRect(crop, dx, dy, dpr, scale, bitmapWidth, bitmapHeight) {
  const sx = Math.max(0, Math.round(crop.x * dpr));
  const sy = Math.max(0, Math.round(crop.y * dpr));
  const sw = Math.min(Math.round(crop.w * dpr), bitmapWidth - sx);
  const sh = Math.min(Math.round(crop.h * dpr), bitmapHeight - sy);
  if (sw <= 0 || sh <= 0) return null;
  return {
    sx,
    sy,
    sw,
    sh,
    tx: Math.round(dx * dpr * scale),
    ty: Math.round(dy * dpr * scale),
    tw: Math.max(1, Math.round(sw * scale)),
    th: Math.max(1, Math.round(sh * scale)),
  };
}

// For test.js only. A plain <script> and executeScript both leave `module`
// undefined, so this is inert everywhere the extension actually runs.
if (typeof module !== 'undefined') {
  module.exports = { MAX_CANVAS_DIM, tilePlan, canvasFit, tileRect };
}
