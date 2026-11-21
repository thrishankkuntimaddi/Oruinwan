// Applies the saved theme before first paint; ThemeContext.js owns it after that.
// Light unless the person chose dark (or "auto" on a dark-mode device).
(function () {
  try {
    var t = localStorage.getItem('oruinwan.theme') || 'light';
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.add(dark ? 'dark' : 'light');
    // Liquid Glass (platform/theme/liquid-glass.css) reads data-theme.
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
    // The design (Settings → Appearance → Design): Liquid Glass (html.lg, the default) or Unslop (html.us).
    var unslop = localStorage.getItem('oruinwan.look') === 'unslop';
    root.classList.toggle('lg', !unslop);
    root.classList.toggle('us', unslop);
    root.setAttribute('data-look', unslop ? 'unslop' : 'glass');
    // Glass → Background colour Off: the glass over a plain backdrop (styles/glass-plain.css).
    var plain = localStorage.getItem('oruinwan.glassColour') === 'off';
    root.setAttribute('data-glass-colour', plain ? 'off' : 'on');
    var colour = unslop ? (dark ? '#141312' : '#F6F5F2') : plain ? (dark ? '#000000' : '#F2F2F7') : (dark ? '#06070B' : '#EEF0F6');
    root.style.background = colour;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = colour;
  } catch (e) { /* storage blocked: stay light */ }
})();
