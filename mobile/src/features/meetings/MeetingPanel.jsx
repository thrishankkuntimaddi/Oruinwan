// One meeting's page, the same before, during and after its call (docs/api/meetings-unified.md):
// Overview · Agenda · Notes · Transcript · Summary & actions · Whiteboard · Brainstorm — the same
// tabs, names and order as the web. Used by the meeting screen and by the in-call Meeting panel.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, CalendarClock, Captions, Check, Disc, Eraser, ExternalLink, FileText, ListTodo, Lock, Pen, Pencil,
  Phone, PhoneOff, Plus, Radio, Sparkles, StickyNote, Trash2, Users, Wand2, X,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { on, toast } from '../../lib/bus.js';
import { openExternal } from '../../native/index.js';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field, Segmented } from '../../ui/Controls.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { sanitizeHtml } from '../../ui/sanitize.js';
import { useLiveDocument } from '../../lib/collab/useCollab.js';
import { useNoteBinding } from '../../lib/collab/useEditorBinding.js';
import { collabView } from '../../lib/collab/state.js';
import { CollabBanner, PresenceAvatars } from '../../lib/collab/CollabUi.jsx';
import { LOCAL_ORIGIN } from '../../lib/collab/TextareaBinding.js';
import { PeoplePicker, fromDateInput, toDateInput } from '../tasks/TaskEditorSheet.jsx';
import { endForEveryone, joinMeetingCall, useHuddle } from '../huddles/huddle.js';
import { mergeSegments, transcriptText } from '../huddles/callMedia.js';
import { toggleCallCaptions, useCallExtras } from '../huddles/callExtras.js';
import { AskMeetingSheet, TranscriptList, useActiveRecorder } from '../huddles/CallExtras.jsx';
import {
  BOARD_H, BOARD_W, MEETING_TABS, STATUS_LABEL, STICKY_COLORS, applyBrainstormEvent, conversationLabel, durationLabel, isAccessError,
  meetingWhen, newStrokeId, roundPoint, strokeHit, summaryText,
} from './meetingsUi.js';

export const meetingKey = (id) => `meeting:${id}`;

/**
 * The meeting record, kept current while it is shown: joins the meeting's room and applies its
 * events (action items, summary, note, agenda, ended, recording).
 */
export function useMeetingLive(id) {
  const key = meetingKey(id);
  const q = useQuery(id && key, () => api().meeting(id), { staleMs: 10_000 });
  useEffect(() => {
    if (!id) return undefined;
    let joined = false;
    const join = () => api().joinMeetingRoom?.(id).then((ok) => (joined = ok)).catch(() => {});
    join();
    const patch = (fn) => setQueryData(key, (m) => (m ? fn(m) : m));
    const off = on('meeting', ({ event, payload }) => {
      if (String(payload?.meetingId) !== String(id)) return;
      if (event === 'meeting:action_items_updated' && Array.isArray(payload.actionItems)) {
        patch((m) => ({ ...m, actionItems: payload.actionItems.map(api().mapActionItem) }));
      } else if (event === 'meeting:summary_updated') {
        patch((m) => ({ ...m, summary: api().mapSummary(payload.summary) }));
      } else if (event === 'meeting:note_ready' && payload.noteId) {
        patch((m) => ({ ...m, noteId: String(payload.noteId) }));
      } else if (['meeting:agenda_updated', 'meeting:ended', 'meeting:recording_ready', 'meeting:recording_deleted'].includes(event)) {
        invalidate(key);
      }
    });
    const offReconnect = on('realtime', ({ connected }) => connected && join());
    return () => {
      off();
      offReconnect();
      if (joined) api().leaveMeetingRoom?.(id);
    };
  }, [id, key]);
  return q;
}

/** "You don't have access to this meeting" / not found / loading. */
export function MeetingUnavailable({ error, loading }) {
  if (loading) return <SkeletonRows count={4} avatar={false} />;
  if (isAccessError(error)) {
    return (
      <EmptyState
        icon={Lock}
        title="You don't have access to this meeting"
        body="Meetings in a channel or a direct message are open to its members, the organiser and the people invited."
      />
    );
  }
  return <EmptyState icon={CalendarClock} title="Meeting not found" body="It may have been cancelled or deleted." />;
}

export function MeetingTabBar({ meeting, tab, onChange, className }) {
  const open = (meeting?.actionItems || []).filter((a) => !a.done).length;
  const options = MEETING_TABS.map((t) => (t.value === 'summary' && open ? { ...t, count: open } : t));
  return <Segmented scroll size="sm" label="Meeting" options={options} value={tab} onChange={onChange} className={className} />;
}

export function MeetingTabContent({ meeting, tab, inCall = false }) {
  switch (tab) {
    case 'agenda':
      return <AgendaTab meeting={meeting} />;
    case 'notes':
      return <NotesTab meeting={meeting} />;
    case 'transcript':
      return <TranscriptTab meeting={meeting} inCall={inCall} />;
    case 'summary':
      return <SummaryActionsTab meeting={meeting} />;
    case 'whiteboard':
      return <WhiteboardTab meeting={meeting} />;
    case 'brainstorm':
      return <BrainstormTab meeting={meeting} />;
    default:
      return <OverviewTab meeting={meeting} inCall={inCall} />;
  }
}

// ---------------------------------------------------------------- overview

function Fact({ label, children }) {
  if (!children) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="shrink-0 text-[13px] text-text-2">{label}</span>
      <span className="min-w-0 text-right text-[14px]">{children}</span>
    </div>
  );
}

const fullDate = (iso) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);

/** Join huddle / Start huddle / End for everyone, for anyone who may open the meeting. */
export function MeetingCallActions({ meeting, size = 'sm' }) {
  const call = useHuddle((s) => s.call);
  const [busy, setBusy] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const inThisCall = Boolean(call && (call.meetingId === meeting.id || (meeting.huddleId && call.huddleId === meeting.huddleId)));
  const live = meeting.status === 'live';
  // An ad-hoc huddle's call is over once it ends; a scheduled meeting can be held again.
  const canJoin = !inThisCall && meeting.status !== 'cancelled' && !(meeting.kind === 'huddle' && !live);
  const run = async (what, fn, fail) => {
    setBusy(what);
    try {
      await fn();
    } catch (err) {
      toast(err.message || fail, 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {inThisCall && (
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-success/40 bg-success/12 px-3 text-[13px] font-medium text-success">
          <Icon as={Radio} size={14} /> You're in this call
        </span>
      )}
      {canJoin && (
        <Button size={size} icon={Phone} loading={busy === 'join'} onClick={() => run('join', () => joinMeetingCall(meeting), "Couldn't join the huddle")}>
          {live ? 'Join huddle' : 'Start huddle'}
        </Button>
      )}
      {live && (
        <Button size={size} variant="danger" icon={PhoneOff} loading={busy === 'end'} onClick={() => setConfirmEnd(true)}>
          End for everyone
        </Button>
      )}
      {meeting.link && (
        <Button size={size} variant="secondary" icon={ExternalLink} onClick={() => openExternal(meeting.link)}>
          Open link
        </Button>
      )}
      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End the call for everyone?"
        body="Everyone is removed from the call. Notes, the transcript and action items stay on the meeting page."
        confirmLabel="End for everyone"
        danger
        onConfirm={() => {
          setConfirmEnd(false);
          run('end', async () => {
            const ended = await endForEveryone(meeting.id);
            if (ended) setQueryData(meetingKey(meeting.id), ended);
            invalidate('meetings:', 'meetingpage:');
          }, "Couldn't end the meeting");
        }}
      />
    </div>
  );
}

function OverviewTab({ meeting, inCall }) {
  const directory = useDirectory();
  const recorder = useActiveRecorder();
  const people = meeting.participants.length
    ? meeting.participants
    : [...new Set([...meeting.participantIds, ...meeting.invitees])].map((id) => directory[id] || { id, name: 'Someone' });
  const joined = meeting.attendees.length;
  const scheduled = meeting.kind === 'scheduled';
  const recordingNow = inCall && recorder;
  return (
    <div className="px-4">
      <div className="rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
              meeting.status === 'live' ? 'bg-success/12 text-success' : meeting.status === 'cancelled' ? 'bg-danger/12 text-danger' : 'bg-surface-3 text-text-2',
            )}
            data-testid="meeting-status"
          >
            {meeting.status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />}
            {STATUS_LABEL[meeting.status] || meeting.status}
          </span>
          <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[12px] text-text-2">{scheduled ? 'Scheduled meeting' : 'Huddle'}</span>
          {(recordingNow || meeting.hasRecording) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/12 px-2.5 py-0.5 text-[12px] font-semibold text-danger" data-testid="meeting-recording-badge">
              <Icon as={Disc} size={12} /> {recordingNow ? 'Recording' : 'Recorded'}
            </span>
          )}
        </div>
        <p className="mt-3 text-[17px] font-semibold">{scheduled ? meetingWhen(meeting.start, meeting.duration) : fullDate(meeting.startedAt) || 'Not started'}</p>
        <div className="mt-2 divide-y divide-line-soft">
          {scheduled && <Fact label="Planned">{`${meeting.duration} min`}</Fact>}
          <Fact label="Started">{fullDate(meeting.startedAt)}</Fact>
          <Fact label="Ended">{meeting.status === 'completed' ? fullDate(meeting.endedAt) : null}</Fact>
          <Fact label="Length">{meeting.status === 'completed' ? durationLabel(meeting.durationSec) : null}</Fact>
          <Fact label="Conversation">{conversationLabel(meeting.conversation)}</Fact>
          <Fact label={scheduled ? 'Organiser' : 'Started by'}>{meeting.organizer?.name}</Fact>
        </div>
        <div className="mt-4">
          <MeetingCallActions meeting={meeting} />
        </div>
      </div>
      <Section title={joined ? `People · ${joined} joined` : 'People'} inset={false}>
        {people.length ? (
          <div className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {people.map((p) => {
              const came = meeting.attendees.some((a) => a.id === p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{p.name}</span>
                  {p.id === meeting.organizer?.id && <span className="text-[12px] text-text-3">{scheduled ? 'Organiser' : 'Started it'}</span>}
                  {came && p.id !== meeting.organizer?.id && <span className="text-[12px] text-text-3">Joined</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">Nobody yet. People who join the call show up here.</p>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- agenda

function AgendaTab({ meeting }) {
  const [items, setItems] = useState(meeting.agenda);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setItems(meeting.agenda), [meeting.agenda]);
  const dirty = JSON.stringify(items) !== JSON.stringify(meeting.agenda);
  const move = (i, d) =>
    setItems((list) => {
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
      setQueryData(meetingKey(meeting.id), (m) => (m ? { ...m, agenda: updated.agenda } : updated));
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

// ---------------------------------------------------------------- notes

/** The meeting's one note, edited live with everyone (collab docType "note"). */
function NotesTab({ meeting }) {
  const [noteId, setNoteId] = useState(meeting.noteId);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    // Always ask: it creates the note the first time and adds me to it.
    api()
      .meetingNote(meeting.id)
      .then((id) => {
        if (!alive || !id) return;
        setNoteId(id);
        setQueryData(meetingKey(meeting.id), (m) => (m && m.noteId !== id ? { ...m, noteId: id } : m));
      })
      .catch((err) => alive && setError(err));
    return () => {
      alive = false;
    };
  }, [meeting.id]);
  if (!noteId) {
    if (error) return <EmptyState icon={FileText} title="Notes aren't available" body={error.message || "Couldn't open this meeting's notes."} className="py-8" />;
    return <SkeletonRows count={3} avatar={false} />;
  }
  return <MeetingNoteEditor noteId={noteId} />;
}

function MeetingNoteEditor({ noteId }) {
  const editorRef = useRef(null);
  const loaded = useRef(false);
  const timer = useRef(null);
  const [saving, setSaving] = useState(false);
  const { state: collab, doc, peers } = useLiveDocument('note', noteId);
  const live = collab.mode !== 'rest';
  const view = collabView(collab, { kind: 'note' });
  const binding = useNoteBinding(doc, live && collab.everSynced, editorRef);
  // Without live editing (an older server) the note loads and saves over REST.
  const { data: note } = useQuery(!live && `note:${noteId}`, () => api().note(noteId), { staleMs: 0 });
  useEffect(() => {
    if (live || !note || loaded.current || !editorRef.current) return;
    loaded.current = true;
    editorRef.current.innerHTML = sanitizeHtml(note.content || '');
  }, [live, note]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const edited = () => {
    if (binding.current) return binding.current.input();
    if (live) return undefined;
    clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => {
      try {
        await api().updateNote(noteId, { content: sanitizeHtml(editorRef.current?.innerHTML || '') });
      } catch (err) {
        toast(err.message || "Couldn't save the notes", 'danger');
      } finally {
        setSaving(false);
      }
    }, 800);
    return undefined;
  };
  const editable = live ? view.editable : true;
  const status = live ? view.subtitle : saving ? 'Saving…' : 'Saved';

  return (
    <div className="px-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-[13px] text-text-2" data-testid="meeting-notes-status">
          {status || ''}
          {live && collab.mode === 'live' && !view.subtitle?.includes('View') ? ' · everyone in this meeting can edit' : ''}
        </p>
        <PresenceAvatars peers={peers} />
        <Button size="sm" variant="ghost" onClick={() => nav.push('note', { id: noteId })}>
          Open in Notes
        </Button>
      </div>
      <CollabBanner text={view.banner} tone={collab.mode === 'closed' ? 'locked' : 'offline'} className="mt-0 mb-3" />
      <div
        ref={editorRef}
        contentEditable={editable}
        suppressContentEditableWarning
        onInput={edited}
        onCompositionStart={() => binding.current?.compositionStart()}
        onCompositionEnd={() => binding.current?.compositionEnd()}
        data-placeholder="Take notes together: decisions, questions, next steps…"
        data-testid="meeting-notes-editor"
        className="prose-oru editor-empty selectable min-h-[40vh] rounded-card border border-line-soft bg-surface p-4 outline-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------- transcript

function RecordingCard({ meetingId }) {
  const key = `meetingrec:${meetingId}`;
  const target = useMemo(() => ({ kind: 'meeting', id: meetingId }), [meetingId]);
  const { data: rec, loading } = useQuery(key, () => api().callRecording(target), { staleMs: 60_000 });
  useEffect(
    () =>
      on('meeting', ({ event, payload }) => {
        if (String(payload?.meetingId) !== String(meetingId)) return;
        if (event === 'meeting:recording_ready' || event === 'meeting:recording_deleted') invalidate(key);
      }),
    [key, meetingId],
  );
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

function TranscriptTab({ meeting, inCall }) {
  const key = `meetingtranscript:${meeting.id}`;
  const target = useMemo(() => ({ kind: 'meeting', id: meeting.id }), [meeting.id]);
  const { data, loading } = useQuery(key, () => api().callTranscript(target), { staleMs: 15_000 });
  const ws = useSession((s) => s.workspaceId);
  const captions = useCallExtras((s) => s.showCaptions);
  const [asking, setAsking] = useState(false);

  // Lines arrive live while the call runs (captions from everyone in it).
  useEffect(
    () =>
      on('meeting', ({ event, payload }) => {
        if (event !== 'meeting:transcript_segments' || String(payload?.meetingId) !== String(meeting.id)) return;
        setQueryData(key, (cur) => ({ text: cur?.text || '', segments: mergeSegments(cur?.segments || [], (payload.segments || []).map((s) => api().mapSegment(s))) }));
      }),
    [key, meeting.id],
  );

  const segments = data?.segments || [];
  const legacy = !segments.length ? data?.text || meeting.transcript : '';
  const ask = (question) =>
    api().askAboutMeeting({ workspaceId: ws, title: meeting.title, transcript: segments.length ? transcriptText(segments) : legacy || meeting.notes, question });

  return (
    <div>
      <RecordingCard meetingId={meeting.id} />
      <div className="mx-4 mb-3 flex flex-wrap justify-end gap-2">
        {inCall && (
          <Button size="sm" variant={captions ? 'primary' : 'secondary'} icon={Captions} onClick={toggleCallCaptions}>
            {captions ? 'Turn off live captions' : 'Turn on live captions'}
          </Button>
        )}
        {(segments.length > 0 || legacy) && (
          <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => setAsking(true)}>
            Ask AI about this meeting
          </Button>
        )}
      </div>
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
          body="During the call, turn on live captions: what people say is written here as they speak."
          className="py-8"
        />
      )}
      <AskMeetingSheet open={asking} onClose={() => setAsking(false)} ask={ask} hint="Answers come from this meeting’s transcript." />
    </div>
  );
}

// ---------------------------------------------------------------- summary & actions

const SUMMARY_SOURCE = { ai: 'Oruinwan AI summary', manual: 'Edited by hand', 'wrap-up': 'Posted from the huddle wrap-up' };

function SummaryCard({ meeting }) {
  const key = meetingKey(meeting.id);
  const text = summaryText(meeting.summary);
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const generate = async () => {
    setBusy('ai');
    try {
      const { summary, source } = await api().summarizeMeeting(meeting.id);
      if (source === 'none' && !summary) toast('Nothing to summarize yet: add notes, an agenda or turn on captions in the call.', 'warning');
      setQueryData(key, (m) => (m ? { ...m, summary } : m));
    } catch (err) {
      toast(err.message || "Oruinwan AI couldn't summarize this meeting", 'danger');
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    try {
      const summary = await api().saveSummary(meeting.id, draft.trim());
      setQueryData(key, (m) => (m ? { ...m, summary } : m));
      setEditing(false);
    } catch (err) {
      toast(err.message || "Couldn't save the summary", 'danger');
    } finally {
      setBusy(null);
    }
  };
  const s = meeting.summary && typeof meeting.summary === 'object' ? meeting.summary : null;
  const meta = [s?.source && SUMMARY_SOURCE[s.source], s?.generatedAt && new Date(s.generatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })].filter(Boolean).join(' · ');
  return (
    <div>
      {editing ? (
        <div className="rounded-card border border-line-soft bg-surface p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            aria-label="Summary"
            placeholder="What was decided, and what happens next"
            className="w-full resize-y bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-text-3"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={busy === 'save'} disabled={!draft.trim()} onClick={save}>
              Save summary
            </Button>
          </div>
        </div>
      ) : text ? (
        <div className="rounded-card border border-line-soft bg-surface p-4" style={{ backgroundImage: 'var(--glass)' }} data-testid="meeting-summary">
          <Markdown text={text} className="text-sm" />
          {meta && <p className="mt-3 text-[12px] text-text-3">{meta}</p>}
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">
          No summary yet. Oruinwan AI writes one from the transcript, the notes and the agenda.
        </p>
      )}
      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Sparkles} loading={busy === 'ai'} onClick={generate}>
            {text ? 'Summarize again' : 'Summarize with AI'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Pencil}
            onClick={() => {
              setDraft(text);
              setEditing(true);
            }}
          >
            {text ? 'Edit' : 'Write one'}
          </Button>
        </div>
      )}
    </div>
  );
}

function dueLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const late = d.getTime() < Date.now() - 86_400_000;
  return { text: `Due ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`, late };
}

/** Edit one action item: text, owner, due date; turn it into a task; delete it. */
function ActionItemSheet({ meeting, item, onClose, onSaved }) {
  const directory = useDirectory();
  const [text, setText] = useState(item.text);
  const [owner, setOwner] = useState(item.assigneeId ? [item.assigneeId] : []);
  const [due, setDue] = useState(toDateInput(item.dueDate));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(null);
  const run = async (what, fn, fail) => {
    setBusy(what);
    try {
      await fn();
      onClose();
    } catch (err) {
      toast(err.message || fail, 'danger');
    } finally {
      setBusy(null);
    }
  };
  const save = () =>
    run('save', async () => {
      const patch = {};
      if (text.trim() !== item.text) patch.text = text.trim();
      if ((owner[0] || null) !== (item.assigneeId || null)) patch.assigneeId = owner[0] || null;
      if (due !== toDateInput(item.dueDate)) patch.dueDate = fromDateInput(due);
      if (Object.keys(patch).length) onSaved(await api().updateActionItem(meeting.id, item.id, patch));
    }, "Couldn't save the action item");
  return (
    <Sheet
      open
      onClose={onClose}
      title="Action item"
      footer={
        <Button block loading={busy === 'save'} disabled={!text.trim()} onClick={save}>
          Save
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <Field label="What" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-input px-3.5 py-3 text-left">
          <Icon as={Users} size="sm" className="text-text-3" />
          <span className="min-w-0 flex-1 truncate text-[15px]">{owner[0] ? directory[owner[0]]?.name || item.assignee?.name || 'Someone' : 'Assign to someone'}</span>
          {owner[0] && (
            <span role="button" tabIndex={0} aria-label="Unassign" onClick={(e) => { e.stopPropagation(); setOwner([]); }} onKeyDown={() => {}} className="text-text-3">
              <Icon as={X} size="sm" />
            </span>
          )}
        </button>
        <Field label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {item.taskId ? (
            <Button size="sm" variant="secondary" icon={ListTodo} onClick={() => { onClose(); nav.push('task', { id: item.taskId }); }}>
              Open task
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={ListTodo}
              loading={busy === 'task'}
              onClick={() => run('task', async () => {
                const { actionItems } = await api().convertActionItem(meeting.id, item.id);
                onSaved(actionItems);
                invalidate('tasks');
                toast('Task created', 'success');
              }, "Couldn't create the task")}
            >
              Convert to task
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            className="text-danger"
            loading={busy === 'delete'}
            onClick={() => run('delete', async () => onSaved(await api().deleteActionItem(meeting.id, item.id)), "Couldn't delete it")}
          >
            Delete
          </Button>
        </div>
      </div>
      <PeoplePicker open={picking} onClose={() => setPicking(false)} value={owner} onChange={(ids) => setOwner(ids.slice(-1))} title="Assign to" />
    </Sheet>
  );
}

export function ActionItemsList({ meeting }) {
  const directory = useDirectory();
  const key = meetingKey(meeting.id);
  const [text, setText] = useState('');
  const [owner, setOwner] = useState([]);
  const [due, setDue] = useState('');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(null);
  const [editing, setEditing] = useState(null);
  const setItems = (actionItems) => actionItems && setQueryData(key, (m) => (m ? { ...m, actionItems } : m));

  const run = async (id, fn, fail) => {
    setBusy(id);
    try {
      setItems(await fn());
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
      const items = await api().addActionItem(meeting.id, { text: text.trim(), assigneeId: owner[0] || null, dueDate: fromDateInput(due) });
      setText('');
      setOwner([]);
      setDue('');
      return items;
    }, "Couldn't add the action item");
  };
  const toggle = (a) => {
    // Optimistic: the box flips at once.
    setItems(meeting.actionItems.map((x) => (x.id === a.id ? { ...x, done: !a.done, status: a.done ? 'pending' : 'done' } : x)));
    run(a.id, () => api().toggleActionItem(meeting.id, a.id), "Couldn't update it");
  };
  const convert = (a) =>
    run(a.id, async () => {
      const { actionItems } = await api().convertActionItem(meeting.id, a.id);
      invalidate('tasks');
      toast('Task created', 'success');
      return actionItems;
    }, "Couldn't create the task");
  const extract = () =>
    run('extract', async () => {
      const { added, actionItems } = await api().extractActionItems(meeting.id);
      toast(added ? `Found ${added} action item${added === 1 ? '' : 's'}` : 'No new action items found', added ? 'success' : 'neutral');
      return actionItems.length ? actionItems : null;
    }, "Couldn't look for action items");

  const items = meeting.actionItems;
  return (
    <div>
      {items.length ? (
        <div className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft" data-testid="action-items">
          {items.map((a) => {
            const who = a.assigneeId ? directory[a.assigneeId] || a.assignee : null;
            const dueAt = dueLabel(a.dueDate);
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={a.done}
                  aria-label={`Mark “${a.text}” ${a.done ? 'not done' : 'done'}`}
                  onClick={() => toggle(a)}
                  className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full border', a.done ? 'border-success bg-success/15 text-success' : 'border-line text-transparent')}
                >
                  <Icon as={Check} size={15} />
                </button>
                <button type="button" onClick={() => setEditing(a)} className="min-w-0 flex-1 text-left" aria-label={`Edit “${a.text}”`}>
                  <p className={cx('text-[15px] leading-snug', a.done && 'text-text-2 line-through')}>{a.text}</p>
                  {(who || dueAt) && (
                    <p className="mt-0.5 text-[13px] text-text-2">
                      {who?.name}
                      {who && dueAt ? ' · ' : ''}
                      {dueAt && <span className={cx(dueAt.late && !a.done && 'text-danger')}>{dueAt.text}</span>}
                    </p>
                  )}
                </button>
                {a.taskId ? (
                  <Button size="sm" variant="ghost" onClick={() => nav.push('task', { id: a.taskId })}>
                    Open task
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" icon={ListTodo} loading={busy === a.id} onClick={() => convert(a)} aria-label={`Convert “${a.text}” to a task`}>
                    Task
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-text-2">No action items yet. Add what was agreed, then turn each into a task.</p>
      )}
      <form onSubmit={add} className="mt-3 space-y-2">
        <Field value={text} onChange={(e) => setText(e.target.value)} placeholder="New action item" aria-label="New action item" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" icon={Users} onClick={() => setPicking(true)}>
            {owner[0] ? directory[owner[0]]?.name || 'Owner' : 'Owner'}
          </Button>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="h-9 rounded-xl border border-line bg-input px-2.5 text-[13px] text-text" />
          <span className="flex-1" />
          <Button type="submit" size="sm" disabled={!text.trim()} loading={busy === 'new'}>
            Add
          </Button>
        </div>
      </form>
      <Button className="mt-3" size="sm" variant="ghost" icon={Wand2} loading={busy === 'extract'} onClick={extract}>
        Find action items in the transcript
      </Button>
      <PeoplePicker open={picking} onClose={() => setPicking(false)} value={owner} onChange={(ids) => setOwner(ids.slice(-1))} title="Owner" />
      {editing && <ActionItemSheet meeting={meeting} item={editing} onClose={() => setEditing(null)} onSaved={setItems} />}
    </div>
  );
}

function SummaryActionsTab({ meeting }) {
  return (
    <div className="px-4">
      <SummaryCard meeting={meeting} />
      <Section title="Action items" inset={false}>
        <ActionItemsList meeting={meeting} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- whiteboard

// The board keeps one dark surface in both themes (strokes are drawn for it, as on the web).
const BOARD_BG = '#1b1b1d';
const PEN_COLORS = ['#FFFFFF', '#f5c46b', '#f39a6b', '#F87171', '#8fd1ad', '#9cc4fe', '#000000'];

function drawStrokes(canvas, strokes) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of strokes) {
    if (!s?.points?.length) continue;
    ctx.beginPath();
    ctx.strokeStyle = s.tool === 'eraser' ? BOARD_BG : s.color || '#FFFFFF';
    ctx.lineWidth = s.tool === 'eraser' ? (s.lineWidth || 3) * 4 : s.lineWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y);
    ctx.stroke();
  }
}

function WhiteboardTab({ meeting }) {
  const canvasRef = useRef(null);
  const { state: collab, doc, peers } = useLiveDocument('whiteboard', meeting.id);
  const live = collab.mode !== 'rest';
  const view = collabView(collab, { kind: 'note' });
  const readOnly = live && !view.editable;
  const [strokes, setStrokes] = useState([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const current = useRef(null);

  // Without live editing: the saved strokes over REST.
  useEffect(() => {
    if (live) return undefined;
    let alive = true;
    api().whiteboard(meeting.id).then((list) => alive && setStrokes(list)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [live, meeting.id]);

  // Live: the shared stroke list is the board.
  useEffect(() => {
    if (!live || !doc || !collab.everSynced) return undefined;
    const y = doc.getArray('strokes');
    const pull = () => setStrokes(y.toArray());
    pull();
    y.observe(pull);
    return () => y.unobserve(pull);
  }, [live, doc, collab.everSynced]);

  useEffect(() => drawStrokes(canvasRef.current, strokes), [strokes]);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return roundPoint({ x: ((e.clientX - r.left) * BOARD_W) / (r.width || BOARD_W), y: ((e.clientY - r.top) * BOARD_H) / (r.height || BOARD_H) });
  };
  const canDraw = !readOnly && (!live || collab.everSynced);
  const eraseAt = (p) => {
    const hit = strokes.filter((s) => strokeHit(s, p, 14));
    if (!hit.length) return;
    if (live && doc) {
      const y = doc.getArray('strokes');
      doc.transact(() => {
        for (let i = y.length - 1; i >= 0; i--) if (hit.includes(y.get(i)) || (y.get(i)?.id && hit.some((h) => h.id === y.get(i).id))) y.delete(i, 1);
      }, LOCAL_ORIGIN);
    } else {
      setStrokes((list) => list.filter((s) => !hit.includes(s)));
      setDirty(true);
    }
  };
  const down = (e) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    if (tool === 'eraser') {
      current.current = { erasing: true };
      eraseAt(p);
      return;
    }
    current.current = { id: newStrokeId(), tool: 'pen', color, lineWidth: 3, points: [p] };
  };
  const move = (e) => {
    const s = current.current;
    if (!s) return;
    const p = pos(e);
    if (s.erasing) return eraseAt(p);
    const last = s.points[s.points.length - 1];
    s.points.push(p);
    const ctx = canvasRef.current?.getContext?.('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth;
      ctx.lineCap = 'round';
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    return undefined;
  };
  const up = () => {
    const s = current.current;
    current.current = null;
    if (!s || s.erasing) return;
    // Shared when the pen lifts.
    if (live && doc) doc.transact(() => doc.getArray('strokes').push([s]), LOCAL_ORIGIN);
    else {
      setStrokes((list) => [...list, s]);
      setDirty(true);
    }
  };
  const clear = () => {
    setConfirmClear(false);
    if (live && doc) {
      const y = doc.getArray('strokes');
      doc.transact(() => y.delete(0, y.length), LOCAL_ORIGIN);
    } else {
      setStrokes([]);
      setDirty(true);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      await api().saveWhiteboard(meeting.id, strokes);
      setDirty(false);
      toast('Whiteboard saved', 'success');
    } catch (err) {
      toast(err.message || "Couldn't save the whiteboard", 'danger');
    } finally {
      setSaving(false);
    }
  };

  const modeText = live
    ? collab.mode === 'live'
      ? readOnly
        ? 'You can watch this board but not draw on it.'
        : 'Live: everyone in this meeting sees strokes as you draw.'
      : view.subtitle || 'Connecting…'
    : `Not live: others see your drawing after you save.${dirty ? ' You have unsaved changes.' : ''}`;

  return (
    <div className="px-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-[13px] text-text-2" data-testid="whiteboard-mode">{modeText}</p>
        <PresenceAvatars peers={peers} />
      </div>
      {!readOnly && (
        <div className="no-scrollbar mb-2 flex items-center gap-2 overflow-x-auto">
          <Button size="sm" variant={tool === 'pen' ? 'primary' : 'secondary'} icon={Pen} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>
            Pen
          </Button>
          <Button size="sm" variant={tool === 'eraser' ? 'primary' : 'secondary'} icon={Eraser} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>
            Eraser
          </Button>
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={tool === 'pen' && c === color}
              onClick={() => {
                setColor(c);
                setTool('pen');
              }}
              className={cx('h-7 w-7 shrink-0 rounded-full border-2', tool === 'pen' && c === color ? 'border-accent' : 'border-line')}
              style={{ background: c }}
            />
          ))}
          <span className="flex-1" />
          <IconButton icon={Trash2} size="sm" label="Clear the board" disabled={!strokes.length} onClick={() => setConfirmClear(true)} />
          {!live && (
            <Button size="sm" loading={saving} disabled={!dirty} onClick={save}>
              Save
            </Button>
          )}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={BOARD_W}
        height={BOARD_H}
        role="img"
        aria-label="Meeting whiteboard"
        data-testid="whiteboard-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="block w-full rounded-card border border-line-soft"
        style={{ background: BOARD_BG, aspectRatio: `${BOARD_W} / ${BOARD_H}`, touchAction: 'none' }}
      />
      <CollabBanner text={view.banner} tone={collab.mode === 'closed' ? 'locked' : 'offline'} />
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear the whiteboard?" body="Everyone's strokes are removed." confirmLabel="Clear" danger onConfirm={clear} />
    </div>
  );
}

// ---------------------------------------------------------------- brainstorm

function BrainstormTab({ meeting }) {
  const me = useSession((s) => s.user?.id);
  const key = `brainstorm:${meeting.id}`;
  const { data, loading } = useQuery(key, () => api().brainstorm(meeting.id), { staleMs: 5_000 });
  const [text, setText] = useState('');
  const [color, setColor] = useState(STICKY_COLORS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      on('meeting', ({ event, payload }) => {
        if (event !== 'brainstorm:update' || String(payload?.meetingId) !== String(meeting.id)) return;
        setQueryData(key, (list) => applyBrainstormEvent(list || [], payload, api().mapSticky));
      }),
    [key, meeting.id],
  );

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
