// ResetPassword.jsx — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, Lock, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

const RULES = [
    { key: 'length',  label: '8–16 characters', test: p => p.length >= 8 && p.length <= 16 },
    { key: 'upper',   label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
    { key: 'number',  label: 'Number',           test: p => /[0-9]/.test(p) },
    { key: 'special', label: 'Special character', test: p => /[^A-Za-z0-9]/.test(p) },
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

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const token = params.get('token');
    const email = params.get('email');

    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        return () => document.documentElement.classList.remove('public-scroll');
    }, []);

    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showCfm, setShowCfm] = useState(false);
    const [loading, setLoading] = useState(false);

    const rules = RULES.map(r => ({ ...r, met: r.test(newPassword) }));
    const allMet = rules.every(r => r.met);
    const matches = newPassword.length > 0 && newPassword === confirm;
    const isValid = allMet && matches;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirm) { showToast('Passwords do not match', 'error'); return; }
        if (!allMet) { showToast('Password does not meet requirements', 'error'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email, password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Reset failed');
            showToast('Password reset successfully — please log in.', 'success');
            navigate('/login');
        } catch (err) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const confirmError = confirm.length > 0 && newPassword !== confirm;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
            {/* Ambient glow */}
            <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(184,149,106,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '420px', animation: 'slideUp 300ms cubic-bezier(0.16,1,0.3,1)' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
                    <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>Chttrix</span>
                </div>

                {/* Card */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '32px' }}>
                    {/* Icon */}
                    <div style={{ width: '44px', height: '44px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <ShieldCheck size={22} style={{ color: 'var(--accent)' }} />
                    </div>

                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>Reset Password</h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                        Create a strong new password for <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{email}</span>
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* New Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>New Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" required style={inputSt(false)}
                                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                                <button type="button" onClick={() => setShowPwd(!showPwd)}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Rules checklist */}
                        {newPassword.length > 0 && (
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

                        {/* Confirm Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input type={showCfm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" required style={inputSt(confirmError)}
                                    onFocus={e => !confirmError && (e.target.style.borderColor = 'var(--border-accent)')}
                                    onBlur={e => !confirmError && (e.target.style.borderColor = 'var(--border-default)')} />
                                <button type="button" onClick={() => setShowCfm(!showCfm)}
                                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                    {showCfm ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            {confirm.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', fontSize: '11px', fontWeight: 600, color: matches ? 'var(--state-success)' : 'var(--state-danger)' }}>
                                    {matches ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                    {matches ? 'Passwords match' : 'Passwords do not match'}
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={!isValid || loading}
                            style={{ padding: '10px', background: isValid ? 'var(--accent)' : 'var(--bg-active)', border: 'none', color: isValid ? 'var(--bg-base)' : 'var(--text-muted)', fontSize: '13px', fontWeight: 700, cursor: isValid && !loading ? 'pointer' : 'not-allowed', opacity: loading ? 0.6 : 1, transition: 'all 150ms ease', letterSpacing: '0.02em', marginTop: '4px' }}>
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '32px', opacity: 0.5 }}>
                    © 2026 Chttrix Inc.
                </p>
            </div>
        </div>
    );
}
