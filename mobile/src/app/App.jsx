import { useEffect } from 'react';
import { api, useSession } from '../data/session.js';
import { useNav } from './nav.js';
import { Shell } from './Shell.jsx';
import { BrandMark } from './BrandMark.jsx';
import { ToastHost } from '../ui/Feedback.jsx';
import { AuthFlow } from '../features/auth/AuthFlow.jsx';
import { UpdateGate } from '../features/update/UpdateGate.jsx';
import { hideSplash, onAppState, onBackButton, openExternal } from '../native/index.js';
import { checkForUpdate } from '../update/updater.js';
import { refreshRemoteConfig, logEvent } from '../config/remote.js';
import { on } from '../lib/bus.js';
import { watchKeyboard } from '../native/keyboard.js';

function Splash() {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <BrandMark size={88} glow />
    </div>
  );
}

export function App() {
  const status = useSession((s) => s.status);

  useEffect(() => {
    watchKeyboard();
    useSession
      .getState()
      .boot()
      .finally(() => {
        hideSplash();
        logEvent('app_open', { version: __APP_VERSION__ });
        // Remote config and the update check run after first paint, never before it.
        setTimeout(() => {
          refreshRemoteConfig();
          checkForUpdate({ auto: true });
        }, 1200);
      });
  }, []);

  useEffect(() => {
    let off = () => {};
    onBackButton(() => useNav.getState().back()).then((f) => (off = f));
    return () => off();
  }, []);

  useEffect(() => {
    let off = () => {};
    onAppState((active) => {
      if (active) {
        api().onResume?.();
        refreshRemoteConfig();
        checkForUpdate({ auto: true });
      }
    }).then((f) => (off = f));
    return () => off();
  }, []);

  useEffect(() => on('session:ended', () => useNav.getState().resetAll()), []);

  // Links must never navigate the app's own WebView; open them in the browser instead.
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (/^(https?:|mailto:)/i.test(href)) {
        e.preventDefault();
        openExternal(href);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <>
      {status === 'booting' ? <Splash /> : status === 'signed-in' ? <Shell /> : <AuthFlow />}
      <ToastHost />
      <UpdateGate />
    </>
  );
}
