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

const TIMELINE = [
    { date: 'NOV 2025', color: '#b8956a', title: 'Chttrix AI 2.0',  body: 'Smarter responses & context awareness.' },
    { date: 'OCT 2025', color: '#a78bfa', title: 'Dark Mode',        body: 'Pure dark surfaces across all views.' },
];

const HelpWhatsNewView = ({ onBack }) => (
    <div style={panelStyle}>
        <div style={headerStyle}>
            <button onClick={onBack}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'rgba(228,228,228,0.45)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
            >
                <ChevronLeft size={13} /> Back
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4' }}>What's New</span>
            <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {TIMELINE.map(({ date, color, title, body }, i) => (
                <div key={i} style={{ paddingLeft: '14px', borderLeft: `2px solid ${color}`, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-5px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color, marginBottom: '3px' }}>{date}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4', marginBottom: '3px' }}>{title}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(228,228,228,0.45)', lineHeight: 1.5 }}>{body}</div>
                </div>
            ))}
        </div>
    </div>
);

export default HelpWhatsNewView;
