'use strict';

/**
 * What a backup holds and how a restore merges it: only what you own and what is missing,
 * never duplicates, never someone else's content, never membership you no longer have,
 * and a second restore changes nothing.
 */

const { fakeModel } = require('./fakes');
const sections = require('../driveBackup.sections');

const oid = (n) => n.toString(16).padStart(24, '0');
const ADA = oid(1);
const BOB = oid(2);
const WS = oid(50);
const GONE_WS = oid(51);
const CH = oid(60);
const DM = oid(61);
const OLD_CH = oid(62);

function world() {
    const userRow = { _id: ADA, username: 'ada', email: 'ada@example.com', jobTitle: 'Engineer', profile: { bio: 'hi' }, preferences: { theme: 'dark', notifications: { email: true } } };
    let crypto = { identityPublicKey: 'PUB1', encryptedIdentityPrivateKey: 'WRAPPED', identityPrivateKeyIv: 'iv', umekProtectionType: 'PASSWORD', umekSalt: 'salt' };
    const convMembers = new Map([[`channel:${CH}`, { id: 'k1', members: new Map([[ADA, 'ENC-CH']]) }], [`dm:${DM}`, { id: 'k2', members: new Map([[ADA, 'ENC-DM']]) }]]);
    const pgCalls = [];
    const identity = {
        users: {
            findById: async () => ({ ...userRow, preferences: { ...userRow.preferences }, profile: { ...userRow.profile } }),
            update: jest.fn(async (id, patch) => Object.assign(userRow, patch)),
        },
        identityKeys: { findByUserId: async () => ({ publicKey: 'PUB1', algorithm: 'ECDH-P256', version: 1 }), upsert: jest.fn() },
        cryptoState: {
            findByUserId: async () => crypto,
            upsert: jest.fn(async (id, s) => { crypto = { ...s }; }),
        },
        conversationKeys: {
            findByUser: async () => [...convMembers.entries()].map(([k, v]) => {
                const [type, id] = k.split(':');
                return { conversationId: id, conversationType: type, workspaceId: WS, encryptedKeys: [...v.members].map(([userId, encryptedKey]) => ({ userId, encryptedKey, algorithm: 'ECDH' })) };
            }),
            findByConversation: async (id, type) => {
                const v = convMembers.get(`${type}:${id}`);
                return v ? { id: v.id, getEncryptedKeyForUser: (u) => (v.members.has(u) ? { encryptedKey: v.members.get(u) } : null) } : null;
            },
        },
        workspaces: {
            listForUser: async () => [{ _id: WS, name: 'Acme', members: [{ user: ADA, role: 'member' }] }],
            memberWorkspaceIds: async () => [WS],
        },
    };
    const models = {
        Note: fakeModel([
            { _id: oid(100), workspace: WS, owner: ADA, title: 'Mine' },
            { _id: oid(101), workspace: WS, owner: BOB, sharedWith: [ADA], title: 'Shared with me' },
            { _id: oid(102), workspace: WS, owner: BOB, title: 'Not mine, not shared' },
            { _id: oid(103), workspace: WS, owner: BOB, meeting: oid(300), title: 'Meeting notes' },
        ]),
        Task: fakeModel([
            { _id: oid(200), workspace: WS, createdBy: ADA, assignedTo: [], title: 'My task' },
            { _id: oid(201), workspace: WS, createdBy: BOB, assignedTo: [ADA], title: 'Assigned to me' },
            { _id: oid(202), workspace: WS, createdBy: BOB, assignedTo: [BOB], title: 'Not mine' },
        ]),
        KnowledgePage: fakeModel([{ _id: oid(400), workspaceId: WS, createdBy: ADA, title: 'Handbook' }, { _id: oid(401), workspaceId: WS, createdBy: BOB, title: 'Bob page' }]),
        ScheduledMeeting: fakeModel([
            { _id: oid(300), workspaceId: WS, createdBy: BOB, participants: [ADA], title: 'Standup' },
            { _id: oid(301), workspaceId: WS, createdBy: ADA, participants: [], title: 'My 1:1' },
        ]),
        WorkspaceFile: fakeModel([{ _id: oid(500), workspaceId: WS, createdBy: ADA, name: 'spec.pdf', size: 10 }]),
        Message: fakeModel([
            { _id: oid(600), channel: CH, sender: ADA, payload: { ciphertext: 'xx', isEncrypted: true } },
            { _id: oid(601), dm: DM, sender: ADA, payload: { ciphertext: 'yy', isEncrypted: true } },
            { _id: oid(602), channel: CH, sender: BOB, payload: { ciphertext: 'zz', isEncrypted: true } },
        ]),
        Channel: fakeModel([{ _id: CH, workspace: WS, name: 'general', members: [{ user: ADA }, { user: BOB }] }]),
        DMSession: fakeModel([{ _id: DM, workspace: WS, participants: [ADA, BOB] }]),
    };
    const d = {
        identity, ...models,
        tasksOnPg: () => false,
        tasksRepo: () => null,
        pgQuery: jest.fn(async (sql, params) => { pgCalls.push(params); const [keyId, user, enc] = params; for (const v of convMembers.values()) if (v.id === keyId && !v.members.has(user)) v.members.set(user, enc); }),
    };
    return { d, userRow, convMembers, setCrypto: (c) => { crypto = c; }, getCrypto: () => crypto };
}

test('collect: what is in a backup for one person', async () => {
    const { d } = world();
    const { bundle, counts } = await sections.collect(ADA, d);
    expect(bundle.notes.map((n) => n.title).sort()).toEqual(['Meeting notes', 'Mine', 'Shared with me']);
    expect(bundle.tasks.map((t) => t.title).sort()).toEqual(['Assigned to me', 'My task']);
    expect(bundle.knowledge.map((p) => p.title)).toEqual(['Handbook']);
    expect(bundle.meetings.map((m) => m.title).sort()).toEqual(['My 1:1', 'Standup']);
    expect(bundle.messages.map((m) => m._id).sort()).toEqual([oid(600), oid(601)]); // only messages you sent
    expect(bundle.messages[0].payload.isEncrypted).toBe(true); // still end-to-end encrypted
    expect(bundle.files).toEqual([expect.objectContaining({ name: 'spec.pdf' })]);
    expect(bundle.files[0].url).toBeUndefined();
    expect(bundle.keys.cryptoState.encryptedIdentityPrivateKey).toBe('WRAPPED');
    expect(bundle.keys.conversationKeys).toHaveLength(2);
    expect(bundle.workspaces).toEqual([{ _id: WS, name: 'Acme', type: null, role: 'member' }]);
    expect(counts).toMatchObject({ notes: 3, tasks: 2, knowledge: 1, meetings: 2, messages: 2, files: 1, conversationKeys: 2 });
});

test('nothing lost: a restore finds everything present and changes nothing', async () => {
    const { d } = world();
    const { bundle } = await sections.collect(ADA, d);
    const plan = await sections.restore(ADA, bundle, { dryRun: true }, d);
    expect(plan.total).toBe(0);
    expect(plan.sections.notes).toMatchObject({ inBackup: 3, present: 1, restore: 0, skipped: 2 });
});

test('restore merges: re-creates what you own that is missing, then is idempotent', async () => {
    const { d, userRow } = world();
    const { bundle } = await sections.collect(ADA, d);

    // Data loss: Ada's note, task, page, meeting and a message disappear; so does Bob's shared note.
    const drop = (M, id) => { const i = M.docs.findIndex((x) => String(x._id) === id); M.docs.splice(i, 1); };
    drop(d.Note, oid(100));
    drop(d.Note, oid(101));
    drop(d.Task, oid(200));
    drop(d.KnowledgePage, oid(400));
    drop(d.ScheduledMeeting, oid(301));
    drop(d.Message, oid(601));
    userRow.preferences = { theme: 'light' }; // changed since, and lost a key
    userRow.jobTitle = '';

    const sizes = () => [d.Note, d.Task, d.KnowledgePage, d.ScheduledMeeting, d.Message].map((M) => M.docs.length);
    const before = sizes();

    const preview = await sections.restore(ADA, bundle, { dryRun: true }, d);
    expect(sizes()).toEqual(before); // a preview writes nothing
    expect(d.identity.users.update).not.toHaveBeenCalled();
    expect(preview.sections.notes).toMatchObject({ restore: 1, skipped: 2 }); // Bob's note is his to restore
    expect(preview.sections.tasks).toMatchObject({ restore: 1, present: 0, skipped: 1 });
    expect(preview.sections.knowledge.restore).toBe(1);
    expect(preview.sections.meetings.restore).toBe(1);
    expect(preview.sections.messages).toMatchObject({ restore: 1, present: 1 });
    expect(preview.sections.files.restore).toBe(0);
    expect(preview.sections.workspaces.restore).toBe(0);

    const applied = await sections.restore(ADA, bundle, { dryRun: false }, d);
    expect(applied.total).toBe(preview.total);
    expect(d.Note.docs.map((n) => n.title)).toContain('Mine');
    expect(d.Note.docs.map((n) => n.title)).not.toContain('Shared with me');
    expect(d.Task.docs.map((t) => t.title)).toContain('My task');
    expect(d.Message.docs.map((m) => String(m._id))).toContain(oid(601));
    // Preferences: current values win, missing keys come back.
    expect(userRow.preferences).toEqual({ theme: 'light', notifications: { email: true } });
    expect(userRow.jobTitle).toBe('Engineer');

    const after = sizes();
    const again = await sections.restore(ADA, bundle, { dryRun: false }, d);
    expect(again.total).toBe(0);
    expect(sizes()).toEqual(after); // no duplicates
});

test('no restore into workspaces or conversations you are no longer in', async () => {
    const { d } = world();
    const { bundle } = await sections.collect(ADA, d);
    bundle.notes.push({ _id: oid(110), workspace: GONE_WS, owner: ADA, title: 'Old workspace note' });
    bundle.messages.push({ _id: oid(610), channel: OLD_CH, sender: ADA });
    bundle.workspaces.push({ _id: GONE_WS, name: 'Left', role: 'member' });

    const plan = await sections.restore(ADA, bundle, { dryRun: false }, d);
    expect(d.Note.docs.find((n) => String(n._id) === oid(110))).toBeUndefined();
    expect(d.Message.docs.find((m) => String(m._id) === oid(610))).toBeUndefined();
    expect(plan.sections.workspaces).toMatchObject({ restore: 0, skipped: 1 });
});

test('keys: restored only into an account without keys; conversation keys only for the same identity', async () => {
    const { d, convMembers, setCrypto, getCrypto } = world();
    const { bundle } = await sections.collect(ADA, d);

    // Same identity, a lost conversation key comes back.
    convMembers.get(`dm:${DM}`).members.delete(ADA);
    let r = await sections.restore(ADA, bundle, { dryRun: false }, d);
    expect(r.sections.keys).toMatchObject({ present: 1, restore: 0 });
    expect(r.sections.conversationKeys).toMatchObject({ restore: 1, present: 1 });
    expect(convMembers.get(`dm:${DM}`).members.get(ADA)).toBe('ENC-DM');

    // The account has new keys: old envelopes are useless, nothing is written.
    setCrypto({ identityPublicKey: 'PUB2', encryptedIdentityPrivateKey: 'NEW' });
    convMembers.get(`dm:${DM}`).members.delete(ADA);
    r = await sections.restore(ADA, bundle, { dryRun: false }, d);
    expect(r.sections.keys).toMatchObject({ skipped: 1, restore: 0 });
    expect(r.sections.conversationKeys.restore).toBe(0);
    expect(getCrypto().identityPublicKey).toBe('PUB2');

    // No keys at all (reset): the wrapped identity comes back.
    setCrypto(null);
    r = await sections.restore(ADA, bundle, { dryRun: false }, d);
    expect(r.sections.keys.restore).toBe(1);
    expect(d.identity.cryptoState.upsert).toHaveBeenCalledWith(ADA, expect.objectContaining({ identityPublicKey: 'PUB1', encryptedIdentityPrivateKey: 'WRAPPED' }));
});

test('fillMissing keeps current values', () => {
    expect(sections.fillMissing({ a: 1, n: { x: 1 } }, { a: 2, b: 3, n: { x: 2, y: 4 } })).toEqual({ value: { a: 1, b: 3, n: { x: 1, y: 4 } }, added: 2 });
});
