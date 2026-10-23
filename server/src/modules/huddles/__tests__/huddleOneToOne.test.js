'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

// A 1:1 DM call ends when one person hangs up, like a phone call. Group DMs stay open, and a
// dropped connection doesn't end the call (the person can reconnect).
describe('1:1 DM calls end when the other person hangs up', () => {
  let io, httpServer, url, registry;
  const clients = [];
  const DMS = { d1: ['alice', 'bob'], g1: ['alice', 'bob', 'carol'] };

  beforeEach((done) => {
    registry = new HuddleRegistry({ maxParticipants: 10 });
    httpServer = http.createServer();
    io = new Server(httpServer);
    io.use((socket, next) => {
      socket.user = { id: socket.handshake.auth.userId };
      socket.data.username = socket.user.id;
      next();
    });
    io.on('connection', (socket) => {
      socket.join(`user:${socket.user.id}`);
      registerHuddleHandlers(io, socket, {
        registry,
        history: { started: async () => null, joined() {}, left() {}, ended() {} },
        meetings: { huddleEnded: async () => [] },
        planLimits: async () => null,
        verify: async (s, { dmId }) => ((DMS[dmId] || []).includes(String(s.user.id))
          ? { ok: true, scope: { dmId, workspaceId: 'w1' }, groupDm: dmId === 'g1', recipientIds: DMS[dmId] }
          : { ok: false, message: 'Not a participant' }),
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
  const next = (socket, event, filter = () => true, ms = 2000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    const h = (p) => { if (filter(p)) { clearTimeout(t); socket.off(event, h); resolve(p); } };
    socket.on(event, h);
  });
  const none = (socket, event, ms = 400) => new Promise((resolve, reject) => {
    const h = (p) => reject(new Error(`unexpected ${event} ${JSON.stringify(p)}`));
    socket.on(event, h);
    setTimeout(() => { socket.off(event, h); resolve(); }, ms);
  });
  const join = (socket, huddleId, dmId) => {
    const roster = next(socket, 'huddle:roster', (p) => p.huddleId === huddleId);
    socket.emit('huddle:join', { huddleId, dmId });
    return roster;
  };

  test('when one person leaves a 1:1 call, it ends for the other', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await join(alice, 'call-1', 'd1');
    await join(bob, 'call-1', 'd1');

    const ended = next(alice, 'huddle:ended', (p) => p.huddleId === 'call-1');
    bob.emit('huddle:leave', { huddleId: 'call-1' });
    expect(await ended).toMatchObject({ huddleId: 'call-1', reason: 'ended' });
    expect(registry.get('call-1')).toBeNull();
  });

  test('a 1:1 call nobody else has joined yet stays open (still ringing)', async () => {
    const alice = await connect('alice');
    await join(alice, 'call-2', 'd1');
    await none(alice, 'huddle:ended');
    expect(registry.get('call-2')).not.toBeNull();
  });

  test('a dropped connection does not end the call for the other person', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await join(alice, 'call-3', 'd1');
    await join(bob, 'call-3', 'd1');

    const left = next(alice, 'huddle:left', (p) => p.huddleId === 'call-3');
    bob.disconnect();
    expect(await left).toMatchObject({ reason: 'disconnected' });
    await none(alice, 'huddle:ended');
    expect(registry.get('call-3')).not.toBeNull();
  });

  test('a group DM call stays open when someone leaves', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    await join(alice, 'call-4', 'g1');
    await join(bob, 'call-4', 'g1');

    const left = next(alice, 'huddle:left', (p) => p.huddleId === 'call-4');
    bob.emit('huddle:leave', { huddleId: 'call-4' });
    await left;
    await none(alice, 'huddle:ended');
    expect(registry.get('call-4')).not.toBeNull();
  });
});
