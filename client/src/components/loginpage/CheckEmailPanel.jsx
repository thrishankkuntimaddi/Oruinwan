import { useEffect, useState } from 'react';
import { ArrowLeft, MailCheck, RotateCw } from 'lucide-react';
import api from '@services/api';

const RESEND_WAIT_S = 30;

/**
 * "Check your email": shown after sign-up, and when someone tries to sign in before verifying.
 * `reason` is 'signup' or 'unverified'.
 */
const CheckEmailPanel = ({ email, reason = 'signup', onBack }) => {
    const [wait, setWait] = useState(reason === 'signup' ? RESEND_WAIT_S : 0);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (wait <= 0) return undefined;
        const t = setTimeout(() => setWait((w) => w - 1), 1000);
        return () => clearTimeout(t);
    }, [wait]);

    const resend = async () => {
        setStatus('sending');
        try {
            await api.post('/api/auth/resend-verification', { email });
            setStatus('sent');
        } catch {
            setStatus('failed');
        }
        setWait(RESEND_WAIT_S);
    };

    return (
        <div data-testid="check-email">
            <div className="orw-auth__panel-head">
                <h2>{reason === 'signup' ? 'Check your email' : 'Verify your email first'}</h2>
                <p>
                    {reason === 'signup'
                        ? 'We sent a verification link to'
                        : 'Your account isn’t verified yet. Open the link we sent to'}{' '}
                    <strong style={{ color: 'var(--o-text)' }}>{email}</strong>, then come back and sign in.
                </p>
            </div>

            <div className="orw-auth__alert orw-auth__alert--good" role="status" style={{ marginBottom: 20 }}>
                <MailCheck size={16} aria-hidden="true" />
                <div>
                    {status === 'sent' ? 'A new link is on its way. It works for 24 hours.'
                        : status === 'failed' ? 'We couldn’t send a new link right now. Try again in a moment.'
                            : 'The link works for 24 hours. Check your spam folder if you can’t see it.'}
                </div>
            </div>

            <div className="orw-form">
                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={resend}
                    disabled={wait > 0 || status === 'sending'} data-testid="resend-verification">
                    <RotateCw size={15} /> {status === 'sending' ? 'Sending…' : wait > 0 ? `Resend link in ${wait}s` : 'Resend verification email'}
                </button>
                <button type="button" className="orw-link" onClick={onBack} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft size={13} /> Back to sign in
                </button>
            </div>
        </div>
    );
};

export default CheckEmailPanel;
