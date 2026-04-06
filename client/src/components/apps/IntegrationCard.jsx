import React from "react";
import { CheckCircle2, ZapOff } from "lucide-react";

const T = {
  bg: 'rgba(255,255,255,0.03)',
  bgHover: 'rgba(184,149,106,0.06)',
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(184,149,106,0.25)',
  accent: '#b8956a',
  accentBg: 'rgba(184,149,106,0.1)',
  text: '#e4e4e4',
  muted: 'rgba(228,228,228,0.4)',
  font: 'Inter, system-ui, sans-serif',
};

export default function IntegrationCard({ integration, connected, onCardClick }) {
  return (
    <button
      onClick={onCardClick}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        background: T.bg, border: `1px solid ${T.border}`,
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
      {/* Connected badge */}
      {connected && (
        <span style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', padding: '2px 7px' }}>
          <CheckCircle2 size={10} /> Connected
        </span>
      )}
      {!connected && (
        <span style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, color: 'rgba(228,228,228,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 7px' }}>
          <ZapOff size={10} /> Not Connected
        </span>
      )}

      {/* Icon */}
      <div style={{ width: '44px', height: '44px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '14px', flexShrink: 0 }}>
        {integration.emoji}
      </div>

      {/* Name */}
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: T.text, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '60px' }}>
        {integration.name}
      </h3>

      {/* Category */}
      <span style={{ fontSize: '10px', color: T.muted, marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {integration.categoryLabel}
      </span>

      {/* Description */}
      <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.5)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {integration.description}
      </p>

      {/* Footer CTA */}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: connected ? '#34d399' : T.accent }}>
          {connected ? 'Manage →' : 'Connect →'}
        </span>
      </div>
    </button>
  );
}
