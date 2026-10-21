// While signed in, this device answers for the person's other devices:
//  - sign-in requests ("Sign-in request from Windows laptop — Approve / Deny"), from the socket
//    (auth:approval-request), a tapped push (signin_approval) or a check when the app resumes;
//  - "unlock messages on <device>" requests (unlock_approval);
//  - "Scan to sign in": scanning the QR on a computer's login screen (Settings, header button).
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Laptop, MapPin, ShieldCheck } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useE2ee } from '../../data/e2ee.js';
import { emit, on, toast } from '../../lib/bus.js';
import { onAppState } from '../../native/index.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { qrMessage } from '../../data/live/adapter.signin.js';
import { QrScanSheet } from './QrScanSheet.jsx';

/** Opens "Scan to sign in" from anywhere (Settings row, header button). */
export const openScanToSignIn = () => emit('qr:scan-to-sign-in');

/** Push types that mean "check for approval requests now". */
export const APPROVAL_PUSH_TYPES = new Set(['signin_approval', 'unlock_approval']);

function where(r) {
  return [r?.deviceName || 'A new device', r?.location ? `near ${r.location}` : null].filter(Boolean).join(' ');
}

function RequesterCard({ requester }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-line-soft bg-surface p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-ink">
        <Icon as={Laptop} size="sm" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-text">{requester?.deviceName || 'Unknown device'}</p>
        {requester?.location && (
          <p className="flex items-center gap-1 text-text-2">
            <Icon as={MapPin} size={13} /> Near {requester.location}
          </p>
        )}
        {requester?.ip && <p className="text-text-3">IP {requester.ip}</p>}
      </div>
    </div>
  );
}

function ApprovalSheet({ approval, onDone }) {
  const [busy, setBusy] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const unlock = approval?.kind === 'unlock';

  const answer = async (approve) => {
    setBusy(approve ? 'yes' : 'no');
    setError('');
    try {
      if (unlock) await api().decideUnlockApproval(approval.id, approve, password || null);
      else await api().decideSignInApproval(approval.id, approve);
      toast(approve ? (unlock ? 'Messages unlocked there' : 'Sign-in approved') : 'Request denied', approve ? 'success' : 'neutral');
      onDone(approval.id);
    } catch (err) {
      if (err.code === 'PASSWORD_NEEDED') setNeedsPassword(true);
      else if (err.code === 'WRONG_PASSWORD') setError('That password did not unlock your messages.');
      else if (err.status === 404 || err.status === 409) {
        toast(err.message || 'This request has expired.', 'neutral');
        onDone(approval.id);
      } else setError(err.message || "That didn't work. Try again.");
    } finally {
      setBusy('');
    }
  };

  return (
    <Sheet
      open={Boolean(approval)}
      onClose={() => onDone(approval?.id, true)}
      title={unlock ? 'Unlock messages on another device?' : 'Sign-in request'}
      footer={
        <div className="flex gap-2.5">
          <Button block variant="secondary" loading={busy === 'no'} disabled={Boolean(busy)} onClick={() => answer(false)}>
            Deny
          </Button>
          <Button block loading={busy === 'yes'} disabled={Boolean(busy) || (needsPassword && !password)} onClick={() => answer(true)}>
            {unlock ? 'Unlock' : 'Approve'}
          </Button>
        </div>
      }
    >
      <div className="px-5 pb-4">
        <p className="mb-3 text-sm text-text-2">
          {unlock
            ? `${where(approval?.requester)} wants to unlock your messages.`
            : `Sign-in request from ${where(approval?.requester)}. Approve only if this is you.`}
        </p>
        <RequesterCard requester={approval?.requester} />
        {unlock && needsPassword && (
          <div className="mt-4">
            <Field
              type="password"
              label="Your password"
              icon={KeyRound}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              hint="Needed once: your account still has an older key. Afterwards every device unlocks automatically."
            />
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** "Scan to sign in": scan the QR on a computer's login screen, then approve that computer. */
function ScanToSignIn({ open, onClose }) {
  const [scanned, setScanned] = useState(null); // { code, requester }
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const onCode = async (code) => {
    setError('');
    try {
      const res = await api().qrScan(code);
      setScanned({ code, requester: res.requester });
    } catch (err) {
      toast(
        err.code === 'QR_WRONG_SIDE'
          ? 'That code is for signing in a phone. On the phone, choose Scan QR code on the start screen.'
          : qrMessage(err),
        'danger',
      );
      onClose();
    }
  };

  const decide = async (approve) => {
    setBusy(approve ? 'yes' : 'no');
    try {
      await api().qrDecide(scanned.code, approve);
      toast(approve ? `Signed in on ${scanned.requester?.deviceName || 'that device'}` : 'Sign-in declined', approve ? 'success' : 'neutral');
      setScanned(null);
      onClose();
    } catch (err) {
      setError(qrMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <QrScanSheet
        open={open && !scanned}
        onClose={onClose}
        onCode={onCode}
        title="Scan to sign in"
        hint="On the computer, choose Sign in with QR on the login screen, then scan the code it shows."
      />
      <Sheet
        open={Boolean(scanned)}
        onClose={() => {
          setScanned(null);
          onClose();
        }}
        title="Sign in on this device?"
        footer={
          <div className="flex gap-2.5">
            <Button block variant="secondary" loading={busy === 'no'} disabled={Boolean(busy)} onClick={() => decide(false)}>
              Deny
            </Button>
            <Button block loading={busy === 'yes'} disabled={Boolean(busy)} onClick={() => decide(true)}>
              Approve
            </Button>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <p className="mb-3 text-sm text-text-2">
            Sign in on {where(scanned?.requester)}? It gets access to your account and your messages.
          </p>
          <RequesterCard requester={scanned?.requester} />
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-text-3">
            <Icon as={ShieldCheck} size={14} /> Approving here also counts as your second sign-in step.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}

export function ApprovalHost() {
  const status = useSession((s) => s.status);
  const [pending, setPending] = useState([]);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [scanning, setScanning] = useState(false);

  const check = useCallback(async () => {
    if (useSession.getState().status !== 'signed-in') return;
    try {
      const list = await api().approvals?.();
      if (Array.isArray(list)) setPending(list);
    } catch {
      /* older server or offline */
    }
  }, []);

  useEffect(() => {
    if (status !== 'signed-in') return undefined;
    check();
    const offSocket = on('socket', ({ event, payload } = {}) => {
      if (event === 'auth:approval-request' && payload?.id) {
        setPending((l) => [payload, ...l.filter((a) => a.id !== payload.id)]);
      } else if (event === 'auth:approval-resolved' && payload?.id) {
        setPending((l) => l.filter((a) => a.id !== payload.id));
      } else if (event === 'crypto:umek-sealed' && useE2ee.getState().status !== 'ready') {
        // Another device sealed the key: this one can unlock without a password now.
        api().unlock?.().catch(() => {});
      }
    });
    const offCheck = on('approvals:check', check);
    const offScan = on('qr:scan-to-sign-in', () => setScanning(true));
    let offApp = () => {};
    onAppState((active) => {
      if (active) check();
    })
      .then((f) => (offApp = f))
      .catch(() => {});
    return () => {
      offSocket();
      offCheck();
      offScan();
      offApp();
    };
  }, [status, check]);

  if (status !== 'signed-in') return null;
  const current = pending.find((a) => a.status === 'pending' && !dismissed.has(a.id)) || null;
  const done = (id, justClose = false) => {
    if (!id) return;
    if (justClose) setDismissed((s) => new Set(s).add(id));
    else setPending((l) => l.filter((a) => a.id !== id));
  };

  return (
    <>
      <ApprovalSheet key={current?.id || 'none'} approval={current} onDone={done} />
      <ScanToSignIn open={scanning} onClose={() => setScanning(false)} />
    </>
  );
}
