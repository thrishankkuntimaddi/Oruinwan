import { describe, expect, test } from 'vitest';
import { fromStarted, normalizeRing, ringAction, ringScope, ringSubtitle, RING_MS } from './ringLogic.js';

const NOW = 1_000_000;

describe('normalizeRing', () => {
  test('a DM call rings', () => {
    const r = normalizeRing({ huddleId: 'h1', kind: 'dm', dmId: 'd1', from: { id: 'u2', name: 'Ben' }, video: true }, NOW);
    expect(r).toMatchObject({ huddleId: 'h1', kind: 'dm', dmId: 'd1', ring: true, video: true, from: { id: 'u2', name: 'Ben' } });
    expect(r.expiresAt).toBe(NOW + RING_MS);
  });

  test('a channel huddle never rings, even if ring is set', () => {
    expect(normalizeRing({ huddleId: 'h1', kind: 'channel', channelId: 'c1', ring: true }, NOW).ring).toBe(false);
  });

  test('FCM string values: "false" does not ring, "true" video', () => {
    const r = normalizeRing({ huddleId: 'h1', dmId: 'd1', ring: 'false', video: 'true', expiresAt: String(NOW + 5000) }, NOW);
    expect(r.ring).toBe(false);
    expect(r.video).toBe(true);
    expect(r.expiresAt).toBe(NOW + 5000);
  });

  test('no huddleId: nothing', () => {
    expect(normalizeRing({ dmId: 'd1' })).toBeNull();
    expect(normalizeRing(null)).toBeNull();
  });
});

describe('ringAction', () => {
  const ring = normalizeRing({ huddleId: 'h1', kind: 'dm', dmId: 'd1', from: { id: 'u2', name: 'Ben' } }, NOW);
  test('rings when free', () => expect(ringAction(ring, { myId: 'u1', now: NOW })).toBe('ring'));
  test('not for my own call', () => expect(ringAction(ring, { myId: 'u2', now: NOW })).toBe('ignore'));
  test('not while I am in a call (busy)', () => expect(ringAction(ring, { myId: 'u1', inCall: true, now: NOW })).toBe('ignore'));
  test('not twice', () => expect(ringAction(ring, { myId: 'u1', current: ring, now: NOW })).toBe('ignore'));
  test('not after it expired', () => expect(ringAction(ring, { myId: 'u1', now: NOW + RING_MS + 1 })).toBe('ignore'));
  test('a channel huddle is a notice', () => {
    const c = normalizeRing({ huddleId: 'h2', kind: 'channel', channelId: 'c1', from: { id: 'u2', name: 'Ben' }, ring: false }, NOW);
    expect(ringAction(c, { myId: 'u1', now: NOW })).toBe('notice');
  });
});

describe('fromStarted (servers before 2.3)', () => {
  test('a DM huddle someone else started rings', () => {
    const r = fromStarted({ huddleId: 'h1', dmId: 'd1', startedBy: { _id: 'u2', username: 'ben' } }, 'u1', NOW);
    expect(r).toMatchObject({ huddleId: 'h1', kind: 'dm', ring: true, from: { id: 'u2', name: 'ben' } });
  });
  test('not my own, not a channel', () => {
    expect(fromStarted({ huddleId: 'h1', dmId: 'd1', startedBy: { _id: 'u1' } }, 'u1', NOW)).toBeNull();
    expect(fromStarted({ huddleId: 'h1', channelId: 'c1', startedBy: { _id: 'u2' } }, 'u1', NOW)).toBeNull();
  });
});

describe('helpers', () => {
  test('ringScope', () => {
    expect(ringScope({ dmId: 'd1' })).toEqual({ dmId: 'd1' });
    expect(ringScope({ channelId: 'c1' })).toEqual({ channelId: 'c1' });
  });
  test('ringSubtitle', () => {
    expect(ringSubtitle({ video: true, kind: 'dm' })).toBe('Incoming video call');
    expect(ringSubtitle({ video: false, kind: 'group_dm' })).toBe('Incoming voice call · group');
  });
});
