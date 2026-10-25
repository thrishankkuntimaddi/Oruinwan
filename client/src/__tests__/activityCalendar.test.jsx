import { describe, expect, it } from 'vitest';
import { toCalendarEvents } from '../features/notifications/components/ActivityCalendar';

describe('Activity calendar (web)', () => {
    it('lists meetings, my open tasks, reminders and scheduled messages with links', () => {
        const at = (day, h = 9) => new Date(2026, 9, day, h).toISOString();
        const events = toCalendarEvents({
            me: 'me',
            workspaceId: 'w1',
            meetings: [{ _id: 'm1', title: 'Standup', scheduledStart: at(26, 10) }, { _id: 'h1', kind: 'huddle', startedAt: at(25, 15) }, { _id: 'x' }],
            tasks: [
                { _id: 't1', title: 'Ship', dueDate: at(26), status: 'todo', assignedTo: ['me'] },
                { _id: 't2', title: 'Other', dueDate: at(26), status: 'todo', assignedTo: ['ben'], createdBy: 'ben' },
                { _id: 't3', title: 'Done', dueDate: at(26), status: 'done', assignedTo: ['me'] },
            ],
            reminders: [{ _id: 'r1', remindAt: at(27) }],
            scheduled: [{ id: 's1', sendAt: at(27, 18) }],
        });
        expect(events.map((e) => e.id).sort()).toEqual(['m:h1', 'm:m1', 'r:r1', 's:s1', 't:t1']);
        expect(events.find((e) => e.id === 'm:m1').href).toBe('/workspace/w1/meetings/m1');
        expect(events.find((e) => e.id === 't:t1')).toMatchObject({ allDay: true, href: '/workspace/w1/tasks/t1' });
    });
});
