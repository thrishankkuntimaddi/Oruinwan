// App-wide huddle chrome: the call screen (full or minimised, CallScreen.jsx), the ring for a DM
// call, "you're in another call" and permission prompts, and "In a call on … · Move here".
// Mounted once in the shell; listens for huddle events while signed in to a server.
import { useEffect, useState } from 'react';
import { ClipboardList, Phone, Video, X } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { useDms, useChannels } from '../../data/hooks.js';
import { useFlag } from '../../config/flags.js';
import { toast } from '../../lib/bus.js';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { openConversation } from '../chats/chatsUi.js';
import { onAppState } from '../../native/index.js';
import { bindHuddles, dismissRing, joinHuddle, leave, loadLive, refreshMine, useHuddle } from './huddle.js';
import { bindCallExtras } from './callExtras.js';
import { CaptionStrip, RecordingConsentBanner } from './CallExtras.jsx';
import { CallView } from './CallScreen.jsx';
import { ElsewherePill, PermissionPrompt, SwitchPrompt } from './CallPrompts.jsx';
import { nav } from '../../app/nav.js';
import { bindRecap, dismissRecap, useRecap } from '../meetings/recap.js';
import { CallEndedNotice, CallTimeBanner } from '../plan/CallLimitNotice.jsx';

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

/** The call screen, titled after its conversation. */
function Call() {
  const call = useHuddle((s) => s.call);
  const title = useCallTitle(call?.scope, call?.title);
  return <CallView title={title} />;
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
      await joinHuddle(ring.huddleId, { dmId: ring.dmId }, title, null, { video: ring.video });
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
        <Icon as={ring.video ? Video : Phone} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{ring.startedBy?.username || 'Someone'} is calling</span>
        <span className="block text-xs text-text-2">{ring.video ? 'Video call' : 'Voice call'} · direct message</span>
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

/** "Meeting ended · View recap" where the person is, after a call they were part of ends. */
export function RecapBanner() {
  const recaps = useRecap((s) => s.recaps);
  const call = useHuddle((s) => s.call);
  if (!recaps.length) return null;
  return (
    <div className="fixed inset-x-3 z-[61] flex flex-col gap-2" style={{ top: `calc(env(safe-area-inset-top) + ${call ? 64 : 8}px)` }}>
      {recaps.map((r) => (
        <div
          key={r.meetingId}
          role="status"
          data-testid="meeting-recap-banner"
          className="glass-strong mx-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border px-3 py-2.5 animate-sheet-in"
          style={{ borderLeft: '3px solid rgb(var(--c-accent))' }}
        >
          <Icon as={ClipboardList} size={18} className="shrink-0 text-accent-ink" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">Meeting ended · View recap</span>
            <span className="block truncate text-xs text-text-2">{r.title}</span>
          </span>
          <Button
            size="sm"
            onClick={() => {
              dismissRecap(r.meetingId);
              nav.push('meeting', { id: r.meetingId, tab: 'summary' });
            }}
          >
            View recap
          </Button>
          <button type="button" aria-label="Dismiss" onClick={() => dismissRecap(r.meetingId)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-3 active:bg-surface-2">
            <Icon as={X} size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function HuddleLayer() {
  const live = useSession((s) => s.mode === 'live' && s.status === 'signed-in');
  const workspaceId = useSession((s) => s.workspaceId);
  const on = useFlag('huddles');
  useEffect(() => (live && on ? bindHuddles() : undefined), [live, on]);
  useEffect(() => (live && on ? bindCallExtras() : undefined), [live, on]);
  useEffect(() => (live ? bindRecap() : undefined), [live]);
  useEffect(() => {
    if (!live || !on || !workspaceId) return;
    loadLive();
  }, [live, on, workspaceId]);
  useEffect(() => {
    if (!live || !on) return undefined;
    let off = () => {};
    let gone = false;
    onAppState((active) => active && refreshMine()).then((fn) => {
      if (gone) fn();
      else off = fn;
    });
    return () => {
      gone = true;
      off();
    };
  }, [live, on]);
  // Signing out (or switching huddles off) ends the call.
  useEffect(() => {
    if ((!live || !on) && useHuddle.getState().call) leave();
  }, [live, on]);
  if (!live || !on) return null;
  return (
    <>
      <Ring />
      <Call />
      <ElsewherePill />
      <SwitchPrompt />
      <PermissionPrompt />
      <RecapBanner />
      <CallTimeBanner />
      <CallEndedNotice />
      <CaptionStrip />
      <RecordingConsentBanner />
    </>
  );
}
