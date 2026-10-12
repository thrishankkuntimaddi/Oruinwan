// Native bridge. Every call is safe on the web: it checks the platform and reports
// what actually happened, so the UI never claims something the device didn't do.
import { Capacitor, SystemBars, SystemBarsStyle, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';

// Plugin imports are static on purpose: a Capacitor plugin proxy must never be the value a
// promise resolves with (e.g. import().then(m => m.App)), because promise resolution probes
// `.then` on it and the proxy throws "App.then() is not implemented".

export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = platform === 'android';
export const isIOS = platform === 'ios';

// The desktop app (desktop/, Electron) runs this same build and exposes a small bridge from
// its preload script: { platform, arch, version, setBadgeCount, openExternal }.
export const desktop = (!isNative && typeof window !== 'undefined' && window.oruinwanDesktop) || null;
export const isDesktop = Boolean(desktop);
/** A plain browser tab: the web app or the dev preview. */
export const isWeb = !isNative && !isDesktop;
// Lets CSS style the desktop app like any mouse-driven device (styles/index.css).
if (isDesktop) document.documentElement.dataset.desktop = '';

/** What to call the thing the app runs on, in user-facing copy. */
export const deviceNoun = isDesktop ? 'computer' : isWeb ? 'browser' : 'phone';
export const platformLabel = isDesktop
  ? { darwin: 'Mac', win32: 'Windows', linux: 'Linux' }[desktop.platform] || 'Desktop'
  : isWeb
    ? 'Web'
    : isIOS
      ? 'iPhone'
      : 'Android';

/** Sent as x-client-platform: the server then hands apps their refresh token in the body. */
export const clientPlatform = isIOS ? 'ios' : 'android';

// Native side: android/app/src/main/java/com/oruinwan/app/AppWindowPlugin.java
const AppWindow = registerPlugin('AppWindow');

/** Match the status/navigation bar icons to the current theme. */
export async function applySystemBars(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0c0c0c' : '#f5f4f2';
  if (!isNative) return false;
  try {
    await SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
    // setStyle resets the window background, so paint ours afterwards (see AppWindowPlugin.java).
    await AppWindow.setBackgroundColor({ color: theme === 'dark' ? '#0c0c0c' : '#f5f4f2' });
    return true;
  } catch {
    return false;
  }
}

export async function hideSplash() {
  if (!isNative) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 180 });
  } catch {
    /* splash already gone */
  }
}

export async function tap(kind = 'light') {
  if (!isNative) return;
  try {
    if (kind === 'select') await Haptics.selectionChanged();
    else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    /* haptics are a nicety */
  }
}

export async function openExternal(url) {
  if (!url) return;
  if (isDesktop) {
    desktop.openExternal(url);
    return;
  }
  if (isNative) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, '_blank', 'noopener');
}

/** Android hardware back. The handler returns true when it consumed the event. */
export async function onBackButton(handler) {
  if (!isNative) return () => {};
  const sub = await App.addListener('backButton', () => {
    if (!handler()) App.minimizeApp();
  });
  return () => sub.remove();
}

/** Calls fn(true|false) when the app moves to the foreground/background. */
export async function onAppState(fn) {
  if (isNative) {
    const sub = await App.addListener('appStateChange', ({ isActive }) => fn(isActive));
    return () => sub.remove();
  }
  const h = () => fn(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', h);
  return () => document.removeEventListener('visibilitychange', h);
}

export async function onNetworkChange(fn) {
  if (isNative) {
    const status = await Network.getStatus();
    fn(status.connected);
    const sub = await Network.addListener('networkStatusChange', (s) => fn(s.connected));
    return () => sub.remove();
  }
  const up = () => fn(true);
  const down = () => fn(false);
  fn(navigator.onLine);
  window.addEventListener('online', up);
  window.addEventListener('offline', down);
  return () => {
    window.removeEventListener('online', up);
    window.removeEventListener('offline', down);
  };
}

export async function hideKeyboard() {
  if (!isNative) return;
  try {
    await Keyboard.hide();
  } catch {
    /* no keyboard open */
  }
}

/** Unread count on the dock, taskbar or launcher icon (desktop only). */
export function setBadgeCount(count) {
  if (!isDesktop) return;
  try {
    desktop.setBadgeCount(Math.max(0, count | 0));
  } catch {
    /* some Linux desktops have no badges */
  }
}

/** Native app version (versionName) when installed; the bundle version otherwise. */
export async function nativeAppInfo() {
  if (isDesktop) return { version: desktop.version || __APP_VERSION__, build: null };
  if (!isNative) return { version: __APP_VERSION__, build: null };
  try {
    const info = await App.getInfo();
    return { version: info.version, build: info.build };
  } catch {
    return { version: __APP_VERSION__, build: null };
  }
}
