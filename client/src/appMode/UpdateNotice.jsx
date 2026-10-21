// "Oruinwan 2.x is available" toast for the desktop app (Update and restart, or the installer when
// the app itself changed), older Android tablet builds (APK), and the browser ("A new version is
// available — Reload"). The state lives in ./updates/store.js; Settings → About & updates and
// the Notifications page show the same update.
import React, { useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { actionLabel, getUpdater, hasUpdate, updateTitle, useUpdateState } from './updates/store';
import { installerReason } from './updates/bundle';

export { desktopDownload, isNewer } from './updates/manifest';

/** One-line explanation under the title. */
export function updateSubtitle(s) {
  if (s.status === 'failed') return s.error || 'The update could not be installed.';
  if (s.status === 'downloading') return `Downloading… ${Math.round(s.percent || 0)}%`;
  if (s.status === 'ready') return 'Downloaded and checked. Restart to finish.';
  if (s.status === 'applying') return 'Restarting…';
  if (s.plan?.mode === 'reload') return 'Reload the page to get the latest version.';
  if (s.plan?.mode === 'bundle') return 'Installs in a few seconds and restarts the app. Your data is kept.';
  return installerReason(s.plan?.reason) || (s.kind === 'desktop' ? 'Install it over this version. Your data is kept.' : 'Updates keep your data.');
}

/** Starts the automatic checks; renders the toast. Mount once. */
export default function UpdateNotice() {
  const s = useUpdateState();
  useEffect(() => getUpdater().start(), []);

  const key = s.manifest?.version || s.plan?.mode;
  if (!hasUpdate(s) || (s.dismissed && s.dismissed === key && s.status === 'available')) return null;
  const busy = s.status === 'downloading' || s.status === 'applying';
  const Icon = s.plan?.mode === 'installer' ? Download : RefreshCw;

  return (
    <div
      role="status"
      className="gl-card"
      style={{
        position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 9999, width: 340,
        maxWidth: 'calc(100vw - 32px)', padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon size={16} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{updateTitle(s)}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{updateSubtitle(s)}</div>
          {s.status === 'downloading' && (
            <div style={{ height: 4, borderRadius: 4, background: 'var(--border-default)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(4, s.percent || 0)}%`, height: '100%', background: 'var(--accent)', transition: 'width 200ms' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => getUpdater().install()} disabled={busy}>
              {busy ? (s.status === 'applying' ? 'Restarting…' : 'Downloading…') : actionLabel(s)}
            </button>
            {s.status === 'available' && (
              <button type="button" className="gl-btn gl-btn--sm" onClick={() => getUpdater().dismiss()}>
                Later
              </button>
            )}
          </div>
        </div>
        {!busy && (
          <button
            type="button"
            onClick={() => getUpdater().dismiss()}
            aria-label="Close"
            style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
