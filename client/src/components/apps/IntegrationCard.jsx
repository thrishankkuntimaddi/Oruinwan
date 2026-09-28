import React from "react";
import { CheckCircle2, ZapOff } from "lucide-react";

const T = {
  bg: 'var(--bg-surface)',
  bgHover: 'var(--bg-hover)',
  border: 'var(--border-default)',
  borderHover: 'var(--border-accent)',
  accent: 'var(--accent)',
  accentBg: 'var(--accent-dim)',
  text: 'var(--text-primary)',
  muted: 'var(--text-muted)',
  font: 'var(--font)',
};

export default function IntegrationCard({ integration, connected, onCardClick }) {
  return (
    <button
      onClick={onCardClick}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: '2px',
        padding: '18px', textAlign: 'left', cursor: 'pointer', outline: 'none',
        width: '100%', transition: 'all 150ms ease', fontFamily: T.font,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = T.bgHover;
        e.currentTarget.style.borderColor = T.borderHover;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = T.bg;
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      {}
      {connected && (
        <span style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--state-success)', background: 'color-mix(in srgb, var(--state-success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--state-success) 25%, transparent)', borderRadius: '2px', padding: '2px 7px' }}>
          <CheckCircle2 size={10} /> Connected
        </span>
      )}
      {!connected && (
        <span style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '2px 7px' }}>
          <ZapOff size={10} /> Not Connected
        </span>
      )}

      {}
      <div style={{ width: '44px', height: '44px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '14px', flexShrink: 0 }}>
        {integration.emoji}
      </div>

      {}
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: T.text, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '60px' }}>
        {integration.name}
      </h3>

      {}
      <span style={{ fontSize: '10px', color: T.muted, marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {integration.categoryLabel}
      </span>

      {}
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {integration.description}
      </p>

      {}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: connected ? 'var(--state-success)' : T.accent }}>
          {connected ? 'Manage →' : 'Connect →'}
        </span>
      </div>
    </button>
  );
}
