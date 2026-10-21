'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

// One call per person, switching calls, moving a call to another device, and "my call" updates.
describe('huddle call rules', () => {
  let io, httpServer, url, registry;
  const clients = [];
  const MEMBERS = { c1: ['alice', 'bob'], c2: ['alice', 'bob'] };
  const LAPTOP = { id: 'dev-laptop', label: 'MacBook · Desktop app', platform: 'desktop' };
  const PHONE = { id: 'dev-phone', label: 'Pixel 8', platform: 'android' };

  beforeEach((done) => {
    registry = new HuddleRegistry({ maxParticipants: 10 });
    httpServer = http.createServer();
    io = new Server(httpServer);
    io.use((socket, next) => {
      socket.user = { id: socket.handshake.auth.userId };
      socket.data.username = socket.user.id.toUpperCase();
      next();
    });
    io.on('connection', (socket) => {
      socket.join(`user:${socket.user.id}`);
      socket.join('workspace:w1');
      socket.join('channel:c1');
      socket.join('channel:c2');
      registerHuddleHandlers(io, socket, {
        registry,
        history: { started: async () => null, joined() {}, left() {}, ended() {} },
        meetings: { huddleEnded: async () => [] },
        planLimits: async () => null,
        verify: async (s, { channelId }) => ((MEMBERS[channelId] || []).includes(String(s.user.id))
          ? { ok: true, scope: { channelId, workspaceId: 'w1' }, channelName: channelId === 'c1' ? 'general' : 'design' }
          : { ok: false, message: 'Not a member' }),
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
    const h = (p) => { if (filter(p)) { clearTimeout(t); socket.off(event, h); resolve(p); } };
    socket.on(event, h);
  });
  const join = (socket, huddleId, channelId, extra = {}) => {
    const roster = next(socket, 'huddle:roster', (p) => p.huddleId === huddleId);
    socket.emit('huddle:join', { huddleId, channelId, ...extra });
    return roster;
  };
  const errorOf = (socket, huddleId, channelId, extra) => {
    const err = next(socket, 'huddle:error');
    socket.emit('huddle:join', { huddleId, channelId, ...extra });
    return err;
  };

  test('joining a second call from another device asks first, then switching moves the person', async () => {
    const laptop = await connect('alice');
    const phone = await connect('alice');
    await join(laptop, 'h1', 'c1', { device: LAPTOP });

    const err = await errorOf(phone, 'h2', 'c2', { device: PHONE });
    expect(err).toMatchObject({ code: 'ALREADY_IN_CALL', sameCall: false, current: { huddleId: 'h1', channelName: 'general', device: { label: LAPTOP.label } } });
    expect(registry.get('h2')).toBeNull();

    const kicked = next(laptop, 'huddle:ended', (p) => p.huddleId === 'h1');
    await join(phone, 'h2', 'c2', { device: PHONE, switch: true });
    expect(await kicked).toMatchObject({ reason: 'switched' });
    expect(registry.callOf('alice').huddle.huddleId).toBe('h2');
  });

  test('starting a call while in another one is refused without switch', async () => {
    const laptop = await connect('alice');
    const phone = await connect('alice');
    await join(laptop, 'h1', 'c1', { device: LAPTOP });
    const err = next(phone, 'huddle:error');
    phone.emit('huddle:start', { huddleId: 'h2', channelId: 'c2', device: PHONE });
    expect(await err).toMatchObject({ huddleId: 'h2', code: 'ALREADY_IN_CALL' });
    expect(registry.get('h2')).toBeNull();
  });

  test('the same call from another device asks to move it; transfer moves it and carries the state', async () => {
    const bob = await connect('bob');
    const laptop = await connect('alice');
    const phone = await connect('alice');
    await join(bob, 'h1', 'c1', { device: { id: 'b', label: 'Bob laptop', platform: 'web' } });
    await join(laptop, 'h1', 'c1', { device: LAPTOP, audioEnabled: false });

    const err = await errorOf(phone, 'h1', 'c1', { device: PHONE });
    expect(err).toMatchObject({ code: 'ALREADY_IN_CALL', sameCall: true, current: { huddleId: 'h1', device: { label: LAPTOP.label } } });

    const moved = next(laptop, 'huddle:ended');
    const reconnect = next(bob, 'huddle:joined', (p) => p.userId === 'alice');
    await join(phone, 'h1', 'c1', { device: PHONE, transfer: true, audioEnabled: false });
    expect(await moved).toEqual({ huddleId: 'h1', reason: 'moved', to: PHONE.label });
    expect(await reconnect).toMatchObject({ audioEnabled: false });
    expect(registry.participant('h1', 'alice')).toMatchObject({ socketId: phone.id, device: PHONE });

    // A late "leave" from the laptop does not hang up the phone.
    laptop.emit('huddle:leave', { huddleId: 'h1' });
    await new Promise((r) => setTimeout(r, 100));
    expect(registry.participant('h1', 'alice').socketId).toBe(phone.id);
  });

  test('another tab of the same device replaces the old one without asking', async () => {
    const tab1 = await connect('alice');
    const tab2 = await connect('alice');
    await join(tab1, 'h1', 'c1', { device: LAPTOP });
    const evicted = next(tab1, 'huddle:ended');
    await join(tab2, 'h1', 'c1', { device: LAPTOP });
    expect(await evicted).toMatchObject({ reason: 'joined_elsewhere' });
  });

  test('my other devices hear where my call is; huddle:mine answers on request', async () => {
    const laptop = await connect('alice');
    const phone = await connect('alice');
    const told = next(phone, 'huddle:self_active', (p) => p.huddleId === 'h1');
    await join(laptop, 'h1', 'c1', { device: LAPTOP });
    expect(await told).toMatchObject({ huddleId: 'h1', channelId: 'c1', channelName: 'general', socketId: laptop.id, device: LAPTOP, audioEnabled: true });

    const muted = next(phone, 'huddle:self_active', (p) => p.audioEnabled === false);
    laptop.emit('huddle:audio_toggle', { huddleId: 'h1', audioEnabled: false });
    await muted;

    const mine = await new Promise((resolve) => phone.emit('huddle:mine', {}, resolve));
    expect(mine.active).toMatchObject({ huddleId: 'h1', audioEnabled: false });

    const gone = next(phone, 'huddle:self_active', (p) => p.huddleId === null);
    laptop.emit('huddle:leave', { huddleId: 'h1' });
    await gone;
    const after = await new Promise((resolve) => phone.emit('huddle:mine', {}, resolve));
    expect(after.active).toBeNull();
  });

  test('older apps without device info keep the old behaviour', async () => {
    const one = await connect('alice');
    const two = await connect('alice');
    await join(one, 'h1', 'c1');
    const evicted = next(one, 'huddle:ended');
    await join(two, 'h1', 'c1');
    expect(await evicted).toMatchObject({ reason: 'joined_elsewhere' });
  });
});
