import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import ProgressHeader from './ProgressHeader';

const RegisterLayout = ({
    children, onNavigate, currentStep,
    onBack, onNext, onSubmit,
    isLoading,
    showBackButton = true,
    showNextButton = true,
    showSubmitButton = false,
    
    theme, toggleTheme,
}) => {
    
    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        return () => document.documentElement.classList.remove('public-scroll');
    }, []);

    return (
        <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <style>{`* { box-sizing: border-box; } ::selection { background: rgba(184,149,106,0.3); color: #e4e4e4; }`}</style>

            {}
            <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '50%', height: '60%', background: 'radial-gradient(circle, rgba(184,149,106,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: '0', right: '-5%', width: '40%', height: '50%', background: 'radial-gradient(circle, rgba(110,168,254,0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            {}
            <nav style={{ position: 'relative', zIndex: 10, padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div onClick={() => onNavigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '28px', height: '28px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Chttrix</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>/</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Register Company</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <button onClick={() => onNavigate('/login')}
                        style={{ background: 'none', border: 'none', color: '#b8956a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>
                        Sign in →
                    </button>
                </div>
            </nav>

            {}
            <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
                <div style={{ width: '100%', maxWidth: '860px', background: '#111', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)', overflow: 'hidden' }}>

                    {}
                    <ProgressHeader currentStep={currentStep} />

                    {}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(184,149,106,0.2) transparent' }}>
                        {children}
                    </div>

                    {}
                    <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
                        {showBackButton && currentStep > 1 ? (
                            <button onClick={onBack}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                                <ArrowLeft size={13} /> Back
                            </button>
                        ) : <div />}

                        {showNextButton && currentStep < 5 ? (
                            <button onClick={onNext}
                                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 24px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                Continue <ArrowRight size={14} />
                            </button>
                        ) : showSubmitButton ? (
                            <button onClick={onSubmit} disabled={isLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 24px', background: isLoading ? 'rgba(184,149,106,0.4)' : '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: isLoading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: isLoading ? 0.7 : 1 }}>
                                {isLoading ? 'Submitting...' : <><span>Submit Registration</span><Sparkles size={14} /></>}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterLayout;
