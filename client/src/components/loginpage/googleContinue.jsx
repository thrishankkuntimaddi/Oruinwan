import { useGoogleLogin } from '@react-oauth/google';
import { IS_APP, IS_SITE } from '../../appMode/env';

// Apps and the product website render no GoogleOAuthProvider (main.jsx) and never load
// Google's script.
export const useGoogleSignIn = IS_APP || IS_SITE ? () => () => {} : useGoogleLogin;

/** Google needs both the build's client id and the server saying it has one. */
export const googleAvailable = (providers) => Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID && providers?.google);

export const GoogleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const ContinueWithGoogle = ({ onClick, disabled }) => (
    <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={onClick} disabled={disabled}
        data-testid="continue-with-google">
        <GoogleIcon /> Continue with Google
    </button>
);

/** Where someone goes once a Google sign-in (or Google sign-up) has a session. */
export function finishGoogleSession(data, { setUser, navigate, adoptSession }) {
    // adoptSession (AuthContext) also opens the message keys; older callers only set the user.
    if (adoptSession) adoptSession(data);
    else {
        localStorage.setItem('accessToken', data.accessToken);
        setUser(data.user);
    }
    if (data.requiresPasswordSetup || data.isFirstLogin) {
        localStorage.setItem('oauthPasswordSetupRequired', 'true');
        localStorage.setItem('oauthProvider', 'google');
        navigate('/set-password');
        return;
    }
    const pendingInvite = localStorage.getItem('pendingInvite');
    if (pendingInvite) { navigate(`/join-workspace?token=${pendingInvite}`); return; }
    if (data.redirectTo) { navigate(data.redirectTo); return; }
    if (data.user?.roles?.includes('chttrix_admin')) navigate('/platform-admin');
    else if (data.user?.companyRole === 'owner') navigate('/owner/dashboard');
    else navigate('/workspaces');
}

/** Latest date of birth that is at least 13 years ago, as YYYY-MM-DD (for <input max>). */
export function latestDob(today = new Date()) {
    const d = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
