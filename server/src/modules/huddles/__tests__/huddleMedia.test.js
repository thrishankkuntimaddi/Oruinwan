'use strict';

/**
 * Huddle recordings, transcript segments, draft summary and the meeting.completed event.
 * The session model, history access checks and storage are faked.
 */

const http = require('http');
const express = require('express');

process.env.MEDIA_URL_SECRET = 'test-media-secret';

const USER = '64b0000000000000000000a1';
const OTHER = '64b0000000000000000000b1';
const OUTSIDER = '64b0000000000000000000c1';
const WS = '64b000000000000000000001';
const SESSION = '64b0000000000000000000d1';
const NOTE = '64b0000000000000000000f1';

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    if (!req.headers['x-user']) return res.status(401).json({ message: 'no auth' });
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../huddleSession.model', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ findById: jest.fn() }));
jest.mock('../huddleHistory.service', () => {
    const { HttpError } = require('../../../shared/utils/workspaceAccess');
    const canView = jest.fn(async (_s, uid) => uid !== '64b0000000000000000000c1');
    return {
        canView,
        loadAccessible: jest.fn(async (uid, huddleId) => {
            const s = global.__session;
            if (!s || s.huddleId !== huddleId) throw new HttpError(404, 'Huddle not found');
            if (!(await canView(s, uid))) throw new HttpError(403, 'You do not have access to this huddle');
            return s;
        }),
        assertMember: jest.fn((s, uid) => {
            if (!(s.participants || []).some((p) => String(p.user) === String(uid))) throw new HttpError(403, 'Only people in this huddle can do that');
        }),
        recorder: { whenIdle: jest.fn(async () => {}) },
        listHistory: jest.fn(), getSession: jest.fn(), ensureNotes: jest.fn(), linkTask: jest.fn(), unlinkTask: jest.fn(), recordWrapUp: jest.fn(),
    };
});
jest.mock('../../uploads/upload.service', () => ({
    writeObject: jest.fn(async () => {}),
    deleteObject: jest.fn(async () => {}),
    streamObject: jest.fn(async (path, req, res) => { res.status(200).send(`bytes:${path}`); }),
}));
jest.mock('../../notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));
jest.mock('../../../features/ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn(async (text) => ({ summary: `S:${text}`, fallback: false })) }));
jest.mock('../../../identity/users.repo', () => ({ findManyByIds: jest.fn(async (ids) => new Map(ids.map((id) => [id, { username: `user-${id.slice(-2)}` }]))), findById: jest.fn() }));
jest.mock('../../../identity/workspaces.repo', () => ({ findById: jest.fn(async () => null), membership: jest.fn(), memberWorkspaceIds: jest.fn(async () => []), findManyByIds: jest.fn(async () => []) }));

const Session = require('../huddleSession.model');
const Note = require('../../../../models/Note');
const storage = require('../../uploads/upload.service');
const emitter = require('../../notifications/notificationEventEmitter');
const media = require('../huddleMedia.service');

function chain(value) {
    const c = {
        select: () => c, sort: () => c, limit: () => c,
        lean: () => Promise.resolve(value && JSON.parse(JSON.stringify(value))),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return c;
}

let server, base;
beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.io = { to: () => ({ emit: () => {} }) }; next(); });
    app.use('/api/v2/huddles', require('../huddles.routes'));
    server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; done(); });
});
afterAll((done) => { server.close(done); });

beforeEach(() => {
    jest.clearAllMocks();
    global.__session = {
        _id: SESSION, huddleId: 'h1', workspace: WS, scope: 'channel', channelName: 'design',
        startedAt: '2026-10-19T10:00:00.000Z', endedAt: '2026-10-19T10:42:00.000Z', startedBy: USER,
        participants: [{ user: USER }, { user: OTHER }], notes: null, transcriptSegments: [], recording: null,
    };
    const s = () => global.__session;
    Session.findOne.mockImplementation((q) => chain(q.huddleId === 'h1' && (!q._id || q._id === SESSION) ? s() : null));
    Session.findOneAndUpdate.mockImplementation((q, update) => {
        const before = JSON.parse(JSON.stringify(s()));
        Object.assign(s(), update.$set);
        return chain(before);
    });
    Session.updateOne.mockImplementation(async (q, update) => {
        if (q.$expr && s().transcriptSegments.length > q.$expr.$lte[1]) return { matchedCount: 0 };
        s().transcriptSegments.push(...update.$push.transcriptSegments.$each);
        return { matchedCount: 1 };
    });
});

async function call(method, path, user, body) {
    const res = await fetch(base + path, {
        method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
}

describe('huddle transcript + summary', () => {
    const seg = (speakerId, text, sec) => ({ speakerId, text, startedAt: new Date(Date.UTC(2026, 9, 19, 10, 0, sec)).toISOString() });

    test('participants append; everyone with access reads; others are refused', async () => {
        const r = await call('POST', '/api/v2/huddles/h1/transcript/segments', OTHER, { segments: [seg(OTHER, "I'll fix the header spacing.", 12), seg(USER, 'Looks good', 3)] });
        expect(r).toEqual({ status: 201, body: { sessionId: SESSION, added: 2 } });
        expect((await call('POST', '/api/v2/huddles/h1/transcript/segments', OUTSIDER, seg(OUTSIDER, 'x', 1))).status).toBe(403);
        expect((await call('POST', '/api/v2/huddles/h1/transcript/segments', USER, { segments: [] })).status).toBe(400);

        const t = await call('GET', '/api/v2/huddles/h1/transcript', USER);
        expect(t.status).toBe(200);
        expect(t.body.text).toBe("[00:03] user-a1: Looks good\n[00:12] user-b1: I'll fix the header spacing.");
        expect((await call('GET', '/api/v2/huddles/h1/transcript', OUTSIDER)).status).toBe(403);
    });

    test('summarize uses the transcript and returns action items', async () => {
        global.__session.transcriptSegments = [seg(OTHER, "I'll fix the header spacing.", 12)];
        const r = await call('POST', '/api/v2/huddles/h1/summarize', USER);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ source: 'transcript', sessionId: SESSION, aiFallback: false });
        expect(r.body.summary).toContain("user-b1: I'll fix the header spacing.");
        expect(r.body.actionItems).toEqual([expect.objectContaining({ text: 'Fix the header spacing', assigneeId: OTHER })]);
    });

    test('summarize falls back to the shared notes', async () => {
        global.__session.notes = NOTE;
        Note.findById.mockImplementation(() => chain({ content: JSON.stringify([
            { id: 'a', type: 'heading', content: 'Discussion' },
            { id: 'b', type: 'text', content: 'We need to rename the &amp; button<br>Done.' },
        ]) }));
        const r = await call('POST', '/api/v2/huddles/h1/summarize', USER);
        expect(r.body.source).toBe('notes');
        expect(r.body.summary).toBe('S:Discussion\nWe need to rename the & button\nDone.');
        expect(r.body.actionItems.map((a) => a.text)).toEqual(['Rename the & button']);
    });
});

describe('huddle recording', () => {
    async function upload(user, name = 'call.webm', type = 'audio/webm') {
        const form = new FormData();
        form.append('file', new Blob(['xyz'], { type }), name);
        form.append('durationSec', '61');
        const res = await fetch(`${base}/api/v2/huddles/h1/recording`, { method: 'POST', headers: { 'x-user': user }, body: form });
        return { status: res.status, body: await res.json() };
    }

    test('upload, signed playback, delete', async () => {
        const up = await upload(OTHER);
        expect(up.status).toBe(201);
        expect(up.body.recording).toMatchObject({ mimeType: 'audio/webm', durationSec: 61, uploadedBy: OTHER });
        expect(global.__session.recording.path).toMatch(new RegExp(`^recordings/${WS}/huddle-${SESSION}/`));

        const g = await call('GET', '/api/v2/huddles/h1/recording', USER);
        expect(g.body.url).toMatch(new RegExp(`^/api/v2/huddles/h1/recording/stream\\?s=${SESSION}&u=${USER}&exp=\\d+&sig=`));
        const stream = await fetch(base + g.body.url);
        expect(stream.status).toBe(200);
        expect(await stream.text()).toBe(`bytes:${global.__session.recording.path}`);
        expect((await fetch(base + g.body.url.replace(/sig=[^&]+/, 'sig=bad'))).status).toBe(403);

        const path = global.__session.recording.path;
        expect((await call('DELETE', '/api/v2/huddles/h1/recording', USER)).status).toBe(200); // started the huddle
        expect(storage.deleteObject).toHaveBeenCalledWith(path);
        expect((await call('GET', '/api/v2/huddles/h1/recording', USER)).status).toBe(404);
    });

    test('non-participants cannot upload; bad types are refused', async () => {
        expect((await upload(OUTSIDER)).status).toBe(403);
        expect((await upload(USER, 'x.wav', 'audio/wav')).status).toBe(415);
        expect(storage.writeObject).not.toHaveBeenCalled();
    });
});

describe('emitHuddleCompleted', () => {
    test('emits metadata for a plain huddle', async () => {
        global.__session.notes = NOTE;
        global.__session.transcriptSegments = [{ text: 'x' }];
        Note.findById.mockImplementation(() => chain({ content: JSON.stringify([
            { id: 'huddle-actions-list', type: 'checklist', content: JSON.stringify([{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }]), meta: { huddleActions: true } },
        ]) }));
        const payload = await media.emitHuddleCompleted({ huddleId: 'h1', workspaceId: WS, channelId: 'c1', channelName: 'design' }, null);
        expect(emitter.emit).toHaveBeenCalledWith('meeting.completed', expect.objectContaining({
            kind: 'huddle', workspaceId: WS, meetingId: SESSION, huddleId: 'h1', title: 'Huddle in #design',
            durationMinutes: 42, participantCount: 2, actionItemCount: 2, hasTranscript: true, hasRecording: false,
        }));
        expect(payload).not.toHaveProperty('transcriptSegments');
    });

    test('skipped for scheduled-meeting huddles (reported as the meeting) and without a workspace', async () => {
        await media.emitHuddleCompleted({ huddleId: 'meeting-64b0000000000000000000e1', workspaceId: WS }, null);
        await media.emitHuddleCompleted({ huddleId: 'h1', workspaceId: WS }, null, { completedMeetingIds: ['m1'] });
        await media.emitHuddleCompleted({ huddleId: 'h1' }, null);
        expect(emitter.emit).not.toHaveBeenCalled();
    });
});
