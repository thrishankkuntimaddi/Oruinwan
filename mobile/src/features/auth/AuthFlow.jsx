import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, AtSign, CalendarDays, Eye, EyeOff, KeyRound, Lock, Mail, MailCheck, RotateCw, Sparkles, ShieldCheck, TriangleAlert, CircleCheck,
} from 'lucide-react';
import { cx } from '../../ui/cx.js';
import { useSession } from '../../data/session.js';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Header } from '../../ui/Screen.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { prefs } from '../../native/storage.js';
import { SERVER_URL } from '../../config/env.js';
import { normalizeServerUrl, probeServer } from '../../data/live/server.js';
import { deviceNoun, isWeb, openExternal } from '../../native/index.js';
import { useNav } from '../../app/nav.js';
import { googleAccessToken } from '../../data/live/google.js';
import { Intro } from './Intro.jsx';

/**
 * The server is fixed for this build (config/env.js SERVER_URL). This only checks it answers,
 * so a sign-in screen can say so when it can't be reached.
 */
function useServerAddress() {
  const [probe, setProbe] = useState(null);
  const check = async () => {
    setProbe({ state: 'checking' });
    setProbe(await probeServer(SERVER_URL));
  };
  useEffect(() => {
    check();
  }, []);
  return { server: SERVER_URL, base: SERVER_URL, probe, check, known: true };
}

/** Only shown when the server can't be reached. */
function ServerSection({ addr }) {
  if (!addr.probe || addr.probe.state !== 'error') return null;
  return (
    <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
      <Icon as={TriangleAlert} size="sm" className="mt-0.5 shrink-0" />
      <span>
        Can't reach Oruinwan right now. Check your internet connection.{' '}
        <button type="button" className="font-medium underline" onClick={() => addr.check()}>
          Try again
        </button>
      </span>
    </p>
  );
}

function ErrorNote({ text }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
      <Icon as={TriangleAlert} size="sm" className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

function SignIn({ onBack, onCreate, onGoogleSignup, onUnverified, initialEmail, initialGoogleToken }) {
  const signIn = useSession((s) => s.signIn);
  const addr = useServerAddress();
  const { server, base } = addr;
  const [email, setEmail] = useState(() => initialEmail || prefs.get('lastEmail') || '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(Boolean(initialGoogleToken));
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const otpRef = useRef(null);

  useEffect(() => {
    if (needsOtp) otpRef.current?.focus();
  }, [needsOtp]);

  const signInWithProvider = useSession((s) => s.signInWithProvider);
  const providers = useProviders(addr.known ? base : '');
  // A Google sign-in waiting for its two-factor code keeps Google's token here.
  const [googleToken, setGoogleToken] = useState(initialGoogleToken || null);

  const failed = (err) => {
    if (err.code === 'EMAIL_NOT_VERIFIED') {
      onUnverified?.(err.email || email.trim(), normalizeServerUrl(server));
      return;
    }
    if (err.code === '2FA_REQUIRED') {
      setNeedsOtp(true);
      setError(err.invalidCode ? 'That code did not work. Try the newest one.' : '');
    } else setError(err.message || 'Could not sign in.');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const url = normalizeServerUrl(server);
    if (!url) return setError("Can't reach Oruinwan right now. Check your internet connection.");
    if (googleToken) {
      setBusy(true);
      try {
        await signInWithProvider('google', { server: url, accessToken: googleToken, otp: otp.trim() });
      } catch (err) {
        failed(err);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await signIn({ server: url, email: email.trim(), password, otp: needsOtp ? otp.trim() : undefined });
      prefs.set('lastServer', url);
      prefs.set('lastEmail', email.trim());
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    setBusy(true);
    try {
      const token = await googleAccessToken(providers.googleClientId);
      prefs.set('lastServer', base);
      try {
        const result = await signInWithProvider('google', { server: base, accessToken: token });
        if (result?.needsSignup) onGoogleSignup?.(result.ticket);
      } catch (err) {
        if (err.code === '2FA_REQUIRED') setGoogleToken(token);
        throw err;
      }
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Sign in" onBack={onBack} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <ServerSection addr={addr} verb="Signing in to" />
        {googleToken && (
          <p className="mb-4 flex items-center gap-2 text-sm text-text-2">
            <GoogleMark /> Signing in with Google. One more step.
          </p>
        )}
        <div className="space-y-4">
          <div hidden={Boolean(googleToken)} className="space-y-4">
          <Field
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
            autoCapitalize="none"
            enterKeyHint="next"
          />
          <Field
            label="Password"
            icon={Lock}
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            enterKeyHint={needsOtp ? 'next' : 'go'}
            trailing={
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="text-text-3">
                <Icon as={show ? EyeOff : Eye} size="sm" />
              </button>
            }
          />
          </div>
          {needsOtp && (
            <Field
              ref={otpRef}
              label="Two-factor code"
              icon={KeyRound}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              hint="Open your authenticator app and enter the current code."
            />
          )}
        </div>
        <ErrorNote text={error} />
        <Button type="submit" block size="lg" className="mt-6" loading={busy}>
          {needsOtp ? 'Verify and sign in' : 'Sign in'}
        </Button>
        {!needsOtp && providers.google && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-text-3" aria-hidden>
              <span className="h-px flex-1 bg-line-soft" />
              or
              <span className="h-px flex-1 bg-line-soft" />
            </div>
            <Button type="button" block size="lg" variant="secondary" onClick={google} disabled={busy}>
              <GoogleMark /> Continue with Google
            </Button>
          </>
        )}
        <p className="mt-5 text-center text-sm text-text-2">
          New to Oruinwan?{' '}
          <button type="button" className="font-medium text-accent-ink underline" onClick={onCreate}>
            Create an account
          </button>
        </p>
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line-soft bg-surface px-3.5 py-3 text-[13px] text-text-2">
          <Icon as={ShieldCheck} size="sm" className="mt-0.5 shrink-0 text-accent-ink" />
          <span>
            Your password also unlocks your encryption keys on this {deviceNoun}. It is never stored.
            {base && (
              <>
                {' '}
                {isWeb ? 'Forgotten your password?' : 'Google sign-in or a forgotten password?'}{' '}
                <button type="button" className="font-medium text-accent-ink underline" onClick={() => openExternal(`${base}/login`)}>
                  Open the web app
                </button>
                .
              </>
            )}
          </span>
        </div>
      </form>
    </div>
  );
}

/**
 * The sign-ins this server offers (GET /api/auth/providers). Only in a browser for now: native
 * builds need Google's native SDK, which comes later.
 */
function useProviders(base) {
  const [providers, setProviders] = useState({});
  useEffect(() => {
    if (!isWeb || !base) return setProviders({});
    let live = true;
    fetch(`${base}/api/auth/providers`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((p) => live && setProviders({ google: Boolean(p.google && p.googleClientId), googleClientId: p.googleClientId }))
      .catch(() => live && setProviders({}));
    return () => {
      live = false;
    };
  }, [base]);
  return providers;
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/**
 * After a first Google sign-in the account has no password. A password keeps the
 * encryption keys out of the server's reach; skipping lets the server hold them (sealed), as
 * the web app does. Shown before the app opens, and again after a reload until chosen.
 */
export function ProtectAccount() {
  const protect = useSession((s) => s.protectWithPassword);
  const skip = useSession((s) => s.skipPassword);
  const signOut = useSession((s) => s.signOut);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const run = async (kind) => {
    setError('');
    if (kind === 'set' && !PASSWORD_RULES.every((r) => r.test(password))) return setError('Your password needs everything in the list below it.');
    setBusy(kind);
    try {
      if (kind === 'set') await protect(password);
      else await skip();
    } catch (err) {
      setError(err.message || 'That did not work. Try again.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg pt-safe">
      <form
        className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-10 pt-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run('set');
        }}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
          <Icon as={ShieldCheck} />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Protect your messages</h1>
        <p className="mt-2 text-sm text-text-2">
          Set a password and your encryption keys are locked with it, so not even the server can read your messages.
          You'll also be able to sign in with your email.
        </p>
        <div className="mt-6">
          <Field
            label="New password"
            icon={Lock}
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            trailing={
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="text-text-3">
                <Icon as={show ? EyeOff : Eye} size="sm" />
              </button>
            }
          />
          <PasswordRules password={password} />
        </div>
        <ErrorNote text={error} />
        <Button type="submit" block size="lg" className="mt-6" loading={busy === 'set'} disabled={Boolean(busy)}>
          Set password
        </Button>
        <Button type="button" block size="lg" variant="secondary" className="mt-2.5" loading={busy === 'skip'} disabled={Boolean(busy)} onClick={() => run('skip')}>
          Skip for now
        </Button>
        <p className="mt-3 text-center text-[13px] text-text-3">
          If you skip, messages stay encrypted and the server keeps your key sealed. You can set a password later from the web app.
        </p>
        <p className="mt-6 text-center text-sm text-text-2">
          <button type="button" className="font-medium text-accent-ink underline" onClick={() => signOut()}>
            Sign out
          </button>
        </p>
      </form>
    </div>
  );
}

// The server's rule (server/src/features/auth/auth.controller.js isStrongPassword).
const PASSWORD_RULES = [
  { label: '8 to 16 characters', test: (p) => p.length >= 8 && p.length <= 16 },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol, like ! or #', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordRules({ password }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]" aria-label="Password rules">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.label} className={cx('flex items-center gap-1.5', ok ? 'text-success' : 'text-text-3')}>
            <Icon as={CircleCheck} size={13} />
            <span>
              {r.label}
              <span className="sr-only">{ok ? ', done' : ', not yet'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Latest date of birth that is at least 13 years ago, as YYYY-MM-DD (the server's rule). */
function latestDob(today = new Date()) {
  const d = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DobField({ value, onChange }) {
  return (
    <Field
      label="Date of birth"
      icon={CalendarDays}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      max={latestDob()}
      min="1900-01-01"
      autoComplete="bday"
      hint="You need to be at least 13. Only you can see this."
    />
  );
}

/**
 * "Check your email": after creating an account, and when someone signs in before verifying.
 * Has a resend button with a short wait between sends.
 */
function CheckEmail({ email, server, reason, onBack, onSignIn }) {
  const resendVerification = useSession((s) => s.resendVerification);
  const [wait, setWait] = useState(reason === 'signup' ? 30 : 0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    setStatus('sending');
    try {
      await resendVerification({ server, email });
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
    setWait(30);
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Check your email" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
            <Icon as={MailCheck} />
          </span>
          <h2 className="mt-4 text-xl font-bold tracking-tight">{reason === 'signup' ? 'Verify your email' : 'Verify your email first'}</h2>
          <p className="mt-2 max-w-sm text-sm text-text-2">
            {reason === 'signup' ? 'We sent a link to' : "Your account isn't verified yet. Open the link we sent to"}{' '}
            <span className="font-medium text-text">{email}</span>, then sign in here. The link works for 24 hours.
          </p>
          {status && (
            <p role="status" className={cx('mt-3 text-sm', status === 'failed' ? 'text-danger' : 'text-success')}>
              {status === 'sent' ? 'A new link is on its way.' : status === 'failed' ? "Couldn't send a new link. Try again in a moment." : 'Sending…'}
            </p>
          )}
        </div>
        <Button block size="lg" className="mt-8" onClick={onSignIn}>
          Go to sign in
        </Button>
        <Button block size="lg" variant="secondary" className="mt-2.5" onClick={resend} disabled={wait > 0 || status === 'sending'}>
          <Icon as={RotateCw} size="sm" /> {wait > 0 ? `Resend link in ${wait}s` : 'Resend verification email'}
        </Button>
      </div>
    </div>
  );
}

/** Account creation. The server emails a link that must be opened before the first sign-in. */
function SignUp({ onBack, onSignIn, onSent, onGoogleSignup, initialEmail }) {
  const signUp = useSession((s) => s.signUp);
  const signInWithProvider = useSession((s) => s.signInWithProvider);
  const addr = useServerAddress();
  const providers = useProviders(addr.known ? addr.base : '');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const url = normalizeServerUrl(addr.server);
    if (!url) return setError("Can't reach Oruinwan right now. Check your internet connection.");
    if (username.trim().length < 2) return setError('Choose a username of at least 2 characters.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!dob) return setError('Enter your date of birth.');
    if (!PASSWORD_RULES.every((r) => r.test(password))) return setError('Your password needs everything in the list below it.');
    setBusy(true);
    try {
      await signUp({ server: url, username: username.trim(), email: email.trim(), dob, password });
      prefs.set('lastServer', url);
      prefs.set('lastEmail', email.trim());
      onSent(email.trim(), url);
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    setBusy(true);
    try {
      const token = await googleAccessToken(providers.googleClientId);
      prefs.set('lastServer', addr.base);
      const result = await signInWithProvider('google', { server: addr.base, accessToken: token });
      if (result?.needsSignup) onGoogleSignup(result.ticket);
    } catch (err) {
      // An existing account with two-step verification finishes on the sign-in screen.
      if (err.code === '2FA_REQUIRED') onSignIn();
      else setError(err.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Create an account" onBack={onBack} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <ServerSection addr={addr} verb="Creating an account on" />
        {providers.google && (
          <>
            <Button type="button" block size="lg" variant="secondary" onClick={google} disabled={busy}>
              <GoogleMark /> Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-text-3" aria-hidden>
              <span className="h-px flex-1 bg-line-soft" />
              or with email
              <span className="h-px flex-1 bg-line-soft" />
            </div>
          </>
        )}
        <div className="space-y-4">
          <Field
            label="Username"
            icon={AtSign}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="sam.carter"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            hint="Your team sees this name."
            enterKeyHint="next"
          />
          <Field
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            enterKeyHint="next"
          />
          <DobField value={dob} onChange={setDob} />
          <div>
            <Field
              label="Password"
              icon={Lock}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              enterKeyHint="go"
              trailing={
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="text-text-3">
                  <Icon as={show ? EyeOff : Eye} size="sm" />
                </button>
              }
            />
            <PasswordRules password={password} />
          </div>
        </div>
        <ErrorNote text={error} />
        <Button type="submit" block size="lg" className="mt-6" loading={busy}>
          Create account
        </Button>
        <p className="mt-4 text-center text-sm text-text-2">
          Already have an account?{' '}
          <button type="button" className="font-medium text-accent-ink underline" onClick={onSignIn}>
            Sign in
          </button>
        </p>
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line-soft bg-surface px-3.5 py-3 text-[13px] text-text-2">
          <Icon as={ShieldCheck} size="sm" className="mt-0.5 shrink-0 text-accent-ink" />
          <span>Your password also protects your encryption keys. Oruinwan can't reset it for you, so keep it somewhere safe.</span>
        </div>
      </form>
    </div>
  );
}

/**
 * "Continue with Google" for an email with no account. Nothing exists until the person confirms
 * here with a username and date of birth. Google already verified the email.
 */
function GoogleSignUp({ ticket, onBack }) {
  const googleSignUp = useSession((s) => s.googleSignUp);
  const [username, setUsername] = useState(ticket.name || '');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (username.trim().length < 2) return setError('Choose a username of at least 2 characters.');
    if (!dob) return setError('Enter your date of birth.');
    setBusy(true);
    try {
      await googleSignUp({ server: prefs.get('lastServer'), signupToken: ticket.signupToken, username: username.trim(), dob });
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Create an account" onBack={onBack} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <span className="mt-2 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
          <Icon as={Sparkles} />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">You're creating a new account</h1>
        <p className="mt-2 text-sm text-text-2">
          There's no Oruinwan account for <span className="font-medium text-text">{ticket.email}</span> yet. Welcome to the team.
          Add a couple of details and you're in.
        </p>
        <div className="mt-6 space-y-4">
          <Field
            label="Username"
            icon={AtSign}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={40}
            hint="Your team sees this name."
          />
          <DobField value={dob} onChange={setDob} />
        </div>
        <ErrorNote text={error} />
        <Button type="submit" block size="lg" className="mt-6" loading={busy} iconRight={ArrowRight}>
          Create my account
        </Button>
        <Button type="button" block size="lg" variant="secondary" className="mt-2.5" onClick={onBack} disabled={busy}>
          Use a different account
        </Button>
      </form>
    </div>
  );
}

/**
 * "Get started": one email field. Existing accounts go on to sign in, new ones to create an
 * account, with the email filled in. Google works from here too.
 */
function EmailStart({ onBack, onExisting, onNew, onGoogleSignup, onGoogle2fa }) {
  const signInWithProvider = useSession((s) => s.signInWithProvider);
  const addr = useServerAddress();
  const providers = useProviders(addr.known ? addr.base : '');
  const [email, setEmail] = useState(() => prefs.get('lastEmail') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const url = normalizeServerUrl(addr.server);
    if (!url) return setError("Can't reach Oruinwan right now. Check your internet connection.");
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      const res = await fetch(`${url}/api/users/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error();
      const { exists } = await res.json();
      prefs.set('lastServer', url);
      prefs.set('lastEmail', value);
      if (exists) onExisting(value);
      else onNew(value);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    setBusy(true);
    let token = null;
    try {
      token = await googleAccessToken(providers.googleClientId);
      prefs.set('lastServer', addr.base);
      const result = await signInWithProvider('google', { server: addr.base, accessToken: token });
      if (result?.needsSignup) onGoogleSignup(result.ticket);
    } catch (err) {
      if (err.code === '2FA_REQUIRED' && token) onGoogle2fa(token);
      else setError(err.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="" onBack={onBack} />
      <form onSubmit={submit} className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Enter your email</h1>
        <p className="mb-6 mt-2 text-[15px] text-text-2">We'll sign you in, or help you create an account if you're new.</p>
        <ServerSection addr={addr} verb="Connecting to" />
        <Field
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          autoCapitalize="none"
          enterKeyHint="go"
          autoFocus
        />
        <ErrorNote text={error} />
        <Button type="submit" block size="lg" className="mt-6" loading={busy} iconRight={ArrowRight} data-testid="email-continue">
          Continue
        </Button>
        {providers.google && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-text-3" aria-hidden>
              <span className="h-px flex-1 bg-line-soft" />
              or
              <span className="h-px flex-1 bg-line-soft" />
            </div>
            <Button type="button" block size="lg" variant="secondary" onClick={google} disabled={busy}>
              <GoogleMark /> Continue with Google
            </Button>
          </>
        )}
        <p className="mt-6 text-center text-[13px] text-text-3">
          By continuing you agree to the{' '}
          <button type="button" className="underline" onClick={() => openExternal(`${addr.base || ''}/terms`)} disabled={!addr.base}>
            Terms
          </button>{' '}
          and{' '}
          <button type="button" className="underline" onClick={() => openExternal(`${addr.base || ''}/privacy`)} disabled={!addr.base}>
            Privacy Policy
          </button>
          .
        </p>
      </form>
    </div>
  );
}

export function AuthFlow() {
  const [step, setStep] = useState('welcome');
  // "Continue with Google" for an email with no account: the server's sign-up ticket.
  const [googleTicket, setGoogleTicket] = useState(null);
  // Where a verification link went: { email, server, reason: 'signup' | 'unverified' }.
  const [checkEmail, setCheckEmail] = useState(null);
  // From "Enter your email": the address, and a Google token waiting for its two-factor code.
  const [startEmail, setStartEmail] = useState('');
  const [pendingGoogle, setPendingGoogle] = useState(null);
  const go = setStep;
  // Back from Sign in or Create account returns to "Enter your email"; from the steps after them, to Sign in.
  const back = () =>
    setStep(step === 'signin' || step === 'signup' ? 'start' : step === 'google-signup' || step === 'check-email' ? 'signin' : 'welcome');
  // Android back on a form does the same.
  useEffect(() => {
    if (step === 'welcome') return undefined;
    const { pushOverlay, removeOverlay } = useNav.getState();
    pushOverlay('auth-form', back);
    return () => removeOverlay('auth-form');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const startGoogleSignup = (ticket) => {
    setGoogleTicket(ticket);
    go('google-signup');
  };
  const showCheckEmail = (info) => {
    setCheckEmail(info);
    go('check-email');
  };
  if (step === 'google-signup' && googleTicket) return <GoogleSignUp ticket={googleTicket} onBack={back} />;
  if (step === 'check-email' && checkEmail) {
    return <CheckEmail {...checkEmail} onBack={back} onSignIn={() => setStep('signin')} />;
  }
  if (step === 'start') {
    return (
      <EmailStart
        onBack={() => setStep('welcome')}
        onExisting={(email) => {
          setStartEmail(email);
          go('signin');
        }}
        onNew={(email) => {
          setStartEmail(email);
          go('signup');
        }}
        onGoogleSignup={startGoogleSignup}
        onGoogle2fa={(token) => {
          setPendingGoogle(token);
          go('signin');
        }}
      />
    );
  }
  if (step === 'signin') {
    return (
      <SignIn
        key={pendingGoogle || startEmail}
        initialEmail={startEmail}
        initialGoogleToken={pendingGoogle}
        onBack={back}
        onCreate={() => go('signup')}
        onGoogleSignup={startGoogleSignup}
        onUnverified={(email, server) => showCheckEmail({ email, server, reason: 'unverified' })}
      />
    );
  }
  if (step === 'signup') {
    return (
      <SignUp
        initialEmail={startEmail}
        onBack={back}
        onSignIn={() => go('signin')}
        onGoogleSignup={startGoogleSignup}
        onSent={(email, server) => showCheckEmail({ email, server, reason: 'signup' })}
      />
    );
  }
  return <Intro onGetStarted={() => go('start')} />;
}
