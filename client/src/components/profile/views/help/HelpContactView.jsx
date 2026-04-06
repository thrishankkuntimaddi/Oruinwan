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
    transition: '150ms ease',
};
const focusAmber = e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)';
const blurDefault = e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';

const HelpContactView = ({ onBack }) => (
    <div style={panelStyle}>
        <div style={headerStyle}>
            <button onClick={onBack}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'rgba(228,228,228,0.45)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
            >
                <ChevronLeft size={13} /> Back
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4' }}>Contact</span>
            <div style={{ width: '40px' }} />
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <select style={{ ...inp }}
                onFocus={focusAmber} onBlur={blurDefault}
            >
                <option value="general">General Inquiry</option>
                <option value="billing">Billing</option>
                <option value="support">Support</option>
            </select>
            <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.6, height: '88px' }}
                placeholder="Message..."
                onFocus={focusAmber} onBlur={blurDefault}
            />
            <button
                style={{ width: '100%', padding: '8px 16px', fontSize: '13px', fontWeight: 700, background: '#b8956a', color: '#0c0c0c', border: 'none', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
                Send Message
            </button>
        </div>
    </div>
);

export default HelpContactView;
