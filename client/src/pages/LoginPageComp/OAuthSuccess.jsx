import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { saveAccessToken } from "../../utils/tokenUtils";
import api from "@services/api";
import AuthShell from "../../components/public/AuthShell";
import logger from '../../utils/logger';

// GitHub (and LinkedIn) send the browser back to `/oauth-success#code=<one-time code>`.
// The fragment never reaches servers, logs or Referer headers. The code is swapped for a
// session at POST /api/auth/oauth/exchange, which runs the same checks as password sign-in
// (two-factor, suspension, deactivation, lockout) and sets the refresh cookie.
function readCode() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('code');
}

function scrubUrl() {
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  } catch {
    // ignore (non-browser environment)
  }
}

export default function OAuthSuccess() {
  const { loadUser } = useAuth();
  const navigate = useNavigate();
  const uid = useId();
  const [code] = useState(readCode);
  const [needsCode, setNeedsCode] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const exchange = useCallback(async (otpValue) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/api/auth/oauth/exchange', { code, ...(otpValue ? { otp: otpValue } : {}) });
      saveAccessToken(data.accessToken);
      await loadUser();
      navigate(data.requiresPasswordSetup ? "/set-password" : "/workspaces", { replace: true });
    } catch (err) {
      const body = err.response?.data || {};
      if (body.requires2FA) {
        setNeedsCode(true);
        setOtp('');
        setError(body.invalidCode ? body.message : '');
      } else if (body.requiresReactivation) {
        navigate(`/reactivate?email=${encodeURIComponent(body.email || '')}`, { replace: true });
      } else {
        logger.warn('OAuth exchange failed:', body.message || err.message);
        setNeedsCode(false);
        setError(body.message || 'Sign-in failed. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [code, loadUser, navigate]);

  useEffect(() => {
    scrubUrl();
    if (started.current) return;
    started.current = true;
    if (!code) {
      navigate("/login", { replace: true });
      return;
    }
    exchange();
  }, [code, exchange, navigate]);

  const submitCode = (e) => {
    e.preventDefault();
    if (otp.length === 6) exchange(otp);
  };

  return (
    <AuthShell title="Signing in">
      {needsCode ? (
        <div>
          <div className="orw-auth__panel-head">
            <h2>Two-step verification</h2>
            <p>Enter the 6-digit code from your authenticator app to finish signing in.</p>
          </div>
          <form onSubmit={submitCode} className="orw-form">
            <div className="orw-field">
              <label className="orw-label" htmlFor={`${uid}-otp`}>Authentication code</label>
              <input id={`${uid}-otp`} name="otp" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus
                autoComplete="one-time-code" placeholder="000000"
                value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                className="orw-input" style={{ letterSpacing: '0.4em', fontSize: 18, textAlign: 'center' }}
                aria-invalid={error ? 'true' : undefined} aria-describedby={`${uid}-otp-help`} />
              <div id={`${uid}-otp-help`} className={error ? 'orw-error-text' : 'orw-hint'} role={error ? 'alert' : undefined}>
                {error || 'Open Google Authenticator, Authy or your usual app to see the current code.'}
              </div>
            </div>
            <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={otp.length !== 6 || busy} aria-busy={busy}>
              {busy ? 'Verifying…' : <><ShieldCheck size={15} /> Verify and sign in</>}
            </button>
          </form>
        </div>
      ) : error ? (
        <div>
          <div className="orw-auth__panel-head">
            <h2>Sign-in didn't finish</h2>
          </div>
          <div className="orw-auth__alert" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</div>
          <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={() => navigate('/login', { replace: true })}>
            <ArrowLeft size={15} /> Back to sign in
          </button>
        </div>
      ) : (
        <div role="status">
          <div className="orw-auth__panel-head">
            <h2>Signing you in…</h2>
            <p>One moment.</p>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
