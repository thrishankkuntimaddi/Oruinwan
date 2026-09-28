'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const registerHuddleHandlers = require('../huddles.socket');
const { HuddleRegistry } = require('../huddleRegistry');

// Real Socket.IO; the session recorder and the notes store are fakes.
describe('huddle sessions over the socket', () => {
  let io, httpServer, url, registry, history, notesOp;
  const clients = [];

  beforeEach((done) => {
    registry = new HuddleRegistry({ maxParticipants: 4 });
    history = { started: jest.fn(), joined: jest.fn(), left: jest.fn(), ended: jest.fn() };
    notesOp = jest.fn(async ({ op, userId }) => {
      if (op.kind === 'boom') { const e = new Error('Invalid id'); e.status = 400; throw e; }
      return { noteId: 'n1', applied: { ...op, by: userId } };
    });
    httpServer = http.createServer();
    io = new Server(httpServer);
    io.use((socket, next) => {
      socket.user = { id: socket.handshake.auth.userId };
      socket.data.username = socket.user.id.toUpperCase();
      next();
    });
    io.on('connection', (socket) => {
      socket.join('channel:c1');
      registerHuddleHandlers(io, socket, {
        registry,
        history,
        notesOp,
        verify: async () => ({ ok: true, scope: { channelId: 'c1', workspaceId: 'w1' }, channelName: 'general' }),
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
  const next = (socket, event) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 2000);
    socket.once(event, (p) => { clearTimeout(t); resolve(p); });
  });
  const join = async (socket, huddleId = 'h1') => {
    const roster = next(socket, 'huddle:roster');
    socket.emit('huddle:join', { huddleId, channelId: 'c1' });
    return roster;
  };
  const emitAck = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));

  test('the huddle run is recorded: started once, every join, every leave, then ended', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const started = next(alice, 'huddle:started');
    alice.emit('huddle:start', { huddleId: 'h1', channelId: 'c1' });
    await started;
    await join(alice);
    await join(bob);

    expect(history.started).toHaveBeenCalledTimes(1);
    expect(history.started.mock.calls[0][0]).toMatchObject({ huddleId: 'h1', channelId: 'c1', workspaceId: 'w1', channelName: 'general', startedBy: { _id: 'alice' } });
    expect(history.joined.mock.calls.map((c) => [c[0], c[1].userId])).toEqual([['h1', 'alice'], ['h1', 'bob']]);

    const left = next(alice, 'huddle:left');
    bob.emit('huddle:leave', { huddleId: 'h1' });
    await left;
    expect(history.left).toHaveBeenCalledWith('h1', 'bob');
    expect(history.ended).not.toHaveBeenCalled();

    alice.emit('huddle:leave', { huddleId: 'h1' });
    await new Promise((r) => setTimeout(r, 100));
    expect(history.ended).toHaveBeenCalledWith('h1');
  });

  test('a join that re-creates a huddle (e.g. after a restart) also starts a session', async () => {
    const alice = await connect('alice');
    await join(alice, 'h2');
    expect(history.started).toHaveBeenCalledTimes(1);
    expect(history.started.mock.calls[0][0].huddleId).toBe('h2');
  });

  test('notes edits are applied for participants and relayed to the others in the call', async () => {
    const alice = await connect('alice');
    const bob = await connect('bob');
    const carol = await connect('carol'); // in the channel, not in the call
    await join(alice);
    await join(bob);

    const relayed = next(bob, 'huddle:notes_op');
    let carolSaw = false;
    carol.on('huddle:notes_op', () => { carolSaw = true; });
    const ack = await emitAck(alice, 'huddle:notes_op', { huddleId: 'h1', op: { kind: 'paragraph', id: 'p1', text: 'hello' } });

    expect(ack).toMatchObject({ ok: true, noteId: 'n1', applied: { kind: 'paragraph', id: 'p1' } });
    expect(await relayed).toMatchObject({ huddleId: 'h1', noteId: 'n1', applied: { id: 'p1' }, by: { userId: 'alice', username: 'ALICE' } });
    expect(notesOp).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice', username: 'ALICE', huddleId: 'h1' }));

    const refused = await emitAck(carol, 'huddle:notes_op', { huddleId: 'h1', op: { kind: 'paragraph', id: 'p2', text: 'x' } });
    expect(refused).toEqual({ ok: false, message: 'Not in this huddle' });
    const bad = await emitAck(alice, 'huddle:notes_op', { huddleId: 'h1', op: { kind: 'boom' } });
    expect(bad).toEqual({ ok: false, message: 'Invalid id' });
    await new Promise((r) => setTimeout(r, 50));
    expect(carolSaw).toBe(false);
  });
});
