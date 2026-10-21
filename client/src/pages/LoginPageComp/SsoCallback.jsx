import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell from '../../components/public/AuthShell';
import api from '@services/api';
import SignInChallenge from '../../components/loginpage/SignInChallenge';

/** The access token the SSO callback puts in the URL fragment (#access=…), or null. */
export function readSsoToken(hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const token = params.get('access');
    return token && token.split('.').length === 3 ? token : null;
}

/** The pending sign-in token (#pending=…) when SSO stopped at the device limit, or null. */
export function readPendingToken(hash) {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const token = params.get('pending');
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

/** Turns /api/auth/signin/status into the answer SignInChallenge shows. */
export function challengeFromStatus(pendingToken, status) {
    const devices = Array.isArray(status?.devices) ? status.devices : [];
    return {
        code: status?.stage === 'mfa' ? 'MFA_REQUIRED' : 'DEVICE_LIMIT',
        pendingToken,
        methods: status?.methods,
        emailHint: status?.emailHint,
        devices,
        limit: devices.length,
    };
}

/**
 * /oauth-success: where /api/auth/sso/:provider/callback lands. Keeps the token, loads the
 * account and continues like any sign-in (pending invite first, otherwise /login routes
 * the signed-in user to their home).
 */
export default function SsoCallback() {
    const { loadUser, adoptSession } = useAuth();
    const navigate = useNavigate();
    const [failed, setFailed] = useState(false);
    const [challenge, setChallenge] = useState(null);
    const ran = useRef(false);

    const goOn = () => {
        const pendingInvite = localStorage.getItem('pendingInvite');
        if (pendingInvite) navigate(`/join-workspace?token=${pendingInvite}`, { replace: true });
        else navigate('/login', { replace: true });
    };

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        const token = readSsoToken(window.location.hash);
        const pending = readPendingToken(window.location.hash);
        // Don't leave the token in the address bar or history.
        window.history.replaceState(null, '', window.location.pathname);
        if (pending) {
            // Over the device limit: sign out of one device here to finish.
            api.post('/api/auth/signin/status', { pendingToken: pending })
                .then(({ data }) => setChallenge(challengeFromStatus(pending, data)))
                .catch(() => setFailed(true));
            return;
        }
        if (!token) { setFailed(true); return; }
        localStorage.setItem('accessToken', token);
        try { sessionStorage.removeItem('ssoEmailHint'); } catch { /* private mode */ }
        Promise.resolve(loadUser?.()).finally(() => {
            const pendingInvite = localStorage.getItem('pendingInvite');
            if (pendingInvite) navigate(`/join-workspace?token=${pendingInvite}`, { replace: true });
            else navigate('/login', { replace: true });
        });
    }, [loadUser, navigate]);

    if (challenge) {
        return (
            <AuthShell title="Signing in">
                <SignInChallenge
                    challenge={challenge}
                    onSession={(data) => { setChallenge(null); adoptSession?.(data); goOn(); }}
                    onCancel={() => navigate('/login', { replace: true })}
                />
            </AuthShell>
        );
    }

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
