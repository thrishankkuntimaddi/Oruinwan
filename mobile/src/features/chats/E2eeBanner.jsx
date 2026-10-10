// Shown when this phone can't read encrypted messages yet, with a one-time password unlock.
import { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { useE2ee } from '../../data/e2ee.js';
import { api, useSession } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { toast } from '../../lib/bus.js';

export function UnlockSheet({ open, onClose }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e?.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const status = await api().unlock(password);
      if (status === 'ready') {
        toast('Messages unlocked on this phone', 'success');
        invalidate('messages', 'thread', 'dms');
        setPassword('');
        onClose();
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
          Messages are end-to-end encrypted. Enter your Oruinwan password once to unlock them on this phone. It is used here and never stored.
        </p>
        <Field type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} autoFocus autoComplete="current-password" />
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
          <p className="font-medium text-text">{canUnlock ? 'Messages are locked on this phone' : 'Encrypted messages are unavailable'}</p>
          <p className="text-text-2">{canUnlock ? 'Unlock once with your password to read and send.' : message}</p>
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
