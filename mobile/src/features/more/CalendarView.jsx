// Activity → Calendar, like Google Calendar's phone app: Schedule (what's coming up), Day,
// 3 days, Week (an hour grid with events at their times and a line at "now") and Month (event
// bars on each day). Filter by kind; + schedules a meeting (at the time tapped on the grid).
// Layout math is shared with the web app (platform/calendar/calendarLayout.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, Headphones, Plus, SquareCheckBig, Video } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useTasks } from '../../data/hooks.js';
import { invalidate, useQuery } from '../../data/query.js';
import { nav } from '../../app/nav.js';
import { prefs } from '../../native/storage.js';
import { Icon } from '../../ui/Icon.jsx';
import { EmptyState } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { clock } from '../../lib/time.js';
import { openStoredMessage } from '../chats/chatsUi.js';
import { ScheduleMeetingSheet } from '../meetings/screens.jsx';
import { calendarEvents } from './calendar.js';
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

function openEvent(e) {
  if (e.kind === 'meeting' || e.kind === 'huddle') nav.push('meeting', { id: e.ref.id });
  else if (e.kind === 'task') nav.push('task', { id: e.ref.id });
  else if (e.kind === 'reminder' && e.ref.noteId) nav.push('note', { id: e.ref.noteId });
  else if (e.kind === 'reminder') openStoredMessage(e.ref.conv, e.ref.message);
  else if (e.kind === 'scheduled') nav.push('outgoing', { tab: 'scheduled' });
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

  const [view, setViewState] = useState(() => prefs.get('calendar.view', 'agenda'));
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState(() => new Set(prefs.get('calendar.hidden', [])));
  const [scheduleAt, setScheduleAt] = useState(undefined); // undefined: closed
  const setView = (v) => {
    setViewState(v);
    prefs.set('calendar.view', v);
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
        me,
      }).filter((e) => !hidden.has(e.kind)),
    [upcoming.data, past.data, tasks, reminders.data, noteReminders.data, scheduled.data, me, hidden],
  );

  const step = (dir) => setCursor((c) => (view === '3day' ? addDays(c, 3 * dir) : stepCursor(view, c, dir)));
  const days = view === 'day' ? [cursor] : view === '3day' ? [cursor, addDays(cursor, 1), addDays(cursor, 2)] : weekDays(cursor);
  const title = view === '3day' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : rangeTitle(view, cursor);

  return (
    <div className="relative flex flex-col pb-24" data-testid="activity-calendar">
      <div className="flex items-center gap-1 px-3 pt-3">
        <button type="button" onClick={() => setCursor(startOfDay(new Date()))} className="h-8 rounded-full border border-line px-3 text-[13px] font-medium active:bg-surface-2">
          Today
        </button>
        {view !== 'agenda' && (
          <>
            <button type="button" aria-label="Previous" onClick={() => step(-1)} className="grid h-8 w-8 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={ChevronLeft} size={18} />
            </button>
            <button type="button" aria-label="Next" onClick={() => step(1)} className="grid h-8 w-8 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={ChevronRight} size={18} />
            </button>
          </>
        )}
        <h2 className="ml-1 min-w-0 flex-1 truncate text-[16px] font-semibold" data-testid="calendar-title">{title}</h2>
      </div>

      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-3" role="tablist" aria-label="Calendar view">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cx('h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium', view === v.id ? 'border-accent bg-accent/12 text-accent-ink' : 'border-line text-text-2')}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-3" aria-label="Show">
        {Object.entries(KIND).map(([k, K]) => (
          <button
            key={k}
            type="button"
            aria-pressed={!hidden.has(k)}
            onClick={() => toggleKind(k)}
            className={cx('flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px]', hidden.has(k) ? 'border-line text-text-3' : 'border-line-strong text-text')}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: hidden.has(k) ? 'transparent' : K.color, boxShadow: `inset 0 0 0 1.5px ${K.color}` }} />
            {K.label}
          </button>
        ))}
      </div>

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
          <HourGrid days={days} events={events} onPickDay={(d) => (setCursor(d), setView('day'))} onCreate={(at) => setScheduleAt(at)} />
        )}
      </div>

      <button
        type="button"
        aria-label="Schedule a meeting"
        onClick={() => setScheduleAt(null)}
        className="pressable fixed right-4 z-10 grid h-14 w-14 place-items-center rounded-2xl bg-gold text-on-accent shadow-lg"
        // Above the AI button, which sits in this corner.
        style={{ bottom: 'calc(var(--sab) + 160px)' }}
        data-testid="calendar-create"
      >
        <Icon as={Plus} size="lg" />
      </button>
      {scheduleAt !== undefined && (
        <ScheduleMeetingSheet
          open
          startAt={scheduleAt ? scheduleAt.toISOString() : null}
          onClose={() => {
            setScheduleAt(undefined);
            invalidate('calendar:');
          }}
        />
      )}
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

function HourGrid({ days, events, onPickDay, onCreate }) {
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

  const tap = (day, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((e.clientY - r.top) / HOUR_PX) * 2) * 30;
    onCreate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, Math.max(0, Math.min(23 * 60 + 30, minutes))));
  };

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
              onClick={(e) => tap(d, e)}
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
