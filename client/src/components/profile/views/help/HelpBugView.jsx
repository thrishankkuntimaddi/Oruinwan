import React from 'react';
import { ChevronLeft } from 'lucide-react';

const panelStyle = {
    width: '256px', background: '#111111', border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.75)', overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
};
const headerStyle = {
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.02)',
};
const inp = {
    width: '100%', padding: '8px 12px', fontSize: '13px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e4', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'Inter,system-ui,sans-serif', colorScheme: 'dark',
    resize: 'vertical', lineHeight: 1.6, height: '112px',
};

const HelpBugView = ({ onBack }) => (
    <div style={panelStyle}>
        <div style={headerStyle}>
            <button onClick={onBack}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'rgba(228,228,228,0.45)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
            >
                <ChevronLeft size={13} /> Back
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4' }}>Report Bug</span>
            <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea style={inp} placeholder="Describe the issue..."
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
                style={{ width: '100%', padding: '8px 16px', fontSize: '13px', fontWeight: 700, background: '#f87171', color: '#0c0c0c', border: 'none', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
                Submit Report
            </button>
        </div>
    </div>
);

export default HelpBugView;
