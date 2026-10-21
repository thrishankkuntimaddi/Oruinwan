import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LoginForm from '../../components/loginpage/LoginForm';
import SignupForm from '../../components/loginpage/SignupForm';
import GoogleSignupStep from '../../components/loginpage/GoogleSignupStep';
import { finishGoogleSession } from '../../components/loginpage/googleContinue';
import { ssoErrorMessage } from '../../components/loginpage/SsoSignIn';
import AuthShell from '../../components/public/AuthShell';
import BrandMark from '../../shared/components/ui/BrandMark';

const LoginPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const mode = searchParams.get('mode');
    const [isSignup, setIsSignup] = useState(mode === 'signup');
    const { user, loading, setUser } = useAuth();
    // "Continue with Google" for an email with no account: the server's sign-up ticket.
    const [googleTicket, setGoogleTicket] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const registrationMessage = location.state?.message;
    const prefilledEmail = location.state?.email;
    // Back from /api/auth/sso/:provider with ?error=sso_… when the round trip failed.
    const ssoError = ssoErrorMessage(searchParams.get('error'));

    useEffect(() => {
        setIsSignup(mode === 'signup');
    }, [mode]);

    // Keep ?mode in the URL in sync so the tab survives a refresh or a shared link.
    const switchTo = (signup) => {
        setIsSignup(signup);
        const next = new URLSearchParams(searchParams);
        if (signup) next.set('mode', 'signup'); else next.delete('mode');
        setSearchParams(next, { replace: true, state: location.state });
    };

    // Only someone who arrives here already signed in is redirected from this page.
    // A sign-in made on this page is routed by LoginForm (invites, pending companies,
    // admin roles); redirecting here as well raced it and could bounce the user back
    // to /workspaces after they had already opened a workspace.
    const arrivalCheckedRef = useRef(false);
    useEffect(() => {
        if (loading || arrivalCheckedRef.current) return;
        arrivalCheckedRef.current = true;
        if (user) {
            const needsPasswordSetup = localStorage.getItem('oauthPasswordSetupRequired') === 'true';
            if (needsPasswordSetup) return;
            if (user.isTemporaryPassword === true && user.passwordInitialized === false) return;
            const isOruinwanAdmin = user.roles?.includes('oruinwan_admin');
            const isOwner = user.companyRole === 'owner';
            if (isOruinwanAdmin) navigate('/platform-admin', { replace: true });
            else if (isOwner) navigate('/owner/dashboard', { replace: true });
            else navigate('/workspaces', { replace: true });
        }
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08080a' }} aria-busy="true" aria-label="Loading">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                    <BrandMark size={36} title="" style={{ opacity: 0.6 }} />
                    <div style={{ height: '2px', width: '80px', background: 'rgba(200,162,116,0.2)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: '-40px', height: '2px', width: '40px', background: '#c8a274', animation: 'slideBar 1.2s ease-in-out infinite' }} />
                    </div>
                </div>
                <style>{'@keyframes slideBar { from{left:-40px} to{left:100%} }'}</style>
            </div>
        );
    }

    if (user) return null;

    return (
        <AuthShell title={googleTicket ? 'Create account' : isSignup ? 'Create account' : 'Sign in'}>
            {registrationMessage && (
                <div className="orw-auth__alert orw-auth__alert--good" role="status" style={{ marginBottom: 22 }}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <div>
                        <strong style={{ display: 'block', color: '#c9f5dd' }}>Account created</strong>
                        {registrationMessage}
                        {prefilledEmail && <div className="orw-code" style={{ display: 'inline-block', marginTop: 6 }}>{prefilledEmail}</div>}
                    </div>
                </div>
            )}

            {ssoError && (
                <div className="orw-auth__alert" role="alert" style={{ marginBottom: 22 }} data-testid="sso-error">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <div>{ssoError}</div>
                </div>
            )}

            {googleTicket ? (
                <GoogleSignupStep ticket={googleTicket} onCancel={() => setGoogleTicket(null)} />
            ) : (<>
            <div className="orw-auth__tabs" role="tablist" aria-label="Account">
                {[{ label: 'Sign in', val: false }, { label: 'Create account', val: true }].map(tab => (
                    <button key={tab.label} type="button" role="tab" className="orw-auth__tab"
                        aria-selected={isSignup === tab.val} onClick={() => switchTo(tab.val)}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" aria-label={isSignup ? 'Create account' : 'Sign in'}>
                {isSignup
                    ? <SignupForm onSwitch={() => switchTo(false)} onGoogleSignup={setGoogleTicket}
                        onGoogleSignedIn={(data) => finishGoogleSession(data, { setUser, navigate })} />
                    : <LoginForm onSwitch={() => switchTo(true)} initialEmail={prefilledEmail} onGoogleSignup={setGoogleTicket} />}
            </div>
            </>)}

            <p className="orw-auth__note">
                Setting up for an organisation? <Link className="orw-link" to="/register-company">Register your company</Link>
            </p>
        </AuthShell>
    );
};

export default LoginPage;
