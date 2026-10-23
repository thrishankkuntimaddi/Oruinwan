// Tablets and iPads in the Android/iOS app (mobile/): the native shell keeps its splash screen
// up until the page says it's ready, and draws the page edge to edge under the system bars.
// The bars follow the theme (applyNativeBars, called by ThemeContext) and the page pads itself
// clear of them (`html.oruinwan-native` in index.css).

export function prepareNativeShell() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  document.documentElement.classList.add('oruinwan-native');
  const plugins = cap.Plugins || {};
  const quietly = (promise) => promise?.catch?.(() => {});
  applyNativeBars(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  requestAnimationFrame(() => setTimeout(() => quietly(plugins.SplashScreen?.hide?.({ fadeOutDuration: 180 })), 60));
}

/** System bar icons and the colour behind them, for the resolved theme ('light' | 'dark'). */
export async function applyNativeBars(theme) {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const plugins = cap.Plugins || {};
  const dark = theme === 'dark';
  try {
    await plugins.SystemBars?.setStyle?.({ style: dark ? 'DARK' : 'LIGHT' });
    // Android only (mobile/android/…/AppWindowPlugin.java). setStyle resets the window
    // background, so paint ours afterwards.
    if (cap.getPlatform?.() === 'android') await plugins.AppWindow?.setBackgroundColor?.({ color: dark ? '#0c0c0c' : '#f8f5f0' });
  } catch { /* older shells without these plugins */ }
}
