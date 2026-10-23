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

// A MediaStream stand-in: tracks of the kinds asked for.
function fakeStream(kinds) {
  const tracks = kinds.map((kind) => ({ kind, enabled: true, readyState: 'live', muted: false, stop: vi.fn() }));
  return {
    tracks,
    getTracks: () => [...tracks],
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    addTrack: (t) => tracks.push(t),
    removeTrack: (t) => tracks.splice(tracks.indexOf(t), 1),
  };
}

beforeEach(() => {
  sent.length = 0;
  globalThis.navigator.mediaDevices = {
    getUserMedia: vi.fn(async (c) => fakeStream([...(c.audio ? ['audio'] : []), ...(c.video ? ['video'] : [])])),
  };
  huddle.bindHuddles();
});

const lastOf = (event) => sent.filter((s) => s.event === event).at(-1)?.payload;
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

  it('joins a live huddle with the microphone and mutes it', async () => {
    await huddle.joinHuddle('h1', { channelId: 'c1' }, '# general');
    expect(lastOf('huddle:join')).toEqual({ channelId: 'c1', huddleId: 'h1', audioEnabled: true, videoEnabled: false, device: { label: 'Android phone', platform: 'web' } });
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
    expect(sent.find((s) => s.event === 'huddle:start').payload).toMatchObject({ channelId: 'c1', huddleId: 'meeting-m1', video: false });
  });

  it('leaves the call when the huddle ends under it', async () => {
    await huddle.joinHuddle('h9', { channelId: 'c1' });
    fire('huddle:ended', { huddleId: 'h9', channelId: 'c1', reason: 'ended' });
    expect(useHuddle.getState().call).toBeNull();
  });

  it('remembers the meeting record of the call from huddle payloads', async () => {
    await huddle.joinHuddle('h7', { channelId: 'c1' });
    expect(useHuddle.getState().call.meetingId).toBeNull();
    fire('huddle:roster', { huddleId: 'h7', meetingId: 'rec1', participants: [] });
    expect(useHuddle.getState().call.meetingId).toBe('rec1');
  });

  it('starts a workspace huddle and joins a meeting call with its record id', async () => {
    await huddle.startWorkspaceHuddle();
    expect(sent.find((x) => x.event === 'huddle:start').payload).toMatchObject({ workspaceId: 'w1' });
    huddle.leave();
    await huddle.joinMeetingCall({ id: 'm5', kind: 'scheduled', title: 'Standup', raw: { _id: 'm5' } });
    expect(useHuddle.getState().call).toMatchObject({ huddleId: 'meeting-m5', meetingId: 'm5', scope: { channelId: 'c1' } });
    huddle.leave();
    await huddle.joinMeetingCall({ id: 'r2', kind: 'huddle', huddleId: 'h-live', title: 'Huddle', conversation: { kind: 'dm', id: 'd1' } });
    expect(useHuddle.getState().call).toMatchObject({ huddleId: 'h-live', meetingId: 'r2', scope: { dmId: 'd1' } });
  });
});

describe('one call at a time, and moving calls between devices', () => {
  it('asks before joining a second call, and switches when told to', async () => {
    await huddle.joinHuddle('h1', { channelId: 'c1' }, '# general');
    await huddle.joinHuddle('h2', { channelId: 'c2' }, '# design');
    // Still in the first call, with a question on screen.
    expect(useHuddle.getState().call.huddleId).toBe('h1');
    expect(useHuddle.getState().prompt).toMatchObject({ kind: 'local', confirmLabel: 'Switch' });
    expect(useHuddle.getState().prompt.body).toContain('#general');
    await huddle.confirmPrompt();
    expect(sent).toContainEqual({ event: 'huddle:leave', payload: { huddleId: 'h1' } });
    expect(lastOf('huddle:join')).toMatchObject({ channelId: 'c2', huddleId: 'h2', switch: true });
    expect(useHuddle.getState().call.huddleId).toBe('h2');
    expect(useHuddle.getState().prompt).toBeNull();
  });

  it('staying keeps the current call', async () => {
    await huddle.joinHuddle('h1', { channelId: 'c1' }, '# general');
    await huddle.startHuddle({ dmId: 'd9' }, 'Call with Sam');
    huddle.dismissPrompt();
    expect(useHuddle.getState().prompt).toBeNull();
    expect(useHuddle.getState().call.huddleId).toBe('h1');
    expect(sent.some((s) => s.event === 'huddle:start')).toBe(false);
  });

  it("asks to switch when the server says I'm in a call on another device", async () => {
    await huddle.joinHuddle('h3', { channelId: 'c3' }, '# ops');
    fire('huddle:error', { huddleId: 'h3', code: 'ALREADY_IN_CALL', current: { huddleId: 'h9', channelName: 'design', device: { label: 'MacBook' } } });
    expect(useHuddle.getState().call).toBeNull();
    expect(useHuddle.getState().prompt).toMatchObject({ kind: 'remote' });
    expect(useHuddle.getState().prompt.body).toContain('MacBook');
    await huddle.confirmPrompt();
    expect(lastOf('huddle:join')).toMatchObject({ huddleId: 'h3', channelId: 'c3', switch: true });
  });

  it('offers to move the same call here, keeping mute and camera', async () => {
    await huddle.joinHuddle('h4', { channelId: 'c4' }, '# eng');
    fire('huddle:error', { huddleId: 'h4', code: 'ALREADY_IN_CALL', sameCall: true, current: { huddleId: 'h4', device: { label: 'MacBook' }, audioEnabled: false, videoEnabled: true } });
    expect(useHuddle.getState().prompt).toMatchObject({ kind: 'move', confirmLabel: 'Move here' });
    await huddle.confirmPrompt();
    expect(lastOf('huddle:join')).toMatchObject({ huddleId: 'h4', transfer: true, audioEnabled: false, videoEnabled: true });
    expect(useHuddle.getState()).toMatchObject({ muted: true, cameraOn: true });
  });

  it('shows "Move here" for my call on another device, not for one on this connection', async () => {
    fire('huddle:self_active', { huddleId: 'h5', channelId: 'c5', channelName: 'design', socketId: 'sock-laptop', device: { label: 'MacBook' }, audioEnabled: true, videoEnabled: false });
    expect(useHuddle.getState().elsewhere).toMatchObject({ huddleId: 'h5', device: { label: 'MacBook' } });
    await huddle.moveCallHere();
    expect(lastOf('huddle:join')).toMatchObject({ huddleId: 'h5', channelId: 'c5', transfer: true });
    expect(useHuddle.getState().elsewhere).toBeNull();
    fire('huddle:self_active', { huddleId: 'h5', channelId: 'c5', socketId: 'sock-here' });
    expect(useHuddle.getState().elsewhere).toBeNull();
    fire('huddle:self_active', { huddleId: null });
    expect(useHuddle.getState().elsewhere).toBeNull();
  });

  it('hangs up here when the call moves to another device', async () => {
    await huddle.joinHuddle('h6', { channelId: 'c6' });
    fire('huddle:ended', { huddleId: 'h6', channelId: 'c6', reason: 'moved', to: { label: 'Pixel 8' } });
    expect(useHuddle.getState().call).toBeNull();
    expect(helpers.request).toHaveBeenCalledWith('huddle:mine', {});
  });
});

describe('video on the phone', () => {
  it('turns the camera on and off and tells the call', async () => {
    await huddle.joinHuddle('v1', { channelId: 'c1' });
    await huddle.toggleCamera();
    expect(useHuddle.getState().cameraOn).toBe(true);
    expect(lastOf('huddle:video_toggle')).toEqual({ huddleId: 'v1', videoEnabled: true });
    expect(huddle.localMedia().getVideoTracks()).toHaveLength(1);
    const cam = huddle.localMedia().getVideoTracks()[0];
    await huddle.toggleCamera();
    expect(cam.stop).toHaveBeenCalled();
    expect(huddle.localMedia().getVideoTracks()).toHaveLength(0);
    expect(lastOf('huddle:video_toggle')).toEqual({ huddleId: 'v1', videoEnabled: false });
  });

  it('joins a video huddle with the camera, and starts one from a conversation', async () => {
    fire('huddle:started', { huddleId: 'vid', channelId: 'c7', video: true, startedBy: { _id: 'sam' } });
    await huddle.joinHuddle('vid', { channelId: 'c7' }, '# demo');
    expect(lastOf('huddle:join')).toMatchObject({ huddleId: 'vid', videoEnabled: true });
    huddle.leave();
    await huddle.startHuddle({ dmId: 'd2' }, 'Call', { video: true });
    expect(lastOf('huddle:start')).toMatchObject({ dmId: 'd2', video: true });
  });

  it("follows other people's camera and raised hand", async () => {
    await huddle.joinHuddle('v2', { channelId: 'c1' });
    fire('huddle:roster', { huddleId: 'v2', participants: [{ userId: 'sam', username: 'Sam', audioEnabled: true, videoEnabled: false }] });
    fire('huddle:video_changed', { huddleId: 'v2', userId: 'sam', videoEnabled: true });
    fire('huddle:hand_changed', { huddleId: 'v2', userId: 'sam', raised: true });
    expect(useHuddle.getState().participants.find((p) => p.userId === 'sam')).toMatchObject({ videoEnabled: true, handRaised: true });
    huddle.toggleHand();
    expect(lastOf('huddle:hand')).toEqual({ huddleId: 'v2', raised: true });
  });

  it("says screen sharing isn't available where the WebView can't do it", async () => {
    await huddle.joinHuddle('v3', { channelId: 'c1' });
    expect(huddle.screenShareSupported()).toBe(false);
    expect(await huddle.startScreenShare()).toBe(false);
    expect(useHuddle.getState().sharing).toBe(false);
  });
});

