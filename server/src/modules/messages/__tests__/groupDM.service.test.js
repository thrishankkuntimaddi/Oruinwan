'use strict';

/**
 * Group DMs (groupDM.service.js): create or reopen, add people (they get the key and only
 * see messages from then on), remove/leave (their key copy goes), rename, and who may do what.
 */

const mockOid = (n) => n.toString(16).padStart(24, '0');
const mockWS = mockOid(50);
const mockASHA = mockOid(1);
const mockBEN = mockOid(2);
const mockCHEN = mockOid(3);
const mockDIVYA = mockOid(4);
const mockOUTSIDER = mockOid(9);
const mockDM = mockOid(70);

const mockStore = { sessions: [] };

function mockMakeSession(fields) {
    const doc = {
        _id: mockDM, workspace: mockWS, company: null, hiddenFor: [], clearedAt: [], mutedBy: [], memberSince: [], name: null,
        ...fields,
        save: jest.fn(async function save() { return this; }),
        toObject() { const { save: _save, toObject: _toObject, ...rest } = this; return { ...rest }; },
    };
    mockStore.sessions.push(doc);
    return doc;
}

jest.mock('../../../../models/DMSession', () => {
    const model = {
        MAX_GROUP_DM_MEMBERS: 10,
        dmPairKey: (ws, a, b) => `${ws}:${[String(a), String(b)].sort().join(':')}`,
        findOne: jest.fn(async (q) => mockStore.sessions.find((s) => s.isGroup && q.isGroup
            && s.participants.length === q.participants.$size
            && q.participants.$all.every((p) => s.participants.map(String).includes(String(p)))) || null),
        findById: jest.fn(async (id) => mockStore.sessions.find((s) => String(s._id) === String(id)) || null),
        create: jest.fn(async (fields) => mockMakeSession({ ...fields, _id: mockStore.sessions.length ? mockOid(70 + mockStore.sessions.length) : mockOid(70) })),
    };
    return model;
});
jest.mock('../message.model.js', () => ({ create: jest.fn(async (doc) => ({ ...doc, _id: 'm1', toObject() { return { ...doc, _id: 'm1' }; } })) }));
jest.mock('../../../identity', () => ({
    workspaces: {
        findById: jest.fn(async () => ({
            _id: mockWS,
            company: null,
            members: [mockASHA, mockBEN, mockCHEN, mockDIVYA].map((user) => ({ user, status: 'active' })),
        })),
    },
    users: { findById: jest.fn(async (id) => ({ _id: id, username: { [mockASHA]: 'asha', [mockBEN]: 'ben', [mockCHEN]: 'chen', [mockDIVYA]: 'divya' }[id] || 'someone' })) },
}));
jest.mock('../../../identity/hydrate', () => ({
    hydrate: jest.fn(async (doc) => {
        const names = { [mockOid(1)]: 'asha', [mockOid(2)]: 'ben', [mockOid(3)]: 'chen', [mockOid(4)]: 'divya' };
        for (const d of Array.isArray(doc) ? doc : [doc]) {
            d.participants = (d.participants || []).map((p) => ({ _id: String(p?._id || p), username: names[String(p?._id || p)] }));
        }
        return doc;
    }),
}));
// Conversation keys, in memory: the current key's version and holders, and earlier keys (epochs)
// with their holders. `noServerCopy` marks epochs the server can't hand out.
const mockKeys = { byConv: new Map() };
function mockConvKeys(id) {
    const k = String(id);
    if (!mockKeys.byConv.has(k)) mockKeys.byConv.set(k, { version: 1, holders: new Set(), epochs: [], noServerCopy: new Set() });
    return mockKeys.byConv.get(k);
}
jest.mock('../../conversations/conversationKeys.service', () => ({
    ensureDMConversationKey: jest.fn(async (id) => {
        const s = mockStore.sessions.find((x) => String(x._id) === String(id));
        for (const p of s?.participants || []) mockConvKeys(id).holders.add(String(p));
        return { status: 'OK' };
    }),
    removeParticipant: jest.fn(async (id, _t, u) => {
        const k = mockConvKeys(id);
        k.holders.delete(String(u));
        for (const e of k.epochs) e.holders.delete(String(u));
        return true;
    }),
    publicKeys: { findByUserId: jest.fn(async (u) => ({ userId: u, publicKey: 'pem' })) },
}));
jest.mock('../../conversations/keyEpochs', () => ({
    rotate: jest.fn(async (id, _t, { memberIds, keepOld = memberIds }) => {
        const k = mockConvKeys(id);
        k.epochs.push({ version: k.version, retiredAt: new Date(), holders: new Set(keepOld.map(String).filter((u) => k.holders.has(u))) });
        k.version += 1;
        k.holders = new Set(memberIds.map(String));
        return { status: 'ROTATED', version: k.version };
    }),
    list: jest.fn(async (id) => mockConvKeys(id).epochs.map((e) => ({ ...e, holders: new Set(e.holders) }))),
    grant: jest.fn(async (id, _t, u, { versions = null } = {}) => {
        const k = mockConvKeys(id);
        let granted = 0;
        const unavailable = [];
        for (const e of k.epochs) {
            if (versions && !versions.has(e.version)) continue;
            if (e.holders.has(String(u))) continue;
            if (k.noServerCopy.has(e.version)) { unavailable.push(e.version); continue; }
            e.holders.add(String(u));
            granted += 1;
        }
        return { granted, unavailable };
    }),
    removeUser: jest.fn(async (id, _t, u) => { for (const e of mockConvKeys(id).epochs) e.holders.delete(String(u)); }),
    announce: jest.fn(),
}));
// The removal side of conversationRooms (tested on its own): a group that loses someone who
// held its key gets a new key for the rest.
jest.mock('../../conversations/conversationRooms', () => ({
    rotateWithout: jest.fn(async (io, id, _t, u) => {
        const s = mockStore.sessions.find((x) => String(x._id) === String(id));
        const rest = (s?.participants || []).map(String).filter((p) => p !== String(u));
        if (!s?.isGroup || !rest.length || !mockConvKeys(id).holders.has(String(u))) return null;
        return (await require('../../conversations/keyEpochs').rotate(id, 'dm', { memberIds: rest, keepOld: rest })).version;
    }),
}));

const Message = require('../message.model.js');
const keys = require('../../conversations/conversationKeys.service');
const svc = require('../groupDM.service');

function fakeIo() {
    const events = [];
    const rooms = { joined: [], left: [] };
    return {
        events, rooms,
        to: (room) => ({ emit: (event, payload) => events.push({ room, event, payload }) }),
        in: (room) => ({
            socketsJoin: (target) => rooms.joined.push([room, target]),
            socketsLeave: (target) => rooms.left.push([room, target]),
        }),
    };
}

beforeEach(() => {
    mockStore.sessions.length = 0;
    mockKeys.byConv.clear();
    jest.clearAllMocks();
});

/** Which key versions `u` can open in conversation `id`: current and earlier. */
const keysOf = (id, u) => {
    const k = mockConvKeys(id);
    return [...k.epochs.filter((e) => e.holders.has(String(u))).map((e) => e.version), ...(k.holders.has(String(u)) ? [k.version] : [])].sort();
};

describe('create', () => {
    test('makes a group with the creator, wraps the key for everyone and tells them', async () => {
        const io = fakeIo();
        const { session, created } = await svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockBEN, mockCHEN], name: ' Launch ' }, io);

        expect(created).toBe(true);
        expect(session.isGroup).toBe(true);
        expect(session.participants).toEqual([mockASHA, mockBEN, mockCHEN]);
        expect(session.name).toBe('Launch');
        expect(session.createdBy).toBe(mockASHA);
        expect(session.memberSince.map((m) => m.user)).toEqual([mockASHA, mockBEN, mockCHEN]);
        expect(keys.ensureDMConversationKey).toHaveBeenCalledWith(mockDM);
        // Every member's devices join the room and reload their mockDM list.
        expect(io.rooms.joined).toEqual(expect.arrayContaining([[`user:${mockBEN}`, `dm:${mockDM}`], [`user:${mockCHEN}`, `dm:${mockDM}`]]));
        expect(io.events.filter((e) => e.event === 'new-dm-session').map((e) => e.room).sort()).toEqual([`user:${mockASHA}`, `user:${mockBEN}`, `user:${mockCHEN}`].sort());
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'system', systemEvent: 'group_created', text: 'asha created this group' }));
    });

    test('the same people again reopens the existing group', async () => {
        const first = await svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockBEN, mockCHEN] }, null);
        first.session.hiddenFor = [{ user: mockASHA }];
        const again = await svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockCHEN, mockBEN] }, null);
        expect(again.created).toBe(false);
        expect(again.session).toBe(first.session);
        expect(again.session.hiddenFor).toEqual([]);
    });

    test('needs 2+ others, workspace members only, and at most 10 people', async () => {
        await expect(svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockBEN] }, null)).rejects.toMatchObject({ status: 400, code: 'TOO_FEW' });
        await expect(svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockBEN, mockOUTSIDER] }, null)).rejects.toMatchObject({ status: 403 });
        const many = Array.from({ length: 10 }, (_, i) => mockOid(100 + i));
        await expect(svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: many }, null)).rejects.toMatchObject({ code: 'GROUP_FULL' });
    });
});

describe('members', () => {
    async function group() {
        return (await svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockBEN, mockCHEN] }, null)).session;
    }

    test('adding someone shares the key and starts their history now', async () => {
        await group();
        jest.clearAllMocks();
        const io = fakeIo();
        const before = Date.now();
        const { added, session } = await svc.addMembers({ dmId: mockDM, actorId: mockBEN, userIds: [mockDIVYA, mockBEN] }, io);

        expect(added).toEqual([mockDIVYA]);
        expect(session.participants).toContain(mockDIVYA);
        const since = svc.memberSinceFor(session, mockDIVYA);
        expect(new Date(since).getTime()).toBeGreaterThanOrEqual(before);
        expect(keys.ensureDMConversationKey).toHaveBeenCalledWith(mockDM);
        // A new key: Divya holds only that one; the others keep the earlier one too.
        expect(keysOf(mockDM, mockDIVYA)).toEqual([2]);
        expect(keysOf(mockDM, mockASHA)).toEqual([1, 2]);
        expect(require('../../conversations/keyEpochs').announce).toHaveBeenCalledWith(io, mockDM, 'dm', 2);
        expect(io.rooms.joined).toEqual(expect.arrayContaining([[`user:${mockDIVYA}`, `dm:${mockDM}`]]));
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ systemEvent: 'group_member_added', text: 'ben added divya' }));
        expect(io.events.some((e) => e.event === 'dm:members_updated' && e.room === `dm:${mockDM}`)).toBe(true);
    });

    test('outsiders and non-members cannot add people', async () => {
        await group();
        await expect(svc.addMembers({ dmId: mockDM, actorId: mockDIVYA, userIds: [mockOUTSIDER] }, null)).rejects.toMatchObject({ status: 403 });
        await expect(svc.addMembers({ dmId: mockDM, actorId: mockASHA, userIds: [mockOUTSIDER] }, null)).rejects.toMatchObject({ status: 403 });
    });

    test('leaving removes my key copy and my devices from the room', async () => {
        await group();
        const io = fakeIo();
        await svc.removeMember({ dmId: mockDM, actorId: mockCHEN, userId: mockCHEN }, io);
        const session = mockStore.sessions[0];
        expect(session.participants).toEqual([mockASHA, mockBEN]);
        expect(session.isGroup).toBe(true);
        expect(keys.removeParticipant).toHaveBeenCalledWith(mockDM, 'dm', mockCHEN);
        expect(io.rooms.left).toEqual(expect.arrayContaining([[`user:${mockCHEN}`, `dm:${mockDM}`]]));
        expect(io.events.some((e) => e.event === 'dm:removed' && e.room === `user:${mockCHEN}`)).toBe(true);
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ systemEvent: 'group_member_left', text: 'chen left' }));
        // Once out, Chen can't act on the group any more.
        await expect(svc.rename({ dmId: mockDM, actorId: mockCHEN, name: 'x' }, null)).rejects.toMatchObject({ status: 403 });
    });

    test('only the creator removes others', async () => {
        await group();
        await expect(svc.removeMember({ dmId: mockDM, actorId: mockBEN, userId: mockCHEN }, null)).rejects.toMatchObject({ status: 403, code: 'NOT_CREATOR' });
        await svc.removeMember({ dmId: mockDM, actorId: mockASHA, userId: mockCHEN }, null);
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ systemEvent: 'group_member_removed', text: 'asha removed chen' }));
    });

    test('when the admin leaves, the longest-standing member takes over and can remove people', async () => {
        await group();
        const session = mockStore.sessions[0];
        // Ben joined first, Chen later; Divya is added last.
        session.memberSince = [
            { user: mockASHA, at: new Date('2026-01-01') },
            { user: mockBEN, at: new Date('2026-01-02') },
            { user: mockCHEN, at: new Date('2026-01-03') },
        ];
        await svc.addMembers({ dmId: mockDM, actorId: mockASHA, userIds: [mockDIVYA] }, null);
        jest.clearAllMocks();

        await svc.removeMember({ dmId: mockDM, actorId: mockASHA, userId: mockASHA }, null);
        expect(session.createdBy).toBe(mockBEN);
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ systemEvent: 'group_admin_changed', text: 'ben now manages the group' }));
        await svc.removeMember({ dmId: mockDM, actorId: mockBEN, userId: mockDIVYA }, null);
        expect(session.participants).toEqual([mockBEN, mockCHEN]);
    });

    test('someone no longer in the workspace cannot act on the group', async () => {
        await group();
        const identity = require('../../../identity');
        identity.workspaces.findById.mockResolvedValueOnce({ _id: mockWS, members: [{ user: mockBEN, status: 'removed' }] });
        await expect(svc.rename({ dmId: mockDM, actorId: mockBEN, name: 'x' }, null)).rejects.toMatchObject({ status: 403, code: 'WORKSPACE_ACCESS_DENIED' });
    });

    test('rename posts a line; a 1:1 mockDM is not a group', async () => {
        await group();
        await svc.rename({ dmId: mockDM, actorId: mockBEN, name: 'Ship it' }, null);
        expect(mockStore.sessions[0].name).toBe('Ship it');
        expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({ systemEvent: 'group_renamed' }));

        mockStore.sessions.length = 0;
        mockMakeSession({ participants: [mockASHA, mockBEN], isGroup: false });
        await expect(svc.addMembers({ dmId: mockDM, actorId: mockASHA, userIds: [mockCHEN] }, null)).rejects.toMatchObject({ code: 'NOT_A_GROUP' });
    });
});

test('display names', () => {
    const p = (id, username) => ({ _id: id, username });
    expect(svc.groupDisplayName({ name: 'Crew', participants: [] }, mockASHA)).toBe('Crew');
    expect(svc.groupDisplayName({ participants: [p(mockASHA, 'asha'), p(mockBEN, 'ben'), p(mockCHEN, 'chen')] }, mockASHA)).toBe('ben and chen');
    expect(svc.groupDisplayName({ participants: [p(mockASHA, 'asha'), p(mockBEN, 'ben'), p(mockCHEN, 'chen'), p(mockDIVYA, 'divya')] }, mockASHA)).toBe('ben, chen and 1 other');
    expect(svc.groupDisplayName({ participants: [p(mockASHA), p(mockBEN, 'b'), p(mockCHEN, 'c'), p(mockDIVYA, 'd'), p(mockOUTSIDER, 'e')] }, mockASHA)).toBe('b, c and 2 others');
    expect(svc.memberSinceFor({ isGroup: false }, mockASHA)).toBeNull();
});

describe('the conversation scenarios (docs/CONVERSATIONS.md)', () => {
    // Nani, Mani, Teja and Nikil.
    const [NANI, MANI, TEJA, NIKIL] = [mockASHA, mockBEN, mockCHEN, mockDIVYA];

    test('B–E: a DM never grows, groups are separate by people, adding grows a group, same people reopen it', async () => {
        // B: Nani ↔ Mani is a 1:1 DM; adding Teja to it is refused, a new group is made instead.
        const dm = mockMakeSession({ _id: mockOid(60), participants: [NANI, MANI], isGroup: false });
        await expect(svc.addMembers({ dmId: dm._id, actorId: MANI, userIds: [TEJA] }, null)).rejects.toMatchObject({ code: 'NOT_A_GROUP' });
        const nmt = (await svc.createGroup({ creatorId: MANI, workspaceId: mockWS, memberIds: [NANI, TEJA] }, null)).session;
        expect(String(nmt._id)).not.toBe(String(dm._id));
        expect(dm.participants).toEqual([NANI, MANI]);

        // C: Nani + Mani + Nikil is a different group.
        const nmk = (await svc.createGroup({ creatorId: NANI, workspaceId: mockWS, memberIds: [MANI, NIKIL] }, null)).session;
        expect(String(nmk._id)).not.toBe(String(nmt._id));

        // D: adding Nikil to Nani + Mani + Teja grows that group; Nikil only sees messages from now.
        const before = Date.now();
        await svc.addMembers({ dmId: nmt._id, actorId: NANI, userIds: [NIKIL] }, null);
        expect(nmt.participants).toEqual([MANI, NANI, TEJA, NIKIL]);
        expect(new Date(svc.memberSinceFor(nmt, NIKIL)).getTime()).toBeGreaterThanOrEqual(before);
        expect(svc.memberSinceFor(nmt, NANI)).not.toBeNull();

        // E: an unnamed group of those four reopens it; a named one is separate.
        const again = await svc.createGroup({ creatorId: TEJA, workspaceId: mockWS, memberIds: [NANI, MANI, NIKIL] }, null);
        expect(again.created).toBe(false);
        expect(again.session).toBe(nmt);
        const named = await svc.createGroup({ creatorId: TEJA, workspaceId: mockWS, memberIds: [NANI, MANI, NIKIL], name: 'Launch crew' }, null);
        expect(named.created).toBe(true);
        expect(String(named.session._id)).not.toBe(String(nmt._id));
        // Every conversation keeps its own id, so history stays separate.
        expect(new Set(mockStore.sessions.map((x) => String(x._id))).size).toBe(mockStore.sessions.length);
    });
});

describe('adding people: how much history they get (Nani, Mani, Teja, Nikil)', () => {
    const [NANI, MANI, TEJA, NIKIL] = [mockASHA, mockBEN, mockCHEN, mockDIVYA];
    const epochs = () => require('../../conversations/keyEpochs');

    async function nmt() {
        const { session } = await svc.createGroup({ creatorId: NANI, workspaceId: mockWS, memberIds: [MANI, TEJA] }, null);
        session.memberSince.forEach((m) => { m.at = new Date('2026-01-01'); });
        return session;
    }

    test('Nani ↔ Mani stays a 1:1 DM: people are never added to it', async () => {
        mockMakeSession({ _id: mockOid(60), participants: [NANI, MANI], isGroup: false });
        await expect(svc.addMembers({ dmId: mockOid(60), actorId: NANI, userIds: [TEJA], history: 'earlier' }, null)).rejects.toMatchObject({ code: 'NOT_A_GROUP' });
    });

    test('"from now on": Nikil sees messages from now, with a new key and none of the earlier ones', async () => {
        const g = await nmt();
        const before = Date.now();
        const { history } = await svc.addMembers({ dmId: g._id, actorId: MANI, userIds: [NIKIL], history: 'from_now' }, null);
        expect(new Date(svc.memberSinceFor(g, NIKIL)).getTime()).toBeGreaterThanOrEqual(before);
        expect(keysOf(g._id, NIKIL)).toEqual([2]);
        expect(keysOf(g._id, NANI)).toEqual([1, 2]);
        expect(g.memberSince.find((m) => m.user === NIKIL).fromKeyVersion).toBe(2);
        expect(history[NIKIL].limited).toBe(false);
    });

    test('the default is "from now on"', async () => {
        const g = await nmt();
        await svc.addMembers({ dmId: g._id, actorId: MANI, userIds: [NIKIL] }, null);
        expect(keysOf(g._id, NIKIL)).toEqual([2]);
    });

    test('"earlier messages": Nikil sees what Mani can see, with the earlier keys', async () => {
        const g = await nmt();
        // Teja was added "from now on" earlier in March (key 2); Mani has been there since January.
        await svc.removeMember({ dmId: g._id, actorId: NANI, userId: TEJA }, null); // key 2
        await svc.addMembers({ dmId: g._id, actorId: NANI, userIds: [TEJA], history: 'from_now' }, null); // key 3
        const tejaSince = new Date(svc.memberSinceFor(g, TEJA));

        await svc.addMembers({ dmId: g._id, actorId: MANI, userIds: [NIKIL], history: 'earlier' }, null);
        expect(new Date(svc.memberSinceFor(g, NIKIL))).toEqual(new Date('2026-01-01'));
        expect(keysOf(g._id, NIKIL)).toEqual([1, 2, 3]);
        expect(epochs().rotate).toHaveBeenCalledTimes(2); // no new key for an "earlier" add

        // Added by Teja instead: only what Teja can see.
        await svc.removeMember({ dmId: g._id, actorId: NANI, userId: NIKIL }, null); // key 4
        await svc.addMembers({ dmId: g._id, actorId: TEJA, userIds: [NIKIL], history: 'earlier' }, null);
        expect(new Date(svc.memberSinceFor(g, NIKIL))).toEqual(tejaSince);
        expect(keysOf(g._id, NIKIL)).toEqual([3, 4]);
    });

    test('a period whose key the server has no copy of: their history starts after it, and the reply says so', async () => {
        const g = await nmt();
        await svc.removeMember({ dmId: g._id, actorId: NANI, userId: TEJA }, null); // key 1 retired
        mockConvKeys(g._id).noServerCopy.add(1);
        const retired = mockConvKeys(g._id).epochs.find((e) => e.version === 1).retiredAt;
        const { history } = await svc.addMembers({ dmId: g._id, actorId: MANI, userIds: [NIKIL], history: 'earlier' }, null);
        expect(history[NIKIL]).toMatchObject({ limited: true });
        expect(new Date(svc.memberSinceFor(g, NIKIL))).toEqual(retired);
        expect(g.memberSince.find((m) => m.user === NIKIL).fromKeyVersion).toBe(2);
        expect(keysOf(g._id, NIKIL)).toEqual([2]);
    });

    test('an unknown history choice is refused', async () => {
        const g = await nmt();
        await expect(svc.addMembers({ dmId: g._id, actorId: MANI, userIds: [NIKIL], history: 'all' }, null)).rejects.toMatchObject({ status: 400, code: 'BAD_HISTORY' });
        expect(g.participants).not.toContain(NIKIL);
    });

    test('if the new key cannot be made, nobody is added', async () => {
        const g = await nmt();
        epochs().rotate.mockRejectedValueOnce(new Error('postgres down'));
        await expect(svc.addMembers({ dmId: g._id, actorId: MANI, userIds: [NIKIL] }, null)).rejects.toMatchObject({ status: 503, code: 'KEY_ROTATION_FAILED' });
        expect(g.participants).not.toContain(NIKIL);
        expect(keysOf(g._id, NIKIL)).toEqual([]);
    });

    test('removing Mani: a new key for the rest; Mani holds none of the keys', async () => {
        const g = await nmt();
        const io = fakeIo();
        await svc.removeMember({ dmId: g._id, actorId: NANI, userId: MANI }, io);
        expect(keysOf(g._id, MANI)).toEqual([]);
        expect(keysOf(g._id, TEJA)).toEqual([1, 2]);
    });

    test('Start a new group: Nani + Mani + Teja + Nikil as a separate group; the original stays as it is', async () => {
        const g = await nmt();
        await svc.addMembers({ dmId: g._id, actorId: NANI, userIds: [NIKIL] }, null);
        // The same four people again, as "Start a new group": a new group, not the old one.
        const fresh = await svc.createGroup({ creatorId: NANI, workspaceId: mockWS, memberIds: [MANI, TEJA, NIKIL], newGroup: true }, null);
        expect(fresh.created).toBe(true);
        expect(String(fresh.session._id)).not.toBe(String(g._id));
        expect(g.participants).toEqual([NANI, MANI, TEJA, NIKIL]);
        // From New Message (no newGroup), the same people reopen the existing group.
        const reopen = await svc.createGroup({ creatorId: TEJA, workspaceId: mockWS, memberIds: [NANI, MANI, NIKIL] }, null);
        expect(reopen.created).toBe(false);
    });
});

describe('New message: finding the conversation without creating it', () => {
    it('finds the group with exactly these people, and nothing for new people', async () => {
        const { session } = await svc.createGroup({ creatorId: mockASHA, workspaceId: mockWS, memberIds: [mockBEN, mockCHEN] }, fakeIo());
        const found = await svc.findConversation({ userId: mockASHA, workspaceId: mockWS, userIds: [mockCHEN, mockBEN] });
        expect(found).toMatchObject({ isGroup: true, dm: { id: String(session._id), isGroup: true } });
        const none = await svc.findConversation({ userId: mockASHA, workspaceId: mockWS, userIds: [mockBEN, mockDIVYA] });
        expect(none).toEqual({ dm: null, isGroup: true });
        expect(mockStore.sessions).toHaveLength(1);
    });
    it('one person: our DM, or null before we ever talked', async () => {
        await expect(svc.findConversation({ userId: mockASHA, workspaceId: mockWS, userIds: [mockBEN] })).resolves.toEqual({ dm: null, isGroup: false });
    });
    it('refuses people outside the workspace and an empty list', async () => {
        await expect(svc.findConversation({ userId: mockASHA, workspaceId: mockWS, userIds: [mockOid(99)] })).rejects.toMatchObject({ status: 403 });
        await expect(svc.findConversation({ userId: mockASHA, workspaceId: mockWS, userIds: [] })).rejects.toMatchObject({ status: 400 });
    });
});
