// What a server notification is (its kind in the app) and what it opens. Used for the in-app
// list (adapter.js mapNotification) and for tapped pushes, which carry only
// { type, link, channelId, dmSessionId, parentMessageId } (no meta).

/** Server notification type → the app's kind (icon, filters). Task types map to 'task' separately. */
export const NOTIF_TYPE = {
  mention: 'mention', dm: 'dm', direct_message: 'dm', thread_reply: 'thread', thread_added: 'thread', reaction: 'reaction',
  meeting_reminder: 'meeting', schedule_created: 'meeting', huddle_started: 'meeting', meeting_recap: 'meeting', note_shared: 'note',
  design_review: 'design', ai_suggestion: 'ai',
};

export function notificationKind(type) {
  if (typeof type !== 'string') return 'note';
  if (type.startsWith('task')) return 'task';
  return NOTIF_TYPE[type] || 'note';
}

const HEX = '[0-9a-f]{24}';

/** Targets that can be read from a notification link (web routes). */
function targetFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  const review = link.match(new RegExp(`[?&]review=(${HEX})`, 'i'));
  if (review) return { kind: 'designReview', id: review[1] };
  const meeting = link.match(new RegExp(`meetings/(${HEX})`, 'i'));
  if (meeting) return { kind: 'meeting', id: meeting[1] };
  const task = link.match(new RegExp(`tasks?/(${HEX})`, 'i')) || link.match(new RegExp(`[?&]task(?:Id)?=(${HEX})`, 'i'));
  if (task) return { kind: 'task', id: task[1] };
  const ch = link.match(new RegExp(`channels?/(${HEX})`, 'i'));
  if (ch) return { kind: 'channel', id: ch[1] };
  const dm = link.match(new RegExp(`dm/(${HEX})`, 'i'));
  if (dm) return { kind: 'dm', id: dm[1] };
  if (/\/tasks\b/.test(link)) return { kind: 'tasks' };
  return null;
}

/**
 * What tapping a notification opens: { kind, id, … } or null.
 * kinds: task, tasks (the Tasks tab), note, thread, meeting (+ tab), designReview, dm, channel.
 */
export function targetOf(n) {
  const meta = n?.meta || {};
  // "Planning ended · View the recap": the meeting page on Summary & actions (before channelId,
  // which a recap also carries).
  if (n?.type === 'meeting_recap' || meta.kind === 'meeting_recap') {
    const id = meta.meetingId || targetFromLink(n?.link)?.id;
    if (id) return { kind: 'meeting', id: String(id), tab: 'summary' };
  }
  if (n?.type === 'design_review' && meta.reviewId) return { kind: 'designReview', id: String(meta.reviewId) };
  if (meta.taskId) return { kind: 'task', id: String(meta.taskId) };
  if (meta.noteId) return { kind: 'note', id: String(meta.noteId) };
  // A thread reply opens its thread (in a channel or a DM).
  const parent = meta.parentMessageId || meta.parentId;
  if (parent && (meta.channelId || meta.dmSessionId)) {
    return meta.channelId
      ? { kind: 'thread', id: String(parent), conv: String(meta.channelId), convKind: 'channel' }
      : { kind: 'thread', id: String(parent), conv: String(meta.dmSessionId), convKind: 'dm' };
  }
  if (meta.scheduledMeetingId) return { kind: 'meeting', id: String(meta.scheduledMeetingId) };
  // Meeting reminders and "turn action items into tasks" suggestions.
  if (meta.meetingId && (n?.type === 'meeting_reminder' || n?.type === 'ai_suggestion')) return { kind: 'meeting', id: String(meta.meetingId) };
  if (meta.dmSessionId) return { kind: 'dm', id: String(meta.dmSessionId) };
  if (meta.channelId) return { kind: 'channel', id: String(meta.channelId) };
  const fromLink = targetFromLink(n?.link);
  if (fromLink) return fromLink;
  // "You have 3 overdue tasks": the task list.
  if (n?.type === 'ai_suggestion' && meta.kind === 'overdue_tasks') return { kind: 'tasks' };
  return null;
}

/** The target of a tapped push (its data payload). */
export function pushTarget(data = {}) {
  return targetOf({
    type: data.type,
    link: data.link,
    meta: { channelId: data.channelId, dmSessionId: data.dmSessionId, parentMessageId: data.parentMessageId },
  });
}
