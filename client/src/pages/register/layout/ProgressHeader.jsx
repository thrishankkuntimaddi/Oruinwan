// ProgressHeader.jsx — Monolith Flow Design System
import React from 'react';

const STEP_TITLES = {
    1: 'Start Your Organization',
    2: 'Administrator Profile',
    3: 'Secure Account',
    4: 'Verification',
    5: 'Review & Launch',
};

// Accept and ignore legacy theme prop
const ProgressHeader = ({ currentStep, theme }) => (
    <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '10px' }}>
                    <span style={{ width: '5px', height: '5px', background: '#b8956a', display: 'inline-block' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>
                        Step {currentStep} of 5
                    </span>
                </div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {STEP_TITLES[currentStep] || ''}
                </h1>
            </div>

            {/* Step bars */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map(step => (
                    <div key={step} style={{
                        height: '4px',
                        width: currentStep >= step ? '28px' : '8px',
                        background: currentStep >= step ? '#b8956a' : 'rgba(255,255,255,0.08)',
                        transition: 'all 400ms cubic-bezier(0.4,0,0.2,1)',
                    }} />
                ))}
            </div>
        </div>
    </div>
);

export default ProgressHeader;
