import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Mail, Phone } from 'lucide-react';

const OTPModal = ({ isOpen, onClose, target, targetType, onVerify, onResend }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const inputRefs = useRef([]);

    // Timer countdown
    useEffect(() => {
        if (!isOpen || success) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, success]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setOtp(['', '', '', '', '', '']);
            setTimeLeft(300);
            setError('');
            setSuccess(false);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    const handleChange = (index, value) => {
        if (value && !/^\d$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError('');
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                const newOtp = digits.split('').concat(Array(6 - digits.length).fill(''));
                setOtp(newOtp);
                const nextIndex = Math.min(digits.length, 5);
                inputRefs.current[nextIndex]?.focus();
            });
        }
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }
        setIsVerifying(true);
        setError('');
        try {
            await onVerify(otpString);
            setSuccess(true);
            setTimeout(() => { onClose(); }, 1500);
        } catch (err) {
            setError(err.message || 'Invalid OTP. Please try again.');
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        setError('');
        try {
            await onResend();
            setOtp(['', '', '', '', '', '']);
            setTimeLeft(300);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err.message || 'Failed to resend OTP');
        } finally {
            setIsResending(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const timerPercent = Math.round((timeLeft / 300) * 100);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', fontFamily: 'Inter, system-ui, sans-serif',
            animation: 'otpFadeIn 0.2s ease-out',
        }}>
            {/* Backdrop */}
            <div
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
                onClick={!success ? onClose : undefined}
            />

            {/* Modal card */}
            <div style={{
                position: 'relative', width: '100%', maxWidth: '400px',
                background: '#111', border: '1px solid var(--border-default)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
                animation: 'otpSlideUp 0.28s cubic-bezier(.22,1,.36,1)',
                overflow: 'hidden',
            }}>

                {!success ? (
                    <>
                        {/* Header bar */}
                        <div style={{
                            padding: '20px 24px 18px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: 'rgba(255,255,255,0.02)',
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Icon badge */}
                                <div style={{
                                    width: '38px', height: '38px', background: 'rgba(184,149,106,0.12)',
                                    border: '1px solid rgba(184,149,106,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    {targetType === 'email'
                                        ? <Mail size={17} style={{ color: '#b8956a' }} />
                                        : <Phone size={17} style={{ color: '#b8956a' }} />
                                    }
                                </div>

                                <div>
                                    <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                                        Verify {targetType === 'email' ? 'Email Address' : 'Phone Number'}
                                    </h2>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.4 }}>
                                        6-digit code sent to{' '}
                                        <span style={{ color: '#b8956a', fontWeight: 600 }}>{target}</span>
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                style={{
                                    width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', background: 'none', border: 'none',
                                    color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
                                    transition: 'color 150ms ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.3)'}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '28px 24px 24px' }}>
                            {/* OTP digit inputs */}
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (inputRefs.current[index] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        style={{
                                            width: '46px', height: '54px',
                                            textAlign: 'center', fontSize: '22px', fontWeight: 700,
                                            background: digit ? 'rgba(184,149,106,0.08)' : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${error
                                                ? 'rgba(239,68,68,0.5)'
                                                : digit ? 'rgba(184,149,106,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            fontFamily: 'Inter, system-ui, sans-serif',
                                            transition: 'border-color 150ms ease, background 150ms ease',
                                            cursor: 'text',
                                        }}
                                        onFocus={e => {
                                            if (!error) e.target.style.borderColor = 'rgba(184,149,106,0.6)';
                                            e.target.style.background = 'rgba(184,149,106,0.06)';
                                        }}
                                        onBlur={e => {
                                            if (!digit) {
                                                e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)';
                                                e.target.style.background = 'rgba(255,255,255,0.04)';
                                            }
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    marginBottom: '16px', padding: '10px 14px',
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    color: '#f87171', fontSize: '12px',
                                }}>
                                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Timer row */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                marginBottom: '20px',
                            }}>
                                <div style={{ flex: 1, marginRight: '12px' }}>
                                    {/* Progress bar */}
                                    <div style={{ height: '2px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${timerPercent}%`,
                                            background: timeLeft > 60 ? '#b8956a' : '#f87171',
                                            transition: 'width 1s linear, background 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '12px', fontWeight: 600, flexShrink: 0,
                                    color: timeLeft > 60 ? '#b8956a' : '#f87171',
                                    fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {timeLeft > 0 ? formatTime(timeLeft) : 'Expired'}
                                </span>
                            </div>

                            {/* Verify button */}
                            <button
                                onClick={handleVerify}
                                disabled={otp.join('').length !== 6 || isVerifying}
                                style={{
                                    width: '100%', padding: '12px',
                                    background: otp.join('').length === 6 && !isVerifying ? '#b8956a' : 'rgba(184,149,106,0.2)',
                                    border: 'none',
                                    color: otp.join('').length === 6 && !isVerifying ? '#0c0c0c' : 'rgba(228,228,228,0.3)',
                                    fontSize: '13px', fontWeight: 700, cursor: otp.join('').length !== 6 || isVerifying ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', transition: 'opacity 150ms ease, background 150ms ease',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                    marginBottom: '10px',
                                }}
                                onMouseEnter={e => { if (otp.join('').length === 6 && !isVerifying) e.currentTarget.style.opacity = '0.88'; }}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                {isVerifying ? (
                                    <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Verifying…</>
                                ) : 'Verify Code'}
                            </button>

                            {/* Resend */}
                            <div style={{ textAlign: 'center' }}>
                                {timeLeft > 0 ? (
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                                        Didn't receive it? Resend available in{' '}
                                        <span style={{ color: '#b8956a', fontWeight: 600 }}>{formatTime(timeLeft)}</span>
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleResend}
                                        disabled={isResending}
                                        style={{
                                            background: 'none', border: 'none', fontSize: '12px', fontWeight: 600,
                                            color: isResending ? 'rgba(228,228,228,0.3)' : '#b8956a',
                                            cursor: isResending ? 'not-allowed' : 'pointer',
                                            fontFamily: 'inherit', transition: 'opacity 150ms ease',
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        }}
                                        onMouseEnter={e => { if (!isResending) e.currentTarget.style.opacity = '0.75'; }}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                    >
                                        {isResending
                                            ? <><RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Resending…</>
                                            : 'Resend Code →'
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Success state */
                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                        <div style={{
                            width: '52px', height: '52px', margin: '0 auto 16px',
                            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <CheckCircle size={26} style={{ color: '#4ade80' }} />
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                            Verified Successfully
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            Your {targetType === 'email' ? 'email address' : 'phone number'} has been confirmed.
                        </p>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes otpFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes otpSlideUp {
                    from { transform: translateY(16px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default OTPModal;
