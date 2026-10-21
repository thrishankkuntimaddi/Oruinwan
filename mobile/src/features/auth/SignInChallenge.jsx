// A sign-in the server paused (useSession().challenge):
//   MFA_REQUIRED  two-step verification: approve on a signed-in device, the authenticator-app
//                 code, or a code sent by email (any one).
//   DEVICE_LIMIT  "You're signed in on 4 devices": sign one out (or all) to continue.
import { useEffect, useRef, useState } from 'react';
import { BellRing, KeyRound, Laptop, LogOut, Mail, Monitor, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { Header } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { shortAgo } from '../../lib/time.js';
import { deviceNoun } from '../../native/index.js';

export const APPROVAL_POLL_MS = 2000;

const PLATFORM_ICON = { ios: Smartphone, android: Smartphone, desktop: Laptop, web: Monitor };
const PLATFORM_LABEL = { ios: 'iPhone / iPad app', android: 'Android app', desktop: 'Desktop app', web: 'Browser' };

function Alert({ text }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
      <Icon as={TriangleAlert} size="sm" className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

/** Errors that end the sign-in: back to the start. */
const ENDED = new Set(['SIGNIN_EXPIRED', 'SIGNIN_DENIED', 'SIGNIN_TOO_MANY', 'SIGNIN_OTHER_DEVICE']);

function useContinue() {
  const continueChallenge = useSession((s) => s.continueChallenge);
  const cancel = useSession((s) => s.cancelChallenge);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ended, setEnded] = useState('');
  const run = async (what, body) => {
    setBusy(what);
    setError('');
    try {
      await continueChallenge(body);
      return true;
    } catch (err) {
      if (ENDED.has(err.code)) setEnded(err.message);
      else setError(err.message || "That didn't work. Try again.");
      return false;
    } finally {
      setBusy('');
    }
  };
  return { run, busy, error, ended, cancel, setError };
}

function Ended({ text, onBack }) {
  return (
    <div className="mt-8 text-center">
      <Alert text={text} />
      <Button block size="lg" className="mt-6" onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  );
}

function MfaStep({ challenge }) {
  const { run, busy, error, ended, cancel, setError } = useContinue();
  const status = useSession((s) => s.challengeStatus);
  const emailCode = useSession((s) => s.challengeEmailCode);
  const methods = challenge.methods || { totp: true };
  const [otp, setOtp] = useState('');
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [approval, setApproval] = useState(methods.approve ? 'pending' : null);
  const finishing = useRef(false);

  // Waiting for "Approve" on another device.
  useEffect(() => {
    if (!methods.approve || ended) return undefined;
    let stop = false;
    let timer = null;
    const tick = async () => {
      try {
        const s = await status();
        const st = s?.approval?.status;
        if (stop) return;
        if (st && st !== approval) setApproval(st);
        if ((st === 'approved' || st === 'denied') && !finishing.current) {
          finishing.current = true;
          if (await run('approve', {})) return;
          finishing.current = false;
        }
      } catch (err) {
        if (stop) return;
        if (err.status === 410) {
          setError('');
          return;
        }
      }
      timer = setTimeout(tick, APPROVAL_POLL_MS);
    };
    timer = setTimeout(tick, APPROVAL_POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.pendingToken, ended]);

  if (ended) return <Ended text={ended} onBack={cancel} />;

  const sendEmail = async () => {
    setError('');
    try {
      const r = await emailCode();
      setEmailSent(r?.emailHint || challenge.emailHint || 'your email');
    } catch (err) {
      setError(err.message || "We couldn't send the email.");
    }
  };

  return (
    <>
      <span className="mt-2 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
        <Icon as={ShieldCheck} />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Confirm it's you</h1>
      <p className="mt-2 text-sm text-text-2">Your account uses two-step verification. Use any one of these.</p>

      {methods.approve && (
        <div className="mt-6 rounded-card border border-line-soft bg-surface p-4" data-testid="mfa-approve">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon as={BellRing} size="sm" className="text-accent-ink" /> Approve on another device
          </p>
          <p className="mt-1 text-sm text-text-2">We sent a sign-in request to your other signed-in devices. Tap Approve there.</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-text-2">
            {approval === 'denied' ? (
              <span className="text-danger">Denied on your other device.</span>
            ) : (
              <>
                <Spinner /> {busy === 'approve' ? 'Signing in…' : 'Waiting for approval…'}
              </>
            )}
          </div>
        </div>
      )}

      {methods.totp && (
        <form
          className="mt-4 rounded-card border border-line-soft bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (otp.length === 6) run('totp', { otp });
          }}
        >
          <Field
            label="Authenticator app code"
            icon={KeyRound}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button type="submit" block className="mt-3" loading={busy === 'totp'} disabled={otp.length !== 6 || Boolean(busy)}>
            Verify
          </Button>
        </form>
      )}

      {methods.email && (
        <div className="mt-4 rounded-card border border-line-soft bg-surface p-4">
          {emailSent ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) run('email', { emailCode: code });
              }}
            >
              <Field
                label={`Code sent to ${emailSent}`}
                icon={Mail}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                hint="It works for 10 minutes."
              />
              <Button type="submit" block className="mt-3" loading={busy === 'email'} disabled={code.length !== 6 || Boolean(busy)}>
                Verify
              </Button>
              <button type="button" className="mt-3 w-full text-center text-sm font-medium text-accent-ink" onClick={sendEmail}>
                Send another code
              </button>
            </form>
          ) : (
            <Button block variant="secondary" icon={Mail} onClick={sendEmail}>
              Email me a code{challenge.emailHint ? ` at ${challenge.emailHint}` : ''}
            </Button>
          )}
        </div>
      )}
      <Alert text={error} />
    </>
  );
}

function DeviceLimitStep({ challenge }) {
  const { run, busy, error, ended, cancel } = useContinue();
  if (ended) return <Ended text={ended} onBack={cancel} />;
  const devices = challenge.devices || [];
  return (
    <>
      <span className="mt-2 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
        <Icon as={Laptop} />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">You're signed in on {challenge.limit || devices.length} devices</h1>
      <p className="mt-2 text-sm text-text-2">Sign out of one to continue on this {deviceNoun}.</p>
      <ul className="mt-6 divide-y divide-line-soft overflow-hidden rounded-card border border-line-soft bg-surface" data-testid="device-limit-list">
        {devices.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
              <Icon as={PLATFORM_ICON[d.platform] || Monitor} size="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{d.name}</p>
              <p className="truncate text-[13px] text-text-2">
                {[PLATFORM_LABEL[d.platform], d.lastActiveAt && `Active ${shortAgo(d.lastActiveAt)}`, d.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button size="sm" variant="secondary" loading={busy === d.id} disabled={Boolean(busy)} onClick={() => run(d.id, { signOutDeviceIds: [d.id] })}>
              Sign out
            </Button>
          </li>
        ))}
      </ul>
      <Button block size="lg" variant="secondary" className="mt-6" icon={LogOut} loading={busy === 'all'} disabled={Boolean(busy)} onClick={() => run('all', { signOutAll: true })}>
        Sign out everywhere and sign in here
      </Button>
      <Alert text={error} />
    </>
  );
}

export function SignInChallenge() {
  const challenge = useSession((s) => s.challenge);
  const cancel = useSession((s) => s.cancelChallenge);
  if (!challenge) return null;
  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title={challenge.code === 'DEVICE_LIMIT' ? 'Too many devices' : 'Two-step verification'} onBack={cancel} />
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-10">
        {challenge.code === 'DEVICE_LIMIT' ? <DeviceLimitStep key={challenge.pendingToken + 'd'} challenge={challenge} /> : <MfaStep key={challenge.pendingToken} challenge={challenge} />}
      </div>
    </div>
  );
}
