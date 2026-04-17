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
    background: 'rgba(255,255,255,0.02)', flexShrink: 0,
};
const BackBtn = ({ onBack }) => (
    <button onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
        onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
    >
        <ChevronLeft size={13} /> Back
    </button>
);

const HelpAcademyView = ({ onBack }) => (
    <div style={{ ...panelStyle, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={headerStyle}>
            <BackBtn onBack={onBack} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Academy</span>
            <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }} className="custom-scrollbar">
            {['Getting Started', 'Power User Tips', 'Workspace Management', 'Integrations'].map((guide, i) => (
                <button key={i}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter,system-ui,sans-serif' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{guide}</div>
                    <div style={{ fontSize: '11px', color: '#b8956a' }}>Read guide →</div>
                </button>
            ))}
        </div>
    </div>
);

export default HelpAcademyView;
