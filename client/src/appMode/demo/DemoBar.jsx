// The strip above the app while the demo workspace is open (desktop and tablet apps).
import React from 'react';
import { FlaskConical, LogOut } from 'lucide-react';
import { leaveDemo } from './session';

export default function DemoBar() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed', top: 'var(--oru-inset-top, 0px)', left: 'var(--oru-inset-left, 0px)', right: 'var(--oru-inset-right, 0px)',
        height: 'var(--oru-demo-bar)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'linear-gradient(90deg, rgba(184,149,106,0.10), rgba(184,149,106,0.18), rgba(184,149,106,0.10)), #0e0d0b',
        borderBottom: '1px solid rgba(200,162,116,0.25)', color: '#d9cdbd', fontFamily: 'var(--font, Inter, system-ui, sans-serif)', fontSize: 12,
      }}
    >
      <FlaskConical size={13} style={{ color: '#c9a87c' }} aria-hidden="true" />
      <span>
        <strong style={{ fontWeight: 600, color: '#ecdcc4' }}>Demo workspace</strong>
        <span style={{ color: '#9a8f80' }}> · sample data that stays on this device</span>
      </span>
      <button
        type="button"
        onClick={leaveDemo}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, padding: '3px 10px', borderRadius: 999,
          border: '1px solid rgba(200,162,116,0.45)', background: 'transparent', color: '#ecdcc4', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <LogOut size={12} aria-hidden="true" /> Leave demo
      </button>
    </div>
  );
}
