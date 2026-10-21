// Meetings: the list (upcoming and past), scheduling with "Find a time", and a meeting's page
// with its agenda, AI summary, action items (→ tasks), transcript and brainstorm board.
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, CalendarClock, CalendarPlus, Check, ClipboardList, Disc, ExternalLink, FileText, ListTodo, Plus, Sparkles, StickyNote, Trash2, Users, Wand2, X,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { on, toast } from '../../lib/bus.js';
import { openExternal } from '../../native/index.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, Field, Segmented } from '../../ui/Controls.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { PeoplePicker, toDateInput } from '../tasks/TaskEditorSheet.jsx';
import { joinMeeting } from '../huddles/huddle.js';
import { mergeSegments, transcriptText } from '../huddles/callMedia.js';
import { AskMeetingSheet, TranscriptList } from '../huddles/CallExtras.jsx';
import { applyBrainstormEvent, combineDateTime, meetingWhen, STICKY_COLORS } from './meetingsUi.js';

const STATUS_LABEL = { scheduled: 'Scheduled', live: 'Live now', completed: 'Ended', cancelled: 'Cancelled' };

// ---------------------------------------------------------------- schedule

const DURATIONS = [15, 30, 45, 60, 90].map((m) => ({ value: m, label: m < 60 ? `${m} min` : `${m / 60} h`.replace('1.5 h', '1½ h') }));

export function ScheduleMeetingSheet({ open, onClose, channelId }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => toDateInput(new Date().toISOString()));
  const [time, setTime] = useState(() => {
    const d = new Date(Date.now() + 3_600_000);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });
  const [duration, setDuration] = useState(30);
  const [people, setPeople] = useState([]);
  const [picking, setPicking] = useState(false);
  const [link, setLink] = useState('');
  const [slots, setSlots] = useState(null);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);

  const findTime = async () => {
    setFinding(true);
    try {
      const found = await api().suggestTimes({ participantIds: [me, ...people].filter(Boolean), minutes: duration });
      setSlots(found);
      if (!found.length) toast('No free time found. Pick one yourself.', 'warning');
    } catch (err) {
      toast(err.message || "Couldn't find a time", 'danger');
    } finally {
      setFinding(false);
    }
  };
  const pickSlot = (slot) => {
    const d = new Date(slot.start);
    setDate(toDateInput(slot.start));
    setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  const save = async () => {
    const start = combineDateTime(date, time);
    if (!start) return toast('Pick a date and time', 'warning');
    setBusy(true);
    try {
      const m = await api().scheduleMeeting(ws, { title: title.trim(), start, duration, participantIds: people, link: link.trim(), channelId });
      invalidate('meetings', 'meetinglist');
      toast('Meeting scheduled', 'success');
      onClose();
      nav.push('meeting', { id: m.id });
    } catch (err) {
      toast(err.message || "Couldn't schedule the meeting", 'danger');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet open={open} onClose={onClose} title="Schedule a meeting" full footer={<Button block loading={busy} disabled={!title.trim()} onClick={save}>Schedule</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly sync" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Length</p>
          <Segmented size="sm" options={DURATIONS} value={duration} onChange={setDuration} />
        </div>
        <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-input px-3.5 py-3 text-left">
          <Icon as={Users} size="sm" className="text-text-3" />
          <span className="min-w-0 flex-1 truncate text-[15px]">
            {people.length ? people.map((id) => directory[id]?.name || 'Someone').join(', ') : 'Invite people'}
          </span>
        </button>
        <div className="rounded-card border border-line-soft bg-surface p-3">
          <div className="flex items-center gap-3">
            <Icon as={Wand2} size="sm" className="text-accent-ink" />
            <p className="min-w-0 flex-1 text-[14px]">Find a time that works</p>
            <Button size="sm" variant="secondary" loading={finding} onClick={findTime}>
              Find a time
            </Button>
          </div>
          {slots?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {slots.map((s) => {
                const active = combineDateTime(date, time) === new Date(s.start).toISOString();
                return (
                  <button key={s.start} type="button" onClick={() => pickSlot(s)} className={cx('pressable rounded-full border px-3 py-1.5 text-[13px]', active ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface-2')}>
                    {meetingWhen(s.start)}
                  </button>
                );
              })}
            </div>
          )}
          {slots?.[0]?.note && <p className="mt-2 text-xs text-text-3">{slots[0].note}</p>}
        </div>
        <Field label="Call link (optional)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
      </div>
      <PeoplePicker open={picking} onClose={() => setPicking(false)} value={people} onChange={setPeople} title="Invite" />
    </Sheet>
  );
}

// ---------------------------------------------------------------- list

export function MeetingsScreen() {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading, refetch } = useQuery(ws && `meetinglist:${ws}`, () => api().meetingsList(ws));
  const [filter, setFilter] = useState('upcoming');
  const [scheduling, setScheduling] = useState(false);
  const now = Date.now();
  const list = (data || []).filter((m) => {
    const ended = m.status === 'completed' || m.status === 'cancelled' || (m.end && new Date(m.end).getTime() < now);
    return filter === 'upcoming' ? !ended : ended;
  });
  if (filter === 'upcoming') list.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return (
    <Screen>
      <Header title="Meetings" actions={<IconButton icon={CalendarPlus} label="Schedule a meeting" onClick={() => setScheduling(true)} />}>
        <Chips options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} value={filter} onChange={setFilter} className="pb-3" />
      </Header>
      <Body onRefresh={refetch}>
        {loading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : list.length ? (
          <RowGroup className="mt-1">
            {list.map((m) => (
              <Row
                key={m.id}
                icon={CalendarClock}
                tile={m.status === 'live' ? 'accent' : 'neutral'}
                title={m.title}
                subtitle={`${meetingWhen(m.start)} · ${m.duration} min${m.status !== 'scheduled' ? ` · ${STATUS_LABEL[m.status]}` : ''}`}
                onClick={() => nav.push('meeting', { id: m.id })}
              />
            ))}
          </RowGroup>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title={filter === 'upcoming' ? 'Nothing scheduled' : 'No past meetings'}
            body={filter === 'upcoming' ? 'Schedule one, and find a time that works for everyone.' : 'Meetings you were part of show up here with their summaries.'}
            action={filter === 'upcoming' ? { label: 'Schedule a meeting', icon: CalendarPlus, onClick: () => setScheduling(true) } : null}
          />
        )}
      </Body>
      {scheduling && <ScheduleMeetingSheet open onClose={() => setScheduling(false)} />}
    </Screen>
  );
}

// ---------------------------------------------------------------- detail tabs

function AgendaTab({ meeting }) {
  const [items, setItems] = useState(meeting.agenda);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setItems(meeting.agenda), [meeting.agenda]);
  const dirty = JSON.stringify(items) !== JSON.stringify(meeting.agenda);
  const move = (i, d) => setItems((list) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const add = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setItems((list) => [...list, { id: `new-${Date.now()}`, title: draft.trim(), notes: '' }]);
    setDraft('');
  };
  const save = async () => {
    setBusy(true);
    try {
      const updated = await api().saveAgenda(meeting.id, items.filter((i) => i.title.trim()));
      setQueryData(`meeting:${meeting.id}`, updated);
      toast('Agenda saved', 'success');
    } catch (err) {
      toast(err.message || "Couldn't save the agenda", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-1 py-1 pr-1 pl-3">
            <span className="w-5 shrink-0 text-xs tabular-nums text-text-3">{i + 1}</span>
            <input
              value={it.title}
              aria-label={`Agenda item ${i + 1}`}
              onChange={(e) => setItems((list) => list.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
            <IconButton icon={ArrowUp} size="sm" label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
            <IconButton icon={ArrowDown} size="sm" label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
            <IconButton icon={X} size="sm" label="Remove" onClick={() => setItems((list) => list.filter((x) => x.id !== it.id))} />
          </div>
        ))}
        <form onSubmit={add} className="flex items-center gap-2 px-3 py-1.5">
          <Icon as={Plus} size="sm" className="text-text-3" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add an agenda item" aria-label="New agenda item" enterKeyHint="done" className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3" />
        </form>
      </div>
      {dirty && (
        <div className="mx-4 mt-3 flex gap-2.5">
          <Button variant="secondary" block onClick={() => setItems(meeting.agenda)}>
            Discard
          </Button>
          <Button block loading={busy} onClick={save}>
            Save agenda
          </Button>
        </div>
      )}
    </>
  );
}

function SummaryTab({ meeting }) {
  const [busy, setBusy] = useState(false);
  const source = meeting.transcript || meeting.notes;
  const generate = async () => {
    setBusy(true);
    try {
      const summary = await api().summarizeMeeting(meeting.id);
      setQueryData(`meeting:${meeting.id}`, (m) => (m ? { ...m, summary } : m));
    } catch (err) {
      toast(err.message || "Oruinwan AI couldn't summarize this meeting", 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="px-4">
      {meeting.summary ? (
        <div className="rounded-card border border-line-soft bg-surface p-4">
          <Markdown text={meeting.summary} className="text-sm" />
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">
          {source ? 'No summary yet.' : 'A summary needs the meeting’s transcript or shared notes first.'}
        </p>
      )}
      <Button className="mt-3" variant="secondary" icon={Sparkles} loading={busy} disabled={!source} onClick={generate}>
        {meeting.summary ? 'Summarize again' : 'Summarize with AI'}
      </Button>
      {meeting.notes && (
        <Section title="Shared notes" inset={false}>
          <div className="selectable whitespace-pre-wrap rounded-card border border-line-soft bg-surface p-4 text-sm">{meeting.notes}</div>
        </Section>
      )}
    </div>
  );
}

function ActionsTab({ meeting }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const [text, setText] = useState('');
  const [owner, setOwner] = useState([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(null);
  const key = `meeting:${meeting.id}`;

  const run = async (id, fn, fail) => {
    setBusy(id);
    try {
      const updated = await fn();
      if (updated) setQueryData(key, updated);
    } catch (err) {
      toast(err.message || fail, 'danger');
    } finally {
      setBusy(null);
    }
  };
  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    run('new', async () => {
      const m = await api().addActionItem(meeting.id, { text: text.trim(), assigneeId: owner[0] || null });
      setText('');
      setOwner([]);
      return m;
    }, "Couldn't add the action item");
  };
  const toTask = (item) =>
    run(item.id, async () => {
      const { meeting: m } = await api().actionItemToTask(ws, meeting, item, me);
      invalidate('tasks');
      toast('Task created', 'success');
      return m;
    }, "Couldn't create the task");

  return (
    <>
      {meeting.actionItems.length ? (
        <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
          {meeting.actionItems.map((a) => {
            const doneNow = a.status === 'done';
            const who = a.assignee?.id ? directory[a.assignee.id] || a.assignee : null;
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={doneNow}
                  aria-label={`Mark “${a.text}” ${doneNow ? 'not done' : 'done'}`}
                  onClick={() => run(a.id, () => api().updateActionItem(meeting.id, a.id, { status: doneNow ? 'pending' : 'done' }), "Couldn't update it")}
                  className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full border', doneNow ? 'border-success bg-success/15 text-success' : 'border-line text-transparent')}
                >
                  <Icon as={Check} size={15} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-[15px] leading-snug', doneNow && 'text-text-2 line-through')}>{a.text}</p>
                  {who && <p className="mt-0.5 text-[13px] text-text-2">{who.name}</p>}
                </div>
                {a.taskId ? (
                  <Button size="sm" variant="ghost" onClick={() => nav.push('task', { id: a.taskId })}>
                    Open task
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" icon={ListTodo} loading={busy === a.id} onClick={() => toTask(a)}>
                    Task
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mx-4 rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">No action items yet. Add what was agreed, then turn each into a task.</p>
      )}
      <form onSubmit={add} className="mx-4 mt-3 space-y-2">
        <Field value={text} onChange={(e) => setText(e.target.value)} placeholder="New action item" aria-label="New action item" />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" icon={Users} onClick={() => setPicking(true)}>
            {owner[0] ? directory[owner[0]]?.name || 'Owner' : 'Owner'}
          </Button>
          <Button type="submit" size="sm" disabled={!text.trim()} loading={busy === 'new'}>
            Add
          </Button>
        </div>
      </form>
      <PeoplePicker open={picking} onClose={() => setPicking(false)} value={owner} onChange={(ids) => setOwner(ids.slice(-1))} title="Owner" />
    </>
  );
}

function RecordingCard({ meetingId }) {
  const key = `meetingrec:${meetingId}`;
  const target = useMemo(() => ({ kind: 'meeting', id: meetingId }), [meetingId]);
  const { data: rec, loading } = useQuery(key, () => api().callRecording(target), { staleMs: 60_000 });
  useEffect(() => on('meeting', ({ event, payload }) => {
    if (String(payload?.meetingId) !== String(meetingId)) return;
    if (event === 'meeting:recording_ready' || event === 'meeting:recording_deleted') invalidate(key);
  }), [key, meetingId]);
  if (loading || !rec?.url) return null;
  const mins = rec.durationSec ? `${Math.max(1, Math.round(rec.durationSec / 60))} min` : null;
  return (
    <div className="mx-4 mb-3 rounded-card border border-line-soft bg-surface p-3.5" style={{ backgroundImage: 'var(--glass)' }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon as={Disc} size="sm" className="text-danger" />
        <p className="flex-1 text-[14px] font-semibold">Recording</p>
        {mins && <span className="text-[12px] text-text-3">{mins}</span>}
      </div>
      {/* The signed link lasts 10 minutes; reopening the tab fetches a fresh one. */}
      <audio controls preload="none" src={rec.url} className="w-full" aria-label="Meeting recording">
        <track kind="captions" />
      </audio>
    </div>
  );
}

function TranscriptTab({ meeting }) {
  const key = `meetingtranscript:${meeting.id}`;
  const target = useMemo(() => ({ kind: 'meeting', id: meeting.id }), [meeting.id]);
  const { data, loading } = useQuery(key, () => api().callTranscript(target), { staleMs: 15_000 });
  const ws = useSession((s) => s.workspaceId);
  const [asking, setAsking] = useState(false);

  // Lines arrive live while the meeting runs (captions from everyone in the call).
  useEffect(() => on('meeting', ({ event, payload }) => {
    if (event !== 'meeting:transcript_segments' || String(payload?.meetingId) !== String(meeting.id)) return;
    setQueryData(key, (cur) => ({ text: cur?.text || '', segments: mergeSegments(cur?.segments || [], (payload.segments || []).map((s) => api().mapSegment(s))) }));
  }), [key, meeting.id]);

  const segments = data?.segments || [];
  const legacy = !segments.length ? data?.text || meeting.transcript : '';
  const ask = (question) =>
    api().askAboutMeeting({ workspaceId: ws, title: meeting.title, transcript: segments.length ? transcriptText(segments) : legacy || meeting.notes, question });

  return (
    <div>
      <RecordingCard meetingId={meeting.id} />
      {(segments.length > 0 || legacy) && (
        <div className="mx-4 mb-3 flex justify-end">
          <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => setAsking(true)}>
            Ask AI about this meeting
          </Button>
        </div>
      )}
      {loading && !data ? (
        <SkeletonRows count={3} avatar={false} />
      ) : segments.length ? (
        <div className="mx-4 rounded-card border border-line-soft bg-surface p-4">
          <TranscriptList segments={segments} />
        </div>
      ) : legacy ? (
        <div className="selectable mx-4 whitespace-pre-wrap rounded-card border border-line-soft bg-surface p-4 text-[14px] leading-relaxed">{legacy}</div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No transcript yet"
          body="During the call, turn on live captions from the call menu (•••): what people say is written here as they speak."
          className="py-8"
        />
      )}
      <AskMeetingSheet open={asking} onClose={() => setAsking(false)} ask={ask} hint="Answers come from this meeting’s transcript." />
    </div>
  );
}

function BoardTab({ meeting }) {
  const me = useSession((s) => s.user?.id);
  const key = `brainstorm:${meeting.id}`;
  const { data, loading } = useQuery(key, () => api().brainstorm(meeting.id), { staleMs: 5_000 });
  const [text, setText] = useState('');
  const [color, setColor] = useState(STICKY_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => on('meeting', ({ event, payload }) => {
    if (event !== 'brainstorm:update' || String(payload?.meetingId) !== String(meeting.id)) return;
    setQueryData(key, (list) => applyBrainstormEvent(list || [], payload, api().mapSticky));
  }), [key, meeting.id]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const n = (data || []).length;
      const item = await api().addSticky(meeting.id, { text: text.trim(), color, x: 40 + (n % 4) * 180, y: 40 + Math.floor(n / 4) * 140 });
      setQueryData(key, (list) => applyBrainstormEvent(list || [], { action: 'add', item }, (x) => x));
      setText('');
    } catch (err) {
      toast(err.message || "Couldn't add the note", 'danger');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item) => {
    setQueryData(key, (list) => (list || []).filter((x) => x.id !== item.id));
    try {
      await api().deleteSticky(meeting.id, item.id);
    } catch (err) {
      toast(err.message || "Couldn't remove the note", 'danger');
      invalidate(key);
    }
  };

  return (
    <div className="px-4">
      <form onSubmit={add} className="rounded-card border border-line-soft bg-surface p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add an idea" aria-label="New sticky note" className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-text-3" />
        <div className="mt-2 flex items-center gap-2">
          {STICKY_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} className={cx('h-7 w-7 rounded-full border-2', c === color ? 'border-text' : 'border-transparent')} style={{ background: c }} />
          ))}
          <span className="flex-1" />
          <Button size="sm" type="submit" icon={StickyNote} loading={busy} disabled={!text.trim()}>
            Add note
          </Button>
        </div>
      </form>
      {loading ? (
        <SkeletonRows count={2} avatar={false} />
      ) : (data || []).length ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((n) => (
            <div key={n.id} className="relative min-h-28 rounded-xl p-3 pr-8 text-[14px] leading-snug text-[#1d1a14] shadow-sm" style={{ background: n.color }}>
              <p className="selectable whitespace-pre-wrap break-words">{n.text}</p>
              {(n.by === me || !n.by) && (
                <button type="button" aria-label="Remove note" onClick={() => remove(n)} className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full text-[#1d1a14]/70 active:bg-black/10">
                  <Icon as={Trash2} size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={StickyNote} title="An empty board" body="Ideas everyone adds appear here live." className="py-8" />
      )}
    </div>
  );
}

const TABS = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'summary', label: 'Summary' },
  { value: 'actions', label: 'Actions' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'board', label: 'Board' },
];

export function MeetingScreen({ id, tab: initialTab = 'agenda' }) {
  const key = `meeting:${id}`;
  const { data: meeting, loading, refetch } = useQuery(key, () => api().meeting(id), { staleMs: 10_000 });
  const me = useSession((s) => s.user?.id);
  const [tab, setTab] = useState(initialTab);
  const [cancel, setCancel] = useState(false);
  const [joining, setJoining] = useState(false);

  // Live updates while the page is open: the board and the agenda.
  useEffect(() => {
    let joined = false;
    api().joinMeetingRoom?.(id).then((ok) => (joined = ok)).catch(() => {});
    const off = on('meeting', ({ event, payload }) => {
      if (String(payload?.meetingId) !== String(id)) return;
      if (event === 'meeting:agenda_updated' || event === 'meeting:ended') invalidate(key);
    });
    const offReconnect = on('realtime', ({ connected }) => connected && api().joinMeetingRoom?.(id));
    return () => {
      off();
      offReconnect();
      if (joined) api().leaveMeetingRoom?.(id);
    };
  }, [id, key]);

  const people = useMemo(() => meeting?.participants || [], [meeting]);

  if (!meeting) {
    return (
      <Screen>
        <Header title="Meeting" />
        {loading ? <SkeletonRows count={4} avatar={false} /> : <EmptyState icon={CalendarClock} title="Meeting not found" body="It may have been cancelled or deleted." />}
      </Screen>
    );
  }

  const canCancel = meeting.organizer?.id === me && meeting.status === 'scheduled';
  const join = async () => {
    setJoining(true);
    try {
      await joinMeeting(meeting.raw);
    } catch (err) {
      toast(err.message || "Couldn't join the meeting", 'danger');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <Header title={meeting.title} subtitle={STATUS_LABEL[meeting.status]} actions={canCancel ? <IconButton icon={Trash2} label="Cancel meeting" onClick={() => setCancel(true)} /> : null} />
      <Body onRefresh={refetch}>
        <div className="mx-4 rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }}>
          <p className="text-[17px] font-semibold">{meetingWhen(meeting.start)}</p>
          <p className="text-[13px] text-text-2">
            {meeting.duration} min{meeting.organizer ? ` · organised by ${meeting.organizer.name}` : ''}
          </p>
          {people.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="flex -space-x-2">
                {people.slice(0, 6).map((p) => (
                  <span key={p.id} className="rounded-full ring-2 ring-surface">
                    <Avatar name={p.name} src={p.avatarUrl} size="xs" />
                  </span>
                ))}
              </span>
              <span className="text-[13px] text-text-2">{people.length} invited</span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {meeting.status !== 'cancelled' && meeting.status !== 'completed' && (
              <Button size="sm" loading={joining} onClick={join}>
                {meeting.status === 'live' ? 'Join call' : 'Start call'}
              </Button>
            )}
            {meeting.link && (
              <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => openExternal(meeting.link)}>
                Open link
              </Button>
            )}
          </div>
        </div>
        <div className="mx-4 mt-4">
          <Segmented size="sm" options={TABS.map((t) => (t.value === 'actions' ? { ...t, count: meeting.actionItems.filter((a) => a.status !== 'done').length } : t))} value={tab} onChange={setTab} />
        </div>
        <div className="mt-4">
          {tab === 'agenda' && <AgendaTab meeting={meeting} />}
          {tab === 'summary' && <SummaryTab meeting={meeting} />}
          {tab === 'actions' && <ActionsTab meeting={meeting} />}
          {tab === 'transcript' && <TranscriptTab meeting={meeting} />}
          {tab === 'board' && <BoardTab meeting={meeting} />}
        </div>
      </Body>
      <Dialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancel this meeting?"
        body="Everyone invited sees it as cancelled."
        confirmLabel="Cancel meeting"
        danger
        onConfirm={async () => {
          setCancel(false);
          try {
            await api().cancelMeeting(id);
            invalidate(key, 'meetinglist', 'meetings');
            toast('Meeting cancelled');
          } catch (err) {
            toast(err.message || "Couldn't cancel the meeting", 'danger');
          }
        }}
      />
    </Screen>
  );
}

export const MEETINGS_ICON = ClipboardList;
