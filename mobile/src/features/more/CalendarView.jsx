// Activity → Calendar, like Google Calendar's phone app. Opens on Month. Schedule (what's coming up), Day,
// 3 days, Week (an hour grid with events at their times and a line at "now") and Month (event
// bars on each day), picked from one menu; a filter chooses which kinds show; + adds a personal
// reminder (personalReminders.js).
// Layout math is shared with the web app (platform/calendar/calendarLayout.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Headphones, ListFilter, Plus, SquareCheckBig, Trash2, Video } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useTasks } from '../../data/hooks.js';
import { useQuery } from '../../data/query.js';
import { nav } from '../../app/nav.js';
import { prefs } from '../../native/storage.js';
import { Icon } from '../../ui/Icon.jsx';
import { EmptyState } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { clock } from '../../lib/time.js';
import { openStoredMessage } from '../chats/chatsUi.js';
import { ActionSheet, Sheet } from '../../ui/Overlay.jsx';
import { calendarEvents } from './calendar.js';
import { addPersonalReminder, personalReminders, removePersonalReminder, usePersonalReminders } from './personalReminders.js';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { toast } from '../../lib/bus.js';
import { deviceNoun } from '../../native/index.js';
import {
  addDays, agenda, eventsOn, hourLabel, layoutDay, monthGrid, rangeTitle, sameDay, startOfDay, stepCursor, weekDays,
} from '../../../../platform/calendar/calendarLayout.js';

export const KIND = {
  meeting: { icon: Video, label: 'Meetings', one: 'Meeting', color: '#b8956a' },
  huddle: { icon: Headphones, label: 'Huddles', one: 'Huddle', color: '#5b8def' },
  task: { icon: SquareCheckBig, label: 'Tasks', one: 'Task due', color: '#d39b2a' },
  reminder: { icon: Bell, label: 'Reminders', one: 'Reminder', color: '#3f9b6b' },
  scheduled: { icon: Clock3, label: 'Scheduled', one: 'Scheduled message', color: '#8a8378' },
};
const VIEWS = [
  { id: 'agenda', label: 'Schedule' },
  { id: 'day', label: 'Day' },
  { id: '3day', label: '3 days' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];
const HOUR_PX = 52;
// The view picked, kept while the app runs (it opens on the month each time).
let sessionView = 'month';

function openEvent(e) {
  if (e.kind === 'meeting' || e.kind === 'huddle') nav.push('meeting', { id: e.ref.id });
  else if (e.kind === 'task') nav.push('task', { id: e.ref.id });
  else if (e.kind === 'reminder' && e.ref.personal) emitPersonal(e.ref);
  else if (e.kind === 'reminder' && e.ref.noteId) nav.push('note', { id: e.ref.noteId });
  else if (e.kind === 'reminder') openStoredMessage(e.ref.conv, e.ref.message);
  else if (e.kind === 'scheduled') nav.push('outgoing', { tab: 'scheduled' });
}

// Tapping a personal reminder opens its sheet in the mounted CalendarView.
let personalHandler = null;
const emitPersonal = (ref) => personalHandler?.(ref);

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** New personal reminder: what, and when (defaults to the next whole hour on the picked day). */
function NewReminderSheet({ open, onClose, ws, day }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const base = new Date(day || Date.now());
    const now = new Date();
    base.setHours(base.toDateString() === now.toDateString() ? now.getHours() + 1 : 9, 0, 0, 0);
    setWhen(localInput(base));
    setTitle('');
  }, [open, day]);
  const save = async () => {
    if (!title.trim() || !when) return;
    setBusy(true);
    await addPersonalReminder(ws, { title, at: new Date(when) });
    setBusy(false);
    toast('Reminder set', 'success');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="New reminder" footer={<Button block loading={busy} disabled={!title.trim() || !when} onClick={save}>Set reminder</Button>}>
      <div className="space-y-3 px-5 pb-4">
        <Field label="Remind me to" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call the bank" autoFocus maxLength={200} />
        <Field label="When" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <p className="text-[12px] text-text-2">Just for you. Kept on this {deviceNoun}, with a notification at the time.</p>
      </div>
    </Sheet>
  );
}

const timeRange = (e) => (e.allDay ? 'All day' : e.end ? `${clock(e.at)} – ${clock(e.end)}` : clock(e.at));

export function CalendarView() {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const { data: tasks } = useTasks();
  const upcoming = useQuery(ws && api().meetingsPage && `calendar:upcoming:${ws}`, () => api().meetingsPage(ws, { status: 'upcoming', limit: 100 }), { staleMs: 60_000 });
  const past = useQuery(ws && api().meetingsPage && `calendar:past:${ws}`, () => api().meetingsPage(ws, { status: 'past', limit: 60 }), { staleMs: 60_000 });
  const reminders = useQuery(ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 60_000 });
  const noteReminders = useQuery(api().noteReminders && ws && `noteReminders:${ws}`, () => api().noteReminders(ws), { staleMs: 60_000 });
  const scheduled = useQuery(api().scheduledMessages && ws && `scheduled:${ws}`, () => api().scheduledMessages(ws), { staleMs: 60_000 });

  // Opens on Schedule (what's coming up); the view picked stays while the app is open.
  const [view, setViewState] = useState(() => sessionView);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState(() => new Set(prefs.get('calendar.hidden', [])));
  const [sheet, setSheet] = useState(null); // 'view' | 'filter' | 'new'
  const [openReminder, setOpenReminder] = useState(null);
  const personalStore = usePersonalReminders((st) => st.byWs[ws]);
  useEffect(() => {
    if (ws) personalReminders(ws); // load this workspace's from the phone
  }, [ws]);
  const personal = useMemo(() => personalStore || [], [personalStore]);
  useEffect(() => {
    personalHandler = setOpenReminder;
    return () => {
      if (personalHandler === setOpenReminder) personalHandler = null;
    };
  }, []);
  const setView = (v) => {
    sessionView = v;
    setViewState(v);
  };
  const toggleKind = (k) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      prefs.set('calendar.hidden', [...next]);
      return next;
    });

  const events = useMemo(
    () =>
      calendarEvents({
        meetings: [...(upcoming.data?.meetings || []), ...(past.data?.meetings || [])],
        tasks: tasks || [],
        reminders: reminders.data || [],
        noteReminders: noteReminders.data || [],
        scheduled: scheduled.data || [],
        personal,
        me,
      }).filter((e) => !hidden.has(e.kind)),
    [upcoming.data, past.data, tasks, reminders.data, noteReminders.data, scheduled.data, personal, me, hidden],
  );

  const step = (dir) => setCursor((c) => (view === '3day' ? addDays(c, 3 * dir) : stepCursor(view, c, dir)));
  const days = view === 'day' ? [cursor] : view === '3day' ? [cursor, addDays(cursor, 1), addDays(cursor, 2)] : weekDays(cursor);
  const title = view === '3day' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : rangeTitle(view, cursor);

  return (
    <div className="relative flex flex-col pb-6" data-testid="activity-calendar">
      {/* One row: Today, back / forward, the range, the view and the filter. */}
      <div className="flex items-center gap-1 px-3 pt-3">
        <button type="button" onClick={() => setCursor(startOfDay(new Date()))} className="h-8 shrink-0 rounded-full border border-line px-3 text-[13px] font-medium active:bg-surface-2">
          Today
        </button>
        {view !== 'agenda' && (
          <>
            <button type="button" aria-label="Previous" onClick={() => step(-1)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={ChevronLeft} size={18} />
            </button>
            <button type="button" aria-label="Next" onClick={() => step(1)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={ChevronRight} size={18} />
            </button>
          </>
        )}
        <h2 className="ml-1 min-w-0 flex-1 truncate text-[15px] font-semibold" data-testid="calendar-title">{title}</h2>
        <button
          type="button"
          onClick={() => setSheet('view')}
          data-testid="calendar-view"
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-[13px] font-medium active:bg-surface-2"
        >
          {VIEWS.find((v) => v.id === view)?.label} <Icon as={ChevronDown} size={14} />
        </button>
        <button
          type="button"
          onClick={() => setSheet('new')}
          aria-label="New reminder"
          data-testid="calendar-new-reminder"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-on-accent active:opacity-80"
        >
          <Icon as={Plus} size={16} />
        </button>
        <button
          type="button"
          onClick={() => setSheet('filter')}
          aria-label={hidden.size ? `Filter, ${hidden.size} hidden` : 'Filter'}
          data-testid="calendar-filter"
          className={cx('relative grid h-8 w-8 shrink-0 place-items-center rounded-full border active:bg-surface-2', hidden.size ? 'border-accent text-accent-ink' : 'border-line text-text-2')}
        >
          <Icon as={ListFilter} size={15} />
          {hidden.size > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-on-accent">{hidden.size}</span>}
        </button>
      </div>

      <NewReminderSheet open={sheet === 'new'} onClose={() => setSheet(null)} ws={ws} day={cursor} />
      <ActionSheet
        open={Boolean(openReminder)}
        onClose={() => setOpenReminder(null)}
        title={openReminder?.title || 'Reminder'}
        actions={[{ label: 'Delete reminder', icon: Trash2, danger: true, onSelect: () => removePersonalReminder(ws, openReminder.id) }]}
      />
      <ActionSheet
        open={sheet === 'view'}
        onClose={() => setSheet(null)}
        title="View"
        actions={VIEWS.map((v) => ({ label: view === v.id ? `${v.label} ✓` : v.label, onSelect: () => setView(v.id) }))}
      />
      <Sheet open={sheet === 'filter'} onClose={() => setSheet(null)} title="Show on the calendar">
        <div className="px-2 pb-3" data-testid="calendar-filter-sheet">
          {Object.entries(KIND).map(([k, K]) => (
            <button
              key={k}
              type="button"
              aria-pressed={!hidden.has(k)}
              onClick={() => toggleKind(k)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: K.color }}>
                <Icon as={K.icon} size={16} />
              </span>
              <span className="flex-1 text-[15px]">{K.label}</span>
              <span className={cx('grid h-6 w-6 place-items-center rounded-full border', hidden.has(k) ? 'border-line-strong' : 'border-accent bg-gold text-on-accent')}>
                {!hidden.has(k) && <Icon as={Check} size={14} />}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <div className="mt-3">
        {view === 'agenda' ? (
          <Agenda events={events} from={cursor} />
        ) : view === 'month' ? (
          <Month
            cursor={cursor}
            events={events}
            onPick={(d) => {
              setCursor(d);
              setView('day');
            }}
          />
        ) : (
          <HourGrid days={days} events={events} onPickDay={(d) => (setCursor(d), setView('day'))} />
        )}
      </div>

    </div>
  );
}

function Agenda({ events, from }) {
  const days = agenda(events, from, 60);
  if (!days.length) {
    return <EmptyState icon={CalendarDays} title="Nothing coming up" body="Meetings, huddles, tasks due, reminders and scheduled messages show up here." />;
  }
  return (
    <div className="px-3" data-testid="calendar-agenda">
      {days.map(({ day, events: list }) => {
        const today = sameDay(day, new Date());
        return (
          <div key={day.toISOString()} className="flex gap-3 border-b border-line-soft py-2.5">
            <div className="w-11 shrink-0 text-center">
              <div className={cx('text-[11px] font-semibold uppercase', today ? 'text-accent-ink' : 'text-text-3')}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div className={cx('mx-auto mt-0.5 grid h-9 w-9 place-items-center rounded-full text-[18px] tabular-nums', today ? 'bg-gold text-on-accent font-semibold' : 'text-text')}>{day.getDate()}</div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openEvent(e)}
                  data-testid="calendar-event"
                  className="block w-full rounded-xl px-3 py-2 text-left text-white active:opacity-90"
                  style={{ background: KIND[e.kind].color }}
                >
                  <span className="block truncate text-[14px] font-semibold">{e.title}</span>
                  <span className="block text-[12px] opacity-90">{timeRange(e)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Month({ cursor, events, onPick }) {
  const today = new Date();
  return (
    <div className="px-1" data-testid="calendar-month">
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-text-3">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-line-soft">
        {monthGrid(cursor.getFullYear(), cursor.getMonth()).flat().map(({ date, inMonth }) => {
          const list = eventsOn(events, date);
          return (
            <button key={date.toISOString()} type="button" onClick={() => onPick(date)} className="flex min-h-[78px] min-w-0 flex-col items-stretch gap-0.5 border-b border-l border-line-soft px-0.5 py-1 text-left first:border-l-0">
              <span
                className={cx(
                  'mx-auto grid h-6 w-6 place-items-center rounded-full text-[12px] tabular-nums',
                  sameDay(date, today) ? 'bg-gold font-semibold text-on-accent' : inMonth ? 'text-text' : 'text-text-3',
                )}
              >
                {date.getDate()}
              </span>
              {list.slice(0, 3).map((e) => (
                <span key={e.id} className="truncate rounded-[4px] px-1 text-[10px] font-medium leading-[15px] text-white" style={{ background: KIND[e.kind].color }}>
                  {e.title}
                </span>
              ))}
              {list.length > 3 && <span className="px-1 text-[10px] text-text-2">+{list.length - 3}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HourGrid({ days, events, onPickDay }) {
  const scroller = useRef(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const hour = days.some((d) => sameDay(d, now)) ? Math.max(0, now.getHours() - 1) : 8;
    if (scroller.current) scroller.current.scrollTop = hour * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, days[0]?.getTime()]);
  const cols = { gridTemplateColumns: `40px repeat(${days.length}, minmax(0, 1fr))` };
  const allDay = days.map((d) => eventsOn(events, d).filter((e) => e.allDay));

  return (
    <div data-testid={days.length === 1 ? 'calendar-day' : 'calendar-week'}>
      <div className="grid border-b border-line-soft" style={cols}>
        <span />
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <button key={d.toISOString()} type="button" onClick={() => onPickDay(d)} className="flex flex-col items-center py-1">
              <span className={cx('text-[10px] font-semibold uppercase', today ? 'text-accent-ink' : 'text-text-3')}>{d.toLocaleDateString(undefined, { weekday: days.length > 3 ? 'narrow' : 'short' })}</span>
              <span className={cx('grid h-8 w-8 place-items-center rounded-full text-[16px] tabular-nums', today ? 'bg-gold font-semibold text-on-accent' : 'text-text')}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      {allDay.some((l) => l.length) && (
        <div className="grid border-b border-line-soft" style={cols}>
          <span className="self-center text-[9px] text-text-3">all day</span>
          {allDay.map((list, i) => (
            <div key={i} className="min-w-0 space-y-0.5 border-l border-line-soft p-0.5">
              {list.map((e) => (
                <button key={e.id} type="button" onClick={() => openEvent(e)} data-testid="calendar-event" className="block w-full truncate rounded-[4px] px-1 text-left text-[10px] font-medium leading-[16px] text-white" style={{ background: KIND[e.kind].color }}>
                  {e.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} className="overflow-y-auto" style={{ height: 'calc(100dvh - 330px)', minHeight: 320 }}>
        <div className="relative grid" style={{ ...cols, height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[9px] text-text-3" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="relative border-l border-line-soft"
              style={{ backgroundImage: 'linear-gradient(to bottom, rgb(var(--c-line) / 0.8) 1px, transparent 1px)', backgroundSize: `100% ${HOUR_PX}px` }}
            >
              {layoutDay(events, d).map(({ event, top, height, column, columns }) => (
                <button
                  key={event.id}
                  type="button"
                  data-testid="calendar-event"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEvent(event);
                  }}
                  className="absolute overflow-hidden rounded-[6px] px-1 py-0.5 text-left text-white shadow-sm"
                  style={{
                    top: (top / 60) * HOUR_PX,
                    height: Math.max(16, (height / 60) * HOUR_PX - 2),
                    left: `calc(${(column / columns) * 100}% + 1px)`,
                    width: `calc(${100 / columns}% - 2px)`,
                    background: KIND[event.kind].color,
                  }}
                >
                  <span className="block truncate text-[11px] font-semibold leading-tight">{event.title}</span>
                  {height >= 45 && days.length < 7 && <span className="block truncate text-[10px] opacity-90">{timeRange(event)}</span>}
                </button>
              ))}
              {sameDay(d, now) && (
                <div className="pointer-events-none absolute -left-px right-0 z-10 h-0.5 bg-[#e5534b]" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }}>
                  <span className="absolute -left-1 -top-[5px] h-3 w-3 rounded-full bg-[#e5534b]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
