'use strict';

/**
 * Who may read, share, store and delete conversation key copies (conversationKeys.controller):
 *   - deleting a key copy: only your own (it had no check at all);
 *   - reading a key: only current members of the conversation and its workspace;
 *   - sharing a key: the sharer must still be a member, not just hold an old copy;
 *   - storing the first key: the conversation's own workspace, copies only for its members.
 */

const ANA = 'a'.repeat(24);
const BEN = 'b'.repeat(24);
const EX = 'e'.repeat(24); // left the conversation (or the workspace)
const CONV = 'c'.repeat(24);
const WS = 'd'.repeat(24);

const mockMembers = new Set([ANA, BEN]);
jest.mock('../conversationKeys.service', () => ({
    isConversationMember: jest.fn(async (_id, _type, u) => mockMembers.has(String(u))),
    getUserConversationKey: jest.fn(async () => ({ encryptedKey: 'k', algorithm: 'RSA-2048', version: 1, previous: [] })),
    hasConversationKeys: jest.fn(async () => true),
    ensureDMConversationKey: jest.fn(async () => ({ status: 'OK' })),
    removeParticipant: jest.fn(async () => true),
    addEncryptedKeyForUser: jest.fn(async () => true),
    storeConversationKeys: jest.fn(async (p) => ({ conversationId: p.conversationId, encryptedKeys: p.encryptedKeys })),
}));
jest.mock('../conversationAccess', () => ({
    checkConversationAccess: jest.fn(async () => ({ ok: true, workspaceId: 'd'.repeat(24), isMember: true })),
}));
jest.mock('../../../identity/queries/auth', () => ({ conversationKeyDocs: { findByConversation: jest.fn(async () => ({ workspaceEncryptedKey: 'x' })) } }));

const svc = require('../conversationKeys.service');
const ctrl = require('../conversationKeys.controller');

const call = async (handler, { user, params = {}, query = {}, body = {} }) => {
    const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await handler({ user: { sub: user }, params, query, body }, res);
    return res;
};

beforeEach(() => jest.clearAllMocks());

describe('conversation key routes', () => {
    it('deleting a key copy: only your own', async () => {
        const other = await call(ctrl.removeParticipant, { user: ANA, params: { id: CONV, userId: BEN }, query: { type: 'channel' } });
        expect(other.code).toBe(403);
        expect(svc.removeParticipant).not.toHaveBeenCalled();
        const own = await call(ctrl.removeParticipant, { user: ANA, params: { id: CONV, userId: ANA }, query: { type: 'channel' } });
        expect(own.code).toBe(200);
    });

    it('reading a key: someone who left gets nothing, even with an old copy on the server', async () => {
        const res = await call(ctrl.getConversationKey, { user: EX, params: { id: CONV }, query: { type: 'channel' } });
        expect(res.code).toBe(403);
        expect(svc.getUserConversationKey).not.toHaveBeenCalled();
        const ok = await call(ctrl.getConversationKey, { user: ANA, params: { id: CONV }, query: { type: 'channel' } });
        expect(ok.code).toBe(200);
        expect(ok.body).toMatchObject({ encryptedKey: 'k', previous: [] });
    });

    it('sharing a key: the sharer must still be a member', async () => {
        const res = await call(ctrl.addUserKey, { user: EX, params: { conversationId: CONV }, body: { conversationType: 'dm', userId: BEN, encryptedKey: 'k', algorithm: 'RSA-2048' } });
        expect(res.code).toBe(403);
        expect(svc.addEncryptedKeyForUser).not.toHaveBeenCalled();
    });

    it('storing the first key: the conversation\'s own workspace, copies only for its members', async () => {
        const body = (extra) => ({ conversationType: 'channel', workspaceId: WS, encryptedKeys: [{ userId: ANA, encryptedKey: 'k', algorithm: 'RSA-2048' }], ...extra });
        const wrongWs = await call(ctrl.storeConversationKeys, { user: ANA, params: { id: CONV }, body: body({ workspaceId: 'f'.repeat(24) }) });
        expect(wrongWs.code).toBe(400);
        const outsider = await call(ctrl.storeConversationKeys, { user: ANA, params: { id: CONV }, body: body({ encryptedKeys: [{ userId: EX, encryptedKey: 'k', algorithm: 'RSA-2048' }] }) });
        expect(outsider.code).toBe(400);
        expect(svc.storeConversationKeys).not.toHaveBeenCalled();
        const ok = await call(ctrl.storeConversationKeys, { user: ANA, params: { id: CONV }, body: body() });
        expect(ok.code).toBe(201);
    });
});
