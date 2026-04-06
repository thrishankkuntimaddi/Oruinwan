// LoginPage.jsx — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Sparkles, Shield, MessageSquare, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoginForm from '../../components/loginpage/LoginForm';
import SignupForm from '../../components/loginpage/SignupForm';

const FEATURES = [
    { icon: MessageSquare, color: '#b8956a', text: 'Channels, DMs & threads' },
    { icon: Zap,           color: '#6ea8fe', text: 'One-click video huddles' },
    { icon: Sparkles,      color: '#a78bfa', text: 'Chttrix AI — workspace aware' },
    { icon: Shield,        color: '#5aba8a', text: 'End-to-end encrypted' },
];

const LoginPage = () => {
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode');
    const [isSignup, setIsSignup] = useState(mode === 'signup');
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const registrationMessage = location.state?.message;
    const prefilledEmail = location.state?.email;

    // Enable scroll for this public page
    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        return () => document.documentElement.classList.remove('public-scroll');
    }, []);

    useEffect(() => {
        setIsSignup(mode === 'signup');
    }, [mode]);

    useEffect(() => {
        if (!loading && user) {
            const needsPasswordSetup = localStorage.getItem('oauthPasswordSetupRequired') === 'true';
            if (needsPasswordSetup) return;
            if (user.isTemporaryPassword === true && user.passwordInitialized === false) return;
            const isChttrixAdmin = user.roles?.includes('chttrix_admin');
            const isOwner = user.companyRole === 'owner';
            if (isChttrixAdmin) navigate('/chttrix-admin', { replace: true });
            else if (isOwner) navigate('/owner/dashboard', { replace: true });
            else navigate('/workspaces', { replace: true });
        }
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0c0c' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <img src="/chttrix-logo.jpg" alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', opacity: 0.4 }} />
                    <div style={{ height: '2px', width: '80px', background: 'rgba(184,149,106,0.2)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: '-40px', height: '2px', width: '40px', background: '#b8956a', animation: 'slideBar 1.2s ease-in-out infinite' }} />
                    </div>
                </div>
                <style>{`@keyframes slideBar { from{left:-40px} to{left:100%} }`}</style>
            </div>
        );
    }

    if (user) return null;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#0c0c0c', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`* { box-sizing: border-box; } ::selection { background: rgba(184,149,106,0.3); color: #e4e4e4; }`}</style>

            {/* ── LEFT PANEL — Brand ── */}
            <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px', background: '#080808', borderRight: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
                {/* Ambient glow */}
                <div style={{ position: 'absolute', top: '20%', left: '30%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(184,149,106,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(110,168,254,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

                {/* Logo */}
                <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                    <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '28px', height: '28px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.02em' }}>Chttrix</span>
                </div>

                {/* Center content */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: 'clamp(32px,3.5vw,52px)', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '18px' }}>
                        Work where<br />
                        <span style={{ color: '#b8956a' }}>the future happens.</span>
                    </h1>
                    <p style={{ fontSize: '15px', color: 'rgba(228,228,228,0.45)', lineHeight: '1.8', marginBottom: '40px', maxWidth: '400px' }}>
                        The operating system for high-performance teams. Channels, AI, tasks — all in one place.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {FEATURES.map(f => {
                            const Icon = f.icon;
                            return (
                                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '30px', height: '30px', background: `${f.color}14`, border: `1px solid ${f.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={13} style={{ color: f.color }} />
                                    </div>
                                    <span style={{ fontSize: '13px', color: 'rgba(228,228,228,0.55)', fontWeight: 500 }}>{f.text}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer quote */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ borderLeft: '2px solid rgba(184,149,106,0.3)', paddingLeft: '14px', marginBottom: '16px' }}>
                        <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.4)', fontStyle: 'italic', lineHeight: '1.7' }}>
                            "Chttrix replaced Slack, Notion, and Jira for our team. We haven't looked back."
                        </p>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.25)', marginTop: '6px' }}>Maya H. — CTO at Fluxio</p>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.15)' }}>© 2026 Chttrix Inc.</p>
                </div>
            </div>

            {/* ── RIGHT PANEL — Forms ── */}
            <div style={{ flex: '1 1 50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', overflowY: 'auto' }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>
                    {/* Registration success banner */}
                    {registrationMessage && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '14px 16px', background: 'rgba(90,186,138,0.07)', border: '1px solid rgba(90,186,138,0.25)', marginBottom: '24px', animation: 'fadeIn 300ms ease' }}>
                            <CheckCircle2 size={16} style={{ color: '#5aba8a', flexShrink: 0, marginTop: '1px' }} />
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#5aba8a', marginBottom: '2px' }}>Account Created</p>
                                <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.5)' }}>{registrationMessage}</p>
                                {prefilledEmail && <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.35)', fontFamily: 'monospace', marginTop: '4px' }}>{prefilledEmail}</p>}
                            </div>
                        </div>
                    )}
                    <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }`}</style>

                    {/* Tab switcher */}
                    <div style={{ display: 'flex', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {[{ label: 'Sign In', val: false }, { label: 'Create Account', val: true }].map(tab => (
                            <button key={tab.label} onClick={() => setIsSignup(tab.val)}
                                style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: `2px solid ${isSignup === tab.val ? '#b8956a' : 'transparent'}`, color: isSignup === tab.val ? '#e4e4e4' : 'rgba(228,228,228,0.4)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 200ms ease', marginBottom: '-1px' }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Form */}
                    {isSignup
                        ? <SignupForm onSwitch={() => setIsSignup(false)} />
                        : <LoginForm onSwitch={() => setIsSignup(true)} initialEmail={prefilledEmail} />
                    }

                    {/* Nav links */}
                    <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', gap: '16px' }}>
                        {[
                            { label: 'Privacy', path: '/privacy' },
                            { label: 'Terms', path: '/terms' },
                            { label: 'Register Company', path: '/register-company' },
                        ].map(l => (
                            <button key={l.label} onClick={() => navigate(l.path)}
                                style={{ background: 'none', border: 'none', color: 'rgba(228,228,228,0.25)', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.25)'}>
                                {l.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
