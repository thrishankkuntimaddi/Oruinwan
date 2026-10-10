import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, MessagesSquare, Server, Sparkles, SquareCheckBig, ShieldCheck, TriangleAlert, CircleCheck, Loader2,
} from 'lucide-react';
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
import { openExternal } from '../../native/index.js';
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

function SignIn({ onBack }) {
  const signIn = useSession((s) => s.signIn);
  const [server, setServer] = useState(() => prefs.get('lastServer') || remoteSnapshot().defaultServerUrl || DEFAULT_SERVER_URL);
  const [email, setEmail] = useState(() => prefs.get('lastEmail') || '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [probe, setProbe] = useState(null);
  const otpRef = useRef(null);

  const check = async (value = server) => {
    const url = normalizeServerUrl(value);
    if (!url) return setProbe(null);
    setProbe({ state: 'checking' });
    setProbe(await probeServer(url));
  };

  useEffect(() => {
    if (server) check(server);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const base = normalizeServerUrl(server);

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Sign in" onBack={onBack} />
      <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 pb-10" noValidate>
        <p className="mb-6 text-sm text-text-2">
          Oruinwan is self-hosted. Enter the address your team uses for Oruinwan on the web.
        </p>
        <div className="space-y-4">
          <div>
            <Field
              label="Server address"
              icon={Server}
              value={server}
              onChange={(e) => setServer(e.target.value)}
              onBlur={() => check()}
              placeholder="https://chat.example.com"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
            />
            <ServerStatus probe={probe} />
          </div>
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
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <Icon as={TriangleAlert} size="sm" className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" block size="lg" className="mt-6" loading={busy}>
          {needsOtp ? 'Verify and sign in' : 'Sign in'}
        </Button>
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line-soft bg-surface px-3.5 py-3 text-[13px] text-text-2">
          <Icon as={ShieldCheck} size="sm" className="mt-0.5 shrink-0 text-accent-ink" />
          <span>
            Your password also unlocks your encryption keys on this phone. It is never stored.
            {base && (
              <>
                {' '}
                New account, Google sign-in or a forgotten password?{' '}
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

export function AuthFlow() {
  const [step, setStep] = useState('welcome');
  const back = () => setStep('welcome');
  // Android back on the sign-in form returns to the welcome screen.
  useEffect(() => {
    if (step !== 'signin') return undefined;
    const { pushOverlay, removeOverlay } = useNav.getState();
    pushOverlay('auth-signin', back);
    return () => removeOverlay('auth-signin');
  }, [step]);
  return step === 'welcome' ? <Welcome onSignIn={() => setStep('signin')} /> : <SignIn onBack={back} />;
}
