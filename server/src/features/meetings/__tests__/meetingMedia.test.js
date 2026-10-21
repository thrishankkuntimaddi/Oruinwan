'use strict';

/**
 * Scheduled meetings: recording upload / signed playback / delete, transcript segments,
 * transcript-based action items and summary, the availability finder endpoint and the
 * meeting.completed event. ScheduledMeeting is an in-memory fake; storage is mocked.
 */

const http = require('http');
const express = require('express');

process.env.MEDIA_URL_SECRET = 'test-media-secret';

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    if (!req.headers['x-user']) return res.status(401).json({ message: 'no auth' });
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../identity/workspaces.repo', () => ({
    findById: jest.fn(), findManyByIds: jest.fn(async () => []), membership: jest.fn(), memberWorkspaceIds: jest.fn(async () => []),
}));
jest.mock('../../../identity/users.repo', () => ({ findManyByIds: jest.fn(async () => new Map()), findById: jest.fn(async () => null) }));
jest.mock('../../../models/ScheduledMeeting', () => ({
    findById: jest.fn(), findOne: jest.fn(), find: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn(), findByIdAndUpdate: jest.fn(),
}));
jest.mock('../../../modules/uploads/upload.service', () => ({
    writeObject: jest.fn(async () => {}),
    deleteObject: jest.fn(async () => {}),
    streamObject: jest.fn(async (path, req, res) => { res.status(200).set('Content-Type', 'video/webm').send(`bytes:${path}`); }),
}));
jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn(async (text) => ({ summary: `S(${text.length})`, fallback: false })) }));

const workspacesRepo = require('../../../identity/workspaces.repo');
const usersRepo = require('../../../identity/users.repo');
const ScheduledMeeting = require('../../../models/ScheduledMeeting');
const storage = require('../../../modules/uploads/upload.service');
const emitter = require('../../../modules/notifications/notificationEventEmitter');
const { summarizeDocument } = require('../../ai/ai.summarizer.service');

const WS = '64b000000000000000000001';
const MEETING = '64b0000000000000000000e1';
const OWNER = '64b0000000000000000000a1';
const GUEST = '64b0000000000000000000b1';
const MEMBER = '64b0000000000000000000b2';
const OUTSIDER = '64b0000000000000000000c1';

const workspace = {
    _id: WS, company: null,
    members: [
        { user: OWNER, role: 'member', status: 'active' },
        { user: GUEST, role: 'member', status: 'active' },
        { user: MEMBER, role: 'member', status: 'active' },
    ],
};

function chain(value) {
    const c = {
        select: () => c, populate: () => c, sort: () => c, limit: () => c,
        lean: () => Promise.resolve(value && JSON.parse(JSON.stringify(value))),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return c;
}

let doc;
let busy;
function applyUpdate(target, update) {
    const set = update.$set || (update.$push ? {} : update);
    for (const [k, v] of Object.entries(set)) target[k] = v;
    for (const [k, v] of Object.entries(update.$push || {})) target[k] = [...(target[k] || []), ...(v.$each || [v])];
}

let server, base;
beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.io = { to: () => ({ emit: () => {} }) }; next(); });
    app.use('/api/v2/meetings', require('../meetings.routes'));
    server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll((done) => { server.close(done); });

beforeEach(() => {
    jest.clearAllMocks();
    workspacesRepo.findById.mockImplementation(async (id) => (String(id) === WS ? workspace : null));
    doc = {
        _id: MEETING, workspaceId: WS, createdBy: OWNER, participants: [GUEST], status: 'live', title: 'Planning',
        startTime: '2026-10-19T10:00:00.000Z', duration: 45, actionItems: [], transcriptSegments: [], transcript: '', sharedNotes: '',
        recording: null, recordingUrl: null,
    };
    busy = [];
    const match = (id) => String(id) === MEETING;
    ScheduledMeeting.findById.mockImplementation((id) => chain(match(id) ? doc : null));
    ScheduledMeeting.findOne.mockImplementation((q) => chain(match(q._id) ? doc : null));
    ScheduledMeeting.find.mockImplementation(() => chain(busy));
    ScheduledMeeting.findByIdAndUpdate.mockImplementation(async (id, update) => { applyUpdate(doc, update); return doc; });
    ScheduledMeeting.findOneAndUpdate.mockImplementation((q, update, opts) => {
        if (!match(q._id)) return chain(null);
        const before = JSON.parse(JSON.stringify(doc));
        applyUpdate(doc, update);
        return chain(opts?.new === false ? before : doc);
    });
    ScheduledMeeting.updateOne.mockImplementation(async (q, update) => {
        if (!match(q._id)) return { matchedCount: 0 };
        if (q.$expr) {
            const limit = q.$expr.$lte[1];
            if ((doc.transcriptSegments || []).length > limit) return { matchedCount: 0 };
        }
        applyUpdate(doc, update);
        return { matchedCount: 1 };
    });
});

async function call(method, path, user, body) {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
}

async function upload(user, { name = 'call.webm', type = 'video/webm', bytes = 'abc', durationSec } = {}) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    if (durationSec !== undefined) form.append('durationSec', String(durationSec));
    const res = await fetch(`${base}/api/v2/meetings/${MEETING}/recording`, { method: 'POST', headers: { 'x-user': user }, body: form });
    return { status: res.status, body: await res.json() };
}

describe('recording', () => {
    test('organizer/invitee uploads; recordingUrl + duration are stored', async () => {
        const r = await upload(GUEST, { durationSec: 125.4 });
        expect(r.status).toBe(201);
        expect(r.body.recordingUrl).toBe(`/api/v2/meetings/${MEETING}/recording`);
        expect(r.body.recording).toMatchObject({ mimeType: 'video/webm', size: 3, durationSec: 125, uploadedBy: GUEST });
        expect(storage.writeObject).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`^recordings/${WS}/meeting-${MEETING}/[0-9a-f-]+\\.webm$`)),
            expect.any(Buffer),
            expect.objectContaining({ contentType: 'video/webm' }),
        );
        expect(doc.recording.path).toMatch(/^recordings\//);
        expect(doc.recordingUrl).toBe(`/api/v2/meetings/${MEETING}/recording`);
    });

    test('replacing a recording deletes the old object', async () => {
        await upload(OWNER);
        const first = doc.recording.path;
        await upload(OWNER, { name: 'call.m4a', type: 'audio/x-m4a' });
        expect(doc.recording.mimeType).toBe('audio/x-m4a');
        await new Promise((r) => setImmediate(r));
        expect(storage.deleteObject).toHaveBeenCalledWith(first);
    });

    test('wrong type -> 415, bad duration -> 400, non-attendee member -> 403, outsider -> 403', async () => {
        expect((await upload(OWNER, { name: 'x.exe', type: 'application/x-msdownload' })).status).toBe(415);
        expect((await upload(OWNER, { name: 'x.mp3', type: 'audio/mpeg' })).status).toBe(415);
        expect((await upload(OWNER, { durationSec: -5 })).status).toBe(400);
        expect((await upload(MEMBER)).status).toBe(403);
        expect((await upload(OUTSIDER)).status).toBe(403);
        expect(storage.writeObject).not.toHaveBeenCalled();
    });

    test('signed GET URL streams for members and is rejected when tampered or for outsiders', async () => {
        await upload(OWNER);
        const none = await call('GET', `/api/v2/meetings/${MEETING}/recording`, OUTSIDER);
        expect(none.status).toBe(403);

        const r = await call('GET', `/api/v2/meetings/${MEETING}/recording`, MEMBER);
        expect(r.status).toBe(200);
        expect(r.body.url).toMatch(new RegExp(`^/api/v2/meetings/${MEETING}/recording/stream\\?u=${MEMBER}&exp=\\d+&sig=`));
        expect(r.body.recording.mimeType).toBe('video/webm');

        const ok = await fetch(base + r.body.url);
        expect(ok.status).toBe(200);
        expect(await ok.text()).toBe(`bytes:${doc.recording.path}`);

        const tampered = await fetch(base + r.body.url.replace(`u=${MEMBER}`, `u=${OUTSIDER}`));
        expect(tampered.status).toBe(403);

        // Member removed from the workspace after the link was issued.
        workspacesRepo.findById.mockImplementation(async () => ({ ...workspace, members: workspace.members.filter((m) => m.user !== MEMBER) }));
        expect((await fetch(base + r.body.url)).status).toBe(403);
    });

    test('delete: only uploader/organizer/admin; object removed', async () => {
        await upload(GUEST);
        const path = doc.recording.path;
        expect((await call('DELETE', `/api/v2/meetings/${MEETING}/recording`, MEMBER)).status).toBe(403);
        const r = await call('DELETE', `/api/v2/meetings/${MEETING}/recording`, OWNER);
        expect(r.status).toBe(200);
        expect(storage.deleteObject).toHaveBeenCalledWith(path);
        expect(doc.recording).toBeNull();
        expect(doc.recordingUrl).toBeNull();
        expect((await call('GET', `/api/v2/meetings/${MEETING}/recording`, OWNER)).status).toBe(404);
    });
});

describe('transcript segments', () => {
    const seg = (speakerId, text, sec) => ({ speakerId, text, startedAt: new Date(Date.UTC(2026, 9, 19, 10, 0, sec)).toISOString(), endedAt: new Date(Date.UTC(2026, 9, 19, 10, 0, sec + 2)).toISOString() });

    test('append, then read back sorted with names and rendered text', async () => {
        usersRepo.findManyByIds.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { _id: id, username: id === OWNER ? 'olivia' : 'gus' }])));
        expect((await call('POST', `/api/v2/meetings/${MEETING}/transcript/segments`, GUEST, { segments: [seg(GUEST, 'Can you send the notes?', 20)] })).status).toBe(201);
        const r1 = await call('POST', `/api/v2/meetings/${MEETING}/transcript/segments`, OWNER, seg(OWNER, "I'll send them tonight.", 30));
        expect(r1).toEqual({ status: 201, body: { added: 1 } });
        expect(doc.transcriptSegments[0].addedBy).toBe(GUEST);

        const r = await call('GET', `/api/v2/meetings/${MEETING}/transcript`, MEMBER);
        expect(r.status).toBe(200);
        expect(r.body.segments.map((s) => [s.speakerName, s.text])).toEqual([['gus', 'Can you send the notes?'], ['olivia', "I'll send them tonight."]]);
        expect(r.body.text).toBe("[00:20] gus: Can you send the notes?\n[00:30] olivia: I'll send them tonight.");
    });

    test('invalid body -> 400; outsider -> 403; full transcript -> 409', async () => {
        expect((await call('POST', `/api/v2/meetings/${MEETING}/transcript/segments`, OWNER, { segments: [{ text: '' }] })).status).toBe(400);
        expect((await call('POST', `/api/v2/meetings/${MEETING}/transcript/segments`, OUTSIDER, seg(OWNER, 'x', 1))).status).toBe(403);
        doc.transcriptSegments = Array.from({ length: 5000 }, (_, i) => seg(OWNER, 'x', i));
        const r = await call('POST', `/api/v2/meetings/${MEETING}/transcript/segments`, OWNER, seg(OWNER, 'y', 1));
        expect(r.status).toBe(409);
    });

    test('summarize prefers the transcript over notes', async () => {
        doc.sharedNotes = 'notes text';
        doc.transcriptSegments = [seg(OWNER, 'We should ship on Monday.', 5)];
        const r = await call('POST', `/api/v2/meetings/${MEETING}/summarize`, OWNER);
        expect(r.status).toBe(200);
        expect(summarizeDocument).toHaveBeenCalledWith(expect.stringContaining('We should ship on Monday.'), expect.any(Object));
        expect(summarizeDocument.mock.calls[0][0]).not.toContain('notes text');
    });

    test('action items: extract (dry) then apply without duplicates', async () => {
        doc.transcriptSegments = [seg(GUEST, "I'll draft the release notes.", 1), seg(OWNER, 'Action item: book the venue', 2)];
        doc.actionItems = [{ _id: 'x', text: 'Book the venue', status: 'pending' }];
        const dry = await call('POST', `/api/v2/meetings/${MEETING}/action-items/extract`, MEMBER, {});
        expect(dry.status).toBe(200);
        expect(dry.body.extracted.map((i) => i.text)).toEqual(['Draft the release notes', 'Book the venue']);
        expect(dry.body.added).toBe(0);
        expect(doc.actionItems).toHaveLength(1);

        const applied = await call('POST', `/api/v2/meetings/${MEETING}/action-items/extract`, MEMBER, { apply: true });
        expect(applied.body.added).toBe(1);
        expect(doc.actionItems[1]).toEqual({ text: 'Draft the release notes', assignedTo: GUEST, status: 'pending' });
    });
});

describe('suggest-time', () => {
    test('uses attendees busy time and working hours; filters non-members', async () => {
        usersRepo.findManyByIds.mockImplementation(async (ids) => new Map(ids.map((id) => [id, {
            _id: id, preferences: { region: { timezone: id === GUEST ? 'America/New_York' : 'UTC' } },
        }])));
        busy = [{ startTime: '2026-10-19T13:00:00.000Z', duration: 60, participants: [GUEST], createdBy: OWNER }];
        const r = await call('POST', '/api/v2/meetings/suggest-time', OWNER, {
            workspaceId: WS, participantIds: [GUEST, OUTSIDER], durationMinutes: 30, from: '2030-10-21T00:00:00.000Z', limit: 3,
        });
        expect(r.status).toBe(200);
        expect(usersRepo.findManyByIds.mock.calls[0][0].sort()).toEqual([GUEST, OWNER].sort());
        expect(r.body.slots).toHaveLength(3);
        expect(r.body.suggestedStart).toBe(r.body.slots[0].start);
        // 2030-10-21 is a Monday; New York opens 13:00Z.
        expect(r.body.slots[0].start).toBe('2030-10-21T13:00:00.000Z');
        expect(ScheduledMeeting.find).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ['scheduled', 'live'] } }));
    });

    test('busy meetings push the first slot later', async () => {
        usersRepo.findManyByIds.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { _id: id, preferences: { region: { timezone: 'UTC' } } }])));
        busy = [{ startTime: '2030-10-21T09:00:00.000Z', duration: 120, participants: [GUEST], createdBy: MEMBER }];
        const r = await call('POST', '/api/v2/meetings/suggest-time', OWNER, { participantIds: [GUEST], from: '2030-10-21T00:00:00.000Z', limit: 1 });
        expect(r.body.slots[0].start).toBe('2030-10-21T11:00:00.000Z');
    });

    test('rejects a non-array participant list and non-members of the workspace', async () => {
        expect((await call('POST', '/api/v2/meetings/suggest-time', OWNER, { participantIds: 'x' })).status).toBe(400);
        expect((await call('POST', '/api/v2/meetings/suggest-time', OUTSIDER, { workspaceId: WS, participantIds: [] })).status).toBe(403);
    });
});

describe('meeting.completed', () => {
    test('ending a meeting emits metadata once', async () => {
        doc.actionItems = [{ text: 'a' }, { text: 'b' }];
        const r = await call('PATCH', `/api/v2/meetings/${MEETING}/end`, OWNER, {});
        expect(r.status).toBe(200);
        expect(emitter.emit).toHaveBeenCalledTimes(1);
        const [name, payload] = emitter.emit.mock.calls[0];
        expect(name).toBe('meeting.completed');
        expect(payload).toMatchObject({
            kind: 'scheduled', workspaceId: WS, meetingId: MEETING, title: 'Planning', durationMinutes: 45, participantCount: 1, actionItemCount: 2,
        });
        expect(payload).not.toHaveProperty('transcript');

        await call('PATCH', `/api/v2/meetings/${MEETING}/end`, OWNER, {});
        expect(emitter.emit).toHaveBeenCalledTimes(1);
    });
});
