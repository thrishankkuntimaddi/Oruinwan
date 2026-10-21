// App-wide huddle chrome: the in-call bar (mute, leave, back to the call) and the ring for a
// DM call. Mounted once in the shell; listens for huddle events while signed in to a server.
import { useEffect, useState } from 'react';
import { Ellipsis, Mic, MicOff, Phone, PhoneOff, Radio } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { useDms, useChannels } from '../../data/hooks.js';
import { useFlag } from '../../config/flags.js';
import { toast } from '../../lib/bus.js';
import { cx } from '../../ui/cx.js';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { openConversation } from '../chats/chatsUi.js';
import { bindHuddles, dismissRing, joinHuddle, leave, loadLive, toggleMute, useHuddle } from './huddle.js';
import { bindCallExtras, useCallExtras } from './callExtras.js';
import { CallMenu, CaptionStrip, RecordingConsentBanner, useActiveRecorder } from './CallExtras.jsx';

function clockSince(start, now) {
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "# design" or "Call with Sam" for a call's scope. */
export function useCallTitle(scope, fallback = 'Huddle') {
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  if (scope?.channelId) {
    const c = (channels || []).find((x) => x.id === scope.channelId);
    return c ? `# ${c.name}` : fallback;
  }
  if (scope?.dmId) {
    const d = (dms || []).find((x) => x.id === scope.dmId);
    return d?.user?.name ? `Call with ${d.user.name}` : 'Direct message call';
  }
  return fallback;
}

function CallBar() {
  const call = useHuddle((s) => s.call);
  const connecting = useHuddle((s) => s.connecting);
  const muted = useHuddle((s) => s.muted);
  const people = useHuddle((s) => s.participants.length);
  const title = useCallTitle(call?.scope, call?.title);
  const since = call?.startedAt || Date.now();
  const [now, setNow] = useState(Date.now());
  const [menu, setMenu] = useState(false);
  const recorder = useActiveRecorder();
  const captions = useCallExtras((s) => s.showCaptions);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!call) return null;
  const open = () => {
    if (call.scope?.channelId) openConversation('channel', call.scope.channelId);
    else if (call.scope?.dmId) openConversation('dm', call.scope.dmId);
  };
  return (
    <div
      role="region"
      aria-label="You are in a huddle"
      data-testid="huddle-bar"
      className="glass fixed inset-x-3 z-[60] flex items-center gap-2 rounded-2xl border px-3 py-2"
      style={{ top: 'calc(env(safe-area-inset-top) + 60px)', borderLeft: '3px solid rgb(var(--c-success))' }}
    >
      <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Icon as={Radio} size={16} className="shrink-0 text-success" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{title}</span>
          <span className="flex items-center gap-1.5 text-xs text-text-2 tabular-nums">
            {recorder && (
              <span className="inline-flex items-center gap-1 font-semibold text-danger" data-testid="huddle-rec">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" aria-hidden />
                REC
              </span>
            )}
            <span className="truncate">{connecting ? 'Connecting…' : `${people} in call · ${clockSince(since, now)}`}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label="Call options: captions, recording, transcript, ask AI"
        data-testid="huddle-bar-more"
        className={cx('pressable grid h-10 w-10 place-items-center rounded-full border', captions ? 'border-accent/40 bg-accent/12 text-accent-ink' : 'border-line bg-surface-2 text-text')}
      >
        <Icon as={Ellipsis} size={18} />
      </button>
      <CallMenu open={menu} onClose={() => setMenu(false)} />
      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute' : 'Mute'}
        data-testid="huddle-bar-mute"
        className={cx('pressable grid h-10 w-10 place-items-center rounded-full border', muted ? 'border-danger/40 bg-danger/12 text-danger' : 'border-line bg-surface-2 text-text')}
      >
        <Icon as={muted ? MicOff : Mic} size={18} />
      </button>
      <button
        type="button"
        onClick={leave}
        aria-label="Leave huddle"
        data-testid="huddle-bar-leave"
        className="pressable grid h-10 w-10 place-items-center rounded-full bg-danger text-white"
      >
        <Icon as={PhoneOff} size={18} />
      </button>
    </div>
  );
}

function Ring() {
  const ring = useHuddle((s) => s.ring);
  const title = useCallTitle(ring ? { dmId: ring.dmId } : null);
  const [busy, setBusy] = useState(false);
  if (!ring) return null;
  const answer = async () => {
    setBusy(true);
    try {
      openConversation('dm', ring.dmId);
      await joinHuddle(ring.huddleId, { dmId: ring.dmId }, title);
    } catch (err) {
      toast(err.message || 'Could not join the call', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="alertdialog"
      aria-label="Incoming call"
      data-testid="huddle-ring"
      className="glass-strong fixed inset-x-3 z-[61] flex items-center gap-3 rounded-2xl border px-3 py-3 animate-sheet-in"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)', borderLeft: '3px solid rgb(var(--c-success))' }}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-success/50 text-success">
        <Icon as={Phone} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{ring.startedBy?.username || 'Someone'} is calling</span>
        <span className="block text-xs text-text-2">Voice call · direct message</span>
      </span>
      <Button size="sm" variant="secondary" onClick={dismissRing}>
        Decline
      </Button>
      <Button size="sm" loading={busy} onClick={answer} data-testid="huddle-ring-join">
        Join
      </Button>
    </div>
  );
}

export function HuddleLayer() {
  const live = useSession((s) => s.mode === 'live' && s.status === 'signed-in');
  const workspaceId = useSession((s) => s.workspaceId);
  const on = useFlag('huddles');
  useEffect(() => (live && on ? bindHuddles() : undefined), [live, on]);
  useEffect(() => (live && on ? bindCallExtras() : undefined), [live, on]);
  useEffect(() => {
    if (!live || !on || !workspaceId) return;
    loadLive();
  }, [live, on, workspaceId]);
  // Signing out (or switching huddles off) ends the call.
  useEffect(() => {
    if ((!live || !on) && useHuddle.getState().call) leave();
  }, [live, on]);
  if (!live || !on) return null;
  return (
    <>
      <Ring />
      <CallBar />
      <CaptionStrip />
      <RecordingConsentBanner />
    </>
  );
}
