import { useState, useEffect, useContext, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '@services/api';
import { Eye, EyeOff, ArrowRight, KeyRound, QrCode } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { IS_APP } from '../../appMode/env';
import { appGoogleAvailable, appGoogleToken } from '../../appMode/appGoogle';
import { useGoogleSignIn, googleAvailable, ContinueWithGoogle, finishGoogleSession } from './googleContinue';
import CheckEmailPanel from './CheckEmailPanel';
import SsoSignIn from './SsoSignIn';
import SignInChallenge, { signInChallengeFrom } from './SignInChallenge';
import QrSignIn from './QrSignIn';

/** Where a password sign-in goes once it has a session. */
export function routeAfterPasswordLogin(response, navigate) {
    const pendingInvite = localStorage.getItem('pendingInvite');
    if (pendingInvite) { navigate(`/join-workspace?token=${pendingInvite}`); return; }
    if (response?.redirectTo) { navigate(response.redirectTo); return; }
    if (response?.user?.companyStatus === 'pending' || response?.user?.companyStatus === 'pending_verification') { navigate('/pending-verification'); return; }
    if (response?.user?.roles?.includes('oruinwan_admin')) { navigate('/platform-admin'); return; }
    const companyRole = response?.user?.companyRole;
    if (companyRole === 'owner') { navigate('/owner/dashboard'); return; }
    if (companyRole === 'admin') { navigate('/admin/dashboard'); return; }
    if (companyRole === 'manager') { navigate('/manager/dashboard'); return; }
    navigate('/workspaces');
}

const LoginForm = ({ initialEmail = '', onGoogleSignup }) => {
    const [formData, setFormData] = useState({ email: initialEmail, password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    // A sign-in step after the first factor (two-step verification or the device limit):
    // { data, kind: 'password' | 'oauth' | 'qr', password?, ephemeralPrivateKey? }.
    const [challenge, setChallenge] = useState(null);
    const [showQr, setShowQr] = useState(false);
    // Set when the password was right but the email was never verified.
    const [unverifiedEmail, setUnverifiedEmail] = useState(null);
    const { login, setUser, adoptSession } = useContext(AuthContext);
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
            const response = await login(formData.email, formData.password);
            showToast('Login successful!', 'success');
            await new Promise(r => setTimeout(r, 100));
            routeAfterPasswordLogin(response, navigate);
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
            const step = signInChallengeFrom(err.response?.data);
            if (step) {
                setChallenge({ data: step, kind: 'password', password: formData.password });
                return;
            }
            showToast(err.message || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    /** A sign-in step finished: take the session like the sign-in that started it would have. */
    const finishChallenge = (data) => {
        const step = challenge;
        setChallenge(null);
        if (step?.kind === 'password') {
            adoptSession(data, { password: step.password });
            showToast('Login successful!', 'success');
            routeAfterPasswordLogin(data, navigate);
            return;
        }
        if (step?.kind === 'qr') {
            adoptSession(data, { ephemeralPrivateKey: step.ephemeralPrivateKey });
            showToast('Signed in', 'success');
            routeAfterPasswordLogin(data, navigate);
            return;
        }
        showToast('Signed in', 'success');
        finishGoogleSession(data, { setUser, navigate, adoptSession });
    };

    const leaveChallenge = (message) => {
        setChallenge(null);
        if (message) showToast(message, 'info');
    };

    // googleToken: { accessToken } from the browser pop-up, or { credential } (an ID token) from the apps.
    const signInWithGoogle = async (googleToken) => {
        try {
            const res = await api.post('/api/auth/google-login', { ...googleToken });
            if (res.data?.needsSignup) { onGoogleSignup?.(res.data); return; }
            showToast('Signed in with Google', 'success');
            finishGoogleSession(res.data, { setUser, navigate, adoptSession });
        } catch (err) {
            const data = err.response?.data;
            const step = signInChallengeFrom(data);
            if (step) { setChallenge({ data: step, kind: 'oauth' }); return; }
            if (data?.requiresReactivation) {
                showToast('Account deactivated. Check your email for reactivation code.', 'info');
                navigate(`/reactivate?email=${encodeURIComponent(data.email || '')}`);
                return;
            }
            showToast(data?.message || 'Google login failed', 'error');
        }
    };

    const googleLogin = useGoogleSignIn({
        onSuccess: tokenResponse => signInWithGoogle({ accessToken: tokenResponse.access_token }),
        onError: () => showToast('Login Failed', 'error'),
    });

    // Desktop and Android apps: Google's own sign-in outside the web view (appMode/appGoogle.js).
    const [appGoogleBusy, setAppGoogleBusy] = useState(false);
    const signInWithAppGoogle = async () => {
        setAppGoogleBusy(true);
        try {
            await signInWithGoogle(await appGoogleToken(providers));
        } catch (err) {
            if (!err?.cancelled) showToast(err.response?.data?.message || err.message || 'Google sign-in failed', 'error');
        } finally {
            setAppGoogleBusy(false);
        }
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
            finishGoogleSession(res.data, { setUser, navigate, adoptSession });
        } catch (err) {
            const data = err.response?.data;
            const step = signInChallengeFrom(data);
            if (step) { setChallenge({ data: step, kind: 'oauth' }); return; }
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

    // In the desktop and Android apps Google's web pop-up can't run; they use appGoogle.js instead.
    const showGoogle = IS_APP ? appGoogleAvailable(providers) : googleAvailable(providers);
    // Passkeys are bound to the web origin, so the desktop and tablet apps leave them out too.
    const showPasskey = !IS_APP && typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);

    if (unverifiedEmail) {
        return <CheckEmailPanel email={unverifiedEmail} reason="unverified" onBack={() => setUnverifiedEmail(null)} />;
    }

    if (challenge) {
        return <SignInChallenge challenge={challenge.data} onSession={finishChallenge} onCancel={leaveChallenge} />;
    }

    if (showQr) {
        return (
            <QrSignIn
                onBack={() => setShowQr(false)}
                onSession={(data, { ephemeralPrivateKey }) => {
                    setShowQr(false);
                    adoptSession(data, { ephemeralPrivateKey });
                    showToast('Signed in with QR', 'success');
                    routeAfterPasswordLogin(data, navigate);
                }}
                onChallenge={(data, { ephemeralPrivateKey }) => { setShowQr(false); setChallenge({ data, kind: 'qr', ephemeralPrivateKey }); }}
            />
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

            <div className="orw-auth__divider">Or</div>
            {showGoogle && <ContinueWithGoogle onClick={IS_APP ? signInWithAppGoogle : googleLogin} disabled={appGoogleBusy} />}
            {showPasskey && (
                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={signInWithPasskey}
                    disabled={passkeyBusy} aria-busy={passkeyBusy} data-testid="sign-in-with-passkey"
                    style={showGoogle ? { marginTop: 10 } : undefined}>
                    <KeyRound size={15} /> {passkeyBusy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
                </button>
            )}
            <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={() => setShowQr(true)}
                data-testid="sign-in-with-qr" style={showGoogle || showPasskey ? { marginTop: 10 } : undefined}>
                <QrCode size={15} /> Sign in with QR
            </button>
            <SsoSignIn initialEmail={formData.email} />
        </div>
    );
};

export default LoginForm;
