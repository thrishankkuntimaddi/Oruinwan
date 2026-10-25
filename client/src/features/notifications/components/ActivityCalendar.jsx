// Activity → Calendar (web): a month with a dot on each busy day and the chosen day's agenda —
// meetings and huddles, tasks due, message reminders and scheduled messages.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Clock3, Headphones, SquareCheckBig, Video } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { PanelEmpty } from '../../../components/layout/WorkspacePanel';

const KIND = {
    meeting: { Icon: Video, label: 'Meeting', color: 'var(--accent)' },
    huddle: { Icon: Headphones, label: 'Huddle', color: 'var(--info, #5b8def)' },
    task: { Icon: SquareCheckBig, label: 'Task due', color: 'var(--warning, #d39b2a)' },
    reminder: { Icon: Bell, label: 'Reminder', color: 'var(--success, #3f9b6b)' },
    scheduled: { Icon: Clock3, label: 'Scheduled message', color: 'var(--text-muted)' },
};

export const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
const idOf = (v) => String(v?._id || v?.id || v || '');
const clock = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Server rows → [{ id, kind, title, at, end, allDay, href }] for the calendar, by time. */
export function toCalendarEvents({ meetings = [], tasks = [], reminders = [], scheduled = [], me, workspaceId }) {
    const out = [];
    for (const m of meetings) {
        const at = m.scheduledStart || m.startTime || m.startedAt;
        if (!at) continue;
        out.push({ id: `m:${idOf(m)}`, kind: m.kind === 'huddle' ? 'huddle' : 'meeting', title: m.title || 'Meeting', at, end: m.scheduledEnd || m.endedAt || null, href: `/workspace/${workspaceId}/meetings/${idOf(m)}` });
    }
    for (const t of tasks) {
        if (!t.dueDate || ['done', 'cancelled'].includes(t.status)) continue;
        const mine = (t.assignedTo || []).some((a) => idOf(a) === me) || idOf(t.createdBy) === me;
        if (me && !mine) continue;
        out.push({ id: `t:${idOf(t)}`, kind: 'task', title: t.title, at: t.dueDate, allDay: true, href: `/workspace/${workspaceId}/tasks/${idOf(t)}` });
    }
    for (const r of reminders) {
        if (!r.remindAt) continue;
        out.push({ id: `r:${idOf(r)}`, kind: 'reminder', title: r.note || 'Message reminder', at: r.remindAt, href: null });
    }
    for (const s of scheduled) {
        if (!s.sendAt) continue;
        out.push({ id: `s:${s.id}`, kind: 'scheduled', title: 'Scheduled message', at: s.sendAt, href: null });
    }
    return out.sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || String(a.at).localeCompare(String(b.at)));
}

function monthWeeks(year, month) {
    const first = new Date(year, month, 1);
    const pad = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells = [...Array(pad).fill(null), ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

const get = (url, params) => api.get(url, { params }).then((r) => r.data).catch(() => null);

export default function ActivityCalendar({ workspaceId }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const me = String(user?._id || user?.id || '');
    const today = new Date();
    const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
    const [selected, setSelected] = useState(dayKey(today));
    const [data, setData] = useState(null);

    useEffect(() => {
        if (!workspaceId) return undefined;
        let gone = false;
        Promise.all([
            get('/v2/meetings', { workspaceId, status: 'upcoming', limit: 100 }),
            get('/v2/meetings', { workspaceId, status: 'past', limit: 60 }),
            get('/v2/tasks', { workspaceId }),
            get('/v2/messages/reminders'),
            get('/v2/scheduled-messages', { workspaceId }),
        ]).then(([up, past, tasks, reminders, scheduled]) => {
            if (gone) return;
            setData({
                meetings: [...(up?.meetings || []), ...(past?.meetings || [])],
                tasks: tasks?.tasks || [],
                reminders: reminders?.reminders || [],
                scheduled: scheduled?.scheduled || [],
            });
        });
        return () => { gone = true; };
    }, [workspaceId]);

    const events = useMemo(() => (data ? toCalendarEvents({ ...data, me, workspaceId }) : []), [data, me, workspaceId]);
    const byDay = useMemo(() => {
        const map = new Map();
        for (const e of events) {
            const k = dayKey(e.at);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(e);
        }
        return map;
    }, [events]);
    const dayEvents = byDay.get(selected) || [];
    const move = (by) => setCursor((c) => {
        const d = new Date(c.y, c.m + by, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    });
    const [sy, sm, sd] = selected.split('-').map(Number);
    const navBtn = { width: 32, height: 32, display: 'grid', placeItems: 'center', border: '1px solid var(--border-default)', borderRadius: 10, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' };

    return (
        <div data-testid="activity-calendar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
            <div className="gl-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <button type="button" aria-label="Previous month" onClick={() => move(-1)} style={navBtn}><ChevronLeft size={16} /></button>
                    <button type="button" onClick={() => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSelected(dayKey(today)); }}
                        style={{ background: 'none', border: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                        {new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </button>
                    <button type="button" aria-label="Next month" onClick={() => move(1)} style={navBtn}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
                </div>
                {monthWeeks(cursor.y, cursor.m).map((week, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                        {week.map((d, j) => {
                            if (!d) return <span key={j} />;
                            const k = dayKey(d);
                            const list = byDay.get(k) || [];
                            const isSel = k === selected;
                            const isToday = k === dayKey(today);
                            return (
                                <button key={j} type="button" onClick={() => setSelected(k)} aria-pressed={isSel}
                                    aria-label={`${d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}${list.length ? `, ${list.length} items` : ''}`}
                                    style={{ height: 52, borderRadius: 10, border: isToday && !isSel ? '1px solid var(--accent)' : '1px solid transparent', background: isSel ? 'var(--accent)' : 'transparent', color: isSel ? 'var(--text-on-accent, #1a1408)' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: isToday ? 700 : 500 }}>
                                    {d.getDate()}
                                    <span style={{ display: 'flex', gap: 3, height: 6 }}>
                                        {[...new Set(list.map((e) => e.kind))].slice(0, 3).map((kind) => (
                                            <span key={kind} style={{ width: 6, height: 6, borderRadius: 6, background: isSel ? 'currentColor' : KIND[kind].color }} />
                                        ))}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div>
                <div className="gl-x-group-label">{new Date(sy, sm, sd).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {!data ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading…</p>
                ) : dayEvents.length ? (
                    <div className="gl-card" style={{ padding: 4 }}>
                        {dayEvents.map((e) => {
                            const K = KIND[e.kind];
                            return (
                                <button key={e.id} type="button" disabled={!e.href} onClick={() => e.href && navigate(e.href)} data-testid="calendar-event"
                                    style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '10px 12px', border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: e.href ? 'pointer' : 'default', borderRadius: 10 }}>
                                    <span style={{ width: 64, fontSize: 12, color: 'var(--text-secondary)' }}>{e.allDay ? 'All day' : clock(e.at)}</span>
                                    <span style={{ width: 3, height: 30, borderRadius: 3, background: K.color }} aria-hidden />
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                                            <K.Icon size={12} /> {K.label}{e.end && !e.allDay ? ` · until ${clock(e.end)}` : ''}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <PanelEmpty icon={CalendarDays} title="Nothing on this day" text="Meetings, huddles, tasks due, reminders and scheduled messages show up here." />
                )}
            </div>
        </div>
    );
}
