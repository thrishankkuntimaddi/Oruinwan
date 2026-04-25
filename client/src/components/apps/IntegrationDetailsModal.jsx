import React, { useState } from "react";
import { X, CheckCircle2, Loader2, Shield, Zap, ChevronRight } from "lucide-react";

export default function IntegrationDetailsModal({ integration, connected, onClose, onStatusChange }) {
  const [isConnected, setIsConnected] = useState(connected);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!integration) return null;

  const handleConnect = () => {
    setLoading(true);
    setShowSuccess(false);
    setTimeout(() => {
      setLoading(false);
      const next = !isConnected;
      setIsConnected(next);
      setShowSuccess(true);
      onStatusChange?.(integration.id, next);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 2000);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.2)', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--accent-dim)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
            {integration.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{integration.name}</h2>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
              {integration.categoryLabel}
            </span>
          </div>

          {}
          {isConnected ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#3a8f6a', background: 'rgba(58,143,106,0.1)', border: '1px solid rgba(58,143,106,0.25)', padding: '3px 10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3a8f6a', animation: 'pulse 2s infinite' }} />
              Connected
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-active)', border: '1px solid var(--border-default)', padding: '3px 10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-accent)' }} />
              Not Connected
            </span>
          )}

          <button
            onClick={onClose}
            style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 150ms ease', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {}
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
            {integration.description}
          </p>

          {}
          {showSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(58,143,106,0.08)', border: '1px solid rgba(58,143,106,0.2)', padding: '10px 14px' }}>
              <CheckCircle2 size={16} style={{ color: '#3a8f6a', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#3a8f6a' }}>
                {isConnected ? `${integration.name} connected successfully!` : `${integration.name} has been disconnected.`}
              </span>
            </div>
          )}

          {}
          <div>
            <h3 style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
              <Zap size={11} /> What you can do
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {integration.useCases.map((useCase, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <ChevronRight size={14} style={{ color: '#b8956a', flexShrink: 0, marginTop: '2px' }} />
                  {useCase}
                </li>
              ))}
            </ul>
          </div>

          {}
          <div>
            <h3 style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
              <Shield size={11} /> Permissions required
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {integration.permissions.map((perm, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--border-accent)', flexShrink: 0 }} />
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '13px', fontWeight: 700,
              background: loading ? 'var(--bg-active)' : isConnected ? 'rgba(201,64,64,0.08)' : '#b8956a',
              border: isConnected ? '1px solid rgba(201,64,64,0.3)' : 'none',
              color: loading ? 'var(--text-muted)' : isConnected ? '#c94040' : '#000',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 150ms ease',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1'; }}
          >
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? (isConnected ? "Disconnecting…" : "Connecting…") : isConnected ? "Disconnect" : `Connect ${integration.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
