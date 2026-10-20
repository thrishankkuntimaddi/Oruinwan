// The web client running inside an app: the desktop app (desktop/, Electron) or a tablet in
// the Android/iOS app (mobile/). Only `vite build --mode app` sets IS_APP; every other build
// drops this code. The server is fixed at build time (VITE_SERVER_URL, else VITE_BACKEND_URL).

export const IS_APP = import.meta.env.MODE === 'app';
/** The product website on GitHub Pages (`vite build --mode site`): no server behind it. */
export const IS_SITE = import.meta.env.MODE === 'site';

/** 'desktop' | 'android' | 'ios': sent as x-client-platform, which puts the server in token mode. */
export function appPlatform() {
  if (typeof window === 'undefined') return 'desktop';
  if (window.oruinwanDesktop) return 'desktop';
  const native = window.Capacitor?.getPlatform?.();
  if (native === 'android' || native === 'ios') return native;
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/iPad|iPhone/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

/** The Oruinwan server this build talks to. Until the production server exists, a local one. */
export const BUILT_IN_SERVER = normalizeServer(import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080');

/** The server this app talks to (the built-in one). */
export function getServer() {
  return BUILT_IN_SERVER;
}

/**
 * Earlier app versions had an on-device demo workspace, remembered as this server address with a
 * made-up session. Anyone still in it starts again at sign-in, with nothing from the demo kept.
 */
export function forgetOldDemo() {
  try {
    if (localStorage.getItem('oruinwan.server') !== 'https://demo.oruinwan.invalid') return;
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage blocked: nothing was saved */
  }
}

/**
 * "chat.example.com", "https://chat.example.com/", ".../api" → "https://chat.example.com".
 * Returns null for anything that isn't an http(s) address.
 */
export function normalizeServer(input) {
  let raw = String(input || '').trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    // Plain hosts: https, except local addresses people run without TLS.
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.)/.test(raw);
    raw = `${local ? 'http' : 'https'}://${raw}`;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const path = u.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return null;
  }
}

/** Host shown in the UI, e.g. "chat.example.com". */
export function serverLabel(url = getServer()) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
