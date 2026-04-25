import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Shield, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import api from '@services/api';

const RULES = [
    { key: 'len', label: '8+ characters',    test: p => p.length >= 8 },
    { key: 'up',  label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
    { key: 'num', label: 'Number',           test: p => /\d/.test(p) },
    { key: 'sym', label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
];

const inputSt = (err) => ({
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-input)',
    border: `1px solid ${err ? 'var(--state-danger)' : 'var(--border-default)'}`,
    color: 'var(--text-primary)', fontSize: '13px',
    padding: '10px 38px 10px 38px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 150ms ease',
});

const SetPassword = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [skipMode, setSkipMode] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        if (user.authProvider === 'local' || user.passwordSetAt) {
            navigate('/workspaces', { replace: true });
        }
    }, [user, navigate]);

    const rules = RULES.map(r => ({ ...r, met: r.test(password) }));
    const allMet = rules.every(r => r.met);
    const matches = password.length > 0 && password === confirmPassword;
    const isValid = allMet && matches;
    const confirmError = confirmPassword.length > 0 && password !== confirmPassword;

    const handleSetPassword = async () => {
        if (!isValid) { showToast('Please meet all password requirements', 'error'); return; }
        setLoading(true);
        try {
            await api.post('/api/auth/oauth/set-password', { password });
            showToast('Password set successfully!', 'success');
            localStorage.removeItem('oauthPasswordSetupRequired');
            localStorage.removeItem('oauthProvider');
            setTimeout(() => navigate('/workspaces', { replace: true }), 500);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to set password', 'error');
        } finally { setLoading(false); }
    };

    const handleSkip = async () => {
        setLoading(true);
        try {
            await api.post('/api/auth/oauth/skip-password');
            showToast('You can set a password later from settings', 'info');
            localStorage.removeItem('oauthPasswordSetupRequired');
            localStorage.removeItem('oauthProvider');
            setTimeout(() => navigate('/workspaces', { replace: true }), 500);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to skip', 'error');
        } finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
            {}
            <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(184,149,106,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(155,142,207,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '420px', animation: 'slideUp 300ms cubic-bezier(0.16,1,0.3,1)' }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
                    <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>Chttrix</span>
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '32px' }}>
                    {}
                    <div style={{ width: '44px', height: '44px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <Shield size={22} style={{ color: 'var(--accent)' }} />
                    </div>

                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>Secure Your Account</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                        You signed in with <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{user?.authProvider}</span>. Set a password to enable email login.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>New Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password"
                                    style={inputSt(false)}
                                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {}
                        {password.length > 0 && (
                            <div style={{ padding: '12px 14px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Requirements</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    {rules.map(r => (
                                        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: r.met ? 'var(--state-success)' : 'var(--text-muted)', fontWeight: r.met ? 600 : 400 }}>
                                            {r.met ? <CheckCircle2 size={11} /> : <div style={{ width: '11px', height: '11px', borderRadius: '50%', border: '1px solid var(--border-accent)', flexShrink: 0 }} />}
                                            {r.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password"
                                    style={inputSt(confirmError)}
                                    onFocus={e => !confirmError && (e.target.style.borderColor = 'var(--border-accent)')}
                                    onBlur={e => !confirmError && (e.target.style.borderColor = 'var(--border-default)')} />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            {confirmPassword.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', fontSize: '11px', fontWeight: 600, color: matches ? 'var(--state-success)' : 'var(--state-danger)' }}>
                                    {matches ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                    {matches ? 'Passwords match' : 'Passwords do not match'}
                                </div>
                            )}
                        </div>

                        {}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: skipMode ? 'rgba(184,149,106,0.06)' : 'var(--bg-active)', border: `1px solid ${skipMode ? 'var(--border-accent)' : 'var(--border-subtle)'}`, cursor: 'pointer', transition: 'all 150ms ease' }}
                            onClick={() => setSkipMode(!skipMode)}>
                            <div style={{ width: '16px', height: '16px', border: `1px solid ${skipMode ? 'var(--accent)' : 'var(--border-default)'}`, background: skipMode ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms ease' }}>
                                {skipMode && <CheckCircle2 size={10} style={{ color: 'var(--bg-base)' }} />}
                            </div>
                            <div>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Skip for now</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Set a password later from account settings</p>
                            </div>
                        </div>

                        {}
                        {skipMode ? (
                            <button onClick={handleSkip} disabled={loading}
                                style={{ padding: '10px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 150ms ease' }}>
                                {loading ? 'Skipping...' : 'Skip Setup →'}
                            </button>
                        ) : (
                            <button onClick={handleSetPassword} disabled={!isValid || loading}
                                style={{ padding: '10px', background: isValid ? 'var(--accent)' : 'var(--bg-active)', border: 'none', color: isValid ? 'var(--bg-base)' : 'var(--text-muted)', fontSize: '13px', fontWeight: 700, cursor: isValid && !loading ? 'pointer' : 'not-allowed', opacity: loading ? 0.6 : 1, transition: 'all 150ms ease', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Key size={14} />
                                {loading ? 'Setting Password...' : 'Set Password'}
                            </button>
                        )}
                    </div>
                </div>

                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '24px', opacity: 0.5 }}>
                    © 2026 Chttrix Inc.
                </p>
            </div>
        </div>
    );
};

export default SetPassword;
