// The incoming-call screen (a DM or group-DM call ringing while the app is open) and the banner
// for a channel huddle that just started ("Ben started a huddle in #design · Join").
// The ringing itself is native (incomingCall.js → callSession.startRinging).
import { useState } from 'react';
import { Headphones, Phone, PhoneOff, Video, X } from 'lucide-react';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { toast } from '../../lib/bus.js';
import { useHuddle } from './huddle.js';
import { answerRing, declineRing, dismissNotice, joinFromNotice } from './incomingCall.js';
import { ringSubtitle } from './ringLogic.js';

function RoundButton({ label, tone, icon, onClick, busy, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      data-testid={testId}
      className="flex flex-col items-center gap-2 text-[13px] font-medium text-white/90 disabled:opacity-60"
    >
      <span className={`grid h-16 w-16 place-items-center rounded-full shadow-lg active:scale-95 ${tone}`}>
        <Icon as={icon} size={26} className="text-white" />
      </span>
      {label}
    </button>
  );
}

export function IncomingCall() {
  const ring = useHuddle((s) => s.ring);
  const [busy, setBusy] = useState(false);
  if (!ring) return null;
  const name = ring.from?.name || 'Someone';
  const answer = async () => {
    setBusy(true);
    try {
      await answerRing(ring);
    } catch (err) {
      toast(err.message || 'Could not join the call', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="alertdialog"
      aria-label={`Incoming call from ${name}`}
      data-testid="huddle-ring"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 text-white"
      style={{
        background: 'radial-gradient(120% 80% at 50% 20%, rgba(200,162,116,0.35), rgba(12,12,12,0.98) 60%)',
        paddingTop: 'calc(env(safe-area-inset-top) + 72px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
      }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full p-1 ring-4 ring-white/15 animate-pulse">
          <Avatar name={name} src={ring.from?.avatar || undefined} size="xl" />
        </span>
        <div>
          <p className="text-2xl font-semibold">{name}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-white/70">
            <Icon as={ring.video ? Video : Phone} size={15} />
            {ringSubtitle(ring)}
          </p>
          {ring.kind === 'group_dm' && ring.title ? <p className="mt-1 text-sm text-white/60">{ring.title}</p> : null}
        </div>
      </div>
      <div className="flex w-full max-w-xs items-start justify-between">
        <RoundButton label="Decline" tone="bg-danger" icon={PhoneOff} onClick={() => declineRing(ring)} testId="huddle-ring-decline" />
        <RoundButton label={busy ? 'Joining…' : 'Answer'} tone="bg-success" icon={ring.video ? Video : Phone} onClick={answer} busy={busy} testId="huddle-ring-join" />
      </div>
    </div>
  );
}

/** A channel huddle started: a banner with Join, no ringing. */
export function HuddleNotice() {
  const notice = useHuddle((s) => s.notice);
  const call = useHuddle((s) => s.call);
  const [busy, setBusy] = useState(false);
  if (!notice || call) return null;
  const where = notice.title ? `#${notice.title.replace(/^#\s*/, '')}` : 'a channel';
  return (
    <div
      role="status"
      data-testid="huddle-notice"
      className="glass-strong fixed inset-x-3 z-[61] flex items-center gap-3 rounded-2xl border px-3 py-3 animate-sheet-in"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)', borderLeft: '3px solid rgb(var(--c-success))' }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-success/50 text-success">
        <Icon as={notice.video ? Video : Headphones} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{notice.from?.name || 'Someone'} started a huddle</span>
        <span className="block truncate text-xs text-text-2">in {where}</span>
      </span>
      <Button
        size="sm"
        loading={busy}
        data-testid="huddle-notice-join"
        onClick={async () => {
          setBusy(true);
          try {
            await joinFromNotice(notice);
          } catch (err) {
            toast(err.message || 'Could not join the huddle', 'danger');
          } finally {
            setBusy(false);
          }
        }}
      >
        Join
      </Button>
      <button type="button" aria-label="Dismiss" onClick={dismissNotice} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-3 active:bg-surface-2">
        <Icon as={X} size={16} />
      </button>
    </div>
  );
}
