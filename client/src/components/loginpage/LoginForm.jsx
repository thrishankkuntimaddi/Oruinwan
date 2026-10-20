import { useState, useEffect, useContext, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '@services/api';
import { Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { IS_APP } from '../../appMode/env';
import { useGoogleSignIn, googleAvailable, ContinueWithGoogle, finishGoogleSession } from './googleContinue';
import CheckEmailPanel from './CheckEmailPanel';

const LoginForm = ({ initialEmail = '', onGoogleSignup }) => {
    const [formData, setFormData] = useState({ email: initialEmail, password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    // Two-step sign-in: set when the server answers { requires2FA } — { via: 'password' | 'google', googleToken? }.
    const [twoFactor, setTwoFactor] = useState(null);
    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    // Set when the password was right but the email was never verified.
    const [unverifiedEmail, setUnverifiedEmail] = useState(null);
    const { login, setUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const uid = useId();

    // The sign-ins this server has keys for (GET /api/auth/providers). Until it answers, only
    // email and password show, so no button leads to a sign-in that isn't set up.
    const [providers, setProviders] = useState({});
    useEffect(() => {
        let live = true;
        api.get('/api/auth/providers').then(r => { if (live) setProviders(r.data || {}); }).catch(() => {});
        return () => { live = false; };
    }, []);

    const isFormValid = formData.email && formData.password.length >= 6;

    const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        if (!isFormValid) return;
        setLoading(true);
        try {
            const response = await login(formData.email, formData.password, twoFactor ? otp : undefined);
            showToast('Login successful!', 'success');
            await new Promise(r => setTimeout(r, 100));

            const pendingInvite = localStorage.getItem('pendingInvite');
            if (pendingInvite) { navigate(`/join-workspace?token=${pendingInvite}`); return; }
            if (response.redirectTo) { navigate(response.redirectTo); return; }
            if (response?.user?.companyStatus === 'pending' || response?.user?.companyStatus === 'pending_verification') { navigate('/pending-verification'); return; }

            const isPlatformAdmin = response?.user?.roles?.includes('chttrix_admin');
            if (isPlatformAdmin) { navigate('/platform-admin'); return; }

            const companyRole = response?.user?.companyRole;
            if (companyRole === 'owner') { navigate('/owner/dashboard'); return; }
            if (companyRole === 'admin') { navigate('/admin/dashboard'); return; }
            if (companyRole === 'manager') { navigate('/manager/dashboard'); return; }
            navigate('/workspaces');
        } catch (err) {
            if (err.response?.data?.requiresReactivation) {
                showToast('Account deactivated. Check your email for reactivation code.', 'info');
                navigate(`/reactivate?email=${encodeURIComponent(formData.email)}`);
                return;
            }
            if (err.response?.data?.emailNotVerified) {
                setUnverifiedEmail(err.response.data.email || formData.email);
                return;
            }
            if (err.response?.data?.requires2FA) {
                setTwoFactor({ via: 'password' });
                setOtpError(err.response.data.invalidCode ? err.response.data.message : '');
                setOtp('');
                return;
            }
            showToast(err.message || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async (googleToken, code) => {
        try {
            const res = await api.post('/api/auth/google-login', { accessToken: googleToken, ...(code ? { otp: code } : {}) });
            if (res.data?.needsSignup) { onGoogleSignup?.(res.data); return; }
            showToast('Signed in with Google', 'success');
            finishGoogleSession(res.data, { setUser, navigate });
        } catch (err) {
            const data = err.response?.data;
            if (data?.requires2FA) {
                setTwoFactor({ via: 'google', googleToken });
                setOtpError(data.invalidCode ? data.message : '');
                setOtp('');
                return;
            }
            if (data?.requiresReactivation) {
                showToast('Account deactivated. Check your email for reactivation code.', 'info');
                navigate(`/reactivate?email=${encodeURIComponent(data.email || '')}`);
                return;
            }
            showToast(data?.message || 'Google login failed', 'error');
        }
    };

    const googleLogin = useGoogleSignIn({
        onSuccess: tokenResponse => signInWithGoogle(tokenResponse.access_token),
        onError: () => showToast('Login Failed', 'error'),
    });

    const submitCode = async e => {
        e.preventDefault();
        if (otp.length !== 6) return;
        if (twoFactor?.via === 'google') {
            setLoading(true);
            try { await signInWithGoogle(twoFactor.googleToken, otp); } finally { setLoading(false); }
            return;
        }
        await handleSubmit(e);
    };

    // Passkey sign-in: the browser shows its own fingerprint / face / screen-lock prompt.
    // The server skips the authenticator-app code for passkeys (they are already two factors).
    const [passkeyBusy, setPasskeyBusy] = useState(false);
    const signInWithPasskey = async () => {
        setPasskeyBusy(true);
        try {
            const email = formData.email.trim();
            const { data: optionsJSON } = await api.post('/api/auth/passkeys/login/options', email ? { email } : {});
            let response;
            try {
                response = await startAuthentication({ optionsJSON });
            } catch (err) {
                // Closing the browser's prompt is not an error worth a red toast.
                if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
                    showToast(err?.message || "Your browser couldn't use a passkey", 'error');
                }
                return;
            }
            const res = await api.post('/api/auth/passkeys/login/verify', { response });
            showToast('Signed in with a passkey', 'success');
            finishGoogleSession(res.data, { setUser, navigate });
        } catch (err) {
            const data = err.response?.data;
            if (data?.requiresReactivation) {
                showToast('Account deactivated. Check your email for reactivation code.', 'info');
                navigate(`/reactivate?email=${encodeURIComponent(data.email || '')}`);
                return;
            }
            showToast(data?.message || err.message || 'Passkey sign-in failed', 'error');
        } finally {
            setPasskeyBusy(false);
        }
    };

    const leaveTwoFactor = () => { setTwoFactor(null); setOtp(''); setOtpError(''); };

    // Google sign-in returns to the server's own web page, so the desktop and tablet apps
    // (src/appMode) offer email and password only.
    const showGoogle = !IS_APP && googleAvailable(providers);
    // Passkeys are bound to the web origin, so the desktop and tablet apps leave them out too.
    const showPasskey = !IS_APP && typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);

    if (unverifiedEmail) {
        return <CheckEmailPanel email={unverifiedEmail} reason="unverified" onBack={() => setUnverifiedEmail(null)} />;
    }

    if (twoFactor) {
        return (
            <div>
                <div className="orw-auth__panel-head">
                    <h2>Two-step verification</h2>
                    <p>Enter the 6-digit code from your authenticator app to finish signing in.</p>
                </div>
                <form onSubmit={submitCode} className="orw-form">
                    <div className="orw-field">
                        <label className="orw-label" htmlFor={`${uid}-otp`}>Authentication code</label>
                        <input id={`${uid}-otp`} name="otp" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus
                            autoComplete="one-time-code" placeholder="000000" data-testid="login-otp"
                            value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                            className="orw-input" style={{ letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' }}
                            aria-invalid={otpError ? 'true' : undefined} aria-describedby={`${uid}-otp-help`} />
                        <div id={`${uid}-otp-help`} className={otpError ? 'orw-error-text' : 'orw-hint'} role={otpError ? 'alert' : undefined}>
                            {otpError || 'Open Google Authenticator, Authy or your usual app to see the current code.'}
                        </div>
                    </div>
                    <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={otp.length !== 6 || loading} aria-busy={loading}>
                        {loading ? 'Verifying…' : <><ShieldCheck size={15} /> Verify and sign in</>}
                    </button>
                    <button type="button" className="orw-link" onClick={leaveTwoFactor} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <ArrowLeft size={13} /> Use a different account
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="orw-auth__panel-head">
                <h2>Welcome back</h2>
                <p>Sign in to pick up where your team left off.</p>
            </div>

            <form onSubmit={handleSubmit} className="orw-form">
                <div className="orw-field">
                    <label className="orw-label" htmlFor={`${uid}-email`}>Email</label>
                    <input id={`${uid}-email`} name="email" type="email" placeholder="you@example.com" required
                        value={formData.email} onChange={handleChange} autoComplete="email"
                        className="orw-input" />
                </div>

                <div className="orw-field">
                    <div className="orw-field__top">
                        <label className="orw-label" htmlFor={`${uid}-password`}>Password</label>
                        <button type="button" className="orw-link" onClick={() => navigate('/forgot-password')}>
                            Forgot password?
                        </button>
                    </div>
                    <div className="orw-input-wrap">
                        <input id={`${uid}-password`} name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" required
                            value={formData.password} onChange={handleChange} autoComplete="current-password"
                            className="orw-input" />
                        <button type="button" className="orw-input-wrap__btn" onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={!isFormValid || loading} aria-busy={loading}>
                    {loading ? 'Signing in…' : <>Sign in <ArrowRight size={15} /></>}
                </button>
            </form>

            {(showGoogle || showPasskey) && <div className="orw-auth__divider">Or</div>}
            {showGoogle && <ContinueWithGoogle onClick={googleLogin} />}
            {showPasskey && (
                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={signInWithPasskey}
                    disabled={passkeyBusy} aria-busy={passkeyBusy} data-testid="sign-in-with-passkey"
                    style={showGoogle ? { marginTop: 10 } : undefined}>
                    <KeyRound size={15} /> {passkeyBusy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
                </button>
            )}
        </div>
    );
};

export default LoginForm;
