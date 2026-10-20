import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The adapter's huddle helpers, recorded instead of sent.
const sent = [];
const helpers = {
  emit: (event, payload) => sent.push({ event, payload }),
  request: vi.fn(async () => ({ huddles: [] })),
  connected: () => true,
  iceServers: vi.fn(async () => ({ iceServers: [{ urls: 'stun:example.org' }] })),
  meetings: vi.fn(async () => []),
  joinMeeting: vi.fn(async (id) => ({ _id: id, title: 'Standup', channelId: 'c1', workspaceId: 'w1' })),
};
vi.mock('../../data/session.js', () => ({
  api: () => ({ huddles: helpers }),
  useSession: { getState: () => ({ user: { id: 'me', name: 'Me' }, workspaceId: 'w1' }) },
}));

const { emit } = await import('../../lib/bus.js');
const huddle = await import('./huddle.js');
const { useHuddle } = huddle;

const fire = (event, payload) => emit('huddle', { event, payload });

beforeEach(() => {
  sent.length = 0;
  globalThis.navigator.mediaDevices = {
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop() {}, kind: 'audio' }], getAudioTracks: () => [{ enabled: true }] })),
  };
  huddle.bindHuddles();
});
afterEach(() => {
  huddle.__resetHuddles();
});

describe('huddles on the phone', () => {
  it('marks a conversation live when a huddle starts there, and clears it when it ends', () => {
    fire('huddle:started', { huddleId: 'h1', channelId: 'c1', startedBy: { _id: 'sam', username: 'sam' } });
    expect(useHuddle.getState().live.c1).toMatchObject({ huddleId: 'h1', startedBy: { username: 'sam' } });
    fire('huddle:ended', { huddleId: 'h1', channelId: 'c1' });
    expect(useHuddle.getState().live.c1).toBeUndefined();
  });

  it('rings for a DM call from someone else, not for my own', () => {
    fire('huddle:started', { huddleId: 'mine', dmId: 'd1', startedBy: { _id: 'me' } });
    expect(useHuddle.getState().ring).toBeNull();
    fire('huddle:started', { huddleId: 'theirs', dmId: 'd1', startedBy: { _id: 'sam', username: 'sam' } });
    expect(useHuddle.getState().ring).toMatchObject({ huddleId: 'theirs', dmId: 'd1' });
    fire('huddle:ended', { huddleId: 'theirs', dmId: 'd1' });
    expect(useHuddle.getState().ring).toBeNull();
  });

  it('joins a live huddle with the microphone and mutes it', async () => {
    await huddle.joinHuddle('h1', { channelId: 'c1' }, '# general');
    expect(sent).toContainEqual({ event: 'huddle:join', payload: { channelId: 'c1', huddleId: 'h1', audioEnabled: true, videoEnabled: false } });
    expect(useHuddle.getState().call).toMatchObject({ huddleId: 'h1', scope: { channelId: 'c1' } });
    huddle.toggleMute();
    expect(sent.at(-1)).toEqual({ event: 'huddle:audio_toggle', payload: { huddleId: 'h1', audioEnabled: false } });
    huddle.leave();
    expect(sent.at(-1)).toEqual({ event: 'huddle:leave', payload: { huddleId: 'h1' } });
    expect(useHuddle.getState().call).toBeNull();
  });

  it('starting where a huddle already runs joins that one', async () => {
    await huddle.startHuddle({ dmId: 'd1' }, 'Call');
    const start = sent.find((s) => s.event === 'huddle:start');
    expect(start.payload).toMatchObject({ dmId: 'd1' });
    fire('huddle:existing', { requestedId: start.payload.huddleId, huddleId: 'running' });
    expect(useHuddle.getState().call.huddleId).toBe('running');
    expect(sent.at(-1)).toMatchObject({ event: 'huddle:join', payload: { dmId: 'd1', huddleId: 'running' } });
  });

  it("a scheduled meeting's call is its own huddle, in its channel", async () => {
    await huddle.joinMeeting({ id: 'm1' });
    expect(helpers.joinMeeting).toHaveBeenCalledWith('m1');
    expect(sent.find((s) => s.event === 'huddle:start').payload).toEqual({ channelId: 'c1', huddleId: 'meeting-m1', video: false });
  });

  it('leaves the call when the huddle ends under it', async () => {
    await huddle.joinHuddle('h9', { channelId: 'c1' });
    fire('huddle:ended', { huddleId: 'h9', channelId: 'c1', reason: 'ended' });
    expect(useHuddle.getState().call).toBeNull();
  });
});
