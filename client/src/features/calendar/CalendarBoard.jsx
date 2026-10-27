// The calendar (Notifications → Calendar), laid out like Google Calendar: a toolbar (Today, back,
// forward, the range, Day / Week / Month / Schedule), a side column (Create, a small month, which
// kinds to show) and the main view: an hour grid for days and weeks with events placed at their
// times and a line at "now", a month grid with event chips, or a list of what's coming up.
// Layout math is shared with the phone app (platform/calendar/calendarLayout.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, ExternalLink, Headphones, Plus, SquareCheckBig, Video, X } from 'lucide-react';
import {
    addDays, agenda, dayKey, eventsByDay, eventsOn, hourLabel, layoutDay, monthGrid, rangeTitle, sameDay, startOfDay, stepCursor, weekDays,
} from '@platform/calendar/calendarLayout.js';
import './calendar.css';

export const KINDS = {
    meeting: { Icon: Video, label: 'Meetings', one: 'Meeting', color: '#b8956a' },
    huddle: { Icon: Headphones, label: 'Huddles', one: 'Huddle', color: '#5b8def' },
    task: { Icon: SquareCheckBig, label: 'Tasks due', one: 'Task due', color: '#d39b2a' },
    reminder: { Icon: Bell, label: 'Reminders', one: 'Reminder', color: '#3f9b6b' },
    scheduled: { Icon: Clock3, label: 'Scheduled messages', one: 'Scheduled message', color: '#8a8378' },
};
const VIEWS = [
    { id: 'day', label: 'Day', key: 'd' },
    { id: 'week', label: 'Week', key: 'w' },
    { id: 'month', label: 'Month', key: 'm' },
    { id: 'agenda', label: 'Schedule', key: 'a' },
];
const HOUR_PX = 48;
const clock = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } },
};

/** "10:00 – 11:00 AM" / "All day". */
export function timeRange(e) {
    if (e.allDay) return 'All day';
    return e.end ? `${clock(e.at)} – ${clock(e.end)}` : clock(e.at);
}

export default function CalendarBoard({ events = [], loading = false, onOpen, onCreateMeeting, onCreateTask }) {
    const today = new Date();
    const [view, setViewState] = useState(() => store.get('calendar.view', 'week'));
    const [cursor, setCursor] = useState(() => startOfDay(today));
    const [hidden, setHidden] = useState(() => new Set(store.get('calendar.hidden', [])));
    const [popover, setPopover] = useState(null); // { event, x, y }
    const [createOpen, setCreateOpen] = useState(false);
    const [viewMenu, setViewMenu] = useState(false);

    const setView = (v) => { setViewState(v); store.set('calendar.view', v); setViewMenu(false); };
    const toggleKind = (k) => setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k); else next.add(k);
        store.set('calendar.hidden', [...next]);
        return next;
    });
    const shown = useMemo(() => events.filter((e) => !hidden.has(e.kind)), [events, hidden]);

    // Keyboard: t = today, ← → move, d / w / m / a switch views (like Google Calendar).
    useEffect(() => {
        const onKey = (e) => {
            const el = document.activeElement;
            if (e.metaKey || e.ctrlKey || e.altKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) || el?.isContentEditable) return;
            if (e.key === 'Escape') { setPopover(null); setCreateOpen(false); setViewMenu(false); return; }
            if (e.key === 't') setCursor(startOfDay(new Date()));
            else if (e.key === 'ArrowLeft') setCursor((c) => stepCursor(view, c, -1));
            else if (e.key === 'ArrowRight') setCursor((c) => stepCursor(view, c, 1));
            else { const v = VIEWS.find((x) => x.key === e.key); if (v) setView(v.id); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    const openEvent = (event, e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPopover({ event, x: Math.min(r.right + 8, window.innerWidth - 300), y: Math.min(r.top, window.innerHeight - 200) });
    };
    const create = (date) => { setCreateOpen(false); onCreateMeeting?.(date); };

    return (
        <div className="cal" data-testid="activity-calendar">
            <aside className="cal-side">
                <div className="cal-create">
                    <button type="button" className="cal-create-btn" onClick={() => setCreateOpen((v) => !v)} aria-expanded={createOpen} data-testid="calendar-create">
                        <Plus size={18} /> Create <ChevronDown size={14} />
                    </button>
                    {createOpen && (
                        <div className="cal-menu" role="menu">
                            {onCreateMeeting && <button type="button" role="menuitem" onClick={() => create(null)}><Video size={14} /> Meeting</button>}
                            {onCreateTask && <button type="button" role="menuitem" onClick={() => { setCreateOpen(false); onCreateTask(); }}><SquareCheckBig size={14} /> Task</button>}
                        </div>
                    )}
                </div>
                <MiniMonth cursor={cursor} today={today} byDay={eventsByDay(shown)} onPick={(d) => setCursor(d)} />
                <div className="cal-kinds">
                    <div className="cal-kinds-title">Show</div>
                    {Object.entries(KINDS).map(([k, K]) => (
                        <label key={k} className="cal-kind">
                            <input type="checkbox" checked={!hidden.has(k)} onChange={() => toggleKind(k)} style={{ accentColor: K.color }} data-testid={`calendar-kind-${k}`} />
                            <span>{K.label}</span>
                        </label>
                    ))}
                </div>
            </aside>

            <section className="cal-main">
                <div className="cal-toolbar">
                    <button type="button" className="cal-today" onClick={() => setCursor(startOfDay(new Date()))}>Today</button>
                    <button type="button" className="cal-nav" aria-label="Previous" onClick={() => setCursor((c) => stepCursor(view, c, -1))}><ChevronLeft size={18} /></button>
                    <button type="button" className="cal-nav" aria-label="Next" onClick={() => setCursor((c) => stepCursor(view, c, 1))}><ChevronRight size={18} /></button>
                    <h2 className="cal-title" data-testid="calendar-title">{rangeTitle(view, cursor)}</h2>
                    {loading && <span className="cal-loading">Loading…</span>}
                    <div className="cal-view">
                        <button type="button" className="cal-view-btn" onClick={() => setViewMenu((v) => !v)} aria-expanded={viewMenu} aria-label="Calendar view" data-testid="calendar-view">
                            {VIEWS.find((v) => v.id === view)?.label} <ChevronDown size={14} />
                        </button>
                        {viewMenu && (
                            <div className="cal-menu cal-menu--right" role="menu">
                                {VIEWS.map((v) => (
                                    <button key={v.id} type="button" role="menuitemradio" aria-checked={view === v.id} onClick={() => setView(v.id)}>
                                        {v.label} <kbd>{v.key.toUpperCase()}</kbd>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {view === 'month' ? (
                    <MonthView cursor={cursor} today={today} events={shown} onOpen={openEvent}
                        onMore={(d) => { setCursor(d); setView('day'); }} onPickDay={(d) => { setCursor(d); setView('day'); }} />
                ) : view === 'agenda' ? (
                    <AgendaView events={shown} from={cursor} onOpen={openEvent} />
                ) : (
                    <TimeGrid days={view === 'day' ? [cursor] : weekDays(cursor)} today={today} events={shown} onOpen={openEvent}
                        onCreate={onCreateMeeting ? create : null} onPickDay={(d) => { setCursor(d); setView('day'); }} />
                )}
            </section>

            {popover && (
                <>
                    <div className="cal-scrim" onClick={() => setPopover(null)} />
                    <div className="cal-pop" role="dialog" aria-label={popover.event.title} style={{ left: popover.x, top: popover.y }} data-testid="calendar-popover">
                        <button type="button" className="cal-pop-close" aria-label="Close" onClick={() => setPopover(null)}><X size={14} /></button>
                        <div className="cal-pop-title">
                            <span className="cal-dot" style={{ background: KINDS[popover.event.kind]?.color }} />
                            {popover.event.title}
                        </div>
                        <div className="cal-pop-line">
                            {new Date(popover.event.at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {timeRange(popover.event)}
                        </div>
                        <div className="cal-pop-line">{KINDS[popover.event.kind]?.one}</div>
                        {popover.event.href && (
                            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => { const ev = popover.event; setPopover(null); onOpen?.(ev); }}>
                                <ExternalLink size={13} /> Open
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function MiniMonth({ cursor, today, byDay, onPick }) {
    const [month, setMonth] = useState(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    useEffect(() => { setMonth(new Date(cursor.getFullYear(), cursor.getMonth(), 1)); }, [cursor]);
    return (
        <div className="cal-mini">
            <div className="cal-mini-head">
                <span>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={14} /></button>
                <button type="button" aria-label="Next month" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={14} /></button>
            </div>
            <div className="cal-mini-grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="cal-mini-dow">{d}</span>)}
                {monthGrid(month.getFullYear(), month.getMonth()).flat().map(({ date, inMonth }) => (
                    <button key={date.toISOString()} type="button" onClick={() => onPick(date)}
                        className={`cal-mini-day${inMonth ? '' : ' is-out'}${sameDay(date, today) ? ' is-today' : ''}${sameDay(date, cursor) ? ' is-selected' : ''}`}
                        aria-label={date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}>
                        {date.getDate()}
                        {byDay.has(dayKey(date)) && <i aria-hidden />}
                    </button>
                ))}
            </div>
        </div>
    );
}

function EventChip({ event, onOpen }) {
    const K = KINDS[event.kind] || KINDS.meeting;
    return (
        <button type="button" className="cal-chip" onClick={(e) => { e.stopPropagation(); onOpen(event, e); }} data-testid="calendar-event" title={`${timeRange(event)} · ${event.title}`}>
            {event.allDay ? (
                <span className="cal-chip-fill" style={{ background: K.color }}>{event.title}</span>
            ) : (
                <>
                    <span className="cal-dot" style={{ background: K.color }} />
                    <span className="cal-chip-time">{clock(event.at)}</span>
                    <span className="cal-chip-title">{event.title}</span>
                </>
            )}
        </button>
    );
}

function MonthView({ cursor, today, events, onOpen, onMore, onPickDay }) {
    const grid = monthGrid(cursor.getFullYear(), cursor.getMonth());
    return (
        <div className="cal-month" data-testid="calendar-month">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-month-dow">{d}</div>)}
            {grid.flat().map(({ date, inMonth }) => {
                const list = eventsOn(events, date);
                const extra = list.length - 3;
                return (
                    <div key={date.toISOString()} className={`cal-month-cell${inMonth ? '' : ' is-out'}`}>
                        <button type="button" className={`cal-month-date${sameDay(date, today) ? ' is-today' : ''}`} onClick={() => onPickDay(date)}
                            aria-label={date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}>
                            {date.getDate() === 1 ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : date.getDate()}
                        </button>
                        {list.slice(0, 3).map((e) => <EventChip key={e.id} event={e} onOpen={onOpen} />)}
                        {extra > 0 && <button type="button" className="cal-more" onClick={() => onMore(date)}>{extra} more</button>}
                    </div>
                );
            })}
        </div>
    );
}

function TimeGrid({ days, today, events, onOpen, onCreate, onPickDay }) {
    const scroller = useRef(null);
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);
    // Opens at the morning (or an hour before now, when today is on screen).
    useEffect(() => {
        const showsToday = days.some((d) => sameDay(d, now));
        const hour = showsToday ? Math.max(0, now.getHours() - 1) : 8;
        if (scroller.current) scroller.current.scrollTop = hour * HOUR_PX;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days.length, days[0]?.getTime()]);

    const allDay = days.map((d) => eventsOn(events, d).filter((e) => e.allDay));
    const hasAllDay = allDay.some((l) => l.length);
    const cols = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };

    const slotClick = (day, e) => {
        if (!onCreate) return;
        const r = e.currentTarget.getBoundingClientRect();
        const minutes = Math.floor(((e.clientY - r.top) / HOUR_PX) * 2) * 30;
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, Math.max(0, Math.min(23 * 60 + 30, minutes)));
        onCreate(at);
    };

    return (
        <div className="cal-grid" data-testid={days.length === 1 ? 'calendar-day' : 'calendar-week'}>
            <div className="cal-grid-head" style={cols}>
                <div className="cal-gutter-label">{Intl.DateTimeFormat().resolvedOptions().timeZone?.split('/').pop()?.replace('_', ' ')}</div>
                {days.map((d) => (
                    <button key={d.toISOString()} type="button" className={`cal-day-head${sameDay(d, today) ? ' is-today' : ''}`} onClick={() => onPickDay(d)}>
                        <span className="cal-dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <span className="cal-dom">{d.getDate()}</span>
                    </button>
                ))}
            </div>
            {hasAllDay && (
                <div className="cal-allday" style={cols}>
                    <div className="cal-gutter-label">All day</div>
                    {allDay.map((list, i) => (
                        <div key={i} className="cal-allday-cell">{list.map((e) => <EventChip key={e.id} event={e} onOpen={onOpen} />)}</div>
                    ))}
                </div>
            )}
            <div className="cal-scroll" ref={scroller}>
                <div className="cal-hours" style={{ ...cols, height: 24 * HOUR_PX }}>
                    <div className="cal-gutter">
                        {Array.from({ length: 24 }, (_, h) => (
                            <span key={h} style={{ top: h * HOUR_PX }}>{h === 0 ? '' : hourLabel(h)}</span>
                        ))}
                    </div>
                    {days.map((d) => (
                        <div key={d.toISOString()} className="cal-col" onClick={(e) => slotClick(d, e)} title={onCreate ? 'Click to schedule a meeting here' : undefined}>
                            {layoutDay(events, d).map(({ event, top, height, column, columns }) => {
                                const K = KINDS[event.kind] || KINDS.meeting;
                                return (
                                    <button key={event.id} type="button" className="cal-block" data-testid="calendar-event"
                                        onClick={(e) => { e.stopPropagation(); onOpen(event, e); }}
                                        style={{
                                            top: (top / 60) * HOUR_PX, height: Math.max(18, (height / 60) * HOUR_PX - 2),
                                            left: `calc(${(column / columns) * 100}% + 2px)`, width: `calc(${100 / columns}% - 4px)`,
                                            background: K.color,
                                        }}>
                                        <span className="cal-block-title">{event.title}</span>
                                        {height >= 40 && <span className="cal-block-time">{timeRange(event)}</span>}
                                    </button>
                                );
                            })}
                            {sameDay(d, now) && (
                                <div className="cal-now" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }} aria-label="Now" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function AgendaView({ events, from, onOpen }) {
    const days = agenda(events, from, 60);
    if (!days.length) {
        return (
            <div className="cal-empty">
                <CalendarDays size={22} />
                <p>Nothing in the next 60 days</p>
                <span>Meetings, huddles, tasks due, reminders and scheduled messages show up here.</span>
            </div>
        );
    }
    return (
        <div className="cal-agenda" data-testid="calendar-agenda">
            {days.map(({ day, events: list }) => (
                <div key={day.toISOString()} className="cal-agenda-day">
                    <div className={`cal-agenda-date${sameDay(day, new Date()) ? ' is-today' : ''}`}>
                        <span className="cal-dom">{day.getDate()}</span>
                        <span>{day.toLocaleDateString(undefined, { month: 'short', weekday: 'short' })}</span>
                    </div>
                    <div className="cal-agenda-list">
                        {list.map((e) => (
                            <button key={e.id} type="button" className="cal-agenda-row" onClick={(ev) => onOpen(e, ev)} data-testid="calendar-event">
                                <span className="cal-dot" style={{ background: KINDS[e.kind]?.color }} />
                                <span className="cal-agenda-time">{timeRange(e)}</span>
                                <span className="cal-agenda-title">{e.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export { addDays };
