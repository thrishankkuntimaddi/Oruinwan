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
    root.style.background = dark ? '#06070B' : '#EEF0F6';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && dark) meta.content = '#06070B';
  } catch (e) { /* storage blocked: stay light */ }
})();
