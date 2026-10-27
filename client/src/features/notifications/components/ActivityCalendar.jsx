// Activity → Calendar (web): meetings and huddles, tasks due, message reminders and scheduled
// messages on a Google-Calendar-style calendar (day, week, month, schedule).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import CalendarBoard from '../../calendar/CalendarBoard';
import ScheduleMeetingModal from '../../messaging/chatWindowComp/modals/ScheduleMeetingModal';
import { useScheduledMeetings } from '../../../hooks/useScheduledMeetings';
import { scheduledToast } from '../../../utils/meetingConflicts';

export const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
const idOf = (v) => String(v?._id || v?.id || v || '');

/** Server rows → [{ id, kind, title, at, end, allDay, href }] for the calendar, by time. */
export function toCalendarEvents({ meetings = [], tasks = [], reminders = [], noteReminders = [], scheduled = [], me, workspaceId }) {
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
    for (const r of noteReminders) {
        if (!r.remindAt) continue;
        out.push({ id: `n:${r.id}`, kind: 'reminder', title: `Note: ${r.noteTitle || 'Note'}`, at: r.remindAt, href: `/workspace/${workspaceId}/notes/${r.noteId}` });
    }
    for (const s of scheduled) {
        if (!s.sendAt) continue;
        out.push({ id: `s:${s.id}`, kind: 'scheduled', title: 'Scheduled message', at: s.sendAt, href: null });
    }
    return out.sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || String(a.at).localeCompare(String(b.at)));
}

const get = (url, params) => api.get(url, { params }).then((r) => r.data).catch(() => null);

/**
 * Activity → Calendar: the workspace's meetings and huddles, my tasks due, my reminders and
 * scheduled messages on a full calendar (features/calendar/CalendarBoard.jsx). Create → Meeting
 * (or a click on an empty time) schedules a meeting at that time.
 */
export default function ActivityCalendar({ workspaceId }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast() || {};
    const me = String(user?._id || user?.id || '');
    const [data, setData] = useState(null);
    const [reload, setReload] = useState(0);
    const [scheduleAt, setScheduleAt] = useState(undefined); // undefined: closed; null/Date: open
    const { createMeeting } = useScheduledMeetings(workspaceId);

    useEffect(() => {
        if (!workspaceId) return undefined;
        let gone = false;
        Promise.all([
            get('/v2/meetings', { workspaceId, status: 'upcoming', limit: 100 }),
            get('/v2/meetings', { workspaceId, status: 'past', limit: 60 }),
            get('/v2/tasks', { workspaceId }),
            get('/v2/messages/reminders'),
            get('/v2/scheduled-messages', { workspaceId }),
            get('/v2/notes/reminders', { workspaceId }),
        ]).then(([up, past, tasks, reminders, scheduled, noteReminders]) => {
            if (gone) return;
            setData({
                meetings: [...(up?.meetings || []), ...(past?.meetings || [])],
                tasks: tasks?.tasks || [],
                reminders: reminders?.reminders || [],
                scheduled: scheduled?.scheduled || [],
                noteReminders: noteReminders?.reminders || [],
            });
        });
        return () => { gone = true; };
    }, [workspaceId, reload]);

    const events = useMemo(() => (data ? toCalendarEvents({ ...data, me, workspaceId }) : []), [data, me, workspaceId]);

    return (
        <>
            <CalendarBoard
                events={events}
                loading={!data}
                onOpen={(e) => e.href && navigate(e.href)}
                onCreateMeeting={(at) => setScheduleAt(at || null)}
                onCreateTask={() => navigate(`/workspace/${workspaceId}/tasks?tab=all-tasks`)}
            />
            {scheduleAt !== undefined && (
                <ScheduleMeetingModal
                    workspaceId={workspaceId}
                    initialStart={scheduleAt ? scheduleAt.toISOString() : null}
                    onClose={() => setScheduleAt(undefined)}
                    onSchedule={async (payload) => {
                        const created = await createMeeting(payload);
                        const t = scheduledToast(created);
                        showToast?.(t.text, t.tone);
                        setReload((n) => n + 1);
                    }}
                />
            )}
        </>
    );
}
