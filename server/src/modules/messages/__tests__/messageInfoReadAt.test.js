'use strict';

/** GET /v2/messages/:id/info: each reader with when they read it, readers hiding receipts left out. */

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const BEN = oid(2);
const CHEN = oid(3);
const HIDDEN = oid(4);
const DM = oid(20);
const MSG = oid(40);

jest.mock('../message.model.js', () => ({}));
jest.mock('../messages.service', () => ({}));
jest.mock('../../../features/channels/channel.model.js', () => ({ findById: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn() }));
jest.mock('../../../identity', () => ({ workspaces: {}, users: {} }));
jest.mock('../../conversations/conversationKeys.service', () => ({}));
jest.mock('../messageAccess', () => ({ canAccessMessage: jest.fn(), loadAccessibleMessage: jest.fn() }));
jest.mock('../../../features/auth/privacy.service', () => ({ redactReadBy: jest.fn(), readersHidingReceipts: jest.fn(), getPrivacy: jest.fn() }));
// Cards for every user id: { _id, username }.
jest.mock('../../../identity/hydrate', () => ({
    hydrate: jest.fn(async (doc, spec) => {
        const card = (id) => ({ _id: String(id), username: `user-${String(id).slice(-1)}` });
        if (spec.readBy && Array.isArray(doc.readBy)) doc.readBy = doc.readBy.map(card);
        if (spec.sender && doc.sender) doc.sender = card(doc.sender);
        if (spec.participants && Array.isArray(doc.participants)) doc.participants = doc.participants.map(card);
        return doc;
    }),
}));

const DMSession = require('../../../../models/DMSession');
const { loadAccessibleMessage } = require('../messageAccess');
const { readersHidingReceipts } = require('../../../features/auth/privacy.service');
const { getMessageInfo } = require('../messages.controller');

test('readByUsers carry readAt (null for reads recorded before read times)', async () => {
    loadAccessibleMessage.mockResolvedValue({
        _id: MSG, dm: DM, sender: ME, createdAt: new Date('2026-10-23T09:00:00Z'),
        readBy: [BEN, CHEN, HIDDEN],
        readReceipts: [{ user: BEN, at: new Date('2026-10-23T09:05:00Z') }, { user: HIDDEN, at: new Date('2026-10-23T09:06:00Z') }],
    });
    DMSession.findById.mockReturnValue({ lean: async () => ({ _id: DM, participants: [ME, BEN, CHEN, HIDDEN] }) });
    readersHidingReceipts.mockResolvedValue(new Set([HIDDEN]));
    const res = { status: jest.fn(() => res), json: jest.fn() };

    await getMessageInfo({ user: { sub: ME }, params: { messageId: MSG } }, res);

    expect(loadAccessibleMessage).toHaveBeenCalledWith(expect.anything(), MSG, ME, expect.objectContaining({ select: '+readReceipts' }));
    const body = res.json.mock.calls[0][0];
    expect(body.readBy).toEqual([BEN, CHEN]);
    expect(body.readByUsers).toEqual([
        expect.objectContaining({ _id: BEN, readAt: '2026-10-23T09:05:00.000Z' }),
        expect.objectContaining({ _id: CHEN, readAt: null }),
    ]);
    expect(body.members.map((m) => m._id)).toEqual([ME, BEN, CHEN, HIDDEN]);
    expect(JSON.stringify(body)).not.toContain('readReceipts');
});
