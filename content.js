/*
 * Uncropped: page-side half.
 *
 * Injected on demand, never on page load. It finds the element that actually
 * scrolls, walks the page once so lazy content exists, reports a tile plan, and
 * then parks the scroller at each tile while the worker takes the picture.
 *
 * Everything it changes to the page is recorded and put back in RESTORE.
 */
(() => {
  if (window.__uncropped) return;
  window.__uncropped = true;

  const VERSION = '1.0.1';

  const S = {
    scroller: null,
    isDocument: true,
    savedScroll: null,
    hidden: [],        // [element, previous inline visibility]
    eagered: [],       // <img> switched off lazy loading
    styleEl: null,
    opts: null,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  // ------------------------------------------------------------------ walking

  // Elements of the document including open shadow roots. Web components park
  // their scroll container inside a shadow root often enough to matter.
  function* deepElements(root = document.body, depth = 0) {
    if (!root || depth > 12) return;
    for (const el of root.querySelectorAll('*')) {
      yield el;
      if (el.shadowRoot) yield* deepElements(el.shadowRoot, depth + 1);
    }
  }

  // ---------------------------------------------------------------- scroller

  function scrolls(el, cs) {
    const oy = cs.overflowY;
    const ox = cs.overflowX;
    const y = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4;
    const x = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 4;
    return x || y;
  }

  // The document wins when it scrolls at all. Only when it does not, which is
  // the whole reason this extension exists, do we go looking for the container
  // that took the job: the biggest scrollable box on screen.
  function findScroller() {
    const de = document.scrollingElement || document.documentElement;
    if (de.scrollHeight > de.clientHeight + 4 || de.scrollWidth > de.clientWidth + 4) {
      return { el: de, isDocument: true };
    }
    let best = null;
    let bestArea = 0;
    for (const el of deepElements()) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (!scrolls(el, cs)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }
    if (best && bestArea > innerWidth * innerHeight * 0.2) {
      return { el: best, isDocument: false };
    }
    return { el: de, isDocument: true };
  }

  const readScroll = () => [S.scroller.scrollLeft, S.scroller.scrollTop];

  function writeScroll(x, y) {
    if (S.isDocument) window.scrollTo({ left: x, top: y, behavior: 'auto' });
    else S.scroller.scrollTo({ left: x, top: y, behavior: 'auto' });
  }

  // Which part of a viewport capture belongs to the scroller. For the document
  // that is the viewport minus any classic scrollbar. For an inner container it
  // is the container's padding box, so the app chrome around it is not smeared
  // down the length of the stitched image.
  function cropRect() {
    if (S.isDocument) {
      return { x: 0, y: 0, w: S.scroller.clientWidth, h: S.scroller.clientHeight };
    }
    const r = S.scroller.getBoundingClientRect();
    const cs = getComputedStyle(S.scroller);
    return {
      x: Math.max(0, Math.round(r.left + (parseFloat(cs.borderLeftWidth) || 0))),
      y: Math.max(0, Math.round(r.top + (parseFloat(cs.borderTopWidth) || 0))),
      w: S.scroller.clientWidth,
      h: S.scroller.clientHeight,
    };
  }

  // --------------------------------------------------------------- settling

  // Two frames is enough for layout and compositing. The extra wait is only for
  // images that started decoding when they came into view, so we ask them
  // rather than guessing, and give up quickly if they are slow.
  async function settle(budgetMs) {
    await nextFrame();
    await nextFrame();
    const deadline = Date.now() + budgetMs;
    for (;;) {
      const pending = pendingImages();
      if (!pending || Date.now() > deadline) break;
      await sleep(40);
    }
    await nextFrame();
  }

  function pendingImages() {
    let n = 0;
    const vw = innerWidth;
    const vh = innerHeight;
    for (const img of document.images) {
      if (img.complete) continue;
      const r = img.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200 || r.right < -200 || r.left > vw + 200) continue;
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------- preparation

  function freezeMotion() {
    S.styleEl = document.createElement('style');
    S.styleEl.setAttribute('data-uncropped', '');
    S.styleEl.textContent =
      'html,body{scroll-behavior:auto !important}' +
      '*,*::before,*::after{transition:none !important;scroll-behavior:auto !important}';
    document.documentElement.appendChild(S.styleEl);
  }

  function eagerImages() {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) {
      S.eagered.push(img);
      img.loading = 'eager';
    }
  }

  // One pass over the whole scroll range so lazy images, virtualised rows and
  // reveal-on-scroll effects have happened before we measure anything. The page
  // often gets taller while this runs, which is why the measurement comes after.
  async function prescroll() {
    const step = Math.max(200, S.scroller.clientHeight - 40);
    for (let i = 0; i < 200; i++) {
      const maxY = S.scroller.scrollHeight - S.scroller.clientHeight;
      const y = Math.min(i * step, maxY);
      writeScroll(0, y);
      await settle(120);
      if (y >= maxY) break;
    }
    writeScroll(0, 0);
    await settle(200);
  }

  // A fixed toolbar is painted into every single tile and stripes the result.
  // Hide those after the first tile. Two exceptions: a fixed layer covering
  // most of the viewport is a backdrop and hiding it punches a hole, and a tall
  // sticky box is a column rather than a bar, so it belongs in every tile.
  function hideOverlays() {
    const vw = innerWidth;
    const vh = innerHeight;
    for (const el of deepElements()) {
      const cs = getComputedStyle(el);
      const pos = cs.position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (pos === 'fixed' && r.width * r.height > vw * vh * 0.8) continue;
      if (pos === 'sticky' && r.height > vh * 0.35) continue;
      S.hidden.push([el, el.style.getPropertyValue('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
    return S.hidden.length;
  }

  function restore() {
    for (const [el, prev] of S.hidden) {
      if (prev) el.style.setProperty('visibility', prev);
      else el.style.removeProperty('visibility');
    }
    S.hidden = [];
    for (const img of S.eagered) img.loading = 'lazy';
    S.eagered = [];
    if (S.styleEl) {
      S.styleEl.remove();
      S.styleEl = null;
    }
    if (S.savedScroll) {
      writeScroll(S.savedScroll[0], S.savedScroll[1]);
      S.savedScroll = null;
    }
  }

  async function prepare(opts) {
    S.opts = opts;
    const found = findScroller();
    S.scroller = found.el;
    S.isDocument = found.isDocument;
    S.savedScroll = readScroll();

    freezeMotion();
    eagerImages();
    if (opts.prescroll) await prescroll();

    const el = S.scroller;
    const crop = cropRect();
    const total = { w: el.scrollWidth, h: el.scrollHeight };

    const { tiles, columns, rows } = tilePlan(total, crop);

    return {
      version: VERSION,
      total,
      crop,
      tiles,
      columns,
      rows,
      dpr: window.devicePixelRatio || 1,
      isDocument: S.isDocument,
      scroller:
        S.scroller.tagName.toLowerCase() +
        (S.scroller.id ? '#' + S.scroller.id : '') +
        (S.scroller.classList && S.scroller.classList[0] ? '.' + S.scroller.classList[0] : ''),
      host: (location.hostname || 'page').replace(/^www\./, ''),
      href: location.href,
    };
  }

  async function goto(x, y, hideFixed, settleMs) {
    let hid = 0;
    if (hideFixed && !S.hidden.length) hid = hideOverlays();
    writeScroll(x, y);
    await settle(settleMs);
    const [ax, ay] = readScroll();
    return { x: ax, y: ay, crop: cropRect(), hid };
  }

  // ------------------------------------------------------------------ toast

  function toast(text, bad) {
    document.querySelectorAll('[data-uncropped-toast]').forEach((n) => n.remove());
    const n = document.createElement('div');
    n.setAttribute('data-uncropped-toast', '');
    n.textContent = text;
    n.style.cssText = [
      'all:initial',
      'position:fixed',
      'z-index:2147483647',
      'left:50%',
      'top:20px',
      'transform:translateX(-50%)',
      'padding:10px 16px',
      'border-radius:10px',
      'font:500 13px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.01em',
      'color:#f6f7f9',
      'background:' + (bad ? '#8b1d1d' : '#15171c'),
      'border:1px solid ' + (bad ? '#c04747' : '#3a3f4a'),
      'box-shadow:0 8px 28px rgba(0,0,0,.35)',
      'pointer-events:none',
      'max-width:min(80vw,640px)',
    ].join(';');
    document.documentElement.appendChild(n);
    setTimeout(() => n.remove(), bad ? 7000 : 2800);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.target !== 'page') return;
    (async () => {
      try {
        if (msg.type === 'PING') reply({ ok: true, data: { version: VERSION } });
        else if (msg.type === 'PREPARE') reply({ ok: true, data: await prepare(msg.opts) });
        else if (msg.type === 'GOTO')
          reply({ ok: true, data: await goto(msg.x, msg.y, msg.hideFixed, msg.settleMs) });
        else if (msg.type === 'RESTORE') {
          restore();
          reply({ ok: true });
        } else if (msg.type === 'TOAST') {
          toast(msg.text, msg.bad);
          reply({ ok: true });
        } else reply({ ok: false, error: 'unknown message ' + msg.type });
      } catch (e) {
        try {
          restore();
        } catch (_) {
          /* the page is already gone */
        }
        reply({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true; // reply is async
  });
})();
