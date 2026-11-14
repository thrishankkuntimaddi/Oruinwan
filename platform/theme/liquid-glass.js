/* ══════════════════════════════════════════════════════════════════
   LIQUID GLASS KIT — behaviour (vanilla JS, no dependencies)
   Pairs with liquid-glass.css.

     import { LiquidGlass } from './liquid-glass.js'
     LiquidGlass.init()                 // everything below, once

   or one by one:
     LiquidGlass.lens()                 // SVG edge-refraction filter + html.lg-refract (Chromium)
     LiquidGlass.press()                // touch: sink on touch, spring back on lift
     LiquidGlass.floatHeaders()         // .lg-header floats over its scrolling body
     LiquidGlass.dockPill(dockEl)       // the glass pill under .lg-dock-tab.is-active
     LiquidGlass.theme.set('light' | 'dark' | 'system')

   Works with any framework: call init() once after the app mounts.
   Everything is idempotent and safe to call again.
══════════════════════════════════════════════════════════════════ */

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/* ── Theme: light by default; only an explicit choice changes it ── */
const THEME_KEY = 'lg-theme';             // 'light' | 'dark' | 'system'
const theme = {
  get() {
    try { const v = localStorage.getItem(THEME_KEY); if (v === 'light' || v === 'dark' || v === 'system') return v; } catch { /* storage off */ }
    return 'light';
  },
  resolve(pref = theme.get()) {
    if (pref === 'dark') return 'dark';
    if (pref === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return 'light';
  },
  apply(pref = theme.get()) {
    const t = theme.resolve(pref);
    document.documentElement.setAttribute('data-theme', t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#06070B' : '#EEF0F6');
    return t;
  },
  set(pref) {
    try { localStorage.setItem(THEME_KEY, pref); } catch { /* storage off */ }
    return theme.apply(pref);
  },
  /** Put this (minified) in <head> to set the theme before first paint:
      <script>try{var p=localStorage.getItem('lg-theme');var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}</script> */
};

/* ── Edge refraction (Chromium): bend the backdrop at the rim ─────
   An SVG displacement map — neutral grey in the middle, ramps at the
   edges — used by backdrop-filter on .lg-bar. Safari/WebKit ignore it
   and keep the frosted blur. */
function lens() {
  if (!isBrowser || document.getElementById('lg-refract')) return;
  const map = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>"
    + "<defs><linearGradient id='x' x1='0' x2='1'><stop offset='0' stop-color='#f00'/><stop offset='1' stop-color='#000'/></linearGradient>"
    + "<linearGradient id='y' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0f0'/><stop offset='1' stop-color='#000'/></linearGradient>"
    + "<filter id='s'><feGaussianBlur stdDeviation='3.5'/></filter></defs>"
    + "<rect width='100' height='100' fill='url(#x)'/><rect width='100' height='100' fill='url(#y)' style='mix-blend-mode:screen'/>"
    + "<rect x='9' y='9' width='82' height='82' rx='16' fill='rgb(128,128,0)' filter='url(#s)'/></svg>";
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  wrap.innerHTML = `<svg width="0" height="0"><filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage href="data:image/svg+xml,${encodeURIComponent(map)}" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
  document.body.appendChild(wrap);
  const brands = navigator.userAgentData?.brands || [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  const reduce = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
  if (chromium && !reduce) document.documentElement.classList.add('lg-refract');
}

/* ── Touch press: a finger has no hover, and a quick tap ends before
   :active shows. The control sinks the moment the finger lands, stays
   down while held (≥ MIN_DOWN), springs back with an overshoot on lift.
   Elements matching NAV wait NAV_DELAY ms before their click runs, so
   the spring is seen before the page changes (the replayed click has
   event.lgReplay = true — skip it in tap-sound / analytics handlers). */
const PRESSABLE = 'button, a[href], [role="button"], .lg-pressable, .lg-btn, .lg-icon-btn, .lg-dock-tab, .lg-dock-action, .lg-nav-item';
const NAV = '[data-lg-nav]';
const MIN_DOWN = 110;
const NAV_DELAY = 130;
let pressWired = false;
function press() {
  if (!isBrowser || pressWired) return;
  pressWired = true;
  document.addEventListener('touchstart', () => {}, { passive: true });   // iOS: enables :active
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let pressed = null, downAt = 0, lastTouch = 0;
  const release = () => {
    const el = pressed; if (!el) return; pressed = null;
    setTimeout(() => {
      el.classList.remove('lg-press'); el.classList.add('lg-release');
      setTimeout(() => el.classList.remove('lg-release'), 520);
    }, Math.max(0, MIN_DOWN - (performance.now() - downAt)));
  };
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || reduce) return;           // mouse: CSS hover + :active
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    pressed = el; downAt = lastTouch = performance.now();
    el.classList.remove('lg-release'); el.classList.add('lg-press');
  }, { passive: true, capture: true });
  for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, release, { passive: true, capture: true });
  document.addEventListener('scroll', release, { passive: true, capture: true });   // became a scroll
  document.addEventListener('click', (e) => {
    if (reduce || e.lgReplay || performance.now() - lastTouch > 800) return;
    const el = e.target.closest?.(NAV); if (!el) return;
    e.preventDefault(); e.stopPropagation();
    setTimeout(() => { const again = new MouseEvent('click', { bubbles: true, cancelable: true, view: window }); again.lgReplay = true; el.dispatchEvent(again); }, NAV_DELAY);
  }, true);
}

/* ── Floating headers: content scrolls UNDER the glass ────────────
   Markup: <section> <header class="lg-header lg-bar">…</header>
                     <div class="lg-scroll" style="overflow:auto">…</div> </section>
   The header is lifted over its scrolling sibling and the body is padded
   by the header's measured height (--lg-hdr-h). The scroll container is
   never changed, so code that reads scrollTop keeps working. */
let headersWired = false;
function floatHeaders(root = document.body) {
  if (!isBrowser || headersWired || typeof ResizeObserver === 'undefined') return;
  headersWired = true;
  const scrolls = (el) => el && /(auto|scroll)/.test(getComputedStyle(el).overflowY);
  const measure = (h) => {
    const mt = parseFloat(getComputedStyle(h).marginTop) || 0;
    h.parentElement?.style.setProperty('--lg-hdr-h', `${Math.round(h.offsetHeight + mt)}px`);
  };
  const ro = new ResizeObserver((es) => es.forEach((e) => measure(e.target)));
  const seen = new WeakSet();
  const scan = () => document.querySelectorAll('.lg-header').forEach((h) => {
    if (seen.has(h)) return; seen.add(h);
    const body = h.nextElementSibling;
    if (!h.parentElement || !scrolls(body)) return;               // not a header-over-scroller: leave it
    h.parentElement.classList.add('lg-float-root'); body.classList.add('lg-under');
    measure(h); ro.observe(h);
  });
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; scan(); }); } })
    .observe(root, { childList: true, subtree: true });
  scan();
}

/* ── Dock pill: the glass lens that slides under the active tab ─────
   Markup: <nav class="lg-dock lg-bar"><span class="lg-dock-pill"></span>
             <button class="lg-dock-tab is-active">…</button> … </nav>
   Call again (or let the observer do it) when .is-active moves. */
function dockPill(dock) {
  if (!isBrowser || !dock) return () => {};
  let pill = dock.querySelector('.lg-dock-pill');
  if (!pill) { pill = document.createElement('span'); pill.className = 'lg-dock-pill'; pill.setAttribute('aria-hidden', 'true'); dock.prepend(pill); }
  const place = () => {
    const tab = dock.querySelector('.lg-dock-tab.is-active');
    if (!tab) { pill.style.opacity = '0'; return; }
    pill.style.width = `${tab.offsetWidth}px`; pill.style.height = `${tab.offsetHeight}px`;
    pill.style.transform = `translate3d(${tab.offsetLeft}px, ${tab.offsetTop}px, 0)`;
    pill.style.opacity = '1';
  };
  place();
  requestAnimationFrame(() => pill.classList.add('is-ready'));     // first placement snaps, later ones glide
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null; ro?.observe(dock);
  const mo = new MutationObserver(place); mo.observe(dock, { subtree: true, attributes: true, attributeFilter: ['class'] });
  return () => { ro?.disconnect(); mo.disconnect(); };
}

function init({ root = document.body } = {}) {
  if (!isBrowser) return;
  theme.apply();
  root.classList?.add('lg-root');
  lens(); press(); floatHeaders(root);
  document.querySelectorAll('.lg-dock').forEach((d) => dockPill(d));
}

export const LiquidGlass = { init, theme, lens, press, floatHeaders, dockPill };
if (isBrowser) window.LiquidGlass = LiquidGlass;      // also usable from a plain <script type="module">
