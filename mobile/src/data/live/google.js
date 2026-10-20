import { registerPlugin } from '@capacitor/core';
import { isAndroid, isWeb } from '../../native/index.js';

// Google sign-in in a browser: Google Identity Services opens Google's own window and hands
// back an access token, which the server checks was issued to this app (its client id) before
// trusting it. Native builds need Google's native SDK instead; they don't offer the button yet.

const SCRIPT = 'https://accounts.google.com/gsi/client';
let loading = null;

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't load Google sign-in. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Opens Google's sign-in window; resolves with an access token, rejects when closed or refused. */
export async function googleAccessToken(clientId) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        if (response?.access_token) resolve(response.access_token);
        else reject(new Error(response?.error_description || 'Google sign-in did not finish.'));
      },
      error_callback: (err) => {
        reject(new Error(err?.type === 'popup_closed' ? 'Google sign-in was closed before it finished.' : 'Google sign-in did not open. Allow pop-ups for this site and try again.'));
      },
    });
    client.requestAccessToken();
  });
}

// The Android app: Android's own account picker (android/…/GoogleSignInPlugin.java), because
// Google's web pop-up doesn't run inside an app. It returns an ID token issued to the server's
// web client id, which the server checks like any other Google sign-in.
const NativeGoogle = registerPlugin('GoogleSignIn');

/** Google can sign in here: a browser, or the Android app. */
export const googleSupported = isWeb || isAndroid;

/**
 * Opens Google's sign-in and resolves with what /auth/google-login takes: { accessToken } in a
 * browser, { credential } (an ID token) in the Android app. Rejects with .cancelled when backed out.
 */
export async function googleSignInToken(clientId) {
  if (!isAndroid) return { accessToken: await googleAccessToken(clientId) };
  try {
    const { idToken } = await NativeGoogle.signIn({ serverClientId: clientId });
    return { credential: idToken };
  } catch (err) {
    if (err?.code === 'CANCELLED') throw Object.assign(new Error(''), { cancelled: true });
    throw new Error(err?.message || 'Google sign-in failed.');
  }
}
