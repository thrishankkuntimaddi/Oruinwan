'use strict';

const mongoose = require('mongoose');
const Note = require('../../../../models/Note');
const KnowledgePage = require('../../../features/knowledge/KnowledgePage');
const Whiteboard = require('../../../features/collaboration/whiteboard.model');
const identity = require('../../../identity');
const { ADAPTERS, KNOWLEDGE_VERSION_EVERY_MS } = require('../collab.adapters');
const { registerModuleSockets } = require('../..');
const { attachCollabReplication } = require('../collab.replication');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const OWNER = oid();
const EDITOR = oid();
const VIEWER = oid();
const OUTSIDER = oid();

const lean = (v) => ({ select: () => ({ lean: async () => v }), lean: async () => v });

beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(identity.workspaces, 'findById').mockImplementation(async (id) => (String(id) === WS ? {
        _id: WS,
        members: [OWNER, EDITOR, VIEWER].map(user => ({ user, role: 'member', status: 'active' })),
    } : null));
});

describe('note adapter', () => {
    const note = (fields) => ({ _id: oid(), workspace: WS, owner: OWNER, isPublic: false, sharedWith: [EDITOR, VIEWER], allowEditing: false, ...fields });

    test('owner writes; shared users write only with allowEditing; public is read-only', async () => {
        let doc = note();
        jest.spyOn(Note, 'findById').mockImplementation(() => lean(doc));
        await expect(ADAPTERS.note.authorize(doc._id, OWNER)).resolves.toEqual({ workspaceId: WS, canWrite: true });
        await expect(ADAPTERS.note.authorize(doc._id, EDITOR)).resolves.toEqual({ workspaceId: WS, canWrite: false });
        doc = note({ allowEditing: true });
        await expect(ADAPTERS.note.authorize(doc._id, EDITOR)).resolves.toEqual({ workspaceId: WS, canWrite: true });
        doc = note({ sharedWith: [], isPublic: true });
        await expect(ADAPTERS.note.authorize(doc._id, VIEWER)).resolves.toEqual({ workspaceId: WS, canWrite: false });
        doc = note({ sharedWith: [] });
        await expect(ADAPTERS.note.authorize(doc._id, VIEWER)).rejects.toMatchObject({ status: 403 });
        await expect(ADAPTERS.note.authorize(doc._id, OUTSIDER)).rejects.toMatchObject({ status: 403 });
        await expect(ADAPTERS.note.authorize('nope', OWNER)).rejects.toMatchObject({ status: 400 });
    });

    test('persist sanitises the HTML of text blocks', async () => {
        const spy = jest.spyOn(Note, 'updateOne').mockResolvedValue({});
        const id = oid();
        await ADAPTERS.note.persist(id, JSON.stringify([{ id: 'a', type: 'text', content: '<b>ok</b><script>x()</script>' }]));
        const saved = JSON.parse(spy.mock.calls[0][1].$set.content);
        expect(saved[0].content).toBe('<b>ok</b>');
    });
});

describe('knowledge adapter', () => {
    test('workspace members read and write; others get not found', async () => {
        const id = oid();
        jest.spyOn(KnowledgePage, 'findById').mockImplementation(() => lean({ _id: id, workspaceId: WS, isDeleted: false }));
        await expect(ADAPTERS.knowledge.authorize(id, VIEWER)).resolves.toEqual({ workspaceId: WS, canWrite: true });
        await expect(ADAPTERS.knowledge.authorize(id, OUTSIDER)).rejects.toMatchObject({ status: 404 });
    });

    test('persist snapshots a version at most every 10 minutes', async () => {
        const now = Date.now();
        const page = { content: 'v1', versions: [], createdBy: OWNER, isDeleted: false, save: jest.fn() };
        jest.spyOn(KnowledgePage, 'findById').mockResolvedValue(page);
        await ADAPTERS.knowledge.persist(oid(), 'v2', { userId: EDITOR, now });
        expect(page.versions).toEqual([expect.objectContaining({ content: 'v1', savedBy: EDITOR })]);
        await ADAPTERS.knowledge.persist(oid(), 'v3', { userId: EDITOR, now: now + 1000 });
        expect(page.versions).toHaveLength(1);
        expect(page.content).toBe('v3');
        await ADAPTERS.knowledge.persist(oid(), 'v4', { userId: EDITOR, now: now + KNOWLEDGE_VERSION_EVERY_MS + 1000 });
        expect(page.versions.map(v => v.content)).toEqual(['v3', 'v1']);
        expect(page.save).toHaveBeenCalledTimes(3);
    });
});

describe('whiteboard adapter', () => {
    test('persist upserts strokes for the meeting', async () => {
        const spy = jest.spyOn(Whiteboard, 'findOneAndUpdate').mockResolvedValue({});
        const meetingId = oid();
        await ADAPTERS.whiteboard.persist(meetingId, [{ id: 's1', points: [] }], { workspaceId: WS });
        expect(spy).toHaveBeenCalledWith(
            { meetingId },
            { $set: { strokes: [{ id: 's1', points: [] }] }, $setOnInsert: { meetingId, workspaceId: WS } },
            { upsert: true }
        );
    });
});

describe('wiring', () => {
    test('module socket registration attaches the collab handlers', () => {
        const events = [];
        const socket = { id: 's1', user: { id: 'u1' }, data: {}, on: (event) => events.push(event), emit() {} };
        registerModuleSockets({}, socket);
        expect(events).toEqual(expect.arrayContaining(['collab:join', 'collab:sync', 'collab:awareness', 'collab:leave']));
    });

    test('replication publishes local changes and applies messages from other instances only', async () => {
        const published = [];
        const redis = { publish: jest.fn(async (ch, m) => published.push([ch, JSON.parse(m)])) };
        const handlers = [];
        const subscriber = { on: (e, h) => handlers.push(h), subscribe: jest.fn(async () => {}), removeListener: jest.fn(), unsubscribe: jest.fn(async () => {}) };
        const registry = { applyPeer: jest.fn(), publish: null };
        const detach = await attachCollabReplication(registry, { redis, subscriber, instanceId: 'me' });
        registry.publish({ type: 'update', key: 'note:1', data: 'AA==' });
        expect(published[0]).toEqual(['collab:ops', { from: 'me', type: 'update', key: 'note:1', data: 'AA==' }]);
        handlers[0]('collab:ops', JSON.stringify({ from: 'me', type: 'update', key: 'note:1' }));
        handlers[0]('collab:ops', JSON.stringify({ from: 'other', type: 'update', key: 'note:1' }));
        handlers[0]('other-channel', '{}');
        expect(registry.applyPeer).toHaveBeenCalledTimes(1);
        await detach();
        expect(registry.publish).toBeNull();
    });
});
