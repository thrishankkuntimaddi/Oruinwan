import { useEffect } from 'react';
import { api, useSession } from '../data/session.js';
import { useNav } from './nav.js';
import { Shell } from './Shell.jsx';
import { BrandMark } from './BrandMark.jsx';
import { ToastHost } from '../ui/Feedback.jsx';
import { AuthFlow, ProtectAccount } from '../features/auth/AuthFlow.jsx';
import { WorkspacePicker } from '../features/workspace/WorkspacePicker.jsx';
import { CreateWorkspaceFlow } from '../features/workspace/CreateWorkspaceFlow.jsx';
import { UpdateGate } from '../features/update/UpdateGate.jsx';
import { hideSplash, onAppState, onAppUrl, onBackButton, openExternal } from '../native/index.js';
import { JoinWorkspaceFlow } from '../features/workspace/JoinWorkspace.jsx';
import { checkForUpdate, confirmRunningBundle } from '../update/updater.js';
import { refreshRemoteConfig, logEvent } from '../config/remote.js';
import { on } from '../lib/bus.js';
import { watchKeyboard } from '../native/keyboard.js';
import { onPushReceived, onPushTap } from '../native/push.js';
import { handleNotification, handleReceived } from '../features/push/quickReply.js';
import { MediaHost } from '../features/media/MediaHost.jsx';
import { ReminderLayer } from '../features/chats/ReminderLayer.jsx';
import { PhoneTour } from '../features/tour/PhoneTour.jsx';
import { finishBackupLink } from '../features/settings/backupInfo.js';
import { openConversationLink, openPageLink } from '../features/home/openTarget.js';
import { browserStartLink } from '../lib/openLink.js';
import { BackupRestoreOffer } from '../features/settings/backup.jsx';
import { PlanLayer } from '../features/plan/UpgradeSheet.jsx';
import { ApprovalHost } from '../features/auth/ApprovalHost.jsx';

/** While the app restores the session: the mark lands, then breathes until it's ready. */
function Splash() {
  return (
    <div className="grid h-full place-items-center bg-bg" aria-busy="true" aria-label="Opening Oruinwan">
      <div className="intro-mark">
        <div className="intro-breathe" style={{ animationDelay: '700ms' }}>
          <BrandMark size={88} glow />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const status = useSession((s) => s.status);
  const needsPassword = useSession((s) => s.needsPassword);
  const pickingWorkspace = useSession((s) => s.pickingWorkspace);
  // From the header, the workspace list opens over the open workspace (calls keep running).
  const browsing = pickingWorkspace === 'browse';
  const creatingWorkspace = useSession((s) => s.creatingWorkspace);
  const joinToken = useSession((s) => s.joinToken);

  useEffect(() => {
    watchKeyboard();
    useSession
      .getState()
      .boot()
      .finally(() => {
        hideSplash();
        // A quick (over-the-air) update that got this far started fine: keep it.
        confirmRunningBundle();
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
        // A workspace joined meanwhile (an invitation accepted in the browser) shows up now.
        if (useSession.getState().status === 'signed-in') useSession.getState().loadWorkspaces().catch(() => {});
        refreshRemoteConfig();
        checkForUpdate({ auto: true });
      }
    }).then((f) => (off = f));
    return () => off();
  }, []);

  useEffect(() => on('session:ended', () => useNav.getState().resetAll()), []);

  // Invitation links: opened on the phone (App Links / Universal Links / oruinwan://), or, in a
  // browser, this page opened as /join-workspace?token=…
  useEffect(() => {
    const here = window.location;
    // The app's own address in a browser (/ in the preview, /m/ on the website).
    const home = new URL('./', here.href).pathname;
    if (/\/(join-workspace|join|invite)\b/.test(here.pathname) && useSession.getState().openInvite(here.href)) {
      window.history.replaceState(null, '', home);
    }
    // A phone opening the website lands here with the page it asked for (server: phoneWebUi).
    const asked = browserStartLink(here);
    if (asked) {
      openPageLink(asked);
      window.history.replaceState(null, '', home);
    }
    let off = () => {};
    // oruinwan://sso?code=… finishes a company SSO sign-in; other links are invitations.
    // oruinwan://backup?result=… is Google Drive backup coming back (Settings → Backup).
    // https://<web>/workspace/…/channel|dm/<id>?message=…|thread=… opens that message or thread.
    onAppUrl((url) => finishBackupLink(url) || useSession.getState().finishSso(url) || openPageLink(url) || useSession.getState().openInvite(url) || openConversationLink(url)).then((f) => (off = f));
    return () => off();
  }, []);

  // Tapping a push notification opens its conversation (once the session has loaded); its
  // Reply and Mark as read actions are handled too (features/push/quickReply.js).
  useEffect(() => {
    if (status !== 'signed-in') return undefined;
    const offTap = onPushTap(handleNotification);
    const offReceived = onPushReceived(handleReceived);
    return () => {
      offTap();
      offReceived();
    };
  }, [status]);

  // Escape: close the top sheet or dialog, leave a text field, then go back a screen.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const { overlays } = useNav.getState();
      if (overlays.length) {
        e.preventDefault();
        overlays[overlays.length - 1].close();
        return;
      }
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        el.blur();
        return;
      }
      if (useSession.getState().status === 'signed-in' && useNav.getState().pop()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      {status === 'booting' ? <Splash /> : status === 'signed-in' ? (needsPassword ? <ProtectAccount /> : joinToken ? <JoinWorkspaceFlow /> : creatingWorkspace ? <CreateWorkspaceFlow /> : pickingWorkspace && !browsing ? <WorkspacePicker /> : <Shell />) : <AuthFlow />}
      {status === 'signed-in' && browsing && !creatingWorkspace && !joinToken && (
        <div className="animate-fade-in fixed inset-0 z-[55] bg-bg">
          <WorkspacePicker />
        </div>
      )}
      {status === 'signed-in' && <MediaHost />}
      {status === 'signed-in' && <ReminderLayer />}
      {/* Free-plan limits: the upgrade sheet for any refused addition (features/plan). */}
      {status === 'signed-in' && <PlanLayer />}
      {/* Sign-in / unlock requests from the person's other devices, and Scan to sign in. */}
      {status === 'signed-in' && <ApprovalHost />}
      {/* The first-run tour, once the workspace itself is on screen (not over sign-in flows). */}
      {status === 'signed-in' && !needsPassword && !joinToken && !creatingWorkspace && !pickingWorkspace && <PhoneTour />}
      {status === 'signed-in' && !needsPassword && !joinToken && !creatingWorkspace && !pickingWorkspace && <BackupRestoreOffer />}
      <ToastHost />
      <UpdateGate />
    </>
  );
}
