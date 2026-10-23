// Applies the saved theme before first paint; ThemeContext.js owns it after that.
// Light unless the person chose dark (or "auto" on a dark-mode device).
(function () {
  try {
    var t = localStorage.getItem('oruinwan.theme') || 'light';
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.add(dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.background = dark ? '#0c0c0c' : '#f8f5f0';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && dark) meta.content = '#0c0c0c';
  } catch (e) { /* storage blocked: stay light */ }
})();
