// A conversation's unread count on this phone. Opening a chat marks it read on the server; the
// chat list (cached) is cleared at once too, so going back doesn't show the old count until the
// list reloads. Another device reading it clears it here as well (`conversation:read`).
import { getQueryData, queryKeys, setQueryData } from './query.js';

export function clearUnreadLocally(kind, id) {
  if (!id) return;
  const prefix = kind === 'channel' ? 'channels:' : 'dms:';
  for (const key of queryKeys(prefix)) {
    const list = getQueryData(key);
    if (!Array.isArray(list) || !list.some((c) => String(c?.id) === String(id) && (c.unread || c.mentions))) continue;
    setQueryData(key, list.map((c) => (String(c?.id) === String(id) ? { ...c, unread: 0, mentions: 0 } : c)));
  }
}
