import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, RefreshCw, MailCheck } from 'lucide-react';
import api from '@services/api';
import AuthShell from '../components/public/AuthShell';
import { AuthStatus, AuthProgress } from '../components/public/AuthParts';

const ASIDE = (
  <>
    <h1 className="orw-auth__title">One click and<br /><span className="orw-gloss-text">you’re verified.</span></h1>
    <p className="orw-auth__lead">Confirming your email keeps your account recoverable and lets teammates invite you by address.</p>
  </>
);

export default function VerifyEmail() {
  const [searchParams]  = useSearchParams();
  const token           = searchParams.get('token') || '';
  const email           = searchParams.get('email') || '';
  const [status, setStatus]   = useState('idle');
  const [message, setMessage] = useState('');
  const [resend, setResend]   = useState('');
  const navigate        = useNavigate();
  const hasRun          = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token || !email) {
      setStatus('error');
      setMessage('This verification link is incomplete. Open it again from the email we sent you.');
      return;
    }

    async function verify() {
      setStatus('sending');
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
          { credentials: 'include' }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(data.message || 'We couldn’t verify your email.');
          return;
        }
        setStatus('success');
        setMessage(data.message || 'Your email has been verified.');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'We couldn’t reach the server. Check your connection and try again.');
      }
    }
    verify();
  }, [token, email, navigate]);

  const sendNewLink = async () => {
    setResend('sending');
    try {
      await api.post('/api/auth/resend-verification', { email });
      setResend('sent');
    } catch {
      setResend('failed');
    }
  };

  return (
    <AuthShell title="Verify email" aside={ASIDE}>
      {(status === 'idle' || status === 'sending') && (
        <AuthStatus
          icon={Loader2}
          spin
          title="Verifying your email…"
          lead={email ? <>Confirming <strong>{email}</strong>. This usually takes a moment.</> : 'This usually takes a moment.'}
        />
      )}

      {status === 'success' && (
        <AuthStatus
          icon={CheckCircle2}
          tone="good"
          title="Email verified"
          lead={<>{message.replace(/[.!\s]+$/, '')}. Taking you to sign in…</>}
          actions={<>
            <AuthProgress ms={3000} label="Redirecting to sign in" />
            <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={() => navigate('/login')}>
              Sign in now <ArrowRight size={15} />
            </button>
          </>}
        />
      )}

      {status === 'error' && (
        <AuthStatus
          icon={XCircle}
          tone="bad"
          title="We couldn’t verify your email"
          lead={message}
          actions={<>
            {resend === 'sent' && (
              <div className="orw-auth__alert orw-auth__alert--good" role="status">
                <MailCheck size={16} aria-hidden="true" />
                <div>A new link is on its way to <strong>{email}</strong>. It works for 24 hours.</div>
              </div>
            )}
            {resend === 'failed' && (
              <p className="orw-error-text" role="alert">We couldn’t send a new link right now. Try again in a moment.</p>
            )}
            {email && resend !== 'sent' ? (
              <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={sendNewLink}
                disabled={resend === 'sending'} aria-busy={resend === 'sending'}>
                {resend === 'sending' ? 'Sending…' : <>Send me a new link <ArrowRight size={15} /></>}
              </button>
            ) : (
              <Link to="/login" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">Go to sign in <ArrowRight size={15} /></Link>
            )}
            <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={() => window.location.reload()}>
              <RefreshCw size={15} /> Try this link again
            </button>
            {email && resend !== 'sent' && <Link to="/login" className="orw-link">Back to sign in</Link>}
          </>}
        />
      )}
    </AuthShell>
  );
}
