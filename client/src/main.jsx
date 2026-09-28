import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/gloss.css';
import './desktop/bridge';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import logger from './utils/logger';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// Dev serves unbundled modules that must never be cached, so the SW is production-only.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => logger.debug('[SW] Registered, scope:', reg.scope))
      .catch((err) => logger.error('[SW] Registration failed:', err));
  });
}
