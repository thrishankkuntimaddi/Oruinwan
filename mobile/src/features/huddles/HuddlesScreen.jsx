// Huddles: what's live now (channels and DMs I'm in), upcoming meetings, and the controls a
// conversation shows (start / join).
import { useEffect, useState } from 'react';
import { CalendarClock, Headphones, Phone, Radio } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { nav } from '../../app/nav.js';
import { useQuery } from '../../data/query.js';
import { useChannels, useDms } from '../../data/hooks.js';
import { useFlag } from '../../config/flags.js';
import { toast } from '../../lib/bus.js';
import { Header, Screen, Body } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { openConversation } from '../chats/chatsUi.js';
import { checkConversation, joinHuddle, joinMeeting, scopeKey, startHuddle, useHuddle } from './huddle.js';

/** Huddles need a signed-in server session with the flag on. */
export function useHuddlesAvailable() {
  const on = useFlag('huddles');
  const live = useSession((s) => s.mode === 'live');
  return on && live && Boolean(api()?.huddles);
}

function whenLabel(iso, duration) {
  const d = new Date(iso);
  const now = Date.now();
  if (d.getTime() <= now && d.getTime() + (duration || 30) * 60000 > now) return 'Now';
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const run = async (fn) => {
  try {
    await fn();
  } catch (err) {
    toast(err.message || 'Could not join the huddle', 'danger');
  }
};

export function HuddlesScreen() {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const live = useHuddle((s) => s.live);
  const call = useHuddle((s) => s.call);
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const meetings = useQuery(ws && `meetings:${ws}`, () => api().huddles.meetings(ws));

  const liveRows = Object.entries(live).map(([key, h]) => {
    const channel = (channels || []).find((c) => c.id === key);
    const dm = channel ? null : (dms || []).find((d) => d.id === key);
    if (!channel && !dm) return null;
    const scope = channel ? { channelId: key } : { dmId: key };
    const title = channel ? `# ${channel.name}` : `Call with ${dm.user?.name || 'someone'}`;
    const people = h.participants?.length || 0;
    return { key, h, scope, title, sub: people ? `${people} in it · started by ${h.startedBy?.username || 'someone'}` : `Started by ${h.startedBy?.username || 'someone'}` };
  }).filter(Boolean);

  const upcoming = (meetings.data || []).filter((m) => {
    const invited = (m.participants || []).map((p) => String(p?._id || p));
    return !invited.length || invited.includes(me) || String(m.createdBy?._id || m.createdBy) === me;
  });

  return (
    <Screen>
      <Header title="Huddles" subtitle="Voice calls in your channels and DMs" />
      <Body onRefresh={meetings.refetch}>
        <Section title="Live now">
          {liveRows.length ? (
            <RowGroup>
              {liveRows.map((r) => (
                <Row
                  key={r.key}
                  icon={Radio}
                  tile="accent"
                  title={r.title}
                  subtitle={r.sub}
                  chevron={false}
                  trailing={
                    call?.huddleId === r.h.huddleId ? (
                      <span className="text-xs font-medium text-success">You're in it</span>
                    ) : (
                      <Button size="sm" onClick={() => run(async () => {
                        if (r.scope.channelId) openConversation('channel', r.scope.channelId);
                        else openConversation('dm', r.scope.dmId);
                        await joinHuddle(r.h.huddleId, r.scope, r.title);
                      })}>
                        Join
                      </Button>
                    )
                  }
                />
              ))}
            </RowGroup>
          ) : (
            <EmptyState icon={Headphones} title="No live huddles" body="Start one from a channel or a direct message: tap the headphones at the top." className="py-8" />
          )}
        </Section>
        <Section title="Coming up">
          {meetings.loading && !meetings.data ? (
            <SkeletonRows count={2} avatar={false} />
          ) : upcoming.length ? (
            <RowGroup>
              {upcoming.map((m) => (
                <div key={m._id} className="flex items-center gap-2 pr-3">
                  <button type="button" onClick={() => nav.push('meeting', { id: m._id })} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-text-2">
                      <Icon as={CalendarClock} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{m.title}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-text-2">{`${whenLabel(m.startTime, m.duration)} · ${m.duration || 30} min${m.status === 'live' ? ' · live' : ''}`}</span>
                    </span>
                  </button>
                  <Button size="sm" variant={m.status === 'live' ? 'primary' : 'secondary'} onClick={() => run(() => joinMeeting(m))}>
                    {m.status === 'live' ? 'Join' : 'Start'}
                  </Button>
                </div>
              ))}
            </RowGroup>
          ) : (
            <EmptyState icon={CalendarClock} title="Nothing scheduled" body="Meetings you're invited to show up here." className="py-8" />
          )}
        </Section>
        <Section>
          <RowGroup>
            <Row icon={CalendarClock} tile="accent" title="All meetings" subtitle="Agendas, summaries, action items and boards" onClick={() => nav.push('meetings')} />
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

/** Header button of a channel or DM: start a huddle, join the live one, or show you're in it. */
export function HuddleButton({ scope, title }) {
  const available = useHuddlesAvailable();
  const key = scopeKey(scope);
  const liveHere = useHuddle((s) => s.live[key]);
  const call = useHuddle((s) => s.call);
  const connecting = useHuddle((s) => s.connecting);
  useEffect(() => {
    if (available) checkConversation(scope).catch(() => {});
  }, [available, key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!available) return null;
  const inHere = call && scopeKey(call.scope) === key;
  const label = inHere ? 'In this huddle' : liveHere ? 'Join the huddle' : 'Start a huddle';
  return (
    <IconButton
      icon={Headphones}
      label={label}
      active={Boolean(inHere || liveHere)}
      disabled={connecting || inHere}
      data-testid="conversation-huddle"
      onClick={() => run(() => (liveHere ? joinHuddle(liveHere.huddleId, scope, title) : startHuddle(scope, title)))}
    />
  );
}

/** "Sam started a huddle · Join" above a conversation's messages. */
export function HuddleBanner({ scope, title }) {
  const available = useHuddlesAvailable();
  const key = scopeKey(scope);
  const liveHere = useHuddle((s) => s.live[key]);
  const call = useHuddle((s) => s.call);
  const [busy, setBusy] = useState(false);
  if (!available || !liveHere || (call && call.huddleId === liveHere.huddleId)) return null;
  const people = liveHere.participants?.length || 0;
  return (
    <div data-testid="conversation-huddle-banner" className="mx-3 mt-2 flex shrink-0 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2" style={{ borderLeft: '3px solid rgb(var(--c-success))' }}>
      <Icon as={Phone} size={16} className="shrink-0 text-success" />
      <span className="min-w-0 flex-1 truncate text-[14px]">
        <strong className="font-semibold">{liveHere.startedBy?.username || 'Someone'}</strong> started a huddle{people ? ` · ${people} in it` : ''}
      </span>
      <Button size="sm" loading={busy} onClick={async () => {
        setBusy(true);
        await run(() => joinHuddle(liveHere.huddleId, scope, title));
        setBusy(false);
      }}>
        Join
      </Button>
    </div>
  );
}
