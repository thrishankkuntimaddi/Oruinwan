import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/public/AuthShell';

/** The access token the SSO callback puts in the URL fragment (#access=…), or null. */
export function readSsoToken(hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const token = params.get('access');
    return token && token.split('.').length === 3 ? token : null;
}

/**
 * /oauth-success: where /api/auth/sso/:provider/callback lands. Keeps the token, loads the
 * account and continues like any sign-in (pending invite first, otherwise /login routes
 * the signed-in user to their home).
 */
export default function SsoCallback() {
    const { loadUser } = useAuth();
    const navigate = useNavigate();
    const [failed, setFailed] = useState(false);
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        const token = readSsoToken(window.location.hash);
        // Don't leave the token in the address bar or history.
        window.history.replaceState(null, '', window.location.pathname);
        if (!token) { setFailed(true); return; }
        localStorage.setItem('accessToken', token);
        try { sessionStorage.removeItem('ssoEmailHint'); } catch { /* private mode */ }
        Promise.resolve(loadUser?.()).finally(() => {
            const pendingInvite = localStorage.getItem('pendingInvite');
            if (pendingInvite) navigate(`/join-workspace?token=${pendingInvite}`, { replace: true });
            else navigate('/login', { replace: true });
        });
    }, [loadUser, navigate]);

    return (
        <AuthShell title="Signing in">
            {failed ? (
                <div className="orw-auth__alert" role="alert" data-testid="sso-callback-error">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <div>
                        Single sign-on did not return a session.{' '}
                        <Link className="orw-link" to="/login">Back to sign in</Link>
                    </div>
                </div>
            ) : (
                <p className="orw-hint" role="status" aria-busy="true">Finishing your company sign-in…</p>
            )}
        </AuthShell>
    );
}
