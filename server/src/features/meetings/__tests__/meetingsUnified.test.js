'use strict';

/**
 * One meeting record per call (docs/api/meetings-unified.md): ad-hoc huddles get a
 * record, one notes store, one action-item list, one summary, the unified list, the
 * end-of-call recap and access checks. Models are in-memory collections that apply the
 * real queries and updates; Express is served on a random port.
 */

const http = require('http');
const express = require('express');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    if (!req.headers['x-user']) return res.status(401).json({ message: 'no auth' });
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../identity/workspaces.repo', () => ({
    findById: jest.fn(), findManyByIds: jest.fn(async () => []), membership: jest.fn(), memberWorkspaceIds: jest.fn(async () => []),
}));
jest.mock('../../../identity/users.repo', () => ({
    findManyByIds: jest.fn(async (ids) => new Map((ids || []).map((id) => [String(id), { _id: String(id), username: `user-${String(id).slice(-2)}` }]))),
    findById: jest.fn(async (id) => ({ _id: id, username: `user-${String(id).slice(-2)}` })),
}));
jest.mock('../../../models/ScheduledMeeting', () => require('./memoryCollection').createCollection('ScheduledMeeting'));
jest.mock('../../../../models/Note', () => require('./memoryCollection').createCollection('Note'));
jest.mock('../../../../models/DMSession', () => require('./memoryCollection').createCollection('DMSession'));
jest.mock('../../channels/channel.model', () => require('./memoryCollection').createCollection('Channel', {
    methods: { isMember(uid) { return (this.members || []).some((m) => String(m.user) === String(uid)); } },
}));
jest.mock('../../../modules/notifications/notification.model', () => require('./memoryCollection').createCollection('Notification'));
jest.mock('../../collaboration/whiteboard.model', () => require('./memoryCollection').createCollection('Whiteboard'));
jest.mock('../../collaboration/brainstorm.model', () => require('./memoryCollection').createCollection('Brainstorm'));
jest.mock('../../../modules/huddles/huddleSession.model', () => require('./memoryCollection').createCollection('HuddleSession'));
jest.mock('../../../modules/messages/message.model', () => require('./memoryCollection').createCollection('Message'));
jest.mock('../../../modules/notifications/notificationService', () => ({
    createMany: jest.fn(async (io, ids, payload) => {
        const Notification = require('../../../modules/notifications/notification.model');
        const out = [];
        for (const id of ids) out.push(await Notification.create({ ...payload, recipient: id }));
        return out;
    }),
    scheduleCreated: jest.fn(async () => []),
    huddleStarted: jest.fn(async () => []),
}));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../notes/notes.notifications', () => ({ notifyNoteCreated: jest.fn(), notifyNoteUpdated: jest.fn() }));
jest.mock('../../ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn(async (text) => ({ summary: `SUMMARY(${text.length})`, fallback: false })) }));
jest.mock('../../tasks/tasks.service', () => ({
    createTask: jest.fn(async (userId, data) => ({ tasks: [{ _id: '64b0000000000000000000t1'.replace('t', 'e'), title: data.title }] })),
    getTask: jest.fn(async (userId, id) => ({ _id: id, title: 'Ship the release', assignedTo: ['64b0000000000000000000b1'], status: 'todo' })),
}));

const workspacesRepo = require('../../../identity/workspaces.repo');
const Meeting = require('../../../models/ScheduledMeeting');
const Note = require('../../../../models/Note');
const DMSession = require('../../../../models/DMSession');
const Channel = require('../../channels/channel.model');
const Notification = require('../../../modules/notifications/notification.model');
const Session = require('../../../modules/huddles/huddleSession.model');
const Message = require('../../../modules/messages/message.model');
const Whiteboard = require('../../collaboration/whiteboard.model');
const notificationService = require('../../../modules/notifications/notificationService');
const { summarizeDocument } = require('../../ai/ai.summarizer.service');
const tasks = require('../../tasks/tasks.service');
const records = require('../meetingRecords');
const meetingsService = require('../meetings.service');
const history = require('../../../modules/huddles/huddleHistory.service');
const { registry } = require('../../../modules/huddles/huddleRegistry');
const collabAdapters = require('../../../modules/collab/collab.adapters');

const WS = '64b000000000000000000001';
const CH = '64b0000000000000000000c1';
const DM = '64b0000000000000000000d1';
const ALICE = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b1';
const CAROL = '64b0000000000000000000b2';
const DAVE = '64b0000000000000000000b3';
const OUTSIDER = '64b0000000000000000000f9';
const TASK = '64b0000000000000000000e1';

const workspace = {
    _id: WS, company: null,
    members: [ALICE, BOB, CAROL, DAVE].map((user, i) => ({ user, role: i ? 'member' : 'owner', status: 'active' })),
};

const collections = [Meeting, Note, DMSession, Channel, Notification, Session, Message, Whiteboard];

function fakeIo() {
    const emitted = [];
    const io = {
        emitted,
        to: (room) => ({ emit: (event, payload) => emitted.push({ rooms: [].concat(room), event, payload }) }),
        in: () => ({ socketsLeave: () => {} }),
        sockets: { sockets: new Map() },
    };
    io.events = (name) => emitted.filter((e) => e.event === name);
    return io;
}

let server, base, io;
beforeAll((done) => {
    records._lazy.dbReady = () => true;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.io = io; next(); });
    app.use('/api/v2/meetings', require('../meetings.routes'));
    app.use('/api/v2/collaboration', require('../../collaboration/collaboration.routes'));
    app.use('/api/v2/huddles', require('../../../modules/huddles/huddles.routes'));
    server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll((done) => { server.close(done); });

beforeEach(() => {
    jest.clearAllMocks();
    io = fakeIo();
    collections.forEach((c) => c.reset());
    for (const h of registry.list()) registry.end(h.huddleId);
    workspacesRepo.findById.mockImplementation(async (id) => (String(id) === WS ? workspace : null));
    Channel.insert({ _id: CH, workspace: WS, name: 'design', members: [{ user: ALICE }, { user: BOB }] });
    DMSession.insert({ _id: DM, workspace: WS, participants: [ALICE, CAROL] });
});

async function call(method, path, user, body) {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
}

const huddle = (over = {}) => ({
    huddleId: 'h-1', channelId: CH, dmId: null, workspaceId: WS, channelName: 'design',
    startedBy: { _id: ALICE, username: 'alice' }, startedAt: new Date('2026-10-20T10:00:00Z'), video: false, ...over,
});

function scheduled(over = {}) {
    return Meeting.insert({
        kind: 'scheduled', workspaceId: WS, createdBy: ALICE, title: 'Planning', startTime: new Date(Date.now() + 3600e3),
        duration: 30, participants: [BOB], invitees: [BOB], status: 'scheduled', actionItems: [], agenda: [], sharedNotes: '', ...over,
    });
}

// ── 1. Ad-hoc huddles get a meeting record ──────────────────────────────────

describe('find-or-create for huddles', () => {
    test('a channel huddle gets one live kind:huddle record, reused while it runs', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        expect(m).toMatchObject({ kind: 'huddle', title: 'Huddle in #design', status: 'live', huddleId: 'h-1', channelId: CH, createdBy: ALICE });
        expect(m.participants).toEqual([ALICE]);
        expect(new Date(m.startedAt).toISOString()).toBe('2026-10-20T10:00:00.000Z');
        const again = await records.findOrCreateForHuddle(huddle());
        expect(String(again._id)).toBe(String(m._id));
        expect(Meeting.docs).toHaveLength(1);
        expect(records.present(Meeting.docs[0]).conversation).toEqual({ kind: 'channel', id: CH, name: 'design' });
    });

    test('DM and workspace huddles are titled after the people / the workspace', async () => {
        const dm = await records.findOrCreateForHuddle(huddle({ huddleId: 'h-dm', channelId: null, dmId: DM, channelName: null }));
        expect(dm).toMatchObject({ title: `Huddle with user-${CAROL.slice(-2)}`, dmSessionId: DM, channelId: null });
        const ws = await records.findOrCreateForHuddle(huddle({ huddleId: 'h-ws', channelId: null, channelName: null }));
        expect(ws).toMatchObject({ title: 'Workspace huddle', channelId: null, dmSessionId: null });
        expect(records.present(ws).conversation).toEqual({ kind: 'workspace', id: WS, name: null });
    });

    test('"meeting-<id>" makes that scheduled meeting live instead of creating a record', async () => {
        const s = scheduled();
        const m = await records.findOrCreateForHuddle(huddle({ huddleId: `meeting-${s._id}`, channelId: null }));
        expect(String(m._id)).toBe(s._id);
        expect(Meeting.docs).toHaveLength(1);
        expect(Meeting.docs[0]).toMatchObject({ status: 'live', huddleId: `meeting-${s._id}` });
        expect(Meeting.docs[0].startedAt).toBeInstanceOf(Date);
    });

    test('a huddle back within 2 minutes of ending continues its record; later it is a new call', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        await records.completeMeeting(m._id, { io });
        const soon = await records.findOrCreateForHuddle(huddle(), { now: new Date(Date.now() + 60e3) });
        expect(String(soon._id)).toBe(String(m._id));
        expect(Meeting.docs[0].status).toBe('live');
        await records.completeMeeting(m._id, { io });
        const later = await records.findOrCreateForHuddle(huddle(), { now: new Date(Date.now() + 10 * 60e3) });
        expect(String(later._id)).not.toBe(String(m._id));
        expect(Meeting.docs).toHaveLength(2);
    });

    test('joins accumulate participants and attendees once each', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        await records.addAttendee(m._id, { userId: BOB, username: 'bob' });
        await records.addAttendee(m._id, { userId: BOB, username: 'bob' });
        await records.addAttendee(m._id, { userId: ALICE, username: 'alice' });
        expect(Meeting.docs[0].participants.sort()).toEqual([ALICE, BOB].sort());
        expect(Meeting.docs[0].attendees.map((a) => a.user)).toEqual([BOB, ALICE]);
    });

    test('the recorder links each run to the record and records who joined', async () => {
        const recorder = history.createRecorder({ Session, isConnected: () => true, meetingLink: history.defaultMeetingLink });
        const session = await recorder.started(huddle());
        expect(session.meeting).toBe(Meeting.docs[0]._id);
        await recorder.joined('h-1', { userId: BOB, username: 'bob' });
        await recorder.whenIdle('h-1');
        expect(Meeting.docs[0].attendees.map((a) => a.user)).toEqual([BOB]);
        expect(history.serialize(Session.docs[0])).toMatchObject({ meetingId: Meeting.docs[0]._id });
    });

    test('GET /by-huddle/:huddleId resolves the record for people in the conversation only', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        expect((await call('GET', '/api/v2/meetings/by-huddle/h-1', BOB))).toMatchObject({ status: 200, body: { meeting: { id: String(m._id), kind: 'huddle', huddleId: 'h-1' } } });
        expect((await call('GET', '/api/v2/meetings/by-huddle/h-1', DAVE)).status).toBe(403);
        expect((await call('GET', '/api/v2/meetings/by-huddle/nope', BOB)).status).toBe(404);
        expect((await call('GET', '/api/v2/meetings/by-huddle/bad%20id', BOB)).status).toBe(400);
        const s = scheduled();
        expect((await call('GET', `/api/v2/meetings/by-huddle/meeting-${s._id}`, BOB)).body.meeting).toMatchObject({ id: s._id, kind: 'scheduled' });
    });
});

// ── Access ──────────────────────────────────────────────────────────────────

describe('access follows the conversation', () => {
    test('channel meetings: channel members and invitees; DM meetings: the two people', async () => {
        const ch = await records.findOrCreateForHuddle(huddle());
        expect((await call('GET', `/api/v2/meetings/${ch._id}`, BOB)).status).toBe(200);
        expect((await call('GET', `/api/v2/meetings/${ch._id}`, DAVE)).status).toBe(403);
        expect((await call('GET', `/api/v2/meetings/${ch._id}`, OUTSIDER)).status).toBe(403);
        await Meeting.updateOne({ _id: ch._id }, { $push: { invitees: DAVE } });
        expect((await call('GET', `/api/v2/meetings/${ch._id}`, DAVE)).status).toBe(200);

        const dm = await records.findOrCreateForHuddle(huddle({ huddleId: 'h-dm', channelId: null, dmId: DM }));
        expect((await call('GET', `/api/v2/meetings/${dm._id}`, CAROL)).status).toBe(200);
        expect((await call('GET', `/api/v2/meetings/${dm._id}`, BOB)).status).toBe(403);

        const ws = scheduled();
        expect((await call('GET', `/api/v2/meetings/${ws._id}`, DAVE)).status).toBe(200);
    });

    test('ad-hoc huddle records get a whiteboard keyed by their id, with the same access', async () => {
        const ch = await records.findOrCreateForHuddle(huddle());
        expect((await call('POST', `/api/v2/collaboration/whiteboard/${ch._id}`, BOB, { strokes: [{ id: 's1', points: [{ x: 1, y: 2 }] }] })).status).toBe(200);
        expect((await call('GET', `/api/v2/collaboration/whiteboard/${ch._id}`, BOB)).body.strokes).toHaveLength(1);
        expect((await call('GET', `/api/v2/collaboration/whiteboard/${ch._id}`, DAVE)).status).toBe(403);
        const view = (await call('GET', `/api/v2/meetings/${ch._id}`, BOB)).body.meeting;
        expect(view.whiteboard).toMatchObject({ exists: true, strokeCount: 1 });
        expect(view.brainstorm).toMatchObject({ exists: false, itemCount: 0 });
    });
});

// ── 2. One notes store ──────────────────────────────────────────────────────

describe('meeting notes', () => {
    test('one Note for the whole meeting: seeded from the old shared notes, reused, editable by participants', async () => {
        const s = scheduled({ sharedNotes: 'Old plan\n\nSecond <b>para</b>' });
        const first = await call('POST', `/api/v2/meetings/${s._id}/notes`, ALICE);
        expect(first).toMatchObject({ status: 200, body: { created: true } });
        const note = Note.docs[0];
        expect(note).toMatchObject({ type: 'meeting', meeting: s._id, owner: ALICE, allowEditing: true });
        expect(note.content).toContain('Old plan');
        expect(note.content).toContain('Second &lt;b&gt;para&lt;/b&gt;');
        expect(Meeting.docs[0]).toMatchObject({ noteId: note._id });
        expect(Meeting.docs[0].sharedNotesMigratedAt).toBeInstanceOf(Date);

        const second = await call('POST', `/api/v2/meetings/${s._id}/notes`, BOB);
        expect(second.body).toEqual({ noteId: note._id, created: false });
        expect(Note.docs).toHaveLength(1);
        expect(Note.docs[0].sharedWith).toContain(BOB);
        expect((await call('GET', `/api/v2/meetings/${s._id}`, BOB)).body.meeting.noteId).toBe(note._id);
    });

    test('an existing empty note is seeded from shared notes once (migration)', async () => {
        const s = scheduled({ sharedNotes: 'Typed before the upgrade' });
        const n = Note.insert({ workspace: WS, owner: ALICE, title: 'x', type: 'meeting', content: JSON.stringify([{ id: 'h', type: 'heading', content: 'Notes' }, { id: 'p', type: 'text', content: '' }]), sharedWith: [] });
        await Meeting.updateOne({ _id: s._id }, { $set: { noteId: n._id } });
        await records.ensureNote(s._id, ALICE);
        expect(Note.docs[0].content).toContain('Typed before the upgrade');
        await Note.updateOne({ _id: n._id }, { $set: { content: '[]' } });
        await records.ensureNote(s._id, ALICE);
        expect(Note.docs[0].content).toBe('[]');
    });

    test('every run of a meeting huddle opens the same note', async () => {
        const s = scheduled({ participants: [BOB] });
        const hid = `meeting-${s._id}`;
        Session.insert({ huddleId: hid, workspace: WS, scope: 'workspace', startedAt: new Date('2026-10-20T10:00:00Z'), endedAt: new Date('2026-10-20T10:30:00Z'), participants: [{ user: ALICE, username: 'alice' }], meeting: s._id });
        const run1 = await history.ensureNotes(ALICE, hid, io);
        Session.insert({ huddleId: hid, workspace: WS, scope: 'workspace', startedAt: new Date('2026-10-21T10:00:00Z'), endedAt: null, participants: [{ user: ALICE, username: 'alice' }], meeting: s._id });
        const run2 = await history.ensureNotes(ALICE, hid, io);
        expect(run1).toMatchObject({ created: true, meetingId: s._id });
        expect(run2).toEqual({ noteId: run1.noteId, created: false, meetingId: s._id });
        expect(Note.docs).toHaveLength(1);
        expect(Session.docs.map((x) => x.notes)).toEqual([run1.noteId, run1.noteId]);
    });

    test('collab: anyone who may open the meeting can edit its note; others cannot', async () => {
        const ch = await records.findOrCreateForHuddle(huddle());
        const { noteId } = await records.ensureNote(ch._id, ALICE);
        await expect(collabAdapters.ADAPTERS.note.authorize(noteId, BOB)).resolves.toMatchObject({ canWrite: true });
        await expect(collabAdapters.ADAPTERS.note.authorize(noteId, DAVE)).rejects.toMatchObject({ status: 403 });
    });
});

// ── 3. One action-item list ─────────────────────────────────────────────────

describe('action items', () => {
    test('add / update / toggle / convert / delete through the REST API', async () => {
        const s = scheduled();
        const add = await call('POST', `/api/v2/meetings/${s._id}/action-items`, ALICE, { text: ' Draft notes ', assigneeId: BOB, dueDate: '2026-11-01' });
        expect(add.status).toBe(201);
        const item = add.body.actionItem;
        expect(item).toMatchObject({ text: 'Draft notes', assigneeId: BOB, done: false, taskId: null, source: 'manual' });
        expect(new Date(item.dueDate).toISOString()).toBe('2026-11-01T00:00:00.000Z');

        const patched = await call('PATCH', `/api/v2/meetings/${s._id}/action-items/${item.id}`, BOB, { text: 'Draft release notes', done: true });
        expect(patched.body.actionItem).toMatchObject({ text: 'Draft release notes', done: true, status: 'done' });
        const toggled = await call('POST', `/api/v2/meetings/${s._id}/action-items/${item.id}/toggle`, BOB);
        expect(toggled.body.actionItem).toMatchObject({ done: false, status: 'pending' });

        const converted = await call('POST', `/api/v2/meetings/${s._id}/action-items/${item.id}/convert`, ALICE);
        expect(converted.status).toBe(200);
        expect(converted.body.actionItem.taskId).toBe(TASK);
        expect(tasks.createTask).toHaveBeenCalledWith(ALICE, expect.objectContaining({ workspaceId: WS, title: 'Draft release notes', assignmentType: 'individual', assignedToIds: [BOB] }), io, expect.anything());
        const again = await call('POST', `/api/v2/meetings/${s._id}/action-items/${item.id}/convert`, ALICE);
        expect(again.body.alreadyConverted).toBe(true);
        expect(tasks.createTask).toHaveBeenCalledTimes(1);

        expect((await call('GET', `/api/v2/meetings/${s._id}/action-items`, BOB)).body.actionItems).toHaveLength(1);
        expect(io.events('meeting:action_items_updated').length).toBeGreaterThan(0);
        expect((await call('DELETE', `/api/v2/meetings/${s._id}/action-items/${item.id}`, ALICE)).body.actionItems).toEqual([]);
    });

    test('validation and missing items', async () => {
        const s = scheduled();
        expect((await call('POST', `/api/v2/meetings/${s._id}/action-items`, ALICE, { text: '' })).status).toBe(400);
        expect((await call('POST', `/api/v2/meetings/${s._id}/action-items`, ALICE, { text: 'x', dueDate: 'soon' })).status).toBe(400);
        expect((await call('POST', `/api/v2/meetings/${s._id}/action-items`, ALICE, { text: 'x', done: 'yes' })).status).toBe(400);
        expect((await call('DELETE', `/api/v2/meetings/${s._id}/action-items/${'6'.repeat(24)}`, ALICE)).status).toBe(404);
        expect((await call('POST', `/api/v2/meetings/${s._id}/action-items/zzz/toggle`, ALICE)).status).toBe(400);
    });

    test('AI extraction writes into the same list, deduped by text', async () => {
        const s = scheduled({ actionItems: [{ _id: '64b0000000000000000000aa', text: 'Book the venue', status: 'pending' }] });
        const first = await records.addActionItemsDeduped(s._id, [{ text: 'book the venue' }, { text: 'Send invites', assigneeId: BOB }, { text: 'send invites' }]);
        expect(first.added).toBe(1);
        const second = await records.addActionItemsDeduped(s._id, [{ text: 'Send invites' }]);
        expect(second.added).toBe(0);
        expect(Meeting.docs[0].actionItems.map((a) => a.text)).toEqual(['Book the venue', 'Send invites']);
        expect(Meeting.docs[0].actionItems[1]).toMatchObject({ source: 'ai', assignedTo: BOB });
    });

    test('a meeting huddle: linking a task and the panel ops use the meeting list', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        Session.insert({ huddleId: 'h-1', workspace: WS, scope: 'channel', channel: CH, startedAt: new Date(), endedAt: null, participants: [{ user: ALICE }], meeting: String(m._id) });
        registry.ensure('h-1', { channelId: CH }, { workspaceId: WS });
        registry.join('h-1', { userId: ALICE, username: 'alice', socketId: 's1' });

        const linked = await history.linkTask(ALICE, 'h-1', TASK, io);
        expect(linked).toEqual({ taskIds: [TASK], meetingId: String(m._id) });
        expect(Session.docs[0].linkedTasks || []).toEqual([]);
        expect(Meeting.docs[0].actionItems[0]).toMatchObject({ text: 'Ship the release', taskId: TASK, source: 'task', assignedTo: BOB });
        await history.linkTask(ALICE, 'h-1', TASK, io);
        expect(Meeting.docs[0].actionItems).toHaveLength(1);

        const op1 = await history.applyNotesOp({ userId: ALICE, username: 'alice', huddleId: 'h-1', op: { kind: 'action', item: { id: 'a-1', text: 'Fix spacing' } }, io });
        expect(op1).toMatchObject({ meetingId: String(m._id), applied: { kind: 'action', item: { id: 'a-1', text: 'Fix spacing', done: false } } });
        await history.applyNotesOp({ userId: ALICE, username: 'alice', huddleId: 'h-1', op: { kind: 'action', item: { id: 'a-1', done: true } }, io });
        expect(Meeting.docs[0].actionItems[1]).toMatchObject({ clientId: 'a-1', text: 'Fix spacing', status: 'done', source: 'huddle' });
        await history.applyNotesOp({ userId: ALICE, username: 'alice', huddleId: 'h-1', op: { kind: 'action_remove', id: 'a-1' }, io });
        expect(Meeting.docs[0].actionItems).toHaveLength(1);

        expect(await history.unlinkTask(ALICE, 'h-1', TASK, io)).toEqual({ taskIds: [], meetingId: String(m._id) });
        expect(Meeting.docs[0].actionItems).toEqual([]);
    });
});

// ── 4. One summary ──────────────────────────────────────────────────────────

describe('summary', () => {
    test('/:id/summarize reads transcript, notes and agenda and saves meeting.summary', async () => {
        const s = scheduled({
            agenda: [{ _id: '64b00000000000000000ag01'.replace('ag', 'ab'), title: 'Launch date', notes: 'pick one', order: 0 }],
            transcriptSegments: [{ speakerId: BOB, speakerName: 'bob', text: 'Ship Monday', startedAt: new Date(), endedAt: new Date() }],
        });
        await records.ensureNote(s._id, ALICE);
        await Note.updateOne({ _id: Note.docs[0]._id }, { $set: { content: JSON.stringify([{ id: 'p', type: 'text', content: 'Notes <b>here</b>' }]) } });

        const r = await call('POST', `/api/v2/meetings/${s._id}/summarize`, ALICE);
        expect(r.status).toBe(200);
        const text = summarizeDocument.mock.calls[0][0];
        expect(text).toContain('Ship Monday');
        expect(text).toContain('Notes here');
        expect(text).toContain('Launch date: pick one');
        expect(r.body).toMatchObject({ summary: expect.stringMatching(/^SUMMARY/), meetingSummary: { text: r.body.summary, by: ALICE, source: 'ai' }, source: 'transcript' });
        const view = (await call('GET', `/api/v2/meetings/${s._id}`, BOB)).body.meeting;
        expect(view.summary).toMatchObject({ text: r.body.summary, by: ALICE, source: 'ai' });
        expect(view.summary.generatedAt).toBeTruthy();
        expect(io.events('meeting:summary_updated')).toHaveLength(1);

        const put = await call('PUT', `/api/v2/meetings/${s._id}/summary`, BOB, { text: 'Edited by hand' });
        expect(put.body.summary).toMatchObject({ text: 'Edited by hand', by: BOB, source: 'manual' });
    });

    test('the huddle wrap-up of a meeting huddle sets meeting.summary and keeps the chat message', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        Session.insert({ huddleId: 'h-1', workspace: WS, scope: 'channel', channel: CH, channelName: 'design', startedAt: new Date(), endedAt: new Date(), participants: [{ user: ALICE }, { user: BOB }], meeting: String(m._id) });
        const msg = Message.insert({ sender: ALICE, channel: CH, workspace: WS });
        const res = await history.recordWrapUp({ userId: ALICE, username: 'alice', huddleId: 'h-1', messageId: msg._id, summaryText: 'We agreed to ship.', io });
        expect(res).toMatchObject({ meetingId: String(m._id), recipients: 1 });
        expect(Meeting.docs[0]).toMatchObject({ summary: 'We agreed to ship.', summaryMeta: { source: 'wrap-up', messageId: msg._id, channelId: CH, by: ALICE } });
        expect(Session.docs[0].summary).toMatchObject({ message: msg._id });
        expect(io.events('huddle:wrapped_up')[0].payload).toMatchObject({ meetingId: String(m._id), messageId: msg._id });
        expect(notificationService.createMany.mock.calls[0][2].meta).toMatchObject({ kind: 'huddle_summary', meetingId: String(m._id) });

        // Posted without the text: the summary text stays, the message reference updates.
        const msg2 = Message.insert({ sender: ALICE, channel: CH, workspace: WS });
        await history.recordWrapUp({ userId: ALICE, username: 'alice', huddleId: 'h-1', messageId: msg2._id, io });
        expect(Meeting.docs[0]).toMatchObject({ summary: 'We agreed to ship.', summaryMeta: { messageId: msg2._id } });
    });
});

// ── 5. Recording / transcript aliases ───────────────────────────────────────

describe('huddle transcript alias', () => {
    test('/api/v2/huddles/:id/transcript* resolve to the meeting record', async () => {
        const m = await records.findOrCreateForHuddle(huddle());
        Session.insert({ huddleId: 'h-1', workspace: WS, scope: 'channel', channel: CH, startedAt: new Date(), endedAt: null, participants: [{ user: ALICE }], meeting: String(m._id) });
        const seg = { speakerId: ALICE, text: "I'll write the brief", startedAt: new Date().toISOString(), endedAt: new Date().toISOString() };
        const up = await call('POST', '/api/v2/huddles/h-1/transcript/segments', ALICE, { segments: [seg] });
        expect(up).toMatchObject({ status: 201, body: { meetingId: String(m._id), added: 1 } });
        expect(Meeting.docs[0].transcriptSegments).toHaveLength(1);
        expect(Meeting.docs[0].hasTranscript).toBe(true);
        expect(Session.docs[0].transcriptSegments || []).toEqual([]);
        const viaMeeting = await call('GET', `/api/v2/meetings/${m._id}/transcript`, BOB);
        const viaHuddle = await call('GET', '/api/v2/huddles/h-1/transcript', BOB);
        expect(viaHuddle.body.segments).toEqual(viaMeeting.body.segments);
        expect(viaHuddle.body).toMatchObject({ huddleId: 'h-1', meetingId: String(m._id) });
    });
});

// ── 6. Lists ────────────────────────────────────────────────────────────────

describe('GET /api/v2/meetings?status=', () => {
    const at = (min) => new Date(Date.now() + min * 60e3);
    let ids;
    beforeEach(() => {
        ids = {
            upcoming: scheduled({ title: 'Roadmap review', startTime: at(120) })._id,
            upcoming2: scheduled({ title: 'Retro', startTime: at(240) })._id,
            live: scheduled({ title: 'Standup', status: 'live', startTime: at(-10), startedAt: at(-10) })._id,
            past: scheduled({ title: 'Kickoff', status: 'completed', startTime: at(-600), endedAt: at(-560) })._id,
            short: Meeting.insert({ kind: 'huddle', workspaceId: WS, createdBy: ALICE, title: 'Workspace huddle', status: 'completed', startTime: at(-300), durationSec: 30, hasContent: false, participants: [ALICE] })._id,
            long: Meeting.insert({ kind: 'huddle', workspaceId: WS, createdBy: ALICE, title: 'Workspace huddle', status: 'completed', startTime: at(-200), durationSec: 300, participants: [ALICE] })._id,
            shortWithNotes: Meeting.insert({ kind: 'huddle', workspaceId: WS, createdBy: ALICE, title: 'Quick sync', status: 'completed', startTime: at(-100), durationSec: 20, hasContent: true, participants: [ALICE] })._id,
            channel: Meeting.insert({ kind: 'huddle', workspaceId: WS, channelId: CH, createdBy: ALICE, title: 'Huddle in #design', status: 'completed', startTime: at(-90), durationSec: 400, participants: [ALICE, BOB] })._id,
            dm: Meeting.insert({ kind: 'huddle', workspaceId: WS, dmSessionId: DM, createdBy: ALICE, title: 'Huddle with carol', status: 'completed', startTime: at(-80), durationSec: 400, participants: [ALICE, CAROL] })._id,
            liveHuddle: Meeting.insert({ kind: 'huddle', workspaceId: WS, channelId: CH, createdBy: BOB, title: 'Huddle in #design', status: 'live', startTime: at(-1), startedAt: at(-1), participants: [BOB] })._id,
        };
    });
    const list = async (user, qs) => (await call('GET', `/api/v2/meetings?workspaceId=${WS}&${qs}`, user)).body;
    const titlesOf = (body) => body.meetings.map((m) => m.id);

    test('upcoming / live / past with the short-call rule', async () => {
        expect(titlesOf(await list(ALICE, 'status=upcoming'))).toEqual([ids.upcoming, ids.upcoming2]);
        expect(titlesOf(await list(ALICE, 'status=live'))).toEqual([ids.liveHuddle, ids.live]);
        expect(titlesOf(await list(ALICE, 'status=past'))).toEqual([ids.dm, ids.channel, ids.shortWithNotes, ids.long, ids.past]);
        expect(titlesOf(await list(ALICE, 'status=past&includeShort=1'))).toContain(ids.short);
        const one = (await list(ALICE, 'status=past')).meetings.find((m) => m.id === ids.channel);
        expect(one).toMatchObject({ kind: 'huddle', conversation: { kind: 'channel', id: CH, name: 'design' }, durationSec: 400 });
    });

    test('only meetings the caller may open', async () => {
        expect(titlesOf(await list(DAVE, 'status=past'))).toEqual([ids.shortWithNotes, ids.long, ids.past]);
        expect(titlesOf(await list(CAROL, 'status=past'))).toContain(ids.dm);
        expect(titlesOf(await list(BOB, 'status=past'))).not.toContain(ids.dm);
        expect(titlesOf(await list(DAVE, 'status=live'))).toEqual([ids.live]);
        expect((await call('GET', `/api/v2/meetings?workspaceId=${WS}&status=past`, OUTSIDER)).status).toBe(403);
    });

    test('kind, q, pagination and bad input', async () => {
        expect(titlesOf(await list(ALICE, 'status=past&kind=scheduled'))).toEqual([ids.past]);
        expect(titlesOf(await list(ALICE, 'status=past&kind=huddle'))).toEqual([ids.dm, ids.channel, ids.shortWithNotes, ids.long]);
        expect(titlesOf(await list(ALICE, 'status=past&q=quick'))).toEqual([ids.shortWithNotes]);
        const page1 = await list(ALICE, 'status=past&limit=2');
        expect(titlesOf(page1)).toEqual([ids.dm, ids.channel]);
        expect(page1.hasMore).toBe(true);
        const page2 = await list(ALICE, `status=past&limit=2&before=${encodeURIComponent(page1.nextBefore)}`);
        expect(titlesOf(page2)).toEqual([ids.shortWithNotes, ids.long]);
        const page3 = await list(ALICE, `status=past&limit=2&before=${encodeURIComponent(page2.nextBefore)}`);
        expect(page3).toMatchObject({ hasMore: false, nextBefore: null });
        expect(titlesOf(page3)).toEqual([ids.past]);
        const up = await list(ALICE, 'status=upcoming&limit=1');
        expect(titlesOf(await list(ALICE, `status=upcoming&limit=1&after=${encodeURIComponent(up.nextAfter)}`))).toEqual([ids.upcoming2]);
        expect((await call('GET', `/api/v2/meetings?workspaceId=${WS}&status=soon`, ALICE)).status).toBe(400);
        expect((await call('GET', `/api/v2/meetings?workspaceId=${WS}&status=past&kind=x`, ALICE)).status).toBe(400);
    });

    test('the legacy list (no status) keeps returning scheduled meetings only', async () => {
        const body = await list(ALICE, 'limit=50');
        expect(body.meetings.every((m) => (m.kind || 'scheduled') === 'scheduled')).toBe(true);
        expect(body.meetings).toHaveLength(4);
    });
});

// ── 7. End and recap ────────────────────────────────────────────────────────

describe('ending a call', () => {
    test('completion sets endedAt/duration, tells everyone and sends one recap notification each', async () => {
        const m = await records.findOrCreateForHuddle(huddle({ startedAt: new Date(Date.now() - 5 * 60e3) }));
        await records.addAttendee(m._id, { userId: BOB, username: 'bob' });
        const done = await meetingsService.completeMeetingsForHuddle({ huddleId: 'h-1', channelId: CH, workspaceId: WS }, io);
        expect(done).toEqual([]); // ad-hoc records are reported as the huddle itself
        expect(Meeting.docs[0]).toMatchObject({ status: 'completed' });
        expect(Meeting.docs[0].durationSec).toBeGreaterThanOrEqual(299);
        expect(Meeting.docs[0].endedAt).toBeInstanceOf(Date);

        const ended = io.events('meeting:ended');
        expect(ended).toHaveLength(1);
        expect(ended[0].rooms).toEqual(expect.arrayContaining([`user:${ALICE}`, `user:${BOB}`, `meeting:${m._id}`]));
        expect(ended[0].payload).toMatchObject({ meetingId: String(m._id), title: 'Huddle in #design', kind: 'huddle', conversation: { kind: 'channel', id: CH } });
        expect(io.events('schedule:updated')).toHaveLength(0); // not announced workspace-wide
        expect(Notification.docs.map((n) => n.recipient).sort()).toEqual([ALICE, BOB].sort());
        expect(Notification.docs[0]).toMatchObject({ type: 'meeting_recap', link: `/meetings/${m._id}`, meta: { meetingId: String(m._id) } });

        // Ended again (already over): nothing new. A re-run that ends: still one recap per person.
        await records.completeMeeting(m._id, { io });
        expect(io.events('meeting:ended')).toHaveLength(1);
        await records.findOrCreateForHuddle(huddle());
        await records.completeMeeting(m._id, { io });
        expect(io.events('meeting:ended')).toHaveLength(2);
        expect(Notification.docs).toHaveLength(2);
    });

    test('a short call without content gets the ended notice but no recap notification', async () => {
        const m = await records.findOrCreateForHuddle(huddle({ startedAt: new Date(Date.now() - 20e3) }));
        await records.completeMeeting(m._id, { io });
        expect(io.events('meeting:ended')).toHaveLength(1);
        expect(Notification.docs).toHaveLength(0);
        await Meeting.updateOne({ _id: m._id }, { $set: { status: 'live' } });
        await records.addActionItem(m._id, { text: 'Follow up' });
        await records.completeMeeting(m._id, { io });
        expect(Notification.docs).toHaveLength(1);
    });

    test('"End meeting" on the page ends the live huddle too', async () => {
        const s = scheduled({ status: 'live', startedAt: new Date(Date.now() - 60e3) });
        const hid = `meeting-${s._id}`;
        registry.ensure(hid, { workspaceId: WS }, { workspaceId: WS, meetingId: s._id });
        registry.join(hid, { userId: ALICE, username: 'alice', socketId: 's1' });

        const r = await call('PATCH', `/api/v2/meetings/${s._id}/end`, ALICE, {});
        expect(r.status).toBe(200);
        expect(r.body.meeting).toMatchObject({ id: s._id, status: 'completed', huddleId: hid });
        expect(registry.get(hid)).toBeNull();
        expect(io.events('huddle:ended')[0].payload).toMatchObject({ huddleId: hid, meetingId: s._id, reason: 'meeting_ended' });
        expect(io.events('meeting:ended')).toHaveLength(1);
        expect(Notification.docs.map((n) => n.recipient).sort()).toEqual([ALICE, BOB].sort());
    });
});
