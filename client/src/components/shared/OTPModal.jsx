import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Dialog, Btn, Meter } from '../ui/page';
import './entryModals.css';

const EMPTY = ['', '', '', '', '', ''];

const OTPModal = ({ isOpen, onClose, target, targetType, onVerify, onResend }) => {
    const [otp, setOtp] = useState(EMPTY);
    const [timeLeft, setTimeLeft] = useState(300);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const inputRefs = useRef([]);

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

    useEffect(() => {
        if (isOpen) {
            setOtp(EMPTY);
            setTimeLeft(300);
            setError('');
            setSuccess(false);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    const fill = (text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6);
        if (!digits) return;
        setOtp(digits.split('').concat(Array(6 - digits.length).fill('')));
        setError('');
        inputRefs.current[Math.min(digits.length, 5)]?.focus();
    };

    const handleChange = (index, value) => {
        if (value.length > 1) { fill(value); return; }
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
        if (e.key === 'Enter') handleVerify();
    };

    const handleVerify = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Enter all 6 digits');
            return;
        }
        setIsVerifying(true);
        setError('');
        try {
            await onVerify(otpString);
            setSuccess(true);
            setTimeout(() => { onClose(); }, 1500);
        } catch (err) {
            setError(err.message || 'That code didn’t work. Check it and try again.');
            setOtp(EMPTY);
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
            setOtp(EMPTY);
            setTimeLeft(300);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err.message || 'We couldn’t send a new code');
        } finally {
            setIsResending(false);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isEmail = targetType === 'email';
    const complete = otp.join('').length === 6;

    return (
        <Dialog
            open={isOpen}
            size="sm"
            busy={success}
            onClose={onClose}
            title={success ? 'Verified' : `Verify your ${isEmail ? 'email' : 'phone number'}`}
            lead={success ? undefined : <>We sent a 6-digit code to <strong style={{ color: 'var(--text-primary)' }}>{target}</strong>.</>}
            footer={success ? null : (
                <>
                    {timeLeft === 0 ? (
                        <Btn variant="ghost" icon={RefreshCw} loading={isResending} onClick={handleResend} style={{ marginRight: 'auto' }}>
                            {isResending ? 'Sending…' : 'Send a new code'}
                        </Btn>
                    ) : (
                        <span className="cd-hint" style={{ marginRight: 'auto', alignSelf: 'center' }}>
                            New code in {formatTime(timeLeft)}
                        </span>
                    )}
                    <Btn variant="primary" onClick={handleVerify} loading={isVerifying} disabled={!complete}>
                        {isVerifying ? 'Verifying…' : 'Verify'}
                    </Btn>
                </>
            )}
        >
            {success ? (
                <div className="em-done" role="status">
                    <span className="gl-empty-mark"><CheckCircle2 size={18} /></span>
                    <h3>{isEmail ? 'Email' : 'Phone number'} confirmed</h3>
                    <p>Taking you back to the form…</p>
                </div>
            ) : (
                <>
                    <div className="em-otp" role="group" aria-label="6-digit code">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                className="gl-input"
                                type="text"
                                inputMode="numeric"
                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                aria-label={`Digit ${index + 1}`}
                                maxLength={index === 0 ? 6 : 1}
                                value={digit}
                                data-filled={digit ? 'true' : undefined}
                                aria-invalid={error ? 'true' : undefined}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={(e) => { e.preventDefault(); fill(e.clipboardData.getData('text')); }}
                            />
                        ))}
                    </div>

                    {error && (
                        <div className="em-alert" data-tone="danger" role="alert">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="em-timer">
                        <Meter value={Math.round((timeLeft / 300) * 100)} tone={timeLeft > 60 ? undefined : 'danger'} label="Time left for this code" />
                        <span>{timeLeft > 0 ? `Expires in ${formatTime(timeLeft)}` : 'Code expired'}</span>
                    </div>
                </>
            )}
        </Dialog>
    );
};

export default OTPModal;
