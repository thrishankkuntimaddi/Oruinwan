'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

// Real Socket.IO server and clients; membership checks are stubbed so no database is needed.
describe('huddle socket handlers', () => {
  let io, httpServer, url, registry;
  const clients = [];
  const MEMBERS = { c1: ['alice', 'bob', 'carol', 'dave'] };

  beforeEach((done) => {
    registry = new HuddleRegistry({ maxParticipants: 3 });
    httpServer = http.createServer();
    io = new Server(httpServer);
    io.use((socket, next) => {
      const { userId } = socket.handshake.auth;
      socket.user = { id: userId };
      socket.data.username = userId.toUpperCase();
      next();
    });
    io.on('connection', (socket) => {
      socket.join(`user:${socket.user.id}`);
      socket.join('workspace:w1');
      socket.join('channel:c1');
      registerHuddleHandlers(io, socket, {
        registry,
        verify: async (s, { channelId }) => (MEMBERS[channelId] || []).includes(String(s.user.id))
          ? { ok: true, scope: { channelId, workspaceId: 'w1' }, channelName: 'general' }
          : { ok: false, message: 'Not a member of this channel' },
      });
    });
    httpServer.listen(0, () => {
      url = `http://localhost:${httpServer.address().port}`;
      done();
    });
  });

  afterEach(() => {
    clients.splice(0).forEach((c) => c.close());
    io.close();
    httpServer.close();
  });

  function connect(userId) {
    return new Promise((resolve) => {
      const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true });
      clients.push(c);
      c.on('connect', () => resolve(c));
    });
  }
  const next = (socket, event, filter = () => true) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 2000);
    const h = (payload) => { if (filter(payload)) { clearTimeout(t); socket.off(event, h); resolve(payload); } };
    socket.on(event, h);
  });
  const none = (socket, event, ms = 200) => new Promise((resolve, reject) => {
    const h = (p) => reject(new Error(`unexpected ${event}: ${JSON.stringify(p)}`));
    socket.on(event, h);
    setTimeout(() => { socket.off(event, h); resolve(); }, ms);
  });

  async function join(socket, huddleId = 'h1') {
    const roster = next(socket, 'huddle:roster');
    socket.emit('huddle:join', { huddleId, channelId: 'c1' });
    return roster;
  }

  test('start announces channelName to the channel and the workspace', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const started = next(bob, 'huddle:started');
    alice.emit('huddle:start', { huddleId: 'h1', channelId: 'c1' });
    expect(await started).toMatchObject({ huddleId: 'h1', channelId: 'c1', channelName: 'general', startedBy: { username: 'ALICE' } });
  });

  test('joiner receives the roster and existing members receive huddle:joined', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    expect((await join(alice)).participants).toEqual([]);
    const joined = next(alice, 'huddle:joined');
    const roster = await join(bob);
    expect(roster.participants.map((p) => p.userId)).toEqual(['alice']);
    expect(await joined).toMatchObject({ huddleId: 'h1', userId: 'bob', username: 'BOB' });
  });

  test('non-members are refused', async () => {
    const eve = await connect('eve');
    const err = next(eve, 'huddle:error');
    eve.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
    expect(await err).toMatchObject({ code: 'FORBIDDEN' });
    expect(registry.get('h1')).toBeNull();
  });

  test('the participant cap returns HUDDLE_FULL', async () => {
    for (const u of ['alice', 'bob', 'carol']) await join(await connect(u));
    const dave = await connect('dave');
    const err = next(dave, 'huddle:error');
    dave.emit('huddle:join', { huddleId: 'h1', channelId: 'c1' });
    expect(await err).toMatchObject({ code: 'HUDDLE_FULL' });
  });

  test('signaling is relayed only between participants, to the target socket', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const carol = await connect('carol');
    await join(alice);
    await join(bob);

    const offer = next(bob, 'huddle:offer');
    alice.emit('huddle:offer', { huddleId: 'h1', targetUserId: 'bob', offer: { type: 'offer', sdp: 'x' } });
    expect(await offer).toEqual({ huddleId: 'h1', fromUserId: 'alice', offer: { type: 'offer', sdp: 'x' } });

    const ice = next(alice, 'huddle:ice-candidate');
    bob.emit('huddle:ice-candidate', { huddleId: 'h1', targetUserId: 'alice', candidate: { candidate: 'c' } });
    expect(await ice).toMatchObject({ fromUserId: 'bob', candidate: { candidate: 'c' } });

    // carol is not in the huddle: her offer must not reach bob
    const silent = none(bob, 'huddle:offer');
    carol.emit('huddle:offer', { huddleId: 'h1', targetUserId: 'bob', offer: { type: 'offer', sdp: 'evil' } });
    await silent;
  });

  test('a dropped connection leaves the huddle and the last one out ends it', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await join(alice);
    await join(bob);

    const left = next(alice, 'huddle:left');
    bob.close();
    expect(await left).toMatchObject({ huddleId: 'h1', userId: 'bob', reason: 'disconnected' });
    expect(registry.get('h1').participants.size).toBe(1);

    const carol = await connect('carol'); // watching the channel, not in the huddle
    const ended = next(carol, 'huddle:ended');
    alice.emit('huddle:leave', { huddleId: 'h1' });
    expect(await ended).toMatchObject({ huddleId: 'h1', reason: 'empty' });
    expect(registry.get('h1')).toBeNull();
  });

  test('rejoining from a second tab evicts the first and tells peers to reconnect', async () => {
    const alice = await connect('alice');
    const bob1 = await connect('bob');
    await join(alice);
    await join(bob1);

    const bob2 = await connect('bob');
    const evicted = next(bob1, 'huddle:ended');
    const left = next(alice, 'huddle:left');
    const rejoined = next(alice, 'huddle:joined');
    await join(bob2);
    expect(await evicted).toMatchObject({ reason: 'joined_elsewhere' });
    expect(await left).toMatchObject({ userId: 'bob', reason: 'rejoined' });
    expect(await rejoined).toMatchObject({ userId: 'bob' });

    // the old tab closing must not remove bob's new session
    bob1.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(registry.participant('h1', 'bob').socketId).toBe(bob2.id);
  });

  test('huddle:active reports the live huddle of a conversation the socket is in', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    alice.emit('huddle:start', { huddleId: 'h1', channelId: 'c1' });
    await join(alice);
    const ask = (s, data) => new Promise((r) => s.emit('huddle:active', data, r));
    const { huddle } = await ask(bob, { channelId: 'c1' });
    expect(huddle).toMatchObject({ huddleId: 'h1', channelId: 'c1', participants: [expect.objectContaining({ userId: 'alice' })] });
    expect((await ask(bob, { channelId: 'other' })).huddle).toBeNull(); // not in that room
  });

  test('audio toggle, list and end', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    alice.emit('huddle:start', { huddleId: 'h1', channelId: 'c1' });
    await join(alice);
    await join(bob);

    const audio = next(bob, 'huddle:audio_changed');
    alice.emit('huddle:audio_toggle', { huddleId: 'h1', audioEnabled: false });
    expect(await audio).toEqual({ huddleId: 'h1', userId: 'alice', audioEnabled: false });

    const { huddles } = await new Promise((r) => bob.emit('huddle:list', { workspaceId: 'w1' }, r));
    expect(huddles).toHaveLength(1);
    expect(huddles[0]).toMatchObject({ huddleId: 'h1', channelName: 'general' });

    const ended = next(bob, 'huddle:ended', (p) => p.reason === 'ended');
    alice.emit('huddle:end', { huddleId: 'h1' });
    expect(await ended).toMatchObject({ huddleId: 'h1' });
    expect(registry.get('h1')).toBeNull();
  });
});

describe('huddle privacy', () => {
  test('DM huddle start is announced only to the DM room', async () => {
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const registry = new HuddleRegistry();
    io.use((socket, next) => { socket.user = { id: socket.handshake.auth.userId }; socket.data.username = 'x'; next(); });
    io.on('connection', (socket) => {
      socket.join('workspace:w1');
      if (socket.user.id !== 'outsider') socket.join('dm:d1');
      registerHuddleHandlers(io, socket, {
        registry,
        verify: async () => ({ ok: true, scope: { dmId: 'd1', workspaceId: 'w1' } }),
      });
    });
    await new Promise((r) => httpServer.listen(0, r));
    const url = `http://localhost:${httpServer.address().port}`;
    const mk = (userId) => new Promise((r) => { const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true }); c.on('connect', () => r(c)); });
    const [a, b, outsider] = await Promise.all([mk('a'), mk('b'), mk('outsider')]);
    let leaked = false;
    outsider.on('huddle:started', () => { leaked = true; });
    const got = new Promise((r) => b.on('huddle:started', r));
    a.emit('huddle:start', { huddleId: 'hd', dmId: 'd1' });
    expect(await got).toMatchObject({ huddleId: 'hd', dmId: 'd1' });
    await new Promise((r) => setTimeout(r, 150));
    expect(leaked).toBe(false);
    [a, b, outsider].forEach((c) => c.close());
    io.close(); httpServer.close();
  });
});

describe('video huddles', () => {
  test('a video huddle is flagged for joiners and camera toggles are relayed', async () => {
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const registry = new HuddleRegistry();
    io.use((socket, next) => { socket.user = { id: socket.handshake.auth.userId }; socket.data.username = socket.handshake.auth.userId; next(); });
    io.on('connection', (socket) => {
      socket.join('dm:d1');
      registerHuddleHandlers(io, socket, { registry, verify: async () => ({ ok: true, scope: { dmId: 'd1', workspaceId: 'w1' } }) });
    });
    await new Promise((r) => httpServer.listen(0, r));
    const url = `http://localhost:${httpServer.address().port}`;
    const mk = (userId) => new Promise((r) => { const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true }); c.on('connect', () => r(c)); });
    const once = (s, ev) => new Promise((r) => s.once(ev, r));
    const [a, b] = await Promise.all([mk('a'), mk('b')]);

    const started = once(b, 'huddle:started');
    a.emit('huddle:start', { huddleId: 'hv', dmId: 'd1', video: true });
    expect(await started).toMatchObject({ huddleId: 'hv', video: true });

    const rosterA = once(a, 'huddle:roster');
    a.emit('huddle:join', { huddleId: 'hv', dmId: 'd1', videoEnabled: true });
    await rosterA;
    const rosterB = once(b, 'huddle:roster');
    const joinedOnA = once(a, 'huddle:joined');
    b.emit('huddle:join', { huddleId: 'hv', dmId: 'd1', videoEnabled: true });
    const roster = await rosterB;
    expect(roster.video).toBe(true);
    expect(roster.participants[0]).toMatchObject({ userId: 'a', videoEnabled: true });
    expect(await joinedOnA).toMatchObject({ userId: 'b', videoEnabled: true });

    const changed = once(b, 'huddle:video_changed');
    a.emit('huddle:video_toggle', { huddleId: 'hv', videoEnabled: false });
    expect(await changed).toEqual({ huddleId: 'hv', userId: 'a', videoEnabled: false });

    [a, b].forEach((c) => c.close());
    io.close(); httpServer.close();
  });
});
