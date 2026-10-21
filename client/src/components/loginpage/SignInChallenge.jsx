import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, LogOut, Mail, Monitor, ShieldCheck, Smartphone, Laptop } from 'lucide-react';
import api from '@services/api';
import './signInChallenge.css';

/** Is this server answer a sign-in step (two-step verification or the device limit)? */
export function signInChallengeFrom(data) {
    if (!data || typeof data !== 'object' || !data.pendingToken) return null;
    if (data.code === 'MFA_REQUIRED' || data.code === 'DEVICE_LIMIT') return data;
    return null;
}

const PLATFORM_ICON = { ios: Smartphone, android: Smartphone, desktop: Laptop, web: Monitor };
const PLATFORM_LABEL = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Desktop app', web: 'Browser' };

export function lastActiveText(value, now = Date.now()) {
    if (!value) return null;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return null;
    const mins = Math.round((now - t) / 60000);
    if (mins < 2) return 'Active now';
    if (mins < 60) return `Active ${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `Active ${hours} h ago`;
    const days = Math.round(hours / 24);
    return `Active ${days} day${days === 1 ? '' : 's'} ago`;
}

const POLL_MS = 2000;

/**
 * The steps between "the password / Google / passkey was right" and a session:
 *  - MFA_REQUIRED: approve on a signed-in device, the authenticator code, or an email code.
 *  - DEVICE_LIMIT: sign out of one device (or all) to continue.
 * Everything goes through /api/auth/signin/* with the pending token (JSON bodies only).
 *
 *   challenge   the server's answer ({ code, pendingToken, methods, devices, limit, ... })
 *   onSession   called with the session answer (accessToken, user, maybe keys)
 *   onCancel    back to the sign-in form (message: why, when the sign-in ended)
 */
export default function SignInChallenge({ challenge: initial, onSession, onCancel, pollMs = POLL_MS }) {
    const [challenge, setChallenge] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [otp, setOtp] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [emailSent, setEmailSent] = useState(null);
    const [denied, setDenied] = useState(false);
    const finished = useRef(false);
    const uid = useId();
    const token = challenge?.pendingToken;

    useEffect(() => { setChallenge(initial); }, [initial]);

    const handleFailure = useCallback((err) => {
        const status = err?.response?.status;
        const data = err?.response?.data || {};
        if (status === 410) { onCancel?.(data.message || 'This sign-in has expired. Sign in again.'); return; }
        if (status === 403 && data.code === 'SIGNIN_DENIED') { setDenied(true); setError(data.message || 'This sign-in was denied on another device.'); return; }
        if (status === 409 && data.code === 'DEVICE_LIMIT') { setChallenge(data); setError(''); return; }
        if (status === 401 && data.code === 'MFA_REQUIRED') {
            setChallenge((c) => ({ ...c, ...data }));
            if (data.invalidCode) setError(data.message || "That code didn't work. Try again.");
            return;
        }
        if (status === 429) { if (data.code === 'SIGNIN_TOO_MANY') onCancel?.(data.message); else setError(data.message || 'Too many tries. Wait a moment.'); return; }
        setError(data.message || err?.message || 'Something went wrong. Try again.');
    }, [onCancel]);

    const proceed = useCallback(async (extra = {}) => {
        if (finished.current || !token) return;
        setBusy(true);
        setError('');
        try {
            const res = await api.post('/api/auth/signin/continue', { pendingToken: token, ...extra });
            finished.current = true;
            onSession?.(res.data);
        } catch (err) {
            handleFailure(err);
        } finally {
            setBusy(false);
        }
    }, [token, onSession, handleFailure]);

    // Waiting for "Approve" on another device: poll the status, finish once approved.
    const waitingForApproval = challenge?.code === 'MFA_REQUIRED' && challenge?.methods?.approve && !denied;
    useEffect(() => {
        if (!waitingForApproval || !token) return undefined;
        let stop = false;
        const timer = setInterval(async () => {
            if (stop || finished.current) return;
            try {
                const { data } = await api.post('/api/auth/signin/status', { pendingToken: token });
                const status = data?.approval?.status;
                if (status === 'approved') { stop = true; clearInterval(timer); proceed(); }
                else if (status === 'denied') { stop = true; clearInterval(timer); setDenied(true); setError('This sign-in was denied on another device.'); }
            } catch (err) {
                if (err?.response?.status === 410) { stop = true; clearInterval(timer); onCancel?.('This sign-in has expired. Sign in again.'); }
            }
        }, pollMs);
        return () => { stop = true; clearInterval(timer); };
    }, [waitingForApproval, token, pollMs, proceed, onCancel]);

    const sendEmail = async () => {
        setBusy(true);
        setError('');
        try {
            const { data } = await api.post('/api/auth/signin/email-code', { pendingToken: token });
            setEmailSent(data?.emailHint || challenge?.emailHint || 'your email');
        } catch (err) {
            handleFailure(err);
        } finally {
            setBusy(false);
        }
    };

    const back = (
        <button type="button" className="orw-link" onClick={() => onCancel?.()} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={13} /> Use a different account
        </button>
    );

    const alert = error ? <div className="orw-auth__alert" role="alert" data-testid="signin-challenge-error">{error}</div> : null;

    if (challenge?.code === 'DEVICE_LIMIT') {
        const devices = Array.isArray(challenge.devices) ? challenge.devices : [];
        return (
            <div className="orw-sic" data-testid="device-limit">
                <div className="orw-auth__panel-head">
                    <h2>Too many devices</h2>
                    <p>You&apos;re signed in on {challenge.limit || devices.length} devices. Sign out of one to continue.</p>
                </div>
                {alert}
                <ul className="orw-sic__devices" aria-label="Signed-in devices" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {devices.map((d) => {
                        const Icon = PLATFORM_ICON[d.platform] || Monitor;
                        const meta = [PLATFORM_LABEL[d.platform], lastActiveText(d.lastActiveAt), d.location].filter(Boolean).join(' · ');
                        return (
                            <li key={d.id} className="orw-sic__device">
                                <Icon size={18} aria-hidden="true" />
                                <div className="orw-sic__device-info">
                                    <div className="orw-sic__device-name">{d.name || 'Unknown device'}</div>
                                    {meta && <div className="orw-sic__device-meta">{meta}</div>}
                                </div>
                                <button type="button" className="orw-btn orw-btn--ghost" disabled={busy}
                                    onClick={() => proceed({ signOutDeviceIds: [d.id] })} aria-label={`Sign out of ${d.name || 'this device'}`}>
                                    <LogOut size={14} /> Sign out
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={busy} aria-busy={busy}
                    onClick={() => proceed({ signOutAll: true })} data-testid="sign-out-everywhere">
                    Sign out everywhere and sign in here
                </button>
                {back}
            </div>
        );
    }

    // MFA_REQUIRED
    const methods = challenge?.methods || { totp: true };
    return (
        <div className="orw-sic" data-testid="two-step">
            <div className="orw-auth__panel-head">
                <h2>Two-step verification</h2>
                <p>Confirm it&apos;s you. Use any one of these.</p>
            </div>
            {alert}
            {methods.approve && !denied && (
                <section className="orw-sic__option" aria-labelledby={`${uid}-approve`}>
                    <div className="orw-sic__option-title" id={`${uid}-approve`}><ShieldCheck size={15} /> Approve on another device</div>
                    <p>We sent a sign-in request to your other signed-in devices. Tap Approve there.</p>
                    <div className="orw-sic__wait" role="status"><span className="orw-sic__dot" aria-hidden="true" /> Waiting for approval…</div>
                </section>
            )}
            {methods.totp && (
                <form className="orw-sic__option" onSubmit={(e) => { e.preventDefault(); if (otp.length === 6) proceed({ otp }); }}>
                    <label className="orw-sic__option-title" htmlFor={`${uid}-otp`}><KeyRound size={15} /> Authenticator app code</label>
                    <div className="orw-sic__row">
                        <input id={`${uid}-otp`} className="orw-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                            placeholder="000000" value={otp} data-testid="login-otp"
                            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} />
                        <button type="submit" className="orw-btn orw-btn--primary" disabled={otp.length !== 6 || busy}>Verify</button>
                    </div>
                </form>
            )}
            {methods.email && (
                <div className="orw-sic__option">
                    <div className="orw-sic__option-title"><Mail size={15} /> Email code</div>
                    {!emailSent ? (
                        <>
                            <p>Get a 6-digit code at {challenge?.emailHint || 'your email address'}. It works for 10 minutes.</p>
                            <button type="button" className="orw-btn orw-btn--ghost" onClick={sendEmail} disabled={busy} data-testid="send-email-code">Email me a code</button>
                        </>
                    ) : (
                        <form onSubmit={(e) => { e.preventDefault(); if (emailCode.length === 6) proceed({ emailCode }); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label htmlFor={`${uid}-email`} style={{ fontSize: 12.5, color: 'var(--o-text-3)' }}>Code sent to {emailSent}</label>
                            <div className="orw-sic__row">
                                <input id={`${uid}-email`} className="orw-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                                    placeholder="000000" value={emailCode} data-testid="email-code"
                                    onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} />
                                <button type="submit" className="orw-btn orw-btn--primary" disabled={emailCode.length !== 6 || busy}>Verify</button>
                            </div>
                            <button type="button" className="orw-link" onClick={sendEmail} disabled={busy} style={{ alignSelf: 'flex-start' }}>Send another code</button>
                        </form>
                    )}
                </div>
            )}
            {back}
        </div>
    );
}
