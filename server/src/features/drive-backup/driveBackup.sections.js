'use strict';

/**
 * What goes into a Google Drive backup, and how it comes back.
 *
 * The rule for restoring: a restore re-creates what you OWN and what is missing. It never
 * overwrites something that still exists, never duplicates (records keep their ids, and an
 * id that exists is skipped), never re-adds you to a workspace or conversation you left
 * or were removed from, and never brings back someone else's content. Running a restore
 * twice changes nothing the second time.
 *
 *   section        backed up                                           restored
 *   profile        name, job title, profile fields, preferences       empty fields / missing preference keys only
 *   keys           identity public key, UMEK-wrapped private key,      when the account has no keys; your
 *                  your wrapped conversation keys                      conversation keys where they are missing
 *   workspaces     the workspaces you belong to (id, name, role)       never (membership is up to workspace admins)
 *   notes          notes you own or that are shared with you, and      notes you own, in workspaces you are still in
 *                  the notes of meetings you were in
 *   tasks          tasks you created or are assigned                   tasks you created
 *   knowledge      knowledge pages you wrote                           those pages
 *   meetings       meetings you organised or were invited to          meetings you organised
 *                  (summary, action items, notes link — no transcript)
 *   messages       messages you sent, still end-to-end encrypted      yours, in conversations you are still in
 *   files          metadata of files you uploaded (no file contents)  never (the backup holds no file bodies)
 */

const MAX_MESSAGES = () => Math.max(1000, Number(process.env.DRIVE_BACKUP_MAX_MESSAGES) || 50_000);
const CHUNK = 500;

const deps = () => ({
    identity: require('../../identity'),
    Note: require('../../../models/Note'),
    Task: require('../../../models/Task'),
    KnowledgePage: require('../knowledge/KnowledgePage'),
    WorkspaceFile: require('../files/WorkspaceFile'),
    ScheduledMeeting: require('../../models/ScheduledMeeting'),
    Message: require('../../modules/messages/message.model'),
    Channel: require('../channels/channel.model'),
    DMSession: require('../../../models/DMSession'),
    tasksOnPg: () => require('../tasks/tasks.store').tasksStore() === 'pg',
    tasksRepo: () => require('../tasks/tasks.repository'),
    pgQuery: (...a) => require('../../shared/postgres').query(...a),
});

const sid = (v) => (v == null ? null : String(v._id || v));
const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

async function exec(q, { select, sort, limit } = {}) {
    let x = q;
    if (select && x.select) x = x.select(select);
    if (sort && x.sort) x = x.sort(sort);
    if (limit && x.limit) x = x.limit(limit);
    return (x.lean ? x.lean() : x);
}

// ── Collect ──────────────────────────────────────────────────────────────────

async function collect(userId, d = deps()) {
    const uid = String(userId);
    const { identity } = d;

    const user = await identity.users.findById(uid);
    if (!user) throw Object.assign(new Error('Account not found'), { status: 404 });
    const profile = {
        username: user.username || null,
        email: user.email || null,
        jobTitle: user.jobTitle || null,
        profile: plain(user.profile) || {},
        preferences: plain(user.preferences) || {},
        social: plain(user.social) || null,
        userStatus: plain(user.userStatus) || null,
    };

    const [identityKey, crypto, convKeys] = await Promise.all([
        identity.identityKeys.findByUserId(uid),
        identity.cryptoState.findByUserId(uid),
        identity.conversationKeys.findByUser(uid),
    ]);
    const keys = {
        identityKey: identityKey ? { publicKey: identityKey.publicKey, algorithm: identityKey.algorithm, version: identityKey.version } : null,
        cryptoState: crypto ? {
            identityPublicKey: crypto.identityPublicKey ?? null,
            encryptedIdentityPrivateKey: crypto.encryptedIdentityPrivateKey ?? null,
            identityPrivateKeyIv: crypto.identityPrivateKeyIv ?? null,
            umekEnvelope: crypto.umekEnvelope ?? null,
            umekEnvelopeIv: crypto.umekEnvelopeIv ?? null,
            umekSalt: crypto.umekSalt ?? null,
            umekProtectionType: crypto.umekProtectionType ?? null,
            algorithm: crypto.algorithm ?? null,
            kekVersion: crypto.kekVersion ?? null,
            version: crypto.version ?? null,
        } : null,
        conversationKeys: (convKeys || []).map((k) => {
            const mine = k.getEncryptedKeyForUser ? k.getEncryptedKeyForUser(uid) : (k.encryptedKeys || []).find((e) => String(e.userId) === uid);
            return mine ? {
                conversationId: String(k.conversationId), conversationType: k.conversationType, workspaceId: sid(k.workspaceId),
                encryptedKey: mine.encryptedKey, ephemeralPublicKey: mine.ephemeralPublicKey || null, algorithm: mine.algorithm,
            } : null;
        }).filter(Boolean),
    };

    const wsList = await identity.workspaces.listForUser(uid, { includeArchived: true });
    const workspaces = (wsList || []).map((w) => {
        const me = (w.members || []).find((m) => sid(m.user || m.userId) === uid);
        return { _id: sid(w), name: w.name, type: w.type || null, role: me?.role || null };
    });
    const wsIds = workspaces.map((w) => w._id);

    const meetings = await exec(d.ScheduledMeeting.find({ workspaceId: { $in: wsIds }, $or: [{ createdBy: uid }, { participants: uid }] }), { select: '-transcriptSegments' });
    const meetingIds = meetings.map((m) => sid(m));

    const [ownNotes, meetingNotes] = await Promise.all([
        exec(d.Note.find({ workspace: { $in: wsIds }, $or: [{ owner: uid }, { sharedWith: uid }] })),
        meetingIds.length ? exec(d.Note.find({ meeting: { $in: meetingIds } })) : [],
    ]);
    const notes = dedupe([...ownNotes, ...meetingNotes]);

    const tasks = d.tasksOnPg()
        ? await d.tasksRepo().findMany({ involves: uid, limit: 20_000 })
        : await exec(d.Task.find({ $or: [{ createdBy: uid }, { assignedTo: uid }] }));

    const knowledge = await exec(d.KnowledgePage.find({ createdBy: uid, isDeleted: { $ne: true } }));
    const files = await exec(d.WorkspaceFile.find({ createdBy: uid, isDeleted: { $ne: true } }), {
        select: '_id workspaceId name description mimeType size folderId tags access currentVersion createdAt updatedAt',
    });

    const [channels, dms] = await Promise.all([
        exec(d.Channel.find({ 'members.user': uid }), { select: '_id workspace name' }),
        exec(d.DMSession.find({ participants: uid }), { select: '_id workspace participants' }),
    ]);
    const conversations = [
        ...channels.map((c) => ({ _id: sid(c), type: 'channel', workspace: sid(c.workspace), name: c.name })),
        ...dms.map((c) => ({ _id: sid(c), type: 'dm', workspace: sid(c.workspace) })),
    ];
    const messages = await exec(d.Message.find({
        sender: uid,
        $or: [{ channel: { $in: channels.map(sid) } }, { dm: { $in: dms.map(sid) } }],
    }), { sort: { createdAt: -1 }, limit: MAX_MESSAGES() });

    const bundle = plain({
        profile, keys, workspaces, notes, tasks, knowledge, meetings, conversations, messages, files,
    });
    return { bundle, counts: countsOf(bundle) };
}

function dedupe(items) {
    const seen = new Set();
    return items.filter((x) => { const k = sid(x); if (seen.has(k)) return false; seen.add(k); return true; });
}

function countsOf(b) {
    return {
        workspaces: (b.workspaces || []).length,
        notes: (b.notes || []).length,
        tasks: (b.tasks || []).length,
        knowledge: (b.knowledge || []).length,
        meetings: (b.meetings || []).length,
        messages: (b.messages || []).length,
        conversationKeys: (b.keys?.conversationKeys || []).length,
        files: (b.files || []).length,
    };
}

// ── Restore ──────────────────────────────────────────────────────────────────

async function existingIds(Model, ids) {
    const found = new Set();
    for (let i = 0; i < ids.length; i += CHUNK) {
        const rows = await exec(Model.find({ _id: { $in: ids.slice(i, i + CHUNK) } }), { select: '_id' });
        for (const r of rows) found.add(sid(r));
    }
    return found;
}

async function insertDocs(Model, docs) {
    for (let i = 0; i < docs.length; i += CHUNK) {
        try {
            await Model.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
        } catch (err) {
            // A record created meanwhile (duplicate id) is fine: it exists, which is the goal.
            if (!(err && (err.code === 11000 || (err.writeErrors || []).every((e) => (e.code || e.err?.code) === 11000)))) throw err;
        }
    }
}

/**
 * Restore owned, missing documents of one Mongo collection.
 * `own(doc)` decides ownership and `allowed(doc)` whether its container still exists for you.
 */
async function restoreDocs({ Model, items, own, allowed, dryRun }) {
    const r = { inBackup: items.length, present: 0, restore: 0, skipped: 0 };
    const candidates = items.filter((x) => {
        if (!own(x) || !allowed(x)) { r.skipped += 1; return false; }
        return true;
    });
    const have = await existingIds(Model, candidates.map(sid));
    const missing = candidates.filter((x) => !have.has(sid(x)));
    r.present = candidates.length - missing.length;
    r.restore = missing.length;
    if (!dryRun && missing.length) await insertDocs(Model, missing);
    return r;
}

/** Keys of `backup` missing in `current` (recursively for plain objects); current always wins. */
function fillMissing(current, backup) {
    let added = 0;
    const walk = (cur, bak) => {
        const out = { ...(cur || {}) };
        for (const [k, v] of Object.entries(bak || {})) {
            if (!(k in out) || out[k] === undefined || out[k] === null) {
                if (v !== undefined && v !== null) { out[k] = v; added += 1; }
            } else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
                out[k] = walk(out[k], v);
            }
        }
        return out;
    };
    return { value: walk(current, backup), added };
}

async function restore(userId, bundle, { dryRun = true } = {}, d = deps()) {
    const uid = String(userId);
    const { identity } = d;
    const b = bundle || {};
    const report = {};

    const ws = new Set((await identity.workspaces.memberWorkspaceIds(uid)).map(String));
    const inWs = (id) => ws.has(sid(id));

    // Profile and preferences: fill what's empty, keep what's there.
    const user = await identity.users.findById(uid);
    {
        const p = b.profile || {};
        const prefs = fillMissing(user?.preferences || {}, p.preferences || {});
        const prof = fillMissing(user?.profile || {}, p.profile || {});
        const patch = {};
        if (prefs.added) patch.preferences = prefs.value;
        if (prof.added) patch.profile = prof.value;
        if (isEmpty(user?.jobTitle) && !isEmpty(p.jobTitle)) patch.jobTitle = p.jobTitle;
        const changed = prefs.added + prof.added + (patch.jobTitle ? 1 : 0);
        report.profile = { inBackup: p.username ? 1 : 0, present: changed ? 0 : 1, restore: changed, skipped: 0 };
        if (!dryRun && Object.keys(patch).length) await identity.users.update(uid, patch);
    }

    // Encryption keys: only into an account that has none; conversation keys only for the same identity.
    {
        const k = b.keys || {};
        const current = await identity.cryptoState.findByUserId(uid);
        const r = { inBackup: k.cryptoState ? 1 : 0, present: 0, restore: 0, skipped: 0 };
        let identityPublicKey = current?.identityPublicKey || null;
        if (k.cryptoState) {
            if (!current || !current.encryptedIdentityPrivateKey) {
                r.restore = 1;
                identityPublicKey = k.cryptoState.identityPublicKey;
                if (!dryRun) {
                    await identity.cryptoState.upsert(uid, k.cryptoState);
                    if (k.identityKey?.publicKey) await identity.identityKeys.upsert(uid, k.identityKey);
                }
            } else if (current.identityPublicKey === k.cryptoState.identityPublicKey) {
                r.present = 1;
            } else {
                r.skipped = 1; // this account has newer keys; old envelopes can't open with them
            }
        }
        report.keys = r;

        const ck = { inBackup: (k.conversationKeys || []).length, present: 0, restore: 0, skipped: 0 };
        const sameIdentity = k.cryptoState && identityPublicKey && identityPublicKey === k.cryptoState.identityPublicKey;
        if (ck.inBackup && sameIdentity) {
            const [channels, dms] = await Promise.all([
                exec(d.Channel.find({ 'members.user': uid }), { select: '_id' }),
                exec(d.DMSession.find({ participants: uid }), { select: '_id' }),
            ]);
            const member = new Set([...channels.map((c) => `channel:${sid(c)}`), ...dms.map((c) => `dm:${sid(c)}`)]);
            for (const e of k.conversationKeys) {
                if (!member.has(`${e.conversationType}:${e.conversationId}`)) { ck.skipped += 1; continue; }
                const existing = await identity.conversationKeys.findByConversation(e.conversationId, e.conversationType);
                if (!existing) { ck.skipped += 1; continue; }
                const mine = existing.getEncryptedKeyForUser ? existing.getEncryptedKeyForUser(uid) : null;
                if (mine) { ck.present += 1; continue; }
                ck.restore += 1;
                if (!dryRun) {
                    await d.pgQuery(
                        `INSERT INTO conversation_key_members (conversation_key_id, user_id, encrypted_key, ephemeral_public_key, algorithm)
                         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (conversation_key_id, user_id) DO NOTHING`,
                        [existing.id || existing._id, uid, e.encryptedKey, e.ephemeralPublicKey, e.algorithm]
                    );
                }
            }
        } else {
            ck.skipped = ck.inBackup;
        }
        report.conversationKeys = ck;
    }

    report.workspaces = { inBackup: (b.workspaces || []).length, present: (b.workspaces || []).filter((w) => inWs(w._id)).length, restore: 0, skipped: (b.workspaces || []).filter((w) => !inWs(w._id)).length };

    report.notes = await restoreDocs({
        Model: d.Note, items: b.notes || [], dryRun,
        own: (n) => sid(n.owner) === uid, allowed: (n) => inWs(n.workspace),
    });

    if (d.tasksOnPg()) {
        const items = b.tasks || [];
        const r = { inBackup: items.length, present: 0, restore: 0, skipped: 0 };
        const candidates = items.filter((t) => sid(t.createdBy) === uid && inWs(t.workspace));
        r.skipped = items.length - candidates.length;
        const repo = d.tasksRepo();
        const have = new Set((await repo.findByIds(candidates.map(sid))).map(sid));
        const missing = candidates.filter((t) => !have.has(sid(t)));
        r.present = candidates.length - missing.length;
        r.restore = missing.length;
        if (!dryRun) for (const t of missing) await repo.insert(t);
        report.tasks = r;
    } else {
        report.tasks = await restoreDocs({
            Model: d.Task, items: b.tasks || [], dryRun,
            own: (t) => sid(t.createdBy) === uid, allowed: (t) => inWs(t.workspace),
        });
    }

    report.knowledge = await restoreDocs({
        Model: d.KnowledgePage, items: b.knowledge || [], dryRun,
        own: (p) => sid(p.createdBy) === uid, allowed: (p) => inWs(p.workspaceId),
    });

    report.meetings = await restoreDocs({
        Model: d.ScheduledMeeting, items: b.meetings || [], dryRun,
        own: (m) => sid(m.createdBy) === uid, allowed: (m) => inWs(m.workspaceId),
    });

    {
        const [channels, dms] = await Promise.all([
            exec(d.Channel.find({ 'members.user': uid }), { select: '_id' }),
            exec(d.DMSession.find({ participants: uid }), { select: '_id' }),
        ]);
        const inConv = new Set([...channels.map(sid), ...dms.map(sid)]);
        report.messages = await restoreDocs({
            Model: d.Message, items: b.messages || [], dryRun,
            own: (m) => sid(m.sender) === uid, allowed: (m) => inConv.has(sid(m.channel) || sid(m.dm)),
        });
    }

    report.files = { inBackup: (b.files || []).length, present: 0, restore: 0, skipped: (b.files || []).length };

    const total = Object.values(report).reduce((n, s) => n + (s.restore || 0), 0);
    return { dryRun, total, sections: report };
}

module.exports = { collect, restore, countsOf, fillMissing, deps };
