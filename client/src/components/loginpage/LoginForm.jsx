import { useState, useContext, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useGoogleLogin } from '@react-oauth/google';
import api from '@services/api';
import { Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { IS_APP, IS_SITE } from '../../appMode/env';

// Apps and the product website render no GoogleOAuthProvider (main.jsx) and never load
// Google's script.
const useGoogleSignIn = IS_APP || IS_SITE ? () => () => {} : useGoogleLogin;

const GoogleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const GitHubIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-1.455-3.795-1.455-.54-1.38-1.335-1.755-1.335-1.755-1.095-.75.09-.735.09-.735 1.215.09 1.845 1.245 1.845 1.245 1.08 1.86 2.805 1.32 3.495 1.005.105-.78.42-1.32.765-1.62-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405 1.02 0 2.04.135 3 .405 2.28-1.56 3.285-1.245 3.285-1.245.675 1.65.255 2.88.135 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

const LinkedInIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a8fd6" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
);

const LoginForm = ({ initialEmail = '' }) => {
    const [formData, setFormData] = useState({ email: initialEmail, password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    // Two-step sign-in: set when the server answers { requires2FA } — { via: 'password' | 'google', googleToken? }.
    const [twoFactor, setTwoFactor] = useState(null);
    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const { login, setUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const uid = useId();

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

    const finishGoogle = (data) => {
        localStorage.setItem('accessToken', data.accessToken);
        setUser(data.user);
        showToast('Google login successful!', 'success');
        if (data.requiresPasswordSetup || data.isFirstLogin) {
            localStorage.setItem('oauthPasswordSetupRequired', 'true');
            localStorage.setItem('oauthProvider', 'google');
            navigate('/set-password'); return;
        }
        const isPlatformAdmin = data.user?.roles?.includes('chttrix_admin');
        if (isPlatformAdmin) navigate('/platform-admin');
        else if (data.user?.companyRole === 'owner') navigate('/owner/dashboard');
        else navigate('/workspaces');
    };

    const signInWithGoogle = async (googleToken, code) => {
        try {
            const res = await api.post('/api/auth/google-login', { accessToken: googleToken, ...(code ? { otp: code } : {}) });
            finishGoogle(res.data);
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

    const leaveTwoFactor = () => { setTwoFactor(null); setOtp(''); setOtpError(''); };

    const socials = [
        // Shown only when the build has a Google client id (VITE_GOOGLE_CLIENT_ID).
        ...(import.meta.env.VITE_GOOGLE_CLIENT_ID ? [{ icon: <GoogleIcon />, label: 'Google', onClick: googleLogin }] : []),
        // These sign-ins return to the server's own web page, so the desktop and tablet apps
        // (src/appMode) offer email and password only.
        ...(IS_APP ? [] : [
            { icon: <GitHubIcon />, label: 'GitHub', onClick: () => { window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/github`; } },
            { icon: <LinkedInIcon />, label: 'LinkedIn', onClick: () => { window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/linkedin`; } },
        ]),
    ];

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
                    <button type="button" className="orw-link" onClick={leaveTwoFactor} style={{ alignSelf: 'center' }}>
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
                    <input id={`${uid}-email`} name="email" type="email" placeholder="you@company.com" required
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

            {socials.length > 0 && (
                <>
                    <div className="orw-auth__divider">Or continue with</div>

                    <div className="orw-auth__social">
                        {socials.map(btn => (
                            <button key={btn.label} type="button" className="orw-btn orw-btn--ghost" onClick={btn.onClick}
                                aria-label={`Continue with ${btn.label}`} title={`Continue with ${btn.label}`}>
                                {btn.icon}
                            </button>
                        ))}
                    </div>
                </>
            )}

        </div>
    );
};

export default LoginForm;
