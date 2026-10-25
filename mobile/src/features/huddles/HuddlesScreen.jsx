// Huddles: every call in the workspace I can open, as one list of meeting records — Live now ·
// Upcoming · Past (scheduled meetings and quick huddles alike; docs/api/meetings-unified.md →
// Lists). Rows open the meeting page. Also the controls a conversation shows (start / join).
import { useEffect, useState } from 'react';
import { CalendarClock, CalendarPlus, Headphones, Phone, Radio } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { nav } from '../../app/nav.js';
import { invalidate, useQuery } from '../../data/query.js';
import { useFlag } from '../../config/flags.js';
import { on, toast } from '../../lib/bus.js';
import { prefs } from '../../native/storage.js';
import { Header, Screen, Body } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, SearchField } from '../../ui/Controls.jsx';
import { Row, RowGroup } from '../../ui/List.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { ScheduleMeetingSheet } from '../meetings/screens.jsx';
import { clashMarker, meetingSubtitle, mergePage, normalizePriority, priorityLabel } from '../meetings/meetingsUi.js';
import { checkConversation, joinHuddle, joinMeetingCall, scopeKey, startHuddle, startWorkspaceHuddle, useHuddle } from './huddle.js';

/** Huddles need a signed-in server session with the flag on. */
export function useHuddlesAvailable() {
  const on = useFlag('huddles');
  const live = useSession((s) => s.mode === 'live');
  return on && live && Boolean(api()?.huddles);
}

const run = async (fn, fail = 'Could not join the huddle') => {
  try {
    await fn();
  } catch (err) {
    toast(err.message || fail, 'danger');
  }
};

export const HUDDLE_LISTS = [
  { value: 'live', label: 'Live now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

const EMPTY = {
  live: { icon: Headphones, title: 'No live huddles', body: 'Start one for the whole workspace, or from a channel or a direct message: tap the headphones at the top.' },
  upcoming: { icon: CalendarClock, title: 'Nothing scheduled', body: 'Schedule a meeting, and find a time that works for everyone.' },
  past: { icon: CalendarClock, title: 'No past meetings', body: 'Meetings and huddles you could join show up here with their notes, summary and action items.' },
};

/** The first page of a list (cached, refreshed by invalidate('meetingpage:')) plus "Load more" pages. */
export function useMeetingPages(ws, status, q) {
  const key = ws && `meetingpage:${ws}:${status}:${q}`;
  const first = useQuery(key, () => api().meetingsPage(ws, { status, q }), { staleMs: 15_000 });
  const [more, setMore] = useState({ key: null, meetings: [], cursor: null, hasMore: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more.key === key ? more : null;
  const meetings = mergePage(first.data?.meetings || [], extra?.meetings || []);
  const hasMore = extra ? extra.hasMore : Boolean(first.data?.hasMore);
  const cursor = extra ? extra.cursor : first.data?.cursor;
  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api().meetingsPage(ws, { status, q, cursor });
      setMore({ key, meetings: [...(extra?.meetings || []), ...page.meetings], cursor: page.cursor, hasMore: page.hasMore });
    } catch (err) {
      toast(err.message || "Couldn't load more", 'danger');
    } finally {
      setLoadingMore(false);
    }
  };
  const refetch = () => {
    setMore({ key: null, meetings: [], cursor: null, hasMore: false });
    return first.refetch();
  };
  return { meetings, hasMore: hasMore && Boolean(cursor), loading: first.loading, error: first.error, loadMore, loadingMore, refetch };
}

function MeetingRow({ m, list }) {
  const call = useHuddle((s) => s.call);
  const inIt = call && (call.meetingId === m.id || (m.huddleId && call.huddleId === m.huddleId));
  const live = m.status === 'live';
  const open = () => nav.push('meeting', { id: m.id, tab: list === 'past' ? 'summary' : 'overview' });
  const clash = list === 'upcoming' ? clashMarker(m) : null;
  const priority = normalizePriority(m.priority);
  const sub = [meetingSubtitle(m), list === 'upcoming' && priority !== 'normal' ? `${priorityLabel(priority)} priority` : null].filter(Boolean).join(' · ');
  const row = (
    <Row
      icon={live ? Radio : m.kind === 'huddle' ? Headphones : CalendarClock}
      tile={live ? 'accent' : 'neutral'}
      title={m.title}
      subtitle={clash ? (
        <>
          {sub}
          <span className="block truncate text-warning" data-testid="meeting-clash">{clash}</span>
        </>
      ) : sub}
      chevron={!live}
      onClick={open}
      className={live ? 'min-w-0 flex-1' : undefined}
    />
  );
  if (!live) return row;
  // A button can't sit inside the row's own button: the join control goes beside it.
  return (
    <div className="flex items-center gap-2 pr-3" data-testid="huddle-live-row">
      {row}
      {inIt ? (
        <span className="shrink-0 text-xs font-medium text-success">You're in it</span>
      ) : (
        <Button size="sm" className="shrink-0" onClick={() => run(() => joinMeetingCall(m))}>
          Join huddle
        </Button>
      )}
    </div>
  );
}

export function HuddlesScreen() {
  const ws = useSession((s) => s.workspaceId);
  const available = useHuddlesAvailable();
  const call = useHuddle((s) => s.call);
  const [list, setList] = useState(() => prefs.get('huddles.list', 'live'));
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [starting, setStarting] = useState(false);
  const pages = useMeetingPages(ws, list, q);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Calls starting and ending anywhere I can see move rows between the lists.
  useEffect(() => {
    let t = null;
    const refresh = () => {
      clearTimeout(t);
      t = setTimeout(() => invalidate('meetingpage:'), 400);
    };
    const offH = on('huddle', ({ event }) => ['huddle:started', 'huddle:ended'].includes(event) && refresh());
    const offM = on('meeting', ({ event }) => event === 'meeting:ended' && refresh());
    const offS = on('socket', ({ event }) => ['schedule:created', 'schedule:updated', 'schedule:deleted', 'schedule:conflicts'].includes(event) && refresh());
    return () => {
      clearTimeout(t);
      offH();
      offM();
      offS();
    };
  }, []);

  const pick = (v) => {
    setList(v);
    prefs.set('huddles.list', v);
  };
  const startOne = async () => {
    setStarting(true);
    await run(() => startWorkspaceHuddle(), "Couldn't start the huddle");
    setStarting(false);
  };
  const empty = EMPTY[list] || EMPTY.live;

  return (
    <Screen>
      <Header
        title="Huddles"
        subtitle="Calls and meetings, live, upcoming and past"
        actions={
          <>
            {available && <IconButton icon={Headphones} label="Start a huddle" disabled={starting || Boolean(call)} onClick={startOne} />}
            <IconButton icon={CalendarPlus} label="Schedule" onClick={() => setScheduling(true)} />
          </>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search meetings and huddles" className="mx-4 mb-2" />
        <Chips options={HUDDLE_LISTS} value={list} onChange={pick} className="pb-3" />
      </Header>
      <Body onRefresh={pages.refetch}>
        <div className="mx-4 mt-1 mb-3 flex gap-2">
          {available && (
            <Button size="sm" icon={Headphones} loading={starting} disabled={Boolean(call)} onClick={startOne}>
              Start a huddle
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => setScheduling(true)}>
            Schedule
          </Button>
        </div>
        {pages.loading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : pages.meetings.length ? (
          <>
            <RowGroup>
              {pages.meetings.map((m) => (
                <MeetingRow key={m.id} m={m} list={list} />
              ))}
            </RowGroup>
            {pages.hasMore && (
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="secondary" loading={pages.loadingMore} onClick={pages.loadMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : pages.error ? (
          <EmptyState icon={CalendarClock} title="Couldn't load meetings" body={pages.error.message || 'Pull down to try again.'} />
        ) : (
          <EmptyState icon={empty.icon} title={q ? 'No matches' : empty.title} body={q ? `Nothing in ${HUDDLE_LISTS.find((l) => l.value === list)?.label.toLowerCase()} matches “${q}”.` : empty.body} />
        )}
      </Body>
      {scheduling && <ScheduleMeetingSheet open onClose={() => setScheduling(false)} />}
    </Screen>
  );
}

/**
 * Header buttons of a channel or DM: start a voice or video huddle, join the live one, or show
 * you're in it.
 */
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
  const label = inHere ? 'In this huddle' : liveHere ? 'Join the huddle' : 'Start a voice huddle';
  return (
    <>
      <IconButton
        icon={Headphones}
        label={label}
        active={Boolean(inHere || liveHere)}
        disabled={connecting || inHere}
        data-testid="conversation-huddle"
        onClick={() => run(() => (liveHere ? joinHuddle(liveHere.huddleId, scope, title) : startHuddle(scope, title)))}
      />
      {/* One huddle button; video is in the ⋮ menu and can be turned on during the call. */}
    </>
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
