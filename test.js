// The arithmetic that decides what the picture looks like.
//
// Everything else this extension has is checked by tools/validate.sh: the
// manifest is consistent, the icons are the right size, every permission is
// justified. None of that touches the part that can go wrong while still
// looking like it worked, which is where the tiles land and how they are
// scaled. That part is geometry.js, and this is it under node.
//
// Run directly (`node test.js`), through `tools/validate.sh`, or from CI.

const assert = require('node:assert/strict');
const { MAX_CANVAS_DIM, tilePlan, canvasFit, tileRect } = require('./geometry.js');

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`  ok ${name}`); };

// ---------------------------------------------------------------- tile plan

const view = { w: 1000, h: 800 };

check('a page that fits in the viewport is one tile at the origin', () => {
  const { tiles, columns, rows } = tilePlan({ w: 1000, h: 800 }, view);
  assert.deepEqual(tiles, [{ x: 0, y: 0 }]);
  assert.equal(columns, 1);
  assert.equal(rows, 1);
});

check('a page shorter than the viewport is still one tile', () => {
  assert.deepEqual(tilePlan({ w: 600, h: 300 }, view).tiles, [{ x: 0, y: 0 }]);
});

check('the tiles cover the whole page, with no gap anywhere', () => {
  // The property that matters. A gap is a band of missing pixels down the
  // stitched image, and it is invisible in any check that does not do this sum.
  for (const total of [{ w: 1000, h: 2000 }, { w: 1000, h: 2400 }, { w: 1000, h: 801 },
                       { w: 3000, h: 5000 }, { w: 1001, h: 800 }, { w: 2500, h: 1700 }]) {
    const { tiles } = tilePlan(total, view);
    const covered = new Set();
    for (const t of tiles) {
      for (let y = t.y; y < Math.min(t.y + view.h, total.h); y += 1) covered.add(y);
    }
    for (let y = 0; y < total.h; y++) {
      assert.ok(covered.has(y), `row ${y} of ${total.h} is in no tile`);
    }
  }
});

check('no tile runs past the end of the content', () => {
  for (const total of [{ w: 1000, h: 2000 }, { w: 2500, h: 1700 }, { w: 1000, h: 801 }]) {
    for (const t of tilePlan(total, view).tiles) {
      assert.ok(t.x + view.w <= Math.max(total.w, view.w), `tile at x=${t.x} overruns`);
      assert.ok(t.y + view.h <= Math.max(total.h, view.h), `tile at y=${t.y} overruns`);
    }
  }
});

check('an exact multiple produces no duplicate tile', () => {
  const { tiles, rows, columns } = tilePlan({ w: 1000, h: 2400 }, view);
  assert.equal(rows, 3);
  assert.equal(columns, 1);
  assert.equal(tiles.length, 3);
  assert.deepEqual(tiles.map((t) => t.y), [0, 800, 1600]);
});

check('the last tile is clamped and overlaps rather than overruns', () => {
  // 2000 tall: rows at 0 and 800 step cleanly, and the third is pulled back to
  // 1200 instead of 1600 so it ends exactly at the bottom.
  assert.deepEqual(tilePlan({ w: 1000, h: 2000 }, view).tiles.map((t) => t.y), [0, 800, 1200]);
});

check('a wide page tiles in both directions, rows outermost', () => {
  const { tiles, columns, rows } = tilePlan({ w: 2500, h: 1700 }, view);
  assert.equal(columns, 3);
  assert.equal(rows, 3);
  assert.equal(tiles.length, 9);
  // Row-major, because the canvas is drawn a row at a time.
  assert.deepEqual(tiles.slice(0, 3), [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1500, y: 0 }]);
});

check('a scroller that measures zero yields no tiles instead of hanging', () => {
  // The step is crop.w, so a width of zero never advances the loop. This used
  // to spin forever and take the tab with it.
  assert.deepEqual(tilePlan({ w: 1000, h: 800 }, { w: 0, h: 800 }), { tiles: [], columns: 0, rows: 0 });
  assert.deepEqual(tilePlan({ w: 1000, h: 800 }, { w: 1000, h: 0 }).tiles, []);
  assert.deepEqual(tilePlan({ w: 1000, h: 800 }, { w: -5, h: 800 }).tiles, []);
});

// -------------------------------------------------------------- canvas size

check('a page within every limit is drawn at its own size', () => {
  const fit = canvasFit(1000, 2000, 1, 120);
  assert.deepEqual(fit, { width: 1000, height: 2000, scale: 1 });
});

check('a retina page keeps its device pixels', () => {
  const fit = canvasFit(1000, 2000, 2, 120);
  assert.equal(fit.width, 2000);
  assert.equal(fit.height, 4000);
  assert.equal(fit.scale, 1);
});

check('a short page is never blown up to fill the allowance', () => {
  assert.equal(canvasFit(200, 100, 1, 120).scale, 1);
});

check('a page longer than the canvas limit is scaled to fit inside it', () => {
  const fit = canvasFit(1000, 40000, 1, 500);
  assert.ok(fit.height <= MAX_CANVAS_DIM, `height ${fit.height} is over the limit`);
  assert.ok(fit.width <= MAX_CANVAS_DIM);
  assert.ok(fit.scale < 1);
});

check('the area ceiling holds even when both sides are legal', () => {
  // 12000 x 12000 is under the per-side limit and far over 120 megapixels.
  const fit = canvasFit(12000, 12000, 1, 120);
  assert.ok(fit.width * fit.height <= 120e6 + 1e4, `${fit.width}x${fit.height} is over the area`);
  assert.ok(fit.width <= MAX_CANVAS_DIM && fit.height <= MAX_CANVAS_DIM);
});

check('device pixel ratio counts against both ceilings', () => {
  const fit = canvasFit(2000, 9000, 2, 120);
  assert.ok(fit.height <= MAX_CANVAS_DIM);
  assert.ok(fit.width * fit.height <= 120e6 + 1e4);
});

check('a canvas is never zero-sided', () => {
  for (const fit of [canvasFit(0, 100, 1, 120), canvasFit(100, 0, 1, 120),
                     canvasFit(1, 1, 1, 120), canvasFit(1, 400000, 1, 1)]) {
    assert.ok(fit.width >= 1 && fit.height >= 1, JSON.stringify(fit));
  }
});

// ------------------------------------------------------------- tile placing

const crop = { x: 0, y: 0, w: 1000, h: 800 };

check('at scale 1 and dpr 1 a tile lands where it was scrolled to', () => {
  const r = tileRect(crop, 0, 800, 1, 1, 1000, 800);
  assert.deepEqual(r, { sx: 0, sy: 0, sw: 1000, sh: 800, tx: 0, ty: 800, tw: 1000, th: 800 });
});

check('the source rectangle is in device pixels', () => {
  const r = tileRect(crop, 0, 800, 2, 1, 2000, 1600);
  assert.equal(r.sw, 2000);
  assert.equal(r.sh, 1600);
  assert.equal(r.ty, 1600, 'and so is the destination');
});

check('an inner scroller is read from its own corner of the capture', () => {
  const inner = { x: 240, y: 64, w: 700, h: 600 };
  const r = tileRect(inner, 0, 0, 1, 1, 1000, 800);
  assert.equal(r.sx, 240);
  assert.equal(r.sy, 64);
  assert.equal(r.sw, 700);
  assert.equal(r.sh, 600);
  assert.equal(r.tx, 0, 'but drawn at the origin of the stitched image');
  assert.equal(r.ty, 0);
});

check('a fractional dpr never asks for a pixel the capture does not have', () => {
  // 1.5 is an ordinary Windows scale factor and the reason for the clamp:
  // rounding 800 * 1.5 can exceed a bitmap the browser rounded the other way.
  const r = tileRect(crop, 0, 0, 1.5, 1, 1500, 1199);
  assert.ok(r.sx + r.sw <= 1500, `${r.sx}+${r.sw} runs past the bitmap`);
  assert.ok(r.sy + r.sh <= 1199, `${r.sy}+${r.sh} runs past the bitmap`);
});

check('nothing is drawn when the crop falls outside the capture', () => {
  assert.equal(tileRect({ x: 1200, y: 0, w: 100, h: 100 }, 0, 0, 1, 1, 1000, 800), null);
  assert.equal(tileRect({ x: 0, y: 900, w: 100, h: 100 }, 0, 0, 1, 1, 1000, 800), null);
});

check('a scaled canvas scales source and destination together', () => {
  const r = tileRect(crop, 0, 1600, 1, 0.5, 1000, 800);
  assert.equal(r.sw, 1000, 'the source is read at full size');
  assert.equal(r.sh, 800);
  assert.equal(r.tw, 500, 'and drawn at half');
  assert.equal(r.th, 400);
  assert.equal(r.ty, 800, 'at half the offset');
});

check('a scaled tile is never drawn zero-sided', () => {
  const r = tileRect({ x: 0, y: 0, w: 2, h: 2 }, 0, 0, 1, 0.001, 1000, 800);
  assert.ok(r.tw >= 1 && r.th >= 1);
});

check('a real capture stitches into a canvas with every row accounted for', () => {
  // The two halves together, which is the only way to catch a disagreement
  // between what the page plans and what the canvas draws.
  const total = { w: 1000, h: 2000 };
  const dpr = 2;
  const fit = canvasFit(total.w, total.h, dpr, 120);
  const rows = new Set();
  for (const t of tilePlan(total, crop).tiles) {
    const r = tileRect(crop, t.x, t.y, dpr, fit.scale, crop.w * dpr, crop.h * dpr);
    assert.ok(r, 'every planned tile draws something');
    assert.ok(r.ty >= 0 && r.ty + r.th <= fit.height + 1,
              `tile at ${r.ty} height ${r.th} runs past the canvas ${fit.height}`);
    for (let y = r.ty; y < r.ty + r.th; y++) rows.add(y);
  }
  for (let y = 0; y < fit.height; y++) {
    assert.ok(rows.has(y), `canvas row ${y} of ${fit.height} was never drawn`);
  }
});

console.log(`\ntest: ${checks} checks passed`);
