'use strict';

/**
 * Huddle life cycle details: one live huddle per conversation, DM huddles in the live
 * list, raised hands, and huddles nobody joins ending by themselves.
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

describe('huddle life cycle', () => {
  let io, httpServer, url, registry, history, meetings;
  const clients = [];

  beforeEach((done) => {
    registry = new HuddleRegistry({ maxParticipants: 4 });
    history = { started: jest.fn(), joined: jest.fn(), left: jest.fn(), ended: jest.fn() };
    meetings = { huddleEnded: jest.fn().mockResolvedValue([]) };
    httpServer = http.createServer();
    io = new Server(httpServer);
    io.use((socket, next) => {
      socket.user = { id: socket.handshake.auth.userId };
      socket.data.username = socket.user.id.toUpperCase();
      next();
    });
    io.on('connection', (socket) => {
      socket.join('workspace:w1');
      socket.join('channel:c1');
      // Only alice and bob are in the DM d1.
      if (['alice', 'bob'].includes(socket.user.id)) socket.join('dm:d1');
      registerHuddleHandlers(io, socket, {
        registry,
        history,
        meetings,
        emptyTimeoutMs: 150,
        verify: async (s, { channelId, dmId }) => (dmId
          ? (['alice', 'bob'].includes(s.user.id) ? { ok: true, scope: { dmId, workspaceId: 'w1' } } : { ok: false, message: 'no' })
          : { ok: true, scope: { channelId, workspaceId: 'w1' }, channelName: 'general' }),
      });
    });
    httpServer.listen(0, () => { url = `http://localhost:${httpServer.address().port}`; done(); });
  });

  afterEach(() => {
    clients.splice(0).forEach((c) => c.close());
    io.close();
    httpServer.close();
  });

  const connect = (userId) => new Promise((resolve) => {
    const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true });
    clients.push(c);
    c.on('connect', () => resolve(c));
  });
  const next = (socket, event, filter = () => true) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 2000);
    const h = (payload) => { if (filter(payload)) { clearTimeout(t); socket.off(event, h); resolve(payload); } };
    socket.on(event, h);
  });
  const list = (socket) => new Promise((resolve) => socket.emit('huddle:list', { workspaceId: 'w1' }, resolve));

  test('every payload carries the call\'s meeting record id', async () => {
    history.started.mockImplementation(async () => new Promise((r) => setTimeout(() => r({ meeting: 'm-123' }), 30)));
    const alice = await connect('alice');
    const bob = await connect('bob');
    const started = next(bob, 'huddle:started');
    alice.emit('huddle:start', { huddleId: 'h9', channelId: 'c1' });
    expect(await started).toMatchObject({ huddleId: 'h9', meetingId: 'm-123' });
    const roster = next(alice, 'huddle:roster');
    alice.emit('huddle:join', { huddleId: 'h9', channelId: 'c1' });
    expect(await roster).toMatchObject({ huddleId: 'h9', meetingId: 'm-123' });
    const joined = next(alice, 'huddle:joined');
    bob.emit('huddle:join', { huddleId: 'h9', channelId: 'c1' });
    expect(await joined).toMatchObject({ userId: 'bob', meetingId: 'm-123' });
    expect((await list(alice)).huddles[0]).toMatchObject({ huddleId: 'h9', meetingId: 'm-123' });
    const ended = next(bob, 'huddle:ended');
    alice.emit('huddle:end', { huddleId: 'h9' });
    expect(await ended).toMatchObject({ huddleId: 'h9', meetingId: 'm-123', reason: 'ended' });
    expect(meetings.huddleEnded).toHaveBeenCalledWith(expect.objectContaining({ huddleId: 'h9', meetingId: 'm-123' }), io);
  });

  test('starting a second huddle in the same channel points to the one already running', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    alice.emit('huddle:start', { huddleId: 'h1', channelId: 'c1' });
    await next(alice, 'huddle:started');
    const roster = next(alice, 'huddle:roster');
    alice.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
    await roster;

    const existing = next(bob, 'huddle:existing');
    bob.emit('huddle:start', { huddleId: 'h2', channelId: 'c1' });
    expect(await existing).toEqual({ requestedId: 'h2', huddleId: 'h1', video: false, meetingId: null });
    expect(registry.get('h2')).toBeNull();
  });

  test('DM huddles are listed only for the two people in the DM', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const carol = await connect('carol');
    const roster = next(alice, 'huddle:roster');
    alice.emit('huddle:join', { huddleId: 'd-call', dmId: 'd1' });
    await roster;

    expect((await list(bob)).huddles.map((h) => h.huddleId)).toEqual(['d-call']);
    expect((await list(carol)).huddles).toEqual([]);
  });

  test('a raised hand reaches everyone in the call and shows in the roster', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    let r = next(alice, 'huddle:roster');
    alice.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
    await r;
    r = next(bob, 'huddle:roster');
    bob.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
    await r;

    const changed = next(alice, 'huddle:hand_changed');
    bob.emit('huddle:hand', { huddleId: 'h1', raised: true });
    expect(await changed).toEqual({ huddleId: 'h1', userId: 'bob', raised: true });
    expect(registry.summary(registry.get('h1')).participants.find((p) => p.userId === 'bob').handRaised).toBe(true);
  });

  test('a huddle nobody joins ends by itself', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const ended = next(bob, 'huddle:ended');
    alice.emit('huddle:start', { huddleId: 'ghost', channelId: 'c1' });
    expect(await ended).toMatchObject({ huddleId: 'ghost', reason: 'empty' });
    expect(registry.get('ghost')).toBeNull();
    expect(history.ended).toHaveBeenCalledWith('ghost');
  });

  test('the last person leaving ends the huddle for the conversation', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const r = next(alice, 'huddle:roster');
    alice.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
    await r;
    const ended = next(bob, 'huddle:ended');
    alice.emit('huddle:leave', { huddleId: 'h1' });
    expect(await ended).toMatchObject({ huddleId: 'h1', channelId: 'c1', reason: 'empty' });
    // Scheduled meetings held in it are completed.
    expect(meetings.huddleEnded).toHaveBeenCalledWith(expect.objectContaining({ huddleId: 'h1', channelId: 'c1' }), io);
  });
});
