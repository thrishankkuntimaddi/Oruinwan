// client/src/pages/VerifyEmail.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight, RefreshCw } from 'lucide-react';

/* ─── Inline design tokens (no Tailwind dependency) ──────────────────────── */
const T = {
  bgOuter:     'var(--bg-base, #0c0c0c)',
  bgCard:      'var(--bg-surface, #111111)',
  bgSection:   'var(--bg-active, #1c1c1c)',
  accent:      'var(--accent, #b8956a)',
  accentDim:   'var(--accent-dim, rgba(184,149,106,0.12))',
  accentHover: 'var(--accent-hover, #c9a87c)',
  textPrimary: 'var(--text-primary, #e4e4e4)',
  textSub:     'var(--text-secondary, #7a7a7a)',
  textMuted:   'var(--text-muted, #404040)',
  border:      'var(--border-default, #222222)',
  borderHover: 'var(--border-accent, #383838)',
  success:     'var(--state-success, #5aba8a)',
  successDim:  'rgba(90,186,138,0.10)',
  danger:      'var(--state-danger, #e05252)',
  dangerDim:   'rgba(224,82,82,0.10)',
};

/* ─── Keyframe injection ─────────────────────────────────────────────────── */
const STYLE = `
  @keyframes ve-progress {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes ve-fadein {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ve-spin {
    to { transform: rotate(360deg); }
  }
  .ve-fadeIn  { animation: ve-fadein 0.35s ease forwards; }
  .ve-spin    { animation: ve-spin 1s linear infinite; }
  .ve-progress-bar {
    transform-origin: left;
    animation: ve-progress 3s ease-in-out forwards;
  }
`;

export default function VerifyEmail() {
  const [searchParams]  = useSearchParams();
  const token           = searchParams.get('token') || '';
  const email           = searchParams.get('email') || '';
  const [status, setStatus]   = useState('idle');
  const [message, setMessage] = useState('');
  const navigate        = useNavigate();
  const hasRun          = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token || !email) {
      setStatus('error');
      setMessage('Missing token or email in the URL.');
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
          setMessage(data.message || 'Verification failed');
          return;
        }
        setStatus('success');
        setMessage(data.message || 'Your email has been verified.');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Network error. Please try again.');
      }
    }
    verify();
  }, [token, email, navigate]);

  /* ── Icon + colours per state ──────────────────────────────────────── */
  const stateMap = {
    idle:    { Icon: Mail,        iconBg: T.accentDim,  iconColor: T.accent,   label: 'Preparing...' },
    sending: { Icon: Loader2,     iconBg: T.accentDim,  iconColor: T.accent,   label: 'Verifying…' },
    success: { Icon: CheckCircle, iconBg: T.successDim, iconColor: T.success,  label: 'Verified!' },
    error:   { Icon: XCircle,     iconBg: T.dangerDim,  iconColor: T.danger,   label: 'Verification Failed' },
  };
  const { Icon, iconBg, iconColor, label } = stateMap[status] || stateMap.idle;

  return (
    <>
      <style>{STYLE}</style>

      {/* Full-page dark shell */}
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.bgOuter,
        backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(184,149,106,0.06) 0%, transparent 70%)`,
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>

        {/* Wordmark */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.03em' }}>
            Chttrix
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: T.accent, letterSpacing: '0.18em', textTransform: 'uppercase', marginLeft: 10 }}>
            AI Collaboration
          </span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: T.bgCard,
          border: `1px solid ${T.border}`,
          overflow: 'hidden',
        }}>

          {/* Amber top stripe */}
          <div style={{ height: 2, backgroundColor: T.accent }} />

          {/* Card body */}
          <div style={{ padding: '40px 36px 36px', textAlign: 'center' }}>

            {/* Icon */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              backgroundColor: iconBg,
              marginBottom: 24,
              border: `1px solid ${T.border}`,
            }}>
              <Icon
                size={34}
                strokeWidth={2}
                style={{
                  color: iconColor,
                  ...(status === 'sending' ? { animation: 've-spin 1s linear infinite' } : {}),
                }}
              />
            </div>

            {/* Headline */}
            <h1 style={{
              margin: '0 0 8px',
              fontSize: 24,
              fontWeight: 700,
              color: T.textPrimary,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              {label}
            </h1>

            {/* Sub-message */}
            <p style={{
              margin: '0 0 32px',
              fontSize: 14,
              color: T.textSub,
              lineHeight: 1.6,
            }}>
              {status === 'idle'    && 'Preparing to verify your email address…'}
              {status === 'sending' && 'Please wait while we verify your account…'}
              {status === 'success' && message}
              {status === 'error'   && message}
            </p>

            {/* ── Success state ── */}
            {status === 'success' && (
              <div className="ve-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: 2,
                  backgroundColor: T.border,
                  overflow: 'hidden',
                }}>
                  <div className="ve-progress-bar" style={{
                    height: '100%',
                    backgroundColor: T.accent,
                  }} />
                </div>

                <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                  Redirecting to login automatically…
                </p>

                {/* CTA button */}
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    backgroundColor: T.accent,
                    color: '#000',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                    transition: 'background-color 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = T.accentHover)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = T.accent)}
                >
                  Go to Login Now <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* ── Error state ── */}
            {status === 'error' && (
              <div className="ve-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    width: '100%',
                    padding: '13px 24px',
                    backgroundColor: T.danger,
                    color: '#fff',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                    transition: 'opacity 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <RefreshCw size={15} /> Try Again
                </button>

                <button
                  onClick={() => navigate('/login')}
                  style={{
                    width: '100%',
                    padding: '13px 24px',
                    backgroundColor: 'transparent',
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = T.borderHover;
                    e.currentTarget.style.color = T.textPrimary;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.color = T.textSub;
                  }}
                >
                  Back to Login
                </button>
              </div>
            )}

            {/* Sending spinner text */}
            {status === 'sending' && (
              <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                This usually takes just a moment…
              </p>
            )}
          </div>

          {/* Card footer */}
          <div style={{
            padding: '14px 36px',
            borderTop: `1px solid ${T.border}`,
            backgroundColor: 'var(--bg-hover, #161616)',
          }}>
            <p style={{ margin: 0, fontSize: 11, color: T.textMuted, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Secure Verification System
            </p>
          </div>
        </div>

        {/* Bottom wordmark / copyright */}
        <p style={{ marginTop: 28, fontSize: 11, color: T.textMuted }}>
          © {new Date().getFullYear()} Chttrix Inc.
        </p>
      </div>
    </>
  );
}
