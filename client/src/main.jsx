// Must stay the first import: app builds read the chosen server before anything else loads.
import './appMode/preboot';
// Moves settings saved under the old Chttrix names before anything reads them.
import './utils/legacyStorageBoot';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/gloss.css';
import './desktop/bridge';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import logger from './utils/logger';
import { IS_APP, IS_SITE, appPlatform, getServer } from './appMode/env';
import { installAppNetwork } from './appMode/network';
import UpdateNotice from './appMode/UpdateNotice';
import { prepareNativeShell } from './appMode/nativeShell';

// Google sign-in is optional. The Google library throws while rendering the login
// form when the client id is empty, so pass a placeholder; LoginForm hides the button.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'google-sign-in-not-configured';

// Desktop and tablet apps (vite --mode app) talk to the built-in server the way the phone app
// does (src/appMode/network.js).
if (IS_APP) prepareNativeShell();
if (IS_APP) installAppNetwork(getServer(), appPlatform());

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {IS_APP || IS_SITE ? (
      <>
        <AuthProvider>
          <App />
        </AuthProvider>
        {IS_APP && <UpdateNotice />}
      </>
    ) : (
      <>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </GoogleOAuthProvider>
        {/* "A new version is available — Reload" after a deploy (appMode/updates/store.js). */}
        <UpdateNotice />
      </>
    )}
  </React.StrictMode>
);

// Dev serves unbundled modules that must never be cached, so the SW is production-only.
// Apps ship their files with them, so they never need one.
if ('serviceWorker' in navigator && import.meta.env.PROD && !IS_APP && !IS_SITE) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => logger.debug('[SW] Registered, scope:', reg.scope))
      .catch((err) => logger.error('[SW] Registration failed:', err));
  });
}
