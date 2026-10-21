'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { HttpError } = require('../../../shared/utils/workspaceAccess');

jest.mock('../../../models/ScheduledMeeting', () => ({
    findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ sharedNotes: 'hello', noteId: 'n1' }) }) })),
}));
const registerMeetingHandlers = require('../meetings.socket');

const M = '64b00000000000000000aa01';
const MEMBERS = ['alice', 'bob'];

describe('meeting socket handlers (H4)', () => {
    let io, httpServer, url, saved;
    const clients = [];

    beforeEach((done) => {
        saved = [];
        httpServer = http.createServer();
        io = new Server(httpServer);
        io.use((socket, next) => { socket.user = { id: socket.handshake.auth.userId }; next(); });
        io.on('connection', (socket) => {
            registerMeetingHandlers(io, socket, {
                load: async (meetingId, userId) => {
                    if (!/^[a-f0-9]{24}$/.test(String(meetingId))) throw new HttpError(400, 'Invalid meeting id');
                    if (!MEMBERS.includes(userId)) throw new HttpError(403, 'You are not a member of this workspace');
                    return { meeting: { _id: meetingId, workspaceId: 'w1' } };
                },
                saveNotes: async (meetingId, notes) => { saved.push({ meetingId, notes }); },
            });
        });
        httpServer.listen(0, () => { url = `http://localhost:${httpServer.address().port}`; done(); });
    });
    afterEach(() => { clients.splice(0).forEach(c => c.close()); io.close(); httpServer.close(); });

    const connect = (userId) => new Promise((resolve) => {
        const c = Client(url, { auth: { userId }, transports: ['websocket'], forceNew: true });
        clients.push(c);
        c.on('connect', () => resolve(c));
    });
    const emitAck = (c, ev, data) => new Promise((resolve) => c.emit(ev, data, resolve));

    test('members join and receive notes; outsiders are refused', async () => {
        const alice = await connect('alice');
        expect(await emitAck(alice, 'meeting:join', { meetingId: M })).toMatchObject({ ok: true, notes: 'hello' });
        const carol = await connect('carol');
        const err = new Promise(r => carol.once('meeting:error', r));
        expect(await emitAck(carol, 'meeting:join', { meetingId: M })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
        expect(await err).toMatchObject({ code: 'FORBIDDEN' });
        expect(await emitAck(alice, 'meeting:join', { meetingId: 'bad' })).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    });

    test('notes_update is deprecated: refused, nothing saved or relayed, the note to edit is named', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        await emitAck(alice, 'meeting:join', { meetingId: M });
        await emitAck(bob, 'meeting:join', { meetingId: M });
        let bobGot = false;
        bob.on('meeting:notes_update', () => { bobGot = true; });

        const res = await emitAck(alice, 'meeting:notes_update', { meetingId: M, notes: 'v2' });
        expect(res).toMatchObject({ ok: false, code: 'DEPRECATED', noteId: 'n1' });
        expect(saved).toEqual([]);
        await new Promise(r => setTimeout(r, 100));
        expect(bobGot).toBe(false);
    });

    test('join returns the meeting note id', async () => {
        const alice = await connect('alice');
        expect(await emitAck(alice, 'meeting:join', { meetingId: M })).toMatchObject({ ok: true, noteId: 'n1', notes: 'hello' });
    });
});
