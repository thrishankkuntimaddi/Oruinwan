// The questions a call asks: "You're in another call · Switch?", "Move the call here?", why the
// microphone or camera is needed, and the "In a call on Pixel 8 · Move here" pill shown while my
// call runs on another of my devices.
import { useState } from 'react';
import { ArrowDownToLine, Camera, Mic, Smartphone } from 'lucide-react';
import { toast } from '../../lib/bus.js';
import { Dialog } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { confirmPrompt, dismissPrompt, moveCallHere, useHuddle } from './huddle.js';
import { allowFromPrompt, dismissPermissionPrompt, usePermissionAsk } from './callPermissions.js';
import { PERMISSION_COPY, callPlace, deviceName } from './callLogic.js';

export function SwitchPrompt() {
  const prompt = useHuddle((s) => s.prompt);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await confirmPrompt();
    } catch (err) {
      toast(err.message || 'Could not join the call', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={Boolean(prompt)}
      onClose={dismissPrompt}
      title={prompt?.title || ''}
      body={prompt?.body}
      confirmLabel={prompt?.confirmLabel || 'Switch'}
      cancelLabel="Stay"
      busy={busy}
      onConfirm={confirm}
    />
  );
}

export function PermissionPrompt() {
  const ask = usePermissionAsk((s) => s.ask);
  const copy = PERMISSION_COPY[ask?.kind] || PERMISSION_COPY.microphone;
  const settings = ask?.step === 'settings';
  return (
    <Dialog
      open={Boolean(ask)}
      onClose={dismissPermissionPrompt}
      title={copy.title}
      body={settings ? copy.denied : copy.body}
      confirmLabel={settings ? 'Open settings' : 'Allow'}
      cancelLabel="Not now"
      onConfirm={allowFromPrompt}
    >
      <span className="mt-4 grid h-12 w-12 place-items-center rounded-full border border-accent/40 bg-accent/12 text-accent-ink">
        <Icon as={ask?.kind === 'camera' ? Camera : Mic} size={20} />
      </span>
    </Dialog>
  );
}

/** "In a call on MacBook · # design · Move here", while I'm not in a call on this device. */
export function ElsewherePill() {
  const elsewhere = useHuddle((s) => s.elsewhere);
  const call = useHuddle((s) => s.call);
  const [busy, setBusy] = useState(false);
  if (!elsewhere || call) return null;
  const move = async () => {
    setBusy(true);
    try {
      await moveCallHere();
    } catch (err) {
      toast(err.message || 'Could not move the call', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="status"
      data-testid="huddle-elsewhere"
      className="glass fixed inset-x-3 z-[46] mx-auto flex max-w-lg items-center gap-2.5 rounded-2xl border px-3 py-2"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)', borderLeft: '3px solid rgb(var(--c-success))' }}
    >
      <Icon as={Smartphone} size={16} className="shrink-0 text-success" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">In a call on {deviceName(elsewhere.device)}</span>
        <span className="block truncate text-xs text-text-2">{callPlace(elsewhere)}</span>
      </span>
      <Button size="sm" icon={ArrowDownToLine} loading={busy} onClick={move} data-testid="huddle-move-here">
        Move here
      </Button>
    </div>
  );
}
