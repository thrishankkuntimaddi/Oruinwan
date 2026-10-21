import { describe, it, expect, beforeEach } from 'vitest';
import { clearQueries, getQueryData, setQueryData } from '../query.js';
import { applyNotificationEvent, mapNotification } from './notificationLive.js';

const WS = 'w1';
const KEY = `notifications:${WS}`;
const row = (id, extra = {}) => ({ id, type: 'dm', read: false, count: 1, ...extra });

describe('notification list patching', () => {
  beforeEach(() => {
    clearQueries();
    setQueryData(KEY, [row('a'), row('b')]);
  });

  it('a grouped row that counts up moves to the top in place of its old copy', () => {
    applyNotificationEvent('notification:updated', {
      notification: { _id: 'b', type: 'dm', workspaceId: WS, title: 'ben · 3 new messages', meta: { count: 3 }, updatedAt: '2026-10-22T09:00:00Z' },
    });
    const list = getQueryData(KEY);
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
    expect(list[0]).toMatchObject({ count: 3, title: 'ben · 3 new messages', at: '2026-10-22T09:00:00Z' });
  });

  it('read, deleted and cleared patch the list without a refetch', () => {
    applyNotificationEvent('notification:read', { workspaceId: WS, ids: ['a'] });
    expect(getQueryData(KEY).find((x) => x.id === 'a').read).toBe(true);
    applyNotificationEvent('notification:deleted', { workspaceId: WS, ids: ['b'] });
    expect(getQueryData(KEY).map((x) => x.id)).toEqual(['a']);
    applyNotificationEvent('notification:cleared', { workspaceId: WS });
    expect(getQueryData(KEY)).toEqual([]);
  });

  it('maps the count of a grouped row', () => {
    expect(mapNotification({ _id: 'x', type: 'mention', meta: { count: 4 } }).count).toBe(4);
    expect(mapNotification({ _id: 'y', type: 'task_assigned' }).count).toBe(1);
  });
});
