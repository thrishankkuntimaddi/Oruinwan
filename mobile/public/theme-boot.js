// Apply the saved theme before first paint so there is no light/dark flash. A file, not an
// inline script: the website's Content-Security-Policy (served at /m/) allows no inline scripts.
(function () {
  try {
    var pref = localStorage.getItem('oru.theme') || 'light';
    var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#06070B' : '#EEF0F6';
  } catch (e) {
    /* storage blocked: the default theme */
  }
})();
