// Shown when this device can't read encrypted messages yet. Accounts whose key the server holds
// sealed unlock by themselves; an older password-protected key unlocks once, with the password
// here or approved from another signed-in device. Never blocks the app.
import { useEffect, useRef, useState } from 'react';
import { Laptop, Lock, ShieldAlert } from 'lucide-react';
import { useE2ee } from '../../data/e2ee.js';
import { api, useSession } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { toast } from '../../lib/bus.js';
import { deviceNoun } from '../../native/index.js';

export const UNLOCK_POLL_MS = 3000;

/**
 * "Ask another device": a signed-in device approves (entering the password there once), then
 * this device unwraps the key from the server.
 */
export function useAskAnotherDevice(onReady) {
  const [asking, setAsking] = useState(null); // request id
  const [error, setError] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!asking) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api().unlockRequestStatus(asking);
        if (stop) return;
        if (r?.umekProtectionType === 'SERVER_KEK') {
          const status = await api().unlock();
          if (status === 'ready') {
            setAsking(null);
            onReady?.();
            return;
          }
        }
        if (r?.status === 'denied') {
          setAsking(null);
          setError('Your other device declined.');
          return;
        }
        if (r?.status === 'expired') {
          setAsking(null);
          setError('The request expired. Ask again.');
          return;
        }
      } catch {
        /* keep waiting */
      }
      timer.current = setTimeout(tick, UNLOCK_POLL_MS);
    };
    timer.current = setTimeout(tick, UNLOCK_POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking]);
  const ask = async () => {
    setError('');
    try {
      const { id } = await api().requestUnlock();
      setAsking(id);
    } catch (err) {
      setError(err.message || "Couldn't reach your other devices.");
    }
  };
  return { asking: Boolean(asking), ask, error, cancel: () => setAsking(null) };
}

export function UnlockSheet({ open, onClose }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = () => {
    toast(`Messages unlocked on this ${deviceNoun}`, 'success');
    invalidate('messages', 'thread', 'dms');
    onClose();
  };
  const other = useAskAnotherDevice(done);
  const submit = async (e) => {
    e?.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const status = await api().unlock(password);
      if (status === 'ready') {
        setPassword('');
        done();
      } else setError(useE2ee.getState().message || 'Could not unlock your messages.');
    } catch (err) {
      setError(err.message || 'Could not unlock your messages.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Unlock your messages"
      footer={
        <Button block loading={busy} disabled={!password} onClick={submit}>
          Unlock
        </Button>
      }
    >
      <form onSubmit={submit} className="px-5 pb-4">
        <p className="mb-4 text-sm text-text-2">
          Your account still has an older key that needs your password once. After that, messages unlock automatically on all your devices:
          Oruinwan's server keeps a sealed copy of your key. Messages are encrypted in transit and at rest.
        </p>
        <Field type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} autoFocus autoComplete="current-password" />
        <div className="mt-4 rounded-xl border border-line-soft bg-surface px-3.5 py-3 text-sm">
          {other.asking ? (
            <p className="text-text-2" role="status">
              Waiting for your other device… Approve there (it asks for your password once).
            </p>
          ) : (
            <button type="button" className="flex items-center gap-2 font-medium text-accent-ink" onClick={other.ask}>
              <Icon as={Laptop} size="sm" /> Signed in elsewhere? Ask another device
            </button>
          )}
          {other.error && <p className="mt-2 text-danger">{other.error}</p>}
        </div>
      </form>
    </Sheet>
  );
}

export function E2eeBanner({ className = '' }) {
  const mode = useSession((s) => s.mode);
  const { status, message } = useE2ee();
  const [open, setOpen] = useState(false);
  if (mode !== 'live' || status === 'ready' || status === 'none') return null;
  const canUnlock = status === 'password_required' || status === 'error';
  return (
    <>
      <div className={`mx-4 flex items-start gap-3 rounded-card border border-warning/30 bg-warning/10 px-3.5 py-3 ${className}`}>
        <Icon as={canUnlock ? Lock : ShieldAlert} size="sm" className="mt-0.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-medium text-text">{canUnlock ? `Messages are locked on this ${deviceNoun}` : 'Encrypted messages are unavailable'}</p>
          <p className="text-text-2">{canUnlock ? 'Unlock once with your password or from another device. After that it happens automatically.' : message}</p>
        </div>
        {canUnlock && (
          <Button size="sm" onClick={() => setOpen(true)}>
            Unlock
          </Button>
        )}
      </div>
      <UnlockSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
