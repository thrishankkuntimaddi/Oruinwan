import React from 'react';
import { ChevronLeft } from 'lucide-react';

const panelStyle = {
    width: '256px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    boxShadow: 'var(--lg-shadow)', overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
};
const headerStyle = {
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-hover)',
};
const inp = {
    width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--bg-hover)',
    border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'Inter,system-ui,sans-serif',
    resize: 'vertical', lineHeight: 1.6, height: '112px',
};

const HelpBugView = ({ onBack }) => (
    <div style={panelStyle}>
        <div style={headerStyle}>
            <button onClick={onBack}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
                <ChevronLeft size={13} /> Back
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Report Bug</span>
            <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea style={inp} placeholder="Describe the issue..."
                onFocus={e => e.currentTarget.style.borderColor = 'var(--gl-accent-line)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            />
            <button
                style={{ width: '100%', padding: '8px 16px', fontSize: '13px', fontWeight: 700, background: 'var(--state-danger)', color: 'var(--bg-base)', border: 'none', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
                Submit Report
            </button>
        </div>
    </div>
);

export default HelpBugView;
