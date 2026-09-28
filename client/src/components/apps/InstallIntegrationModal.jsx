import React, { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";

// Preview-only connect dialog for the (feature-flagged) mock integrations.
const FONT = 'var(--font)';

export default function InstallIntegrationModal({ integration, onClose, onInstalled }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!integration) return null;

  const handleInstall = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      onInstalled?.(integration.id);
      setTimeout(() => onClose(), 1500);
    }, 1800);
  };

  const btn = { flex: 1, padding: '9px 0', fontSize: '13px', fontWeight: 600, borderRadius: '2px', cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Install integration" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '100%', maxWidth: '384px', boxShadow: 'var(--card-shadow)', overflow: 'hidden', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Install Integration</h3>
          <button onClick={onClose} aria-label="Close" style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          {done ? (
            <>
              <div style={{ width: '56px', height: '56px', borderRadius: '2px', background: 'color-mix(in srgb, var(--state-success) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={28} style={{ color: 'var(--state-success)' }} />
              </div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{integration.name} connected (preview)</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>You can manage this integration in Apps.</p>
            </>
          ) : (
            <>
              <div style={{ width: '56px', height: '56px', borderRadius: '2px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                {integration.emoji}
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{integration.name}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{integration.description}</p>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', borderRadius: '2px', padding: '10px 12px', margin: 0 }}>
                Preview: this is a visual prototype. No real data will be accessed.
              </p>
            </>
          )}
        </div>

        {!done && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ ...btn, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)' }}>Cancel</button>
            <button onClick={handleInstall} disabled={loading}
              style={{ ...btn, fontWeight: 700, color: '#0c0c0c', background: 'var(--accent)', border: 'none', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
