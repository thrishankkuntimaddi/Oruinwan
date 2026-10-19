import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, AtSign, Eye, EyeOff, KeyRound, Lock, Mail, MailCheck, MessagesSquare, Server, Sparkles, SquareCheckBig, ShieldCheck, TriangleAlert, CircleCheck, Loader2,
} from 'lucide-react';
import { cx } from '../../ui/cx.js';
import { useSession } from '../../data/session.js';
import { BrandMark } from '../../app/BrandMark.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Header } from '../../ui/Screen.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { prefs } from '../../native/storage.js';
import { DEFAULT_SERVER_URL } from '../../config/env.js';
import { remoteSnapshot } from '../../config/remote.js';
import { normalizeServerUrl, probeServer } from '../../data/live/server.js';
import { deviceNoun, isWeb, openExternal } from '../../native/index.js';
import { useNav } from '../../app/nav.js';

const POINTS = [
  { icon: MessagesSquare, title: 'Channels and direct messages', body: 'End-to-end encrypted, on your own server.' },
  { icon: SquareCheckBig, title: 'Tasks and notes', body: 'Plan, track and write with your team.' },
  { icon: Sparkles, title: 'Oruinwan AI', body: 'Summaries, drafts and answers from your workspace.' },
];

function Welcome({ onSignIn }) {
  const startDemo = useSession((s) => s.startDemo);
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-bg px-6 pt-safe pb-safe">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%] opacity-70"
        style={{ background: 'radial-gradient(60% 50% at 50% 20%, rgb(var(--c-accent) / 0.16), transparent 70%)' }}
      />
      <div className="relative flex flex-1 flex-col items-center justify-center pt-10 text-center">
        <BrandMark size={96} glow />
        <h1 className="mt-6 text-[32px] font-bold tracking-tight">Oruinwan</h1>
        <p className="mt-1.5 text-[15px] text-text-2">The collaboration platform for teams that ship.</p>
        <ul className="mt-9 w-full max-w-sm space-y-4 text-left">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-accent-ink">
                <Icon as={p.icon} />
              </span>
              <span>
                <span className="block text-[15px] font-medium">{p.title}</span>
                <span className="block text-[13px] text-text-2">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative mx-auto w-full max-w-sm space-y-2.5 pt-8 pb-6">
        <Button block size="lg" iconRight={ArrowRight} onClick={onSignIn}>
          Sign in to your workspace
        </Button>
        <Button
          block
          size="lg"
          variant="secondary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await startDemo();
            } finally {
              setBusy(false);
            }
          }}
        >
          Explore the demo
        </Button>
        <p className="pt-2 text-center text-xs text-text-3">Version {__APP_VERSION__} · Open source (MIT)</p>
      </div>
    </div>
  );
}

function ServerStatus({ probe }) {
  if (!probe) return null;
  if (probe.state === 'checking')
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-2">
        <Loader2 size={13} className="animate-spin" /> Checking server…
      </p>
    );
  if (probe.state === 'ok')
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
        <Icon as={CircleCheck} size={13} /> Connected{probe.insecure ? ' (not HTTPS — messages are still end-to-end encrypted)' : ''}
      </p>
    );
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
      <Icon as={TriangleAlert} size={13} /> {probe.message}
    </p>
  );
}

// In a browser the app can be served by the Oruinwan server itself (the web, desktop and
// tablet builds). Then the page's own address is the server and nobody should have to type it.
const PAGE_ORIGIN = isWeb && typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? location.origin : '';

/** The known server as one line, with a way to type a different one. */
function ServerLine({ server, verb, onChange }) {
  let host = server;
  try {
    host = new URL(server).host;
  } catch {
    /* keep as typed */
  }
  return (
    <p className="mb-6 flex items-center gap-2 text-sm text-text-2">
      <Icon as={Server} size="sm" className="shrink-0 text-text-3" />
      <span className="min-w-0 truncate">
        {verb} <span className="font-medium text-text">{host}</span>
      </span>
      <button type="button" onClick={onChange} className="ml-auto shrink-0 font-medium text-accent-ink underline">
        Change
      </button>
    </p>
  );
}

/**
 * Which server to talk to. Starts from the remembered, remote-configured or build-time server;
 * otherwise quietly tries the page's own address. `known` is true once the server answers and
 * the person hasn't asked to change it, so the form can show one line instead of the field.
 */
function useServerAddress() {
  const [server, setServer] = useState(() => prefs.get('lastServer') || remoteSnapshot().defaultServerUrl || DEFAULT_SERVER_URL);
  const [editing, setEditing] = useState(false);
  const [probe, setProbe] = useState(null);

  const check = async (value = server) => {
    const url = normalizeServerUrl(value);
    if (!url) return setProbe(null);
    setProbe({ state: 'checking' });
    setProbe(await probeServer(url));
  };

  useEffect(() => {
    if (server) {
      check(server);
      return undefined;
    }
    if (!PAGE_ORIGIN) return undefined;
    // Try the page's own address quietly: if no Oruinwan server answers there, the field stays
    // empty, without an error the person didn't cause.
    let live = true;
    probeServer(PAGE_ORIGIN).then((result) => {
      if (!live || result.state !== 'ok') return;
      setServer(PAGE_ORIGIN);
      setProbe(result);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = normalizeServerUrl(server);
  return { server, setServer, probe, check, base, known: probe?.state === 'ok' && !editing, edit: () => setEditing(true) };
}

/** The server line, or the intro text and the address field when the server isn't known. */
function ServerSection({ addr, verb }) {
  return (
    <>
      {addr.known ? (
        <ServerLine server={addr.base} verb={verb} onChange={addr.edit} />
      ) : (
        <p className="mb-6 text-sm text-text-2">
          Oruinwan is self-hosted. Enter the address your team uses for Oruinwan on the web.
        </p>
      )}
      <div hidden={addr.known} className="mb-4">
        <Field
          label="Server address"
          icon={Server}
          value={addr.server}
          onChange={(e) => addr.setServer(e.target.value)}
          onBlur={() => addr.check()}
          placeholder="https://chat.example.com"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
        />
        <ServerStatus probe={addr.probe} />
      </div>
    </>
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

function SignIn({ onBack, onCreate }) {
  const signIn = useSession((s) => s.signIn);
  const addr = useServerAddress();
  const { server, base } = addr;
  const [email, setEmail] = useState(() => prefs.get('lastEmail') || '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const otpRef = useRef(null);

  useEffect(() => {
    if (needsOtp) otpRef.current?.focus();
  }, [needsOtp]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const url = normalizeServerUrl(server);
    if (!url) return setError('Enter your server address, for example https://chat.example.com');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await signIn({ server: url, email: email.trim(), password, otp: needsOtp ? otp.trim() : undefined });
      prefs.set('lastServer', url);
      prefs.set('lastEmail', email.trim());
    } catch (err) {
      if (err.code === '2FA_REQUIRED') {
        setNeedsOtp(true);
        setError(err.invalidCode ? 'That code did not work. Try the newest one.' : '');
      } else setError(err.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Sign in" onBack={onBack} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <ServerSection addr={addr} verb="Signing in to" />
        <div className="space-y-4">
          <Field
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
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
        <p className="mt-4 text-center text-sm text-text-2">
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
                Google sign-in or a forgotten password?{' '}
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

/** Account creation. The server emails a link that must be opened before the first sign-in. */
function SignUp({ onBack, onSignIn }) {
  const signUp = useSession((s) => s.signUp);
  const addr = useServerAddress();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const url = normalizeServerUrl(addr.server);
    if (!url) return setError('Enter your server address, for example https://chat.example.com');
    if (username.trim().length < 3) return setError('Choose a username of at least 3 characters.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!PASSWORD_RULES.every((r) => r.test(password))) return setError('Your password needs everything in the list below it.');
    setBusy(true);
    try {
      await signUp({ server: url, username: username.trim(), email: email.trim(), password });
      prefs.set('lastServer', url);
      prefs.set('lastEmail', email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <Header title="Check your email" onBack={onBack} />
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          <div className="mt-6 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
              <Icon as={MailCheck} />
            </span>
            <h2 className="mt-4 text-xl font-bold tracking-tight">Verify your email</h2>
            <p className="mt-2 max-w-sm text-sm text-text-2">
              We sent a link to <span className="font-medium text-text">{sentTo}</span>. Open it to confirm your address,
              then sign in here. The link works for 24 hours.
            </p>
          </div>
          <Button block size="lg" className="mt-8" onClick={onSignIn}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Create an account" onBack={onBack} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <ServerSection addr={addr} verb="Creating an account on" />
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
            placeholder="you@company.com"
            autoComplete="email"
            autoCapitalize="none"
            enterKeyHint="next"
          />
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

export function AuthFlow() {
  const [step, setStep] = useState('welcome');
  const [from, setFrom] = useState('welcome');
  const go = (next) => {
    setFrom(step);
    setStep(next);
  };
  // Back from Create account returns to where it was opened; back from Sign in to the welcome screen.
  const back = () => setStep(step === 'signup' ? from : 'welcome');
  // Android back on a form does the same.
  useEffect(() => {
    if (step === 'welcome') return undefined;
    const { pushOverlay, removeOverlay } = useNav.getState();
    pushOverlay('auth-form', back);
    return () => removeOverlay('auth-form');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, from]);
  if (step === 'signin') return <SignIn onBack={back} onCreate={() => go('signup')} />;
  if (step === 'signup') return <SignUp onBack={back} onSignIn={() => go('signin')} />;
  return <Welcome onSignIn={() => go('signin')} />;
}
