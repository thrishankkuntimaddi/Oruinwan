import { describe, expect, it } from 'vitest';
import { notificationKind, pushTarget, targetOf } from './notificationTarget.js';

const R = '64f0c0ffee0000000000abcd';
const M = '64f0c0ffee0000000000beef';

describe('notification kinds', () => {
  it('maps the server types', () => {
    expect(notificationKind('task_assigned')).toBe('task');
    expect(notificationKind('design_review')).toBe('design');
    expect(notificationKind('ai_suggestion')).toBe('ai');
    expect(notificationKind('meeting_reminder')).toBe('meeting');
    expect(notificationKind('thread_reply')).toBe('thread');
    expect(notificationKind('something_new')).toBe('note');
    expect(notificationKind(undefined)).toBe('note');
  });
});

describe('notification targets', () => {
  it('design reviews open the review', () => {
    expect(targetOf({ type: 'design_review', meta: { kind: 'annotation', reviewId: R, fileId: M } })).toEqual({ kind: 'designReview', id: R });
    expect(targetOf({ type: 'design_review', link: `/workspace/w/files?file=${M}&review=${R}`, meta: {} })).toEqual({ kind: 'designReview', id: R });
  });

  it('meeting reminders open the meeting', () => {
    expect(targetOf({ type: 'meeting_reminder', meta: { meetingId: M, scheduledMeetingId: M, startsIn: '10 min' } })).toEqual({ kind: 'meeting', id: M });
    expect(targetOf({ type: 'meeting_reminder', meta: { meetingId: M } })).toEqual({ kind: 'meeting', id: M });
  });

  it('AI suggestions open the meeting, the task or the task list', () => {
    expect(targetOf({ type: 'ai_suggestion', meta: { kind: 'meeting_action_items', meetingId: M } })).toEqual({ kind: 'meeting', id: M });
    expect(targetOf({ type: 'ai_suggestion', meta: { kind: 'overdue_tasks', count: 3, taskId: R } })).toEqual({ kind: 'task', id: R });
    expect(targetOf({ type: 'ai_suggestion', meta: { kind: 'overdue_tasks', count: 3 }, link: '/workspace/w/tasks' })).toEqual({ kind: 'tasks' });
    expect(targetOf({ type: 'ai_suggestion', meta: { kind: 'overdue_tasks', count: 3 } })).toEqual({ kind: 'tasks' });
  });

  it('keeps the message targets', () => {
    expect(targetOf({ type: 'thread_reply', meta: { channelId: 'c', parentMessageId: 'p' } })).toEqual({ kind: 'thread', id: 'p', conv: 'c', convKind: 'channel' });
    expect(targetOf({ type: 'dm', meta: { dmSessionId: 'd' } })).toEqual({ kind: 'dm', id: 'd' });
    expect(targetOf({ type: 'x', meta: {} })).toBeNull();
  });

  it('reads push data, which has a link but no meta', () => {
    expect(pushTarget({ type: 'meeting_reminder', link: `/meetings/${M}` })).toEqual({ kind: 'meeting', id: M });
    expect(pushTarget({ type: 'design_review', link: `/workspace/w/files?file=${M}&review=${R}` })).toEqual({ kind: 'designReview', id: R });
    expect(pushTarget({ type: 'mention', channelId: 'c1' })).toEqual({ kind: 'channel', id: 'c1' });
    expect(pushTarget({})).toBeNull();
  });
});
