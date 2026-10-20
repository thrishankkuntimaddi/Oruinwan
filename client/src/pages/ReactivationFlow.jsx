import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RotateCcw, Mail, AlertCircle, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../contexts/ToastContext';
import AuthShell from '../components/public/AuthShell';
import { AuthMark, AuthHead } from '../components/public/AuthParts';

const ReactivationFlow = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const emailFromUrl = searchParams.get('email') || '';

    const [email] = useState(emailFromUrl);
    const [otpCode, setOtpCode] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleReactivate = async (e) => {
        e.preventDefault();

        if (otpCode.length !== 6) {
            setError('Enter the 6-digit code from the email');
            return;
        }

        if (!password) {
            setError('Enter your password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post(
                `/api/auth/reactivate/verify-otp`,
                { email, otpCode, password }
            );

            if (response.data.accessToken) {
                localStorage.setItem('accessToken', response.data.accessToken);
            }

            showToast('Welcome back. Your account is active again.', 'success');

            navigate('/workspaces');
        } catch (err) {
            setError(err.response?.data?.message || 'We couldn’t reactivate your account. Try again.');

            if (err.response?.data?.message?.includes('OTP') || err.response?.data?.message?.includes('expired')) {
                setOtpCode('');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            title="Reactivate account"
            aside={<>
                <h1 className="orw-auth__title">Welcome<br /><span className="orw-gloss-text">back.</span></h1>
                <p className="orw-auth__lead">Your messages, channels and settings are where you left them. Confirm it’s you to switch your account back on.</p>
            </>}
        >
            <AuthMark icon={RotateCcw} />
            <AuthHead eyebrow="Deactivated account" title="Reactivate your account">
                Enter the code we emailed you and your password. You’ll go straight to your workspaces.
            </AuthHead>

            <form onSubmit={handleReactivate} className="orw-form">
                {error && (
                    <div className="orw-auth__alert" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</div>
                )}

                <div className="orw-field">
                    <span className="orw-label">Email</span>
                    <div className="orw-auth-value"><Mail size={15} aria-hidden="true" /><span>{email || 'No email in this link'}</span></div>
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="reactivate-code">Verification code</label>
                    <input
                        id="reactivate-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="orw-input"
                        style={{ letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' }}
                        maxLength={6}
                        autoFocus
                        aria-describedby="reactivate-code-hint"
                    />
                    <p className="orw-hint" id="reactivate-code-hint">The code is in your inbox and works for 10 minutes.</p>
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="reactivate-password">Password</label>
                    <div className="orw-input-wrap">
                        <input
                            id="reactivate-password"
                            type={showPwd ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="orw-input"
                        />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowPwd(!showPwd)}
                            aria-label={showPwd ? 'Hide password' : 'Show password'} aria-pressed={showPwd}>
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6 || !password}
                    aria-busy={loading}
                    className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block"
                >
                    {loading ? 'Reactivating…' : <>Reactivate account <ArrowRight size={15} /></>}
                </button>
            </form>

            <p className="orw-auth__note">
                <Link to="/login" className="orw-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
                </Link>
            </p>
        </AuthShell>
    );
};

export default ReactivationFlow;
