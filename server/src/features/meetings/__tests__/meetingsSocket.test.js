'use strict';

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { HttpError } = require('../../../shared/utils/workspaceAccess');

jest.mock('../../../models/ScheduledMeeting', () => ({
    findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ sharedNotes: 'hello' }) }) })),
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

    test('notes_update persists and broadcasts to the room only; requires joining first', async () => {
        const alice = await connect('alice');
        const bob = await connect('bob');
        const carol = await connect('carol');
        await emitAck(alice, 'meeting:join', { meetingId: M });
        await emitAck(bob, 'meeting:join', { meetingId: M });
        let carolGot = false;
        carol.on('meeting:notes_update', () => { carolGot = true; });

        const got = new Promise(r => bob.once('meeting:notes_update', r));
        expect(await emitAck(alice, 'meeting:notes_update', { meetingId: M, notes: 'v2' })).toMatchObject({ ok: true });
        expect(await got).toMatchObject({ meetingId: M, notes: 'v2', updatedBy: 'alice' });
        expect(saved).toEqual([{ meetingId: M, notes: 'v2' }]);

        expect(await emitAck(carol, 'meeting:notes_update', { meetingId: M, notes: 'hijack' })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
        expect(await emitAck(alice, 'meeting:notes_update', { meetingId: M, notes: 42 })).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
        expect(saved).toHaveLength(1);
        await new Promise(r => setTimeout(r, 100));
        expect(carolGot).toBe(false);
    });
});
