/**
 * Meeting clashes and priority (server: features/meetings/conflicts.js).
 *
 * POST /api/v2/meetings/conflicts answers
 *   { hasConflicts, conflictCount, start, end,
 *     attendees: [{ userId, name, isOrganizer, conflicts: [{ meetingId, title|null, busy, start, end, priority }] }],
 *     suggestions: [{ start, end, allAvailable }] }
 * and every meeting carries `priority` and `conflicts` ([{ meetingId, userIds, mine, busy, title|null, priority, start, end }]).
 * Pure helpers, no React: unit-tested.
 */

export const MEETING_PRIORITIES = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];
const LABEL = Object.fromEntries(MEETING_PRIORITIES.map((p) => [p.value, p.label]));

export const normalizePriority = (p) => (LABEL[p] ? p : 'normal');
export const priorityLabel = (p) => LABEL[normalizePriority(p)];
/** Chip tone for a priority (page kit tones); normal has none. */
export const priorityTone = (p) => ({ low: undefined, normal: undefined, high: 'warning', urgent: 'danger' })[normalizePriority(p)];

const time = (d) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
export const timeRange = (start, end) => `${time(start)}–${time(end)}`;

/** "Design review · High priority", or "Busy · High priority" when the title is hidden. */
export function clashDetail(c) {
    return `${c?.title || 'Busy'} · ${priorityLabel(c?.priority)} priority`;
}

/**
 * One line per busy person, organiser ("You") first:
 *   [{ userId, name, isOrganizer, text: 'Asha is busy 09:00–09:30 (Design review · High priority)' }]
 * `nameOf(userId)` can supply names the server did not send.
 */
export function conflictLines(result, { nameOf } = {}) {
    if (!result || !Array.isArray(result.attendees)) return [];
    const lines = [];
    const people = [...result.attendees].sort((a, b) => Number(!!b.isOrganizer) - Number(!!a.isOrganizer));
    for (const a of people) {
        for (const c of a.conflicts || []) {
            const who = a.isOrganizer ? 'You are' : `${a.name || nameOf?.(a.userId) || 'Someone'} is`;
            lines.push({
                key: `${a.userId}:${c.meetingId}`,
                userId: a.userId,
                isOrganizer: !!a.isOrganizer,
                priority: normalizePriority(c.priority),
                text: `${who} busy ${timeRange(c.start, c.end)} (${clashDetail(c)})`,
            });
        }
    }
    return lines;
}

/** Free-slot suggestions as { start: Date, end: Date } (future ones only). */
export function conflictSuggestions(result, now = Date.now()) {
    return (result?.suggestions || [])
        .map((s) => ({ start: new Date(s.start), end: new Date(s.end) }))
        .filter((s) => !Number.isNaN(s.start.getTime()) && s.end.getTime() > now);
}

/** A meeting's clashes (as stored on it): [] when none. */
export const meetingClashes = (m) => (Array.isArray(m?.conflicts) ? m.conflicts : []);

/**
 * The short marker for lists and calendars: "Clashes with Standup" for the viewer's own clash,
 * "2 people double-booked" otherwise. Null when the meeting has no clash.
 */
export function clashMarker(m) {
    const list = meetingClashes(m);
    if (!list.length) return null;
    const mine = list.filter((c) => c.mine);
    if (mine.length) {
        const first = mine[0];
        const more = mine.length > 1 ? ` +${mine.length - 1}` : '';
        return {
            mine: true,
            label: `Clashes with ${first.title || 'another meeting'}${more}`,
            title: mine.map((c) => `${c.title || 'Busy'} ${timeRange(c.start, c.end)} · ${priorityLabel(c.priority)} priority`).join('\n'),
        };
    }
    const people = new Set(list.flatMap((c) => c.userIds || []));
    const n = people.size || list.length;
    return {
        mine: false,
        label: `${n} ${n === 1 ? 'person' : 'people'} double-booked`,
        title: list.map((c) => `Busy ${timeRange(c.start, c.end)} · ${priorityLabel(c.priority)} priority`).join('\n'),
    };
}

/** The toast after saving: a plain "Meeting scheduled", or a warning naming the clash. */
export function scheduledToast(meeting, { verb = 'scheduled' } = {}) {
    const marker = clashMarker(meeting);
    if (!marker) return { text: `Meeting ${verb}`, tone: 'success' };
    return { text: `Meeting ${verb}, but it clashes: ${marker.label.charAt(0).toLowerCase()}${marker.label.slice(1)}`, tone: 'warning' };
}

