// Activity → Calendar: a month with a dot on every busy day, and the chosen day's agenda —
// meetings and huddles, tasks due, reminders and scheduled messages. Tap one to open it.
import { useMemo, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, Headphones, SquareCheckBig, Video } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { useTasks } from '../../data/hooks.js';
import { useQuery } from '../../data/query.js';
import { nav } from '../../app/nav.js';
import { Icon } from '../../ui/Icon.jsx';
import { EmptyState } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { clock } from '../../lib/time.js';
import { openStoredMessage } from '../chats/chatsUi.js';
import { calendarEvents, dayKey, eventsByDay, monthWeeks } from './calendar.js';

const KIND = {
  meeting: { icon: Video, label: 'Meeting', tone: 'bg-accent' },
  huddle: { icon: Headphones, label: 'Huddle', tone: 'bg-info' },
  task: { icon: SquareCheckBig, label: 'Task due', tone: 'bg-warning' },
  reminder: { icon: Bell, label: 'Reminder', tone: 'bg-success' },
  scheduled: { icon: Clock3, label: 'Scheduled', tone: 'bg-text-3' },
};

function openEvent(e) {
  if (e.kind === 'meeting' || e.kind === 'huddle') nav.push('meeting', { id: e.ref.id });
  else if (e.kind === 'task') nav.push('task', { id: e.ref.id });
  else if (e.kind === 'reminder' && e.ref.noteId) nav.push('note', { id: e.ref.noteId });
  else if (e.kind === 'reminder') openStoredMessage(e.ref.conv, e.ref.message);
  else if (e.kind === 'scheduled') nav.push('outgoing', { tab: 'scheduled' });
}

export function CalendarView() {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const { data: tasks } = useTasks();
  const upcoming = useQuery(ws && api().meetingsPage && `calendar:upcoming:${ws}`, () => api().meetingsPage(ws, { status: 'upcoming', limit: 100 }), { staleMs: 60_000 });
  const past = useQuery(ws && api().meetingsPage && `calendar:past:${ws}`, () => api().meetingsPage(ws, { status: 'past', limit: 60 }), { staleMs: 60_000 });
  const reminders = useQuery(ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 60_000 });
  const noteReminders = useQuery(api().noteReminders && ws && `noteReminders:${ws}`, () => api().noteReminders(ws), { staleMs: 60_000 });
  const scheduled = useQuery(api().scheduledMessages && ws && `scheduled:${ws}`, () => api().scheduledMessages(ws), { staleMs: 60_000 });
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(() => dayKey(today));

  const events = useMemo(
    () =>
      calendarEvents({
        meetings: [...(upcoming.data?.meetings || []), ...(past.data?.meetings || [])],
        tasks: tasks || [],
        reminders: reminders.data || [],
        noteReminders: noteReminders.data || [],
        scheduled: scheduled.data || [],
        me,
      }),
    [upcoming.data, past.data, tasks, reminders.data, noteReminders.data, scheduled.data, me],
  );
  const byDay = useMemo(() => eventsByDay(events), [events]);
  const dayEvents = byDay.get(selected) || [];
  const move = (by) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + by, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedDate = (() => {
    const [y, m, d] = selected.split('-').map(Number);
    return new Date(y, m, d);
  })();

  return (
    <div className="px-4 pt-3 pb-6" data-testid="activity-calendar">
      <div className="rounded-card border border-line-soft bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => move(-1)} className="grid h-9 w-9 place-items-center rounded-full text-text-2 active:bg-surface-2">
            <Icon as={ChevronLeft} size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor({ y: today.getFullYear(), m: today.getMonth() });
              setSelected(dayKey(today));
            }}
            className="text-[15px] font-semibold"
          >
            {title}
          </button>
          <button type="button" aria-label="Next month" onClick={() => move(1)} className="grid h-9 w-9 place-items-center rounded-full text-text-2 active:bg-surface-2">
            <Icon as={ChevronRight} size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-text-3">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 space-y-0.5">
          {monthWeeks(cursor.y, cursor.m).map((week, i) => (
            <div key={i} className="grid grid-cols-7">
              {week.map((d, j) => {
                if (!d) return <span key={j} />;
                const k = dayKey(d);
                const list = byDay.get(k) || [];
                const isToday = k === dayKey(today);
                const isSel = k === selected;
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setSelected(k)}
                    aria-label={`${d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}${list.length ? `, ${list.length} ${list.length === 1 ? 'item' : 'items'}` : ''}`}
                    aria-pressed={isSel}
                    className={cx('flex h-11 flex-col items-center justify-center rounded-xl text-[14px] tabular-nums', isSel ? 'bg-gold text-on-accent' : isToday ? 'font-bold text-accent-ink' : 'text-text')}
                  >
                    {d.getDate()}
                    <span className="mt-0.5 flex h-1.5 gap-0.5">
                      {[...new Set(list.map((e) => e.kind))].slice(0, 3).map((kind) => (
                        <span key={kind} className={cx('h-1.5 w-1.5 rounded-full', isSel ? 'bg-on-accent' : KIND[kind].tone)} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <h3 className="mt-5 mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-text-2">
        {selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>
      {dayEvents.length ? (
        <div className="overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
          {dayEvents.map((e) => (
            <button key={e.id} type="button" onClick={() => openEvent(e)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-surface-2" data-testid="calendar-event">
              <span className="w-14 shrink-0 text-[12px] tabular-nums text-text-2">{e.allDay ? 'All day' : clock(e.at)}</span>
              <span className={cx('h-8 w-1 shrink-0 rounded-full', KIND[e.kind].tone)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{e.title}</span>
                <span className="flex items-center gap-1 text-[12px] text-text-2">
                  <Icon as={KIND[e.kind].icon} size={12} /> {KIND[e.kind].label}
                  {e.end && !e.allDay ? ` · until ${clock(e.end)}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title="Nothing on this day" body="Meetings, huddles, tasks due, reminders and scheduled messages show up here." />
      )}
    </div>
  );
}
