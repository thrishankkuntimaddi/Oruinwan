import { useEffect, useRef, useState } from 'react';
import { Lock, X, Smartphone, KeyRound } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { Btn, IconBtn } from '../ui/page';
import PasswordUnlockModal from './PasswordUnlockModal';
import { ownApprovalIds } from './ApprovalPrompt';
import './messagesLockedBanner.css';

const POLL_MS = 3000;

/**
 * Shown (not blocking) when this device can't open the message key yet. That only happens for
 * accounts whose key is still password-protected, on a device that signed in without the
 * password (Google, passkey, QR). Two ways out, each needed only once:
 *  - "Enter password once": opens the key here and seals it on the server.
 *  - "Ask another device": a signed-in device approves (entering the password there once).
 * Afterwards every device unlocks automatically.
 */
export default function MessagesLockedBanner({ pollMs = POLL_MS }) {
    const { requiresPassword, unlockEncryption, resetEncryptionKeys, retryEncryption } = useAuth();
    const socketCtx = useOptionalSocket();
    const socket = socketCtx?.socket || null;
    const [dismissed, setDismissed] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [asking, setAsking] = useState(null); // { id } while waiting for another device
    const [note, setNote] = useState('');
    const retryRef = useRef(retryEncryption);
    retryRef.current = retryEncryption;

    // Another device sealed the key: try again here without asking anything.
    useEffect(() => {
        if (!socket || !requiresPassword) return undefined;
        const onSealed = () => retryRef.current?.();
        socket.on('crypto:umek-sealed', onSealed);
        return () => socket.off('crypto:umek-sealed', onSealed);
    }, [socket, requiresPassword]);

    useEffect(() => {
        if (!asking?.id) return undefined;
        let stop = false;
        const timer = setInterval(async () => {
            if (stop) return;
            try {
                const { data } = await api.get(`/api/v2/crypto/unlock-requests/${encodeURIComponent(asking.id)}`);
                if (data?.umekProtectionType === 'SERVER_KEK' || data?.status === 'approved') {
                    stop = true;
                    clearInterval(timer);
                    setAsking(null);
                    setNote('');
                    retryRef.current?.();
                } else if (data?.status === 'denied' || data?.status === 'expired') {
                    stop = true;
                    clearInterval(timer);
                    setAsking(null);
                    setNote(data.status === 'denied' ? 'Your other device declined.' : 'Nobody answered in time. Try again.');
                }
            } catch { /* keep waiting */ }
        }, pollMs);
        return () => { stop = true; clearInterval(timer); };
    }, [asking?.id, pollMs]);

    if (!requiresPassword) return null;

    const askAnother = async () => {
        setNote('');
        try {
            const { data } = await api.post('/api/v2/crypto/unlock-requests', {});
            if (data?.id) ownApprovalIds.add(data.id);
            setAsking({ id: data?.id });
        } catch (err) {
            setNote(err?.response?.data?.message || 'Could not reach your other devices.');
        }
    };

    return (
        <>
            {!dismissed && !showPassword && (
                <div className="mlb gl-liquid" role="status" data-testid="messages-locked-banner">
                    <span className="mlb__mark" aria-hidden="true"><Lock size={15} /></span>
                    <div className="mlb__text">
                        <strong>Messages are locked on this device</strong>
                        <span>{asking ? 'Waiting for your other device to approve…' : note || 'Unlock once and they open automatically from then on.'}</span>
                    </div>
                    <div className="mlb__actions">
                        <Btn size="sm" variant="primary" icon={KeyRound} onClick={() => setShowPassword(true)}>Enter password once</Btn>
                        <Btn size="sm" variant="ghost" icon={Smartphone} onClick={askAnother} disabled={Boolean(asking)} data-testid="ask-another-device">
                            {asking ? 'Asked' : 'Ask another device'}
                        </Btn>
                    </div>
                    <IconBtn label="Dismiss" onClick={() => setDismissed(true)}><X size={14} /></IconBtn>
                </div>
            )}
            {showPassword && (
                <PasswordUnlockModal
                    onSubmit={async (pw) => { await unlockEncryption(pw); setShowPassword(false); }}
                    onResetKeys={async (pw) => { await resetEncryptionKeys(pw); setShowPassword(false); }}
                    onClose={() => setShowPassword(false)}
                />
            )}
        </>
    );
}
