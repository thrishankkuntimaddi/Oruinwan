// Build-time configuration (see .env.example). Nothing here is secret.
const env = import.meta.env;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_TIME = __BUILD_TIME__;

export const DEFAULT_SERVER_URL = (env.VITE_DEFAULT_SERVER_URL || '').trim();

export const REPO = 'thrishankkuntimaddi/Oruniwan';
export const UPDATE_MANIFEST_URL =
  (env.VITE_UPDATE_MANIFEST_URL || '').trim() ||
  `https://github.com/${REPO}/releases/latest/download/latest.json`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

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
