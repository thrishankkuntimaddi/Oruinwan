import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Shield, ShieldCheck, ShieldOff, Check, X, AlertCircle, Key, Loader, Copy } from 'lucide-react';
import Card from './Card';
import api from '@services/api';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

// ── Password strength calculator ─────────────────────────────────────────────
const calculatePasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length * 20;
    let label = 'Weak', color = 'var(--state-danger)';
    if (score >= 80) { label = 'Strong'; color = 'var(--state-success)'; }
    else if (score >= 60) { label = 'Good'; color = '#c9a840'; }
    else if (score >= 40) { label = 'Fair'; color = '#c97c40'; }
    return { score, label, color, checks };
};

const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 2,
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms ease',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    marginBottom: 6,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const STEP = { IDLE: 'idle', SETUP: 'setup', CONFIRMING: 'confirming', DISABLING: 'disabling' };

const SecurityTab = ({ passwordData, setPasswordData, showCurrentPassword, setShowCurrentPassword, loading, handlePasswordChange }) => {
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const strength = calculatePasswordStrength(passwordData.newPassword);

    const [tfaEnabled, setTfaEnabled] = useState(false);
    const [tfaStep, setTfaStep] = useState(STEP.IDLE);
    const [tfaSetup, setTfaSetup] = useState(null);
    const [otpInput, setOtpInput] = useState('');
    const [tfaLoading, setTfaLoading] = useState(false);
    const [tfaError, setTfaError] = useState('');
    const [copied, setCopied] = useState(false);

    const load2FAStatus = useCallback(async () => {
        try {
            const { data } = await api.get('/api/auth/2fa/status');
            setTfaEnabled(data.twoFactorEnabled);
        } catch { }
    }, []);

    useEffect(() => { load2FAStatus(); }, [load2FAStatus]);

    const PasswordInput = ({ label, fieldKey, show, setShow, placeholder }) => (
        <div>
            <label style={labelStyle}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={show ? 'text' : 'password'}
                    value={passwordData[fieldKey]}
                    onChange={e => setPasswordData({ ...passwordData, [fieldKey]: e.target.value })}
                    style={{ ...inputStyle, paddingRight: 36 }}
                    placeholder={placeholder}
                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                        transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
            </div>
        </div>
    );

    const handleStartSetup = async () => {
        setTfaLoading(true);
        setTfaError('');
        try {
            const { data } = await api.post('/api/auth/2fa/setup');
            setTfaSetup(data);
            setTfaStep(STEP.SETUP);
        } catch (err) {
            setTfaError(err.response?.data?.message || 'Failed to start setup');
        } finally { setTfaLoading(false); }
    };

    const handleVerifySetup = async () => {
        if (!otpInput || otpInput.length < 6) { setTfaError('Enter the 6-digit code from your authenticator app'); return; }
        setTfaLoading(true); setTfaError('');
        try {
            await api.post('/api/auth/2fa/verify-setup', { otp: otpInput });
            setTfaEnabled(true); setTfaStep(STEP.IDLE); setTfaSetup(null); setOtpInput('');
        } catch (err) {
            setTfaError(err.response?.data?.message || 'Invalid OTP. Try again.');
        } finally { setTfaLoading(false); }
    };

    const handleDisable = async () => {
        if (!otpInput || otpInput.length < 6) { setTfaError('Enter your 6-digit OTP to disable 2FA'); return; }
        setTfaLoading(true); setTfaError('');
        try {
            await api.post('/api/auth/2fa/disable', { otp: otpInput });
            setTfaEnabled(false); setTfaStep(STEP.IDLE); setOtpInput('');
        } catch (err) {
            setTfaError(err.response?.data?.message || 'Failed to disable 2FA');
        } finally { setTfaLoading(false); }
    };

    const handleCancelTfa = () => {
        setTfaStep(STEP.IDLE); setTfaSetup(null); setOtpInput(''); setTfaError('');
    };

    const copySecret = () => {
        if (tfaSetup?.secret) {
            navigator.clipboard.writeText(tfaSetup.secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const btnPrimary = (disabled) => ({
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 16px', fontSize: 13, fontWeight: 500,
        color: '#0c0c0c', backgroundColor: 'var(--accent)',
        border: 'none', borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 150ms ease',
        ...S.font,
    });

    const btnGhost = {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 16px', fontSize: 13, fontWeight: 500,
        color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)',
        border: '1px solid var(--border-default)', borderRadius: 2,
        cursor: 'pointer',
        transition: 'color 150ms ease, border-color 150ms ease',
        ...S.font,
    };

    const btnDanger = (disabled) => ({
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 16px', fontSize: 13, fontWeight: 500,
        color: '#fff', backgroundColor: 'var(--state-danger)',
        border: 'none', borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 150ms ease',
        ...S.font,
    });

    const isPasswordDisabled = loading
        || !passwordData.currentPassword
        || !passwordData.newPassword
        || passwordData.newPassword !== passwordData.confirmPassword;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Password Section ──────────────────────────────────────── */}
            <Card title="Change Password" subtitle="Update your account password">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
                    <PasswordInput label="Current Password" fieldKey="currentPassword" show={showCurrentPassword} setShow={setShowCurrentPassword} placeholder="Enter current password" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <PasswordInput label="New Password" fieldKey="newPassword" show={showNew} setShow={setShowNew} placeholder="New password" />
                        <PasswordInput label="Confirm Password" fieldKey="confirmPassword" show={showConfirm} setShow={setShowConfirm} placeholder="Confirm password" />
                    </div>

                    {passwordData.newPassword && (
                        <div style={{
                            padding: 12,
                            backgroundColor: 'var(--bg-active)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', ...S.font }}>Strength</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: strength.color, ...S.font }}>{strength.label}</span>
                            </div>
                            <div style={{ width: '100%', height: 3, backgroundColor: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', backgroundColor: strength.color, width: `${strength.score}%`, transition: 'width 300ms ease' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 12px' }}>
                                {[['length', '8+ chars'], ['uppercase', 'Uppercase'], ['lowercase', 'Lowercase'], ['number', 'Number'], ['special', 'Symbol']].map(([k, l]) => (
                                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: strength.checks?.[k] ? 'var(--state-success)' : 'var(--text-muted)', ...S.font }}>
                                        {strength.checks?.[k] ? <Check size={10} /> : <X size={10} />}
                                        {l}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--state-danger)', ...S.font }}>
                            <AlertCircle size={13} /> Passwords do not match
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handlePasswordChange}
                            disabled={isPasswordDisabled}
                            style={btnPrimary(isPasswordDisabled)}
                            onMouseEnter={e => { if (!isPasswordDisabled) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                            onMouseLeave={e => { if (!isPasswordDisabled) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                        >
                            {loading ? 'Updating…' : 'Update Password'}
                        </button>
                    </div>
                </div>
            </Card>

            {/* ── 2FA Section ───────────────────────────────────────────── */}
            <Card title="Two-Factor Authentication" subtitle="Add extra security with a one-time password app">
                {/* Status header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: tfaEnabled ? 'rgba(90,186,138,0.12)' : 'var(--bg-active)',
                            border: `1px solid ${tfaEnabled ? 'rgba(90,186,138,0.3)' : 'var(--border-default)'}`,
                        }}>
                            {tfaEnabled
                                ? <ShieldCheck size={16} style={{ color: 'var(--state-success)' }} />
                                : <Shield size={16} style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', ...S.font }}>Authenticator App (TOTP)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <span style={{
                                    display: 'inline-block',
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: tfaEnabled ? 'var(--state-success)' : 'var(--text-muted)',
                                }} />
                                <span style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: tfaEnabled ? 'var(--state-success)' : 'var(--text-muted)',
                                    ...S.font,
                                }}>
                                    {tfaEnabled ? '2FA Enabled' : '2FA Disabled'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {tfaStep === STEP.IDLE && (
                        <button
                            onClick={tfaEnabled ? () => setTfaStep(STEP.DISABLING) : handleStartSetup}
                            disabled={tfaLoading}
                            style={tfaEnabled ? {
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px', fontSize: 12, fontWeight: 500,
                                color: 'var(--state-danger)',
                                backgroundColor: 'rgba(224,82,82,0.08)',
                                border: '1px solid rgba(224,82,82,0.3)',
                                borderRadius: 2, cursor: 'pointer',
                                transition: 'background-color 150ms ease',
                                ...S.font,
                            } : {
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px', fontSize: 12, fontWeight: 500,
                                color: '#0c0c0c', backgroundColor: 'var(--accent)',
                                border: 'none', borderRadius: 2, cursor: tfaLoading ? 'not-allowed' : 'pointer',
                                opacity: tfaLoading ? 0.5 : 1,
                                transition: 'background-color 150ms ease',
                                ...S.font,
                            }}
                        >
                            {tfaLoading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                            {tfaEnabled ? <><ShieldOff size={13} /> Disable 2FA</> : <><Key size={13} /> Enable 2FA</>}
                        </button>
                    )}
                </div>

                {/* Error */}
                {tfaError && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 12, padding: 10,
                        backgroundColor: 'rgba(224,82,82,0.08)',
                        border: '1px solid rgba(224,82,82,0.25)',
                        borderRadius: 2, fontSize: 12, color: 'var(--state-danger)',
                        ...S.font,
                    }}>
                        <AlertCircle size={13} />{tfaError}
                    </div>
                )}

                {/* Setup step */}
                {tfaStep === STEP.SETUP && tfaSetup && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 16,
                        padding: 16,
                        backgroundColor: 'var(--bg-active)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 2,
                    }}>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, ...S.font }}>Step 1 — Scan with your authenticator app</p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', ...S.font }}>Open Google Authenticator, Authy, or any TOTP app and scan the QR code below.</p>
                        </div>

                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ border: '2px solid var(--border-accent)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(tfaSetup.otpauthUrl)}`}
                                    alt="2FA QR Code"
                                    style={{ width: 140, height: 140, display: 'block' }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', ...S.font }}>Can't scan? Enter this key manually:</p>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: 8,
                                    backgroundColor: 'var(--bg-surface)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 2,
                                }}>
                                    <code style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', wordBreak: 'break-all', userSelect: 'all', fontFamily: 'monospace' }}>
                                        {tfaSetup.secret}
                                    </code>
                                    <button
                                        onClick={copySecret}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2, transition: 'color 150ms ease', flexShrink: 0 }}
                                        title="Copy"
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    >
                                        {copied ? <Check size={13} style={{ color: 'var(--state-success)' }} /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, ...S.font }}>Step 2 — Enter the 6-digit OTP to confirm</p>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={otpInput}
                                onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                style={{ ...inputStyle, maxWidth: 140, textAlign: 'center', fontFamily: 'monospace', fontSize: 18, letterSpacing: '0.4em' }}
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={handleVerifySetup}
                                disabled={tfaLoading || otpInput.length < 6}
                                style={{
                                    ...btnPrimary(tfaLoading || otpInput.length < 6),
                                    backgroundColor: 'var(--state-success)',
                                }}
                                onMouseEnter={e => { if (otpInput.length >= 6 && !tfaLoading) e.currentTarget.style.opacity = '0.85'; }}
                                onMouseLeave={e => e.currentTarget.style.opacity = (tfaLoading || otpInput.length < 6) ? '0.5' : '1'}
                            >
                                {tfaLoading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                                Confirm & Enable 2FA
                            </button>
                            <button onClick={handleCancelTfa} style={btnGhost}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Disabling step */}
                {tfaStep === STEP.DISABLING && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 12,
                        padding: 16,
                        backgroundColor: 'rgba(224,82,82,0.06)',
                        border: '1px solid rgba(224,82,82,0.25)',
                        borderRadius: 2,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <AlertCircle size={14} style={{ color: 'var(--state-danger)', marginTop: 1, flexShrink: 0 }} />
                            <p style={{ fontSize: 12, color: 'var(--state-danger)', margin: 0, ...S.font }}>
                                Disabling 2FA reduces your account security. Enter your current OTP to confirm.
                            </p>
                        </div>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpInput}
                            onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            style={{ ...inputStyle, maxWidth: 140, textAlign: 'center', fontFamily: 'monospace', fontSize: 18, letterSpacing: '0.4em' }}
                            onFocus={e => e.target.style.borderColor = 'var(--state-danger)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={handleDisable}
                                disabled={tfaLoading || otpInput.length < 6}
                                style={btnDanger(tfaLoading || otpInput.length < 6)}
                            >
                                {tfaLoading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldOff size={13} />}
                                Disable 2FA
                            </button>
                            <button onClick={handleCancelTfa} style={btnGhost}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Idle + enabled info */}
                {tfaStep === STEP.IDLE && tfaEnabled && (
                    <div style={{
                        padding: 12,
                        backgroundColor: 'rgba(90,186,138,0.06)',
                        border: '1px solid rgba(90,186,138,0.25)',
                        borderRadius: 2,
                    }}>
                        <p style={{ fontSize: 12, color: 'var(--state-success)', margin: 0, ...S.font }}>
                            ✓ Your account is protected with two-factor authentication. You'll be asked for a 6-digit OTP at login on new devices.
                        </p>
                    </div>
                )}

                {/* Idle + disabled warning */}
                {tfaStep === STEP.IDLE && !tfaEnabled && (
                    <div style={{
                        padding: 12,
                        backgroundColor: 'rgba(184,149,106,0.06)',
                        border: '1px solid rgba(184,149,106,0.25)',
                        borderRadius: 2,
                    }}>
                        <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0, ...S.font }}>
                            ⚠ 2FA is not enabled. Enable it to protect your account even if your password is compromised.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default SecurityTab;
