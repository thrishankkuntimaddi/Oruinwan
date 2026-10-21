import { describe, expect, it } from 'vitest';
import { conversationOf, quickReplyPlan } from './quickReply.js';
import { actionOf, notificationIdFor } from '../../native/push.js';

describe('notification actions', () => {
  it('reads the action from the plugins', () => {
    expect(actionOf('tap')).toBeNull();
    expect(actionOf(undefined)).toBeNull();
    expect(actionOf('dismiss')).toBeNull();
    expect(actionOf('reply', 'On my way')).toEqual({ id: 'reply', input: 'On my way' });
    expect(actionOf('read')).toEqual({ id: 'read', input: '' });
  });

  it('plans what each action does', () => {
    expect(quickReplyPlan({ channelId: 'c1' }, null)).toEqual({ kind: 'open', conv: { kind: 'channel', id: 'c1', parentId: null } });
    expect(quickReplyPlan({ dmSessionId: 'd1' }, { id: 'read' })).toMatchObject({ kind: 'read', conv: { kind: 'dm', id: 'd1' } });
    expect(quickReplyPlan({ dmSessionId: 'd1', parentMessageId: 'p1' }, { id: 'reply', input: '  hi  ' })).toEqual({
      kind: 'reply',
      conv: { kind: 'dm', id: 'd1', parentId: 'p1' },
      text: 'hi',
    });
    expect(quickReplyPlan({ taskId: 't1' }, { id: 'reply', input: 'x' })).toEqual({ kind: 'notifications' });
    expect(conversationOf()).toBeNull();
  });

  it('gives each conversation one stable notification id', () => {
    expect(notificationIdFor('abc')).toBe(notificationIdFor('abc'));
    expect(notificationIdFor('abc')).not.toBe(notificationIdFor('abd'));
    expect(notificationIdFor('64f0c0ffee0000000000abcd')).toBeGreaterThan(0);
  });
});
