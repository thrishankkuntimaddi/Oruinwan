// The "Oruinwan 2.x is available" entry at the top of Notifications (All and Unread). It comes
// from the update check on this device (./updates/store.js), not from the server, so it isn't
// marked read or cleared with the server's notifications; it goes away once updated.
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { actionLabel, getUpdater, hasUpdate, updateTitle, useUpdateState } from './updates/store';
import { updateSubtitle } from './UpdateNotice';

export default function UpdateCard() {
  const s = useUpdateState();
  if (!hasUpdate(s)) return null;
  const busy = s.status === 'downloading' || s.status === 'applying';
  return (
    <div className="gl-card" role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 16, flexWrap: 'wrap' }}>
      <RefreshCw size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{updateTitle(s)}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{updateSubtitle(s)}</div>
      </div>
      <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" disabled={busy} onClick={() => getUpdater().install()}>
        {busy ? 'Working…' : actionLabel(s)}
      </button>
    </div>
  );
}
