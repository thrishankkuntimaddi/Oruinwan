// The web client running inside an app: the desktop app (desktop/, Electron) or a tablet in
// the Android/iOS app (mobile/). Only `vite build --mode app` sets IS_APP; every other build
// drops this code. The server is the user's choice, stored on the device.

export const IS_APP = import.meta.env.MODE === 'app';
/** The product website on GitHub Pages (`vite build --mode site`): no server behind it. */
export const IS_SITE = import.meta.env.MODE === 'site';

const SERVER_KEY = 'oruinwan.server';

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

export function getServer() {
  try {
    return localStorage.getItem(SERVER_KEY) || '';
  } catch {
    return '';
  }
}

export function setServer(url) {
  try {
    if (url) localStorage.setItem(SERVER_KEY, url);
    else localStorage.removeItem(SERVER_KEY);
  } catch {
    /* storage blocked: the app asks again next time */
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
