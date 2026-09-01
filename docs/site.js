/* Progressive enhancement only. Without this file the page is a complete
   storyboard and every tooltip is still readable in the markup. */
(() => {
  document.documentElement.classList.add('js');

  // ------------------------------------------------------------------ theme
  const themer = document.getElementById('themer');
  const stored = (() => {
    try { return localStorage.getItem('uncropped-theme'); } catch (e) { return null; }
  })();
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  themer.addEventListener('click', () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const now = document.documentElement.getAttribute('data-theme') || (dark ? 'dark' : 'light');
    const next = now === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('uncropped-theme', next); } catch (e) { /* private mode */ }
  });

  // ---------------------------------------------------------------- stepper
  const steps = [...document.querySelectorAll('#steps .step')];
  const count = document.getElementById('count');
  const play = document.getElementById('play');
  const pad = (n) => String(n).padStart(2, '0');
  let i = 0;
  let timer = null;

  function show(n) {
    i = (n + steps.length) % steps.length;
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    count.textContent = pad(i + 1) + ' / ' + pad(steps.length);
    const box = steps[i].parentElement.parentElement;
    if (box.scrollWidth > box.clientWidth) {
      steps[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    play.textContent = 'PLAY';
  }

  function start() {
    if (timer) return stop();
    play.textContent = 'STOP';
    timer = setInterval(() => {
      if (i === steps.length - 1) { stop(); return; }
      show(i + 1);
    }, 1400);
  }

  document.getElementById('prev').addEventListener('click', () => { stop(); show(i - 1); });
  document.getElementById('next').addEventListener('click', () => { stop(); show(i + 1); });
  play.addEventListener('click', start);
  steps.forEach((s, k) => s.addEventListener('click', () => { stop(); show(k); }));
  show(0);

  // Run the sequence once, the first time it comes into view.
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { io.disconnect(); show(0); start(); }
      }
    }, { threshold: 0.4 });
    io.observe(document.getElementById('steps'));
  }

  // --------------------------------------------------------------- tooltips
  const tip = document.getElementById('tip');
  let held = null;

  function place(el) {
    const text = el.getAttribute('data-tip');
    if (!text) return;
    tip.textContent = text;
    tip.classList.add('on');
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
    const above = r.top > t.height + 14;
    tip.style.left = x + 'px';
    tip.style.top = (above ? r.top - t.height - 10 : r.bottom + 10) + 'px';
    held = el;
  }

  function hide() {
    tip.classList.remove('on');
    held = null;
  }

  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && el !== held) place(el);
  });
  document.addEventListener('pointerout', (e) => {
    if (held && !held.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) place(el);
  });
  document.addEventListener('focusout', hide);
  addEventListener('scroll', () => held && place(held), { passive: true });
})();
