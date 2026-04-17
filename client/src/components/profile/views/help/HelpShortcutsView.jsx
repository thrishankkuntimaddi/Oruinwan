import React from 'react';
import { ChevronLeft } from 'lucide-react';

const panelStyle = {
    width: '256px', background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.75)', overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
};
const headerStyle = {
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.02)',
};
const inp = {
    width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--bg-hover)',
    border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'Inter,system-ui,sans-serif', colorScheme: 'dark',
    resize: 'vertical', lineHeight: 1.6,
};

const HelpShortcutsView = ({ onBack }) => (
    <div style={panelStyle}>
        <div style={headerStyle}>
            <button onClick={onBack}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
            >
                <ChevronLeft size={13} /> Back
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Shortcuts</span>
            <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '8px 14px 14px' }}>
            {[
                { label: 'Quick Search',  keys: 'Cmd+K' },
                { label: 'New Message',   keys: 'Cmd+N' },
                { label: 'Toggle AI',     keys: 'Cmd+J' },
                { label: 'Close',         keys: 'Esc'   },
            ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.label}</span>
                    <kbd style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{item.keys}</kbd>
                </div>
            ))}
        </div>
    </div>
);

export default HelpShortcutsView;
