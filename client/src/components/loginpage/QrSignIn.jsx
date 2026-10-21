import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import api from '@services/api';
import { signInChallengeFrom } from './SignInChallenge';
import './signInChallenge.css';

const POLL_MS = 2000;

function toB64(buf) {
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}

/**
 * A one-time ECDH P-256 key for this sign-in. The private half can't leave the browser
 * (non-extractable); the server wraps the message key for the public half.
 */
export async function makeEphemeralKey() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
    return { privateKey: pair.privateKey, publicKey: toB64(raw) };
}

/**
 * "Sign in with QR" on the web / desktop login screen: shows a QR code that a phone where the
 * person is signed in scans (Settings → Scan to sign in) and approves. A new code every minute
 * while nobody has scanned it. Polls for the answer; the session arrives with the message key
 * wrapped for this browser's one-time key.
 *
 *   onSession(data, { ephemeralPrivateKey })   signed in
 *   onChallenge(data, { ephemeralPrivateKey }) the device limit stopped it (DEVICE_LIMIT)
 *   onBack()                                   back to the other sign-in options
 */
export default function QrSignIn({ onSession, onChallenge, onBack, pollMs = POLL_MS, makeKey = makeEphemeralKey }) {
    const [qr, setQr] = useState(null); // { code, secret, qrDataUrl, expiresAt }
    const [status, setStatus] = useState('loading'); // loading | waiting | scanned | denied | expired | error
    const [message, setMessage] = useState('');
    const keyRef = useRef(null);
    const doneRef = useRef(false);

    const fresh = useCallback(async () => {
        try {
            if (!keyRef.current) keyRef.current = await makeKey();
            const { data } = await api.post('/api/auth/qr/request', { publicKey: keyRef.current.publicKey });
            setQr(data);
            setStatus('waiting');
            setMessage('');
        } catch (err) {
            setStatus('error');
            setMessage(err?.response?.data?.message || "Couldn't make a QR code. Try again.");
        }
    }, [makeKey]);

    useEffect(() => { fresh(); }, [fresh]);

    useEffect(() => {
        if (!qr || (status !== 'waiting' && status !== 'scanned')) return undefined;
        let stop = false;
        const tick = async () => {
            if (stop || doneRef.current) return;
            // Nobody scanned it in time: show a new one (codes live about a minute).
            if (status === 'waiting' && qr.expiresAt && Date.now() >= new Date(qr.expiresAt).getTime()) { stop = true; fresh(); return; }
            try {
                const { data } = await api.post('/api/auth/qr/poll', { code: qr.code, secret: qr.secret });
                if (stop) return;
                if (data?.accessToken) {
                    doneRef.current = true;
                    stop = true;
                    onSession?.(data, { ephemeralPrivateKey: keyRef.current?.privateKey || null });
                    return;
                }
                if (data?.status === 'scanned' && status !== 'scanned') setStatus('scanned');
            } catch (err) {
                if (stop) return;
                const res = err?.response;
                const challenge = signInChallengeFrom(res?.data);
                if (challenge) { doneRef.current = true; stop = true; onChallenge?.(challenge, { ephemeralPrivateKey: keyRef.current?.privateKey || null }); return; }
                if (res?.status === 410) {
                    stop = true;
                    if (status === 'waiting') fresh();
                    else { setStatus('expired'); setMessage('The request expired before it was approved.'); }
                    return;
                }
                if (res?.status === 403) { stop = true; setStatus('denied'); setMessage(res.data?.message || 'Sign-in was declined on your phone.'); }
            }
        };
        const timer = setInterval(tick, pollMs);
        return () => { stop = true; clearInterval(timer); };
    }, [qr, status, pollMs, fresh, onSession, onChallenge]);

    const ended = status === 'denied' || status === 'expired' || status === 'error';

    return (
        <div className="orw-sic" data-testid="qr-sign-in">
            <div className="orw-auth__panel-head">
                <h2>Sign in with QR</h2>
                <p>Use your phone where you&apos;re already signed in. No password needed.</p>
            </div>
            <div className="orw-qr">
                <div className={`orw-qr__frame${status === 'scanned' || ended ? ' orw-qr__frame--dim' : ''}`} aria-live="polite">
                    {qr?.qrDataUrl
                        ? <img src={qr.qrDataUrl} alt="QR code to sign in on this device" data-testid="qr-image" />
                        : <span className="orw-hint">{status === 'loading' ? 'Making a code…' : ''}</span>}
                </div>
                {status === 'scanned' && (
                    <div className="orw-sic__wait" role="status"><span className="orw-sic__dot" aria-hidden="true" /> Scanned — approve on your phone</div>
                )}
                {status === 'waiting' && (
                    <ol className="orw-qr__steps">
                        <li>Open Oruinwan on your phone</li>
                        <li>Go to Settings → Scan to sign in</li>
                        <li>Point the camera at this code and tap Approve</li>
                    </ol>
                )}
                {ended && (
                    <>
                        <div className="orw-auth__alert" role="alert">{message}</div>
                        <button type="button" className="orw-btn orw-btn--ghost" onClick={() => { setStatus('loading'); fresh(); }}>
                            <RefreshCw size={14} /> Show a new code
                        </button>
                    </>
                )}
            </div>
            <button type="button" className="orw-link" onClick={() => onBack?.()} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={13} /> Other ways to sign in
            </button>
        </div>
    );
}
