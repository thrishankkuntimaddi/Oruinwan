import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The adapter's huddle helpers, recorded instead of sent.
const sent = [];
const helpers = {
  emit: (event, payload) => sent.push({ event, payload }),
  request: vi.fn(async () => ({ huddles: [] })),
  connected: () => true,
  iceServers: vi.fn(async () => ({ iceServers: [{ urls: 'stun:example.org' }] })),
  socketId: () => 'sock-here',
  meetings: vi.fn(async () => []),
};
vi.mock('../../data/session.js', () => ({
  api: () => ({ huddles: helpers }),
  useSession: { getState: () => ({ user: { id: 'me', name: 'Me' }, workspaceId: 'w1' }) },
}));
vi.mock('../chats/chatsUi.js', () => ({ openConversation: vi.fn() }));

const { emit } = await import('../../lib/bus.js');
const huddle = await import('./huddle.js');
const incoming = await import('./incomingCall.js');
const { useHuddle } = huddle;
const fire = (event, payload) => emit('huddle', { event, payload });

let unbind = () => {};
beforeEach(() => {
  vi.useFakeTimers();
  sent.length = 0;
  globalThis.navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] })) };
  huddle.bindHuddles();
  unbind = incoming.bindIncomingCalls();
});
afterEach(() => {
  unbind();
  huddle.__resetHuddles();
  vi.useRealTimers();
});

const dmRing = (over = {}) => ({ huddleId: 'h1', kind: 'dm', dmId: 'd1', from: { id: 'sam', name: 'Sam' }, video: false, ring: true, ...over });

describe('incoming calls on the phone', () => {
  it('a DM call from someone else rings; ring_cancel stops it', () => {
    fire('huddle:ring', dmRing());
    expect(useHuddle.getState().ring).toMatchObject({ huddleId: 'h1', dmId: 'd1', from: { name: 'Sam' } });
    fire('huddle:ring_cancel', { huddleId: 'h1', reason: 'answered_elsewhere' });
    expect(useHuddle.getState().ring).toBeNull();
  });

  it('my own call does not ring', () => {
    fire('huddle:ring', dmRing({ from: { id: 'me', name: 'Me' } }));
    expect(useHuddle.getState().ring).toBeNull();
  });

  it('a channel huddle is a notice, not a ring', () => {
    fire('huddle:ring', { huddleId: 'h2', kind: 'channel', channelId: 'c1', title: 'design', from: { id: 'sam', name: 'Sam' }, ring: false });
    expect(useHuddle.getState().ring).toBeNull();
    expect(useHuddle.getState().notice).toMatchObject({ huddleId: 'h2', channelId: 'c1' });
  });

  it('declining tells the server', () => {
    fire('huddle:ring', dmRing());
    incoming.declineRing();
    expect(sent.at(-1)).toEqual({ event: 'huddle:decline', payload: { huddleId: 'h1' } });
    expect(useHuddle.getState().ring).toBeNull();
  });

  it('stops ringing when the call ends or times out', () => {
    fire('huddle:ring', dmRing());
    fire('huddle:ended', { huddleId: 'h1', dmId: 'd1' });
    expect(useHuddle.getState().ring).toBeNull();
    fire('huddle:ring', dmRing({ huddleId: 'h3', expiresAt: Date.now() + 10_000 }));
    vi.advanceTimersByTime(10_001);
    expect(useHuddle.getState().ring).toBeNull();
  });

  it('older servers: huddle:started for a DM still rings, once', () => {
    fire('huddle:started', { huddleId: 'h4', dmId: 'd1', startedBy: { _id: 'sam', username: 'sam' } });
    expect(useHuddle.getState().ring).toBeNull();
    vi.advanceTimersByTime(1600);
    expect(useHuddle.getState().ring).toMatchObject({ huddleId: 'h4', from: { name: 'sam' } });
  });

  it('a huddle:ring right after huddle:started wins (no double ring)', () => {
    fire('huddle:started', { huddleId: 'h5', dmId: 'd1', startedBy: { _id: 'sam', username: 'sam' } });
    fire('huddle:ring', dmRing({ huddleId: 'h5' }));
    vi.advanceTimersByTime(1600);
    expect(useHuddle.getState().ring).toMatchObject({ huddleId: 'h5', from: { name: 'Sam' } });
  });

  it('answering joins the call', async () => {
    fire('huddle:ring', dmRing());
    const answering = incoming.answerRing();
    await vi.runAllTimersAsync();
    await answering.catch(() => {});
    expect(sent.find((s) => s.event === 'huddle:join')?.payload).toMatchObject({ huddleId: 'h1', dmId: 'd1' });
    expect(useHuddle.getState().ring).toBeNull();
  });
});
