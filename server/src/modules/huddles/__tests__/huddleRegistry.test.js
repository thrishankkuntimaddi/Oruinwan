'use strict';

const { HuddleRegistry, maxParticipantsFromEnv } = require('../huddleRegistry');

describe('HuddleRegistry', () => {
  let r;
  beforeEach(() => {
    r = new HuddleRegistry({ maxParticipants: 3 });
    r.ensure('h1', { channelId: 'c1' }, { channelName: 'general' });
  });

  test('join returns the participants already present', () => {
    expect(r.join('h1', { userId: 'a', username: 'A', socketId: 's1' }).others).toEqual([]);
    const second = r.join('h1', { userId: 'b', username: 'B', socketId: 's2' });
    expect(second.others.map((p) => p.userId)).toEqual(['a']);
    expect(second.others[0]).not.toHaveProperty('socketId');
  });

  test('enforces the participant cap but lets an existing member rejoin', () => {
    r.join('h1', { userId: 'a', socketId: 's1' });
    r.join('h1', { userId: 'b', socketId: 's2' });
    r.join('h1', { userId: 'c', socketId: 's3' });
    expect(r.join('h1', { userId: 'd', socketId: 's4' }).error).toBe('HUDDLE_FULL');
    const again = r.join('h1', { userId: 'c', socketId: 's9' });
    expect(again.error).toBeUndefined();
    expect(again.replacedSocketId).toBe('s3');
  });

  test('scope mismatch is rejected', () => {
    expect(r.ensure('h1', { dmId: 'd1' }).error).toBe('HUDDLE_SCOPE_MISMATCH');
    expect(r.ensure('h1', { channelId: 'c1' }).huddle).toBeTruthy();
  });

  test('last leave ends and deletes the huddle', () => {
    r.join('h1', { userId: 'a', socketId: 's1' });
    r.join('h1', { userId: 'b', socketId: 's2' });
    expect(r.leave('h1', 'a')).toMatchObject({ removed: true, ended: false });
    expect(r.leave('h1', 'b')).toMatchObject({ removed: true, ended: true });
    expect(r.get('h1')).toBeNull();
  });

  test('a stale socket cannot remove a fresh join', () => {
    r.join('h1', { userId: 'a', socketId: 'old' });
    r.join('h1', { userId: 'a', socketId: 'new' });
    expect(r.leave('h1', 'a', 'old').removed).toBe(false);
    expect(r.participant('h1', 'a').socketId).toBe('new');
    expect(r.huddlesForSocket('new')).toEqual(['h1']);
    expect(r.huddlesForSocket('old')).toEqual([]);
  });

  test('setAudio and list summaries', () => {
    r.join('h1', { userId: 'a', username: 'A', socketId: 's1' });
    r.setAudio('h1', 'a', false);
    const [summary] = r.list();
    expect(summary).toMatchObject({ huddleId: 'h1', channelId: 'c1', channelName: 'general' });
    expect(summary.participants).toEqual([expect.objectContaining({ userId: 'a', audioEnabled: false })]);
  });

  test('HUDDLE_MAX_PARTICIPANTS env parsing', () => {
    expect(maxParticipantsFromEnv({})).toBe(6);
    expect(maxParticipantsFromEnv({ HUDDLE_MAX_PARTICIPANTS: '10' })).toBe(10);
    expect(maxParticipantsFromEnv({ HUDDLE_MAX_PARTICIPANTS: '1' })).toBe(6);
    expect(maxParticipantsFromEnv({ HUDDLE_MAX_PARTICIPANTS: 'abc' })).toBe(6);
  });
});
