import { useCallback, useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { Dialog, Btn } from '../ui/page';
import '../shared/entryModals.css';

/** Requests this browser made itself (an unlock request): never shown to itself. */
export const ownApprovalIds = new Set();

const PLATFORM = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Desktop app', web: 'Browser' };

/** "Chrome on Windows near Hyderabad" */
export function describeRequester(r = {}) {
    return `${r.deviceName || 'A new device'}${r.location ? ` near ${r.location}` : ''}`;
}

/**
 * Requests from the person's other devices, answered here (on a device already signed in):
 *  - kind 'signin'  a new device passed the password / Google step of a 2FA account:
 *                   "Sign-in request from Windows laptop — Approve / Deny".
 *  - kind 'unlock'  a signed-in device asks to unlock messages. If this account's key is still
 *                   password-protected, the password is asked once here: the key is then sealed on
 *                   the server and every device unlocks automatically from then on.
 * New requests arrive over the socket (auth:approval-request) and are also fetched on start
 * and whenever the window gets focus.
 */
export default function ApprovalPrompt() {
    const { user } = useAuth() || {};
    const socketCtx = useOptionalSocket();
    const socket = socketCtx?.socket || null;
    const [queue, setQueue] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [needsPassword, setNeedsPassword] = useState(false);
    const signedIn = Boolean(user);

    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get('/api/auth/approvals');
            setQueue(Array.isArray(data?.approvals) ? data.approvals : []);
        } catch { /* signed out or offline: nothing to show */ }
    }, []);

    useEffect(() => {
        if (!signedIn) { setQueue([]); return undefined; }
        refresh();
        const onFocus = () => refresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [signedIn, refresh]);

    useEffect(() => {
        if (!socket) return undefined;
        const onRequest = (a) => {
            if (!a?.id) return;
            setQueue((q) => (q.some((x) => x.id === a.id) ? q : [...q, a]));
        };
        const onResolved = (a) => setQueue((q) => q.filter((x) => x.id !== a?.id));
        socket.on('auth:approval-request', onRequest);
        socket.on('auth:approval-resolved', onResolved);
        return () => {
            socket.off('auth:approval-request', onRequest);
            socket.off('auth:approval-resolved', onResolved);
        };
    }, [socket]);

    const current = queue.find((a) => !ownApprovalIds.has(a.id)) || null;

    // For an unlock request: does this account still need the password once?
    useEffect(() => {
        setError('');
        setPassword('');
        setNeedsPassword(false);
        if (current?.kind !== 'unlock') return undefined;
        let live = true;
        (async () => {
            try {
                const svc = (await import('../../services/identityKeyService')).default;
                const type = await svc.getProtectionType();
                if (live) setNeedsPassword(type === 'PASSWORD');
            } catch { /* keep the simple approve */ }
        })();
        return () => { live = false; };
    }, [current?.id, current?.kind]);

    const done = (id) => setQueue((q) => q.filter((x) => x.id !== id));

    const answer = async (approve) => {
        if (!current) return;
        setBusy(true);
        setError('');
        try {
            if (current.kind === 'unlock') {
                if (approve && needsPassword) {
                    const svc = (await import('../../services/identityKeyService')).default;
                    await svc.sealWithPassword(password);
                }
                await api.post(`/api/v2/crypto/unlock-requests/${encodeURIComponent(current.id)}/decision`, { approve });
            } else {
                await api.post(`/api/auth/approvals/${encodeURIComponent(current.id)}/decision`, { approve });
            }
            done(current.id);
        } catch (err) {
            const status = err?.response?.status;
            if (err?.response?.data?.code === 'UMEK_NOT_SEALED') { setNeedsPassword(true); setError('Enter your password once to unlock.'); return; }
            if (status === 404 || status === 409 || status === 403) { done(current.id); return; }
            setError(err?.response?.data?.message || (err?.message === 'Incorrect password' ? 'That password didn’t work.' : err?.message) || 'Something went wrong. Try again.');
        } finally {
            setBusy(false);
        }
    };

    if (!signedIn || !current) return null;
    const r = current.requester || {};
    const isUnlock = current.kind === 'unlock';
    const when = current.createdAt ? new Date(current.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;
    const details = [PLATFORM[r.platform], r.ip ? `IP ${r.ip}` : null, when].filter(Boolean).join(' · ');

    return (
        <Dialog
            open
            size="sm"
            busy={busy}
            title={isUnlock ? 'Unlock messages on another device?' : 'Sign-in request'}
            lead={isUnlock
                ? `${describeRequester(r)} asks to unlock your messages.`
                : `${describeRequester(r)} is trying to sign in to your account.`}
            onClose={() => done(current.id)}
            footer={(
                <>
                    <Btn variant="ghost" onClick={() => answer(false)} disabled={busy} data-testid="approval-deny">Deny</Btn>
                    <Btn variant="primary" icon={isUnlock ? Lock : ShieldCheck} loading={busy} onClick={() => answer(true)}
                        disabled={isUnlock && needsPassword && !password} data-testid="approval-approve">
                        {isUnlock ? 'Unlock' : 'Approve'}
                    </Btn>
                </>
            )}
        >
            {details && <div className="em-alert" style={{ marginBottom: 12 }}><ShieldCheck size={14} /><span>{details}</span></div>}
            {isUnlock && needsPassword && (
                <div className="cd-field">
                    <label htmlFor="approval-password">Your password, once</label>
                    <input id="approval-password" className="gl-input" type="password" autoComplete="current-password"
                        value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                    <div className="cd-hint">After this, all your devices unlock messages automatically.</div>
                </div>
            )}
            {!isUnlock && (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    Approve only if this is you. If it isn&apos;t, deny it and change your password.
                </p>
            )}
            {error && <div className="em-alert" data-tone="danger" role="alert" style={{ marginTop: 12 }}><span>{error}</span></div>}
        </Dialog>
    );
}
