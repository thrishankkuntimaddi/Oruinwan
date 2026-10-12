// Tablets and iPads in the Android/iOS app (mobile/): the native shell keeps its splash screen
// up until the page says it's ready, and draws the page edge to edge under the system bars.
// The web client is dark, so the bars get light icons and the page pads itself clear of them
// (`html.oruinwan-native` in index.css).

export function prepareNativeShell() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  document.documentElement.classList.add('oruinwan-native');
  const plugins = cap.Plugins || {};
  const quietly = (promise) => promise?.catch?.(() => {});
  quietly(plugins.SystemBars?.setStyle?.({ style: 'DARK' }));
  // Android only (mobile/android/…/AppWindowPlugin.java): the colour behind the bars.
  if (cap.getPlatform?.() === 'android') quietly(plugins.AppWindow?.setBackgroundColor?.({ color: '#0c0c0c' }));
  requestAnimationFrame(() => setTimeout(() => quietly(plugins.SplashScreen?.hide?.({ fadeOutDuration: 180 })), 60));
}
