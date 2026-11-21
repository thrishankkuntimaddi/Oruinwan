// Apply the saved theme before first paint so there is no light/dark flash. A file, not an
// inline script: the website's Content-Security-Policy (served at /m/) allows no inline scripts.
(function () {
  try {
    var pref = localStorage.getItem('oru.theme') || 'light';
    var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    // The design (Settings → Appearance → Design): Liquid Glass unless Unslop was chosen.
    var unslop = localStorage.getItem('oru.look') === 'unslop';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    // Glass → Background colour Off: the glass over a plain backdrop (styles/glass-plain.css).
    var plain = localStorage.getItem('oru.glassColour') === 'off';
    document.documentElement.dataset.look = unslop ? 'unslop' : 'glass';
    document.documentElement.dataset.glassColour = plain ? 'off' : 'on';
    document.querySelector('meta[name="theme-color"]').content = unslop ? (dark ? '#141312' : '#F6F5F2') : plain ? (dark ? '#000000' : '#F2F2F7') : (dark ? '#06070B' : '#EEF0F6');
  } catch (e) {
    /* storage blocked: the default theme */
  }
})();
