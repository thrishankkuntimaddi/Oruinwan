import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, ArrowLeft, Key, CheckCircle2 } from 'lucide-react';

const inputSt = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px',
    padding: '10px 14px 10px 36px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'border-color 150ms ease',
};

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/', { replace: true });
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            setSent(true);
        } catch (err) {
            console.error('Forgot Password Error:', err);
        } finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
            {}
            <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(184,149,106,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(155,142,207,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '400px', animation: 'slideUp 300ms cubic-bezier(0.16,1,0.3,1)' }}>
                {}
                <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px', cursor: 'pointer' }}>
                    <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '32px', height: '32px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>Chttrix</span>
                </div>

                {}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '32px' }}>
                    {}
                    <div style={{ width: '44px', height: '44px', background: 'var(--bg-active)', border: `1px solid ${sent ? 'var(--state-success)' : 'var(--border-accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        {sent
                            ? <CheckCircle2 size={22} style={{ color: 'var(--state-success)' }} />
                            : <Key size={22} style={{ color: 'var(--accent)' }} />}
                    </div>

                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                        {sent ? 'Check your inbox' : 'Forgot password?'}
                    </h1>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                        {sent ? `We sent a reset link to ${email}` : 'Enter your email to receive a password reset link.'}
                    </p>

                    {!sent ? (
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    Email Address
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required
                                        style={inputSt}
                                        onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={loading}
                                style={{ padding: '10px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'opacity 150ms ease', letterSpacing: '0.02em' }}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ padding: '12px 14px', background: 'rgba(90,186,138,0.06)', border: '1px solid rgba(90,186,138,0.2)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                Didn't receive it? Check your spam folder or try a different address.
                            </div>
                            <button onClick={() => setSent(false)}
                                style={{ padding: '10px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                Try a different email
                            </button>
                        </div>
                    )}
                </div>

                {}
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <ArrowLeft size={13} /> Back to Sign In
                    </Link>
                </div>

                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '32px', opacity: 0.5 }}>
                    © 2026 Chttrix Inc.
                </p>
            </div>
        </div>
    );
}
