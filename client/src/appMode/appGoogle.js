// "Continue with Google" inside the apps, where Google's web pop-up can't run:
//  - desktop (Electron): the person's own browser, back to the app (desktop/electron/googleSignIn.js),
//    then the server swaps the code for an ID token (/api/auth/google/desktop-token);
//  - Android tablets: Android's account picker (mobile/android/…/GoogleSignInPlugin.java).
// Either way the result is a Google ID token the server checks at /api/auth/google-login.
import api from '@services/api';

const desktopBridge = () => (typeof window !== 'undefined' && window.oruinwanDesktop?.googleSignIn ? window.oruinwanDesktop : null);

function androidPlugin() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (cap?.getPlatform?.() !== 'android') return null;
  return cap.Plugins?.GoogleSignIn || null;
}

/** Whether this app and this server can do Google sign-in. */
export function appGoogleAvailable(providers) {
  if (desktopBridge()) return Boolean(providers?.googleDesktopClientId);
  if (androidPlugin()) return Boolean(providers?.google && providers?.googleClientId);
  return false;
}

const cancelled = () => Object.assign(new Error('Cancelled'), { cancelled: true });

/** Runs the sign-in; resolves with { credential } for /api/auth/google-login. Rejects with .cancelled when backed out. */
export async function appGoogleToken(providers) {
  const desktop = desktopBridge();
  if (desktop) {
    const result = await desktop.googleSignIn(providers.googleDesktopClientId);
    if (result?.error) {
      if (result.code === 'CANCELLED') throw cancelled();
      throw new Error(result.error);
    }
    const { data } = await api.post('/api/auth/google/desktop-token', result);
    return { credential: data.idToken };
  }
  const android = androidPlugin();
  if (android) {
    try {
      const { idToken } = await android.signIn({ serverClientId: providers.googleClientId });
      return { credential: idToken };
    } catch (err) {
      if (err?.code === 'CANCELLED') throw cancelled();
      throw err;
    }
  }
  throw new Error('Google sign-in is not available in this app');
}
