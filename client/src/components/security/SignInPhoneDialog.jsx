import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import api from '@services/api';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { Dialog, Btn } from '../ui/page';
import { describeRequester } from './ApprovalPrompt';
import '../shared/entryModals.css';

const POLL_MS = 2000;

/**
 * Settings → Devices → "Sign in a phone": shows a QR code the phone app scans from its start
 * screen ("Scan QR code"). When a phone claims it, this device asks "Allow <iPhone> to sign
 * in?"; allowing signs the phone in with its message key, no password needed. A new code every
 * minute while nobody has scanned it.
 */
export default function SignInPhoneDialog({ open, onClose, onSignedIn, pollMs = POLL_MS }) {
    const socketCtx = useOptionalSocket();
    const socket = socketCtx?.socket || null;
    const [offer, setOffer] = useState(null); // { code, qrDataUrl, expiresAt }
    const [state, setState] = useState({ status: 'loading' }); // loading | waiting | claimed | approved | denied | expired | error
    const [busy, setBusy] = useState(false);

    const fresh = useCallback(async () => {
        setState({ status: 'loading' });
        try {
            const { data } = await api.post('/api/auth/qr/offer', {});
            setOffer(data);
            setState({ status: 'waiting' });
        } catch (err) {
            setState({ status: 'error', message: err?.response?.data?.message || "Couldn't make a QR code." });
        }
    }, []);

    useEffect(() => {
        if (open) fresh();
        else { setOffer(null); setState({ status: 'loading' }); }
    }, [open, fresh]);

    const check = useCallback(async () => {
        if (!offer) return;
        if (state.status === 'waiting' && offer.expiresAt && Date.now() >= new Date(offer.expiresAt).getTime()) { fresh(); return; }
        try {
            const { data } = await api.post('/api/auth/qr/offer/status', { code: offer.code });
            if (data?.status === 'claimed') setState({ status: 'claimed', requester: data.requester });
            else if (data?.status === 'expired') {
                if (state.status === 'waiting') fresh();
                else setState({ status: 'expired' });
            }
        } catch { /* try again next tick */ }
    }, [offer, state.status, fresh]);

    useEffect(() => {
        if (!open || !offer || state.status !== 'waiting') return undefined;
        const timer = setInterval(check, pollMs);
        return () => clearInterval(timer);
    }, [open, offer, state.status, check, pollMs]);

    useEffect(() => {
        if (!socket || !offer) return undefined;
        const onClaimed = (e) => { if (e?.code === offer.code) setState({ status: 'claimed', requester: e.requester }); };
        socket.on('auth:qr-claimed', onClaimed);
        return () => socket.off('auth:qr-claimed', onClaimed);
    }, [socket, offer]);

    const decide = async (approve) => {
        setBusy(true);
        try {
            await api.post('/api/auth/qr/decide', { code: offer.code, approve });
            setState({ status: approve ? 'approved' : 'denied', requester: state.requester });
            if (approve) onSignedIn?.();
        } catch (err) {
            setState({ status: 'expired', message: err?.response?.data?.message });
        } finally {
            setBusy(false);
        }
    };

    const { status } = state;
    let footer = <Btn variant="ghost" onClick={onClose}>Close</Btn>;
    if (status === 'claimed') {
        footer = (
            <>
                <Btn variant="ghost" onClick={() => decide(false)} disabled={busy}>Deny</Btn>
                <Btn variant="primary" icon={ShieldCheck} loading={busy} onClick={() => decide(true)} data-testid="allow-phone">Allow</Btn>
            </>
        );
    } else if (status === 'expired' || status === 'denied' || status === 'error') {
        footer = (
            <>
                <Btn variant="ghost" onClick={onClose}>Close</Btn>
                <Btn variant="primary" icon={RefreshCw} onClick={fresh}>New code</Btn>
            </>
        );
    }

    return (
        <Dialog open={open} onClose={onClose} busy={busy} size="sm" title="Sign in a phone"
            lead="Sign in on your phone or tablet without typing a password." footer={footer}>
            {status === 'claimed' ? (
                <div className="em-alert" data-testid="phone-claimed">
                    <Smartphone size={14} />
                    <span><strong>Allow {describeRequester(state.requester)} to sign in?</strong> Only allow it if you are holding that device.</span>
                </div>
            ) : status === 'approved' ? (
                <div className="em-alert"><ShieldCheck size={14} /><span><strong>Done.</strong> {state.requester?.deviceName || 'Your phone'} is signing in now.</span></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    {/* The QR image carries its own light quiet zone, so it scans in dark mode too. */}
                    <div style={{ width: 220, height: 220, borderRadius: 'var(--gl-radius)', display: 'grid', placeItems: 'center', opacity: status === 'waiting' ? 1 : 0.2 }}>
                        {offer?.qrDataUrl && <img src={offer.qrDataUrl} alt="QR code for signing in a phone" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />}
                    </div>
                    {status === 'waiting' && (
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                            <li>Open Oruinwan on your phone</li>
                            <li>On the start screen tap <strong>Scan QR code</strong></li>
                            <li>Point the camera here, then allow it on this screen</li>
                        </ol>
                    )}
                    {status === 'denied' && <div className="em-alert">Denied. The phone was not signed in.</div>}
                    {(status === 'expired' || status === 'error') && <div className="em-alert" data-tone="danger" role="alert">{state.message || 'This code expired. Make a new one.'}</div>}
                </div>
            )}
        </Dialog>
    );
}
