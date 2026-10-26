// Where a task comment stands with the task's linked chat thread (server:
// features/tasks/tasks.threadSync.js), in plain words — one wording for the web, desktop and phone
// apps. Returns null when there is nothing to say.

const SKIPPED = {
  audience: "Only here: some people in the chat thread can't see this task",
  author_cannot_post: "Only here: you can't post in that chat thread",
  thread_locked: 'Only here: the chat thread is locked',
  thread_gone: 'Only here: the chat thread was deleted',
};

export function syncLabel(entry) {
  if (entry?.mirror || entry?.fromThread) return 'From the chat thread';
  const s = entry?.sync;
  if (!s) return null;
  switch (s.state) {
    case 'synced': return 'Also in the chat thread';
    case 'pending': return 'Sharing to the chat thread…';
    case 'failed': return "Couldn't share to the chat thread";
    case 'skipped': return SKIPPED[s.reason] || null;
    default: return null;
  }
}
