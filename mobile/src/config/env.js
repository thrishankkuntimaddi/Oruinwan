// Build-time configuration (see .env.example). Nothing here is secret.
const env = import.meta.env;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_TIME = __BUILD_TIME__;

/**
 * The Oruinwan server this app talks to, fixed at build time: VITE_SERVER_URL (see .env.example).
 * Until the production server exists, builds talk to a server on this computer.
 */
// The website's copy (served at /m/ by the server, Dockerfile) built without an address talks to
// the server it was loaded from (VITE_SAME_ORIGIN=1).
const sameOrigin = env.VITE_SAME_ORIGIN === '1' && typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol) ? window.location.origin : '';
export const SERVER_URL = (env.VITE_SERVER_URL || env.VITE_DEFAULT_SERVER_URL || sameOrigin || 'http://localhost:8080').trim().replace(/\/+$/, '');
/** @deprecated kept for older imports; the same as SERVER_URL. */
export const DEFAULT_SERVER_URL = SERVER_URL;

export const REPO = 'thrishankkuntimaddi/Oruinwan';
export const UPDATE_MANIFEST_URL =
  (env.VITE_UPDATE_MANIFEST_URL || '').trim() ||
  `https://github.com/${REPO}/releases/latest/download/latest.json`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
/** The latest Android app (the same file the website's download page links to). */
export const ANDROID_APK = `https://github.com/${REPO}/releases/latest/download/Oruinwan-Android.apk`;

export const firebaseConfig = env.VITE_FIREBASE_API_KEY
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
    }
  : null;
