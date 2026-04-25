import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Shield, Key } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import api from '@services/api';

const REQS = [
    { key: 'len', label: '8+ characters',    test: p => p.length >= 8 },
    { key: 'up',  label: 'Uppercase letter',  test: p => /[A-Z]/.test(p) },
    { key: 'num', label: 'Number',             test: p => /\d/.test(p) },
    { key: 'sym', label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
];

export default function SetupPassword() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user, setUser } = useAuth();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showCf, setShowCf] = useState(false);
    const [loading, setLoading] = useState(false);

    const reqResults = REQS.map(r => ({ ...r, met: r.test(password) }));
    const passwordsMatch = password.length > 0 && password === confirm;
    const isValid = reqResults.every(r => r.met) && passwordsMatch;

    const handleSubmit = async () => {
        if (!isValid) { showToast('Please meet all password requirements', 'error'); return; }
        setLoading(true);
        try {
            await api.post('/api/auth/setup-temp-password', { password });
            showToast('Password set! Welcome to Chttrix 🎉', 'success');
            if (setUser && user) setUser({ ...user, isTemporaryPassword: false, passwordInitialized: true });
            const dest = sessionStorage.getItem('setupPasswordDest') || '/workspaces';
            sessionStorage.removeItem('setupPasswordDest');
            setTimeout(() => navigate(dest, { replace: true }), 600);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to set password. Please try again.', 'error');
        } finally { setLoading(false); }
    };

    const inputStyle = {
        width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
        border: '1px solid var(--border-default)', color: 'var(--text-primary)',
        fontSize: '13px', padding: '10px 40px 10px 38px', outline: 'none',
        fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms ease',
    };

    return (
        <div style={{
            minHeight: '100vh', width: '100%', background: 'var(--bg-base)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, system-ui, sans-serif', padding: '20px',
        }}>
            <div style={{ width: '100%', maxWidth: '420px' }}>

                {}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>

                    {}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'rgba(184,149,106,0.1)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Shield size={18} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Secure Your Account</h1>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>First-time login — set a permanent password</p>
                        </div>
                    </div>

                    {}
                    <div style={{ padding: '24px' }}>
                        {}
                        {user?.username && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', marginBottom: '20px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(184,149,106,0.15)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{user.username}</span>
                                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '2px 6px' }}>Required</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {}
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input type={showPw ? 'text' : 'password'} value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit()}
                                        placeholder="Create a strong password"
                                        autoComplete="new-password" autoFocus
                                        style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                                    <button type="button" onClick={() => setShowPw(v => !v)}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            {}
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Confirm Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input type={showCf ? 'text' : 'password'} value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit()}
                                        placeholder="Re-enter your password"
                                        autoComplete="new-password"
                                        style={inputStyle}
                                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                                    <button type="button" onClick={() => setShowCf(v => !v)}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                                        {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            {}
                            {password && (
                                <div style={{ background: 'var(--bg-active)', border: '1px solid var(--border-default)', padding: '12px 14px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '10px' }}>Requirements</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                        {reqResults.map(r => (
                                            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: r.met ? 'var(--state-success)' : 'var(--text-muted)' }}>
                                                {r.met
                                                    ? <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
                                                    : <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid var(--text-muted)', flexShrink: 0 }} />}
                                                {r.label}
                                            </div>
                                        ))}
                                    </div>
                                    {confirm && (
                                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: passwordsMatch ? 'var(--state-success)' : 'var(--state-danger)' }}>
                                            {passwordsMatch ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                            {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {}
                            <SubmitBtn onClick={handleSubmit} disabled={!isValid || loading} loading={loading} />
                        </div>
                    </div>
                </div>

                {}
                <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <Shield size={11} /> Your temporary password will be permanently invalidated after setup
                </p>
            </div>
        </div>
    );
}

function SubmitBtn({ onClick, disabled, loading }) {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: disabled ? 'var(--bg-active)' : hov ? 'var(--accent-hover)' : 'var(--accent)',
                border: 'none', color: disabled ? 'var(--text-muted)' : 'var(--bg-base)',
                fontSize: '13px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
            }}>
            {loading
                ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'var(--bg-base)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <><Key size={14} /> Set My Password</>}
        </button>
    );
}
