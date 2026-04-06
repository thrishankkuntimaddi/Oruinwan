import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react';

/**
 * Password Unlock Modal — Monolith Flow Design System
 *
 * Appears when user has password-protected identity keys
 * but session is rehydrated without password.
 *
 * This is NOT a crypto bug — it's expected behavior for:
 * - Page refresh
 * - New device login
 * - Session rehydration
 */
export default function PasswordUnlockModal({ onSubmit }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();

        if (!password.trim()) {
            setError('Password is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onSubmit(password);
            // Success — modal will be closed by parent component
        } catch (err) {
            console.error('❌ [UNLOCK] Password unlock failed:', err);

            // Provide more actionable error messages
            const rawMsg = err.message || '';
            let friendlyMsg = 'Incorrect password. Please try again.';
            if (rawMsg.includes('500')) {
                friendlyMsg = 'Server error while verifying password. Please try again in a moment.';
            } else if (rawMsg.includes('404')) {
                friendlyMsg = 'Encryption keys not found on server. Please contact support.';
            } else if (rawMsg.includes('403')) {
                friendlyMsg = 'Session expired. Please refresh the page and log in again.';
            } else if (rawMsg.includes('Failed to unwrap')) {
                friendlyMsg = 'Could not unlock encryption. Please check your password and try again.';
            } else if (rawMsg && rawMsg !== 'Incorrect password') {
                friendlyMsg = rawMsg;
            }

            setError(friendlyMsg);
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !loading) {
            handleUnlock(e);
        }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 999,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                padding: '16px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                animation: 'pwUnlockFadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-modal-title"
        >
            <div style={{
                background: 'var(--bg-surface, #111111)',
                border: '1px solid var(--border-accent, #383838)',
                width: '100%', maxWidth: '420px',
                overflow: 'hidden',
                animation: 'pwUnlockSlideIn 260ms cubic-bezier(0.16,1,0.3,1)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid var(--border-default, #222222)',
                    background: 'var(--bg-active, #1c1c1c)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                    <div style={{
                        width: '36px', height: '36px',
                        background: 'var(--bg-base, #0c0c0c)',
                        border: '1px solid var(--border-default, #222222)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Lock size={18} style={{ color: 'var(--accent, #b8956a)' }} strokeWidth={2} />
                    </div>
                    <div>
                        <h2
                            id="unlock-modal-title"
                            style={{
                                margin: 0, fontSize: '15px', fontWeight: 600,
                                color: 'var(--text-primary, #e4e4e4)',
                                letterSpacing: '-0.01em', lineHeight: 1.2,
                            }}
                        >
                            Unlock Encryption
                        </h2>
                        <p style={{
                            margin: '3px 0 0', fontSize: '12px',
                            color: 'var(--text-secondary, #7a7a7a)',
                            lineHeight: 1.4,
                        }}>
                            Enter your password to access secure messaging
                        </p>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleUnlock} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Info notice */}
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '10px 12px',
                        background: 'var(--bg-hover, #161616)',
                        border: '1px solid var(--border-default, #222222)',
                    }}>
                        <ShieldAlert size={14} style={{ color: 'var(--accent, #b8956a)', flexShrink: 0, marginTop: '1px' }} />
                        <div>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #e4e4e4)', lineHeight: 1.4 }}>
                                Your messages are encrypted
                            </p>
                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary, #7a7a7a)', lineHeight: 1.5 }}>
                                To decrypt your conversation history, please enter your account password.
                            </p>
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label
                            htmlFor="unlock-password"
                            style={{
                                display: 'block', fontSize: '10px', fontWeight: 700,
                                color: 'var(--text-muted, #404040)',
                                textTransform: 'uppercase', letterSpacing: '0.12em',
                                marginBottom: '7px',
                            }}
                        >
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="unlock-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(null);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter your password"
                                autoFocus
                                autoComplete="current-password"
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '9px 40px 9px 12px',
                                    background: 'var(--bg-input, #141414)',
                                    border: `1px solid ${error ? 'var(--state-danger, #e05252)' : 'var(--border-default, #222222)'}`,
                                    color: 'var(--text-primary, #e4e4e4)',
                                    fontSize: '14px', fontFamily: 'inherit',
                                    outline: 'none', boxSizing: 'border-box',
                                    opacity: loading ? 0.5 : 1,
                                    cursor: loading ? 'not-allowed' : 'text',
                                    transition: 'border-color 150ms ease',
                                }}
                                onFocus={e => { if (!error) e.target.style.borderColor = 'var(--border-accent, #383838)'; }}
                                onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border-default, #222222)'; }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                                style={{
                                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted, #404040)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '2px', transition: '150ms ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary, #e4e4e4)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #404040)'}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                            padding: '10px 12px',
                            background: 'rgba(224,82,82,0.08)',
                            border: '1px solid rgba(224,82,82,0.25)',
                        }}>
                            <AlertCircle size={14} style={{ color: 'var(--state-danger, #e05252)', flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--state-danger, #e05252)', lineHeight: 1.5 }}>{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                        <button
                            type="submit"
                            disabled={loading || !password.trim()}
                            style={{
                                width: '100%', padding: '10px',
                                background: (loading || !password.trim()) ? 'var(--bg-active, #1c1c1c)' : 'var(--accent, #b8956a)',
                                border: '1px solid transparent',
                                color: (loading || !password.trim()) ? 'var(--text-muted, #404040)' : '#0c0c0c',
                                fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                                cursor: (loading || !password.trim()) ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'opacity 150ms ease',
                            }}
                            onMouseEnter={e => { if (!loading && password.trim()) e.currentTarget.style.opacity = '0.88'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Unlocking...</span>
                                </>
                            ) : (
                                <>
                                    <Lock size={16} />
                                    <span>Unlock Encryption</span>
                                </>
                            )}
                        </button>

                        <p style={{
                            margin: 0, fontSize: '11px',
                            color: 'var(--text-muted, #404040)',
                            textAlign: 'center', lineHeight: 1.5,
                        }}>
                            Your password is never stored and is only used to decrypt your encryption keys.
                        </p>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes pwUnlockFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pwUnlockSlideIn {
                    from { opacity: 0; transform: translateY(-12px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
