'use strict';

jest.mock('../../notifications/notificationService', () => ({
  createMany: jest.fn(async (io, ids) => ids.map((id) => ({ recipient: id }))),
}));

const mongoose = require('mongoose');
const Session = require('../huddleSession.model');
const Message = require('../../messages/message.model');
const Channel = require('../../../features/channels/channel.model');
// Workspaces live in PostgreSQL: spy on the repository.
const identity = require('../../../identity');
const notificationService = require('../../notifications/notificationService');
const service = require('../huddleHistory.service');
const { registry } = require('../huddleRegistry');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const CH = oid();
const OTHER_CH = oid();
const ALICE = oid();
const BOB = oid();
const EVE = oid();

function chain(value) {
  const q = {
    populate: () => q, select: () => q, sort: () => q, lean: () => q, limit: () => q,
    then: (res, rej) => Promise.resolve(value).then(res, rej),
    catch: (rej) => Promise.resolve(value).catch(rej),
  };
  return q;
}

/**
 * A tiny in-memory stand-in for the HuddleSession collection that understands
 * exactly the updates the recorder sends, so the tests check the persisted
 * result (not just which methods were called).
 */
function memoryModel({ delayCreate = 0 } = {}) {
  const docs = [];
  const matches = (d, q) => Object.entries(q).every(([k, v]) => {
    if (k === 'participants.user') return d.participants.some((p) => String(p.user) === String(v));
    return (d[k] ?? null) === v;
  });
  return {
    docs,
    updateMany: jest.fn(async (q, { $set }) => {
      const hit = docs.filter((d) => matches(d, q));
      hit.forEach((d) => Object.assign(d, $set));
      return { matchedCount: hit.length };
    }),
    create: jest.fn(async (doc) => {
      if (delayCreate) await new Promise((r) => setTimeout(r, delayCreate));
      const d = { endedAt: null, participants: [], ...doc };
      docs.push(d);
      return d;
    }),
    updateOne: jest.fn(async (q, update) => {
      const d = docs.find((x) => matches(x, q));
      if (!d) return { matchedCount: 0 };
      if (update.$push) d.participants.push({ ...update.$push.participants });
      if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
          if (k.startsWith('participants.$[p].')) d.participants.filter((p) => p.leftAt == null).forEach((p) => { p[k.split('.').pop()] = v; });
          else if (k.startsWith('participants.$.')) d.participants.find((p) => String(p.user) === String(q['participants.user']))[k.split('.').pop()] = v;
          else d[k] = v;
        }
      }
      return { matchedCount: 1 };
    }),
  };
}

describe('huddle history recorder', () => {
  let clock;
  const now = () => new Date(clock);
  beforeEach(() => { clock = Date.parse('2026-09-28T10:00:00Z'); });

  const summary = (extra = {}) => ({
    huddleId: 'h1', channelId: CH, workspaceId: WS, channelName: 'design', video: false,
    startedBy: { _id: ALICE, username: 'alice' }, startedAt: now(), participants: [], ...extra,
  });

  test('start, joins, leaves and end are persisted in order', async () => {
    const Model = memoryModel({ delayCreate: 20 });
    const rec = service.createRecorder({ Session: Model, now, isConnected: () => true });

    // The join is fired before the (slow) create finishes: it must still land on that session.
    rec.started(summary());
    rec.joined('h1', { userId: ALICE, username: 'alice' });
    clock += 60_000;
    rec.joined('h1', { userId: BOB, username: 'bob' });
    clock += 60_000;
    rec.left('h1', BOB);
    rec.joined('h1', { userId: BOB, username: 'bob' }); // came back
    clock += 60_000;
    rec.ended('h1');
    await rec.whenIdle('h1');

    expect(Model.docs).toHaveLength(1);
    const s = Model.docs[0];
    expect(s).toMatchObject({ huddleId: 'h1', scope: 'channel', channel: CH, workspace: WS, channelName: 'design', startedByName: 'alice' });
    expect(s.participants.map((p) => [p.username, p.leftAt && new Date(p.leftAt).toISOString()])).toEqual([
      ['alice', '2026-09-28T10:03:00.000Z'],
      ['bob', '2026-09-28T10:03:00.000Z'],
    ]);
    expect(new Date(s.endedAt).toISOString()).toBe('2026-09-28T10:03:00.000Z');
  });

  test('a new run of the same huddle id closes a stale open run and starts a fresh session', async () => {
    const Model = memoryModel();
    const rec = service.createRecorder({ Session: Model, now, isConnected: () => true });
    rec.started(summary({ huddleId: 'meeting-1', channelId: null }));
    rec.joined('meeting-1', { userId: ALICE, username: 'alice' });
    clock += 3_600_000;
    rec.started(summary({ huddleId: 'meeting-1', channelId: null }));
    await rec.whenIdle('meeting-1');
    expect(Model.docs).toHaveLength(2);
    expect(Model.docs[0].endedAt).not.toBeNull();
    expect(Model.docs[1]).toMatchObject({ scope: 'workspace', endedAt: null, participants: [] });
  });

  test('database errors and a disconnected database never throw into the call', async () => {
    const Model = memoryModel();
    Model.create.mockRejectedValueOnce(new Error('boom'));
    const rec = service.createRecorder({ Session: Model, now, isConnected: () => true });
    await expect(rec.started(summary())).resolves.toBeNull();
    const offline = service.createRecorder({ Session: Model, now, isConnected: () => false });
    await expect(offline.joined('h1', { userId: ALICE })).resolves.toBeNull();
    expect(Model.updateOne).not.toHaveBeenCalled();
  });

  test('serialize derives the end of a run that never closed (server restart)', () => {
    const out = service.serialize({
      _id: oid(), huddleId: 'h9', scope: 'channel', channel: CH, workspace: WS, startedAt: new Date('2026-09-28T10:00:00Z'), endedAt: null,
      participants: [
        { user: ALICE, username: 'alice', joinedAt: new Date('2026-09-28T10:00:00Z'), leftAt: new Date('2026-09-28T10:05:00Z') },
        { user: BOB, username: 'bob', joinedAt: new Date('2026-09-28T10:01:00Z'), leftAt: new Date('2026-09-28T10:20:00Z') },
      ],
    });
    expect(out.endedAt.toISOString()).toBe('2026-09-28T10:20:00.000Z');
    expect(out.durationSec).toBe(20 * 60);
    expect(out.participants.map((p) => p.username)).toEqual(['alice', 'bob']);
  });
});

describe('huddle wrap-up', () => {
  const session = (extra = {}) => ({
    _id: oid(), huddleId: 'h1', scope: 'channel', channel: CH, workspace: WS, channelName: 'design',
    startedAt: new Date(), endedAt: new Date(),
    participants: [{ user: ALICE, username: 'alice' }, { user: BOB, username: 'bob' }],
    ...extra,
  });
  let io;
  let emitted;

  beforeEach(() => {
    jest.restoreAllMocks();
    notificationService.createMany.mockClear();
    emitted = [];
    io = { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
    jest.spyOn(Session, 'updateOne').mockResolvedValue({ matchedCount: 1 });
  });

  const withSession = (s) => jest.spyOn(Session, 'findOne').mockImplementation((q) => chain(q.endedAt === null && s.endedAt ? null : s));
  const withMessage = (m) => jest.spyOn(Message, 'findById').mockImplementation(() => chain(m));

  test('records the posted message and notifies everyone else who was in the call', async () => {
    const s = withSession(session());
    const messageId = oid();
    withMessage({ _id: messageId, sender: ALICE, channel: CH });

    const res = await service.recordWrapUp({ userId: ALICE, username: 'alice', huddleId: 'h1', messageId, io });

    expect(res).toEqual({ notified: 1, recipients: 1 });
    expect(Session.updateOne).toHaveBeenCalledWith({ _id: expect.anything() }, {
      $set: { summary: expect.objectContaining({ message: messageId, channel: CH, postedBy: ALICE }) },
    });
    const [, recipients, payload] = notificationService.createMany.mock.calls[0];
    expect(recipients).toEqual([BOB]);
    expect(payload).toMatchObject({
      workspaceId: WS, type: 'huddle_started', title: 'Huddle summary posted',
      body: 'alice posted the huddle wrap-up in #design', link: `/channel/${CH}`,
      meta: { kind: 'huddle_summary', huddleId: 'h1', messageId },
    });
    expect(emitted).toContainEqual(expect.objectContaining({ room: 'huddle:h1', event: 'huddle:wrapped_up' }));
    s.mockRestore();
  });

  test('someone who was not in the huddle cannot post its wrap-up', async () => {
    withSession(session());
    jest.spyOn(Channel, 'findById').mockImplementation(() => chain({ isMember: () => true }));
    withMessage({ sender: EVE, channel: CH });
    await expect(service.recordWrapUp({ userId: EVE, huddleId: 'h1', messageId: oid(), io })).rejects.toMatchObject({ status: 403 });
    expect(notificationService.createMany).not.toHaveBeenCalled();
  });

  test('the summary must be the caller\'s own message in the huddle\'s channel', async () => {
    withSession(session());
    withMessage({ sender: BOB, channel: CH });
    await expect(service.recordWrapUp({ userId: ALICE, huddleId: 'h1', messageId: oid(), io })).rejects.toMatchObject({ status: 404 });
    withMessage({ sender: ALICE, channel: OTHER_CH });
    await expect(service.recordWrapUp({ userId: ALICE, huddleId: 'h1', messageId: oid(), io })).rejects.toMatchObject({ status: 400 });
    expect(Session.updateOne).not.toHaveBeenCalled();
  });

  test('a workspace huddle may post to any channel of the same workspace', async () => {
    withSession(session({ scope: 'workspace', channel: null, channelName: null }));
    jest.spyOn(Channel, 'findById').mockImplementation(() => chain({ workspace: WS, name: 'general' }));
    withMessage({ sender: BOB, channel: OTHER_CH });
    const res = await service.recordWrapUp({ userId: BOB, username: 'bob', huddleId: 'h1', messageId: oid(), io });
    expect(res.recipients).toBe(1);
    expect(notificationService.createMany.mock.calls[0][2]).toMatchObject({ body: 'bob posted the huddle wrap-up in #general', link: `/channel/${OTHER_CH}` });
  });
});

describe('huddle history listing', () => {
  beforeEach(() => jest.restoreAllMocks());

  test('lists finished runs the user can see and hides live and empty ones', async () => {
    jest.spyOn(identity.workspaces, 'findById').mockImplementation(async () => ({ _id: WS, members: [{ user: ALICE, role: 'member', status: 'active' }] }));
    jest.spyOn(Channel, 'find').mockImplementation(() => chain([{ _id: CH }]));
    const base = { scope: 'channel', channel: CH, workspace: WS, startedAt: new Date('2026-09-28T10:00:00Z') };
    const find = jest.spyOn(Session, 'find').mockImplementation(() => chain([
      { ...base, _id: oid(), huddleId: 'done', endedAt: new Date('2026-09-28T10:30:00Z'), participants: [{ user: ALICE, username: 'alice' }], notes: oid() },
      { ...base, _id: oid(), huddleId: 'live-now', endedAt: null, participants: [{ user: BOB, username: 'bob' }] },
      { ...base, _id: oid(), huddleId: 'nobody', endedAt: new Date(), participants: [] },
    ]));
    registry.ensure('live-now', { channelId: CH });
    try {
      const list = await service.listHistory(ALICE, WS);
      expect(list.map((h) => h.huddleId)).toEqual(['done']);
      expect(list[0]).toMatchObject({ durationSec: 1800, channelId: CH, notesId: expect.any(String) });
      const query = find.mock.calls[0][0];
      expect(query.workspace).toBe(WS);
      expect(query.$or).toEqual(expect.arrayContaining([{ 'participants.user': ALICE }, { scope: 'channel', channel: { $in: [CH] } }]));
    } finally {
      registry.end('live-now');
    }
  });

  test('non-members of the workspace get 403', async () => {
    jest.spyOn(identity.workspaces, 'findById').mockImplementation(async () => ({ _id: WS, members: [] }));
    await expect(service.listHistory(EVE, WS)).rejects.toMatchObject({ status: 403 });
  });
});
