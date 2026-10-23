'use strict';

/**
 * "Files shared with me": one list of every file the caller can open in a workspace —
 *   - attachments sent in channels they are a member of (from the moment they joined),
 *   - attachments in their DMs and group DMs (after "clear chat" / joining a group),
 *   - files uploaded straight to the workspace library (restricted ones only when they
 *     are on them).
 *
 * Only metadata is read (name, type, size, sender, conversation). Chat attachments are
 * opened through the same signed /api/v2/uploads links the conversation uses, so
 * nothing about storage or encryption changes here. Messages deleted for everyone,
 * removed, or hidden with "delete for me" are left out, as are system lines.
 */

const mongoose = require('mongoose');
const Channel = require('../channels/channel.model.js');
const DMSession = require('../../../models/DMSession');
const Message = require('../../modules/messages/message.model.js');
const WorkspaceFile = require('./WorkspaceFile');
const { hydrate } = require('../../identity/hydrate');

const KINDS = ['all', 'image', 'document', 'media', 'other'];
const SOURCES = ['all', 'library', 'channels', 'dms'];
const SORTS = ['newest', 'oldest', 'name', 'size'];
const MAX_LIMIT = 100;
const MAX_OFFSET = 5000;

const PERSON = { type: 'user', fields: ['username', 'profilePicture'] };

const httpErr = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const isId = (v) => v != null && /^[a-f\d]{24}$/i.test(String(v)) && mongoose.isValidObjectId(String(v));
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DOC_MIME = /pdf|word|document|text\/|spreadsheet|excel|csv|presentation|powerpoint|rtf|opendocument|msword|ms-excel|ms-powerpoint|json|xml|markdown/i;
const DOC_EXT = /\.(pdf|docx?|odt|rtf|pages|txt|md|xlsx?|ods|csv|tsv|numbers|pptx?|odp|key|json|xml|log)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg|tiff?)$/i;
const MEDIA_EXT = /\.(mp4|mov|webm|mkv|avi|mp3|wav|m4a|ogg|flac|aac)$/i;

/**
 * Mongo conditions selecting one kind of file. `p` is the path prefix of the
 * attachment fields ('' for library files, 'attachments.' for unwound messages).
 */
function kindMatch(kind, p = '') {
    const image = [{ [`${p}mimeType`]: /^image\//i }, { [`${p}name`]: IMAGE_EXT }];
    const media = [{ [`${p}mimeType`]: /^(video|audio)\//i }, { [`${p}name`]: MEDIA_EXT }];
    const document = [{ [`${p}mimeType`]: DOC_MIME }, { [`${p}name`]: DOC_EXT }];
    if (p) {
        image.push({ [`${p}type`]: 'image' });
        media.push({ [`${p}type`]: { $in: ['video', 'audio', 'voice'] } });
    }
    switch (kind) {
        case 'image': return { $or: image };
        case 'media': return { $or: media };
        // A document that is not also an image or media file (e.g. image/svg+xml is an image).
        case 'document': return { $and: [{ $or: document }, { $nor: [...image, ...media] }] };
        case 'other': return { $nor: [...image, ...media, ...document] };
        default: return {};
    }
}

/** The same classification for one item in memory (used by the client too, mirrored there). */
function kindOf({ mimeType = '', name = '', type = '' } = {}) {
    const m = String(mimeType || '').toLowerCase();
    const n = String(name || '');
    if (m.startsWith('image/') || type === 'image' || IMAGE_EXT.test(n)) return 'image';
    if (/^(video|audio)\//.test(m) || ['video', 'audio', 'voice'].includes(type) || MEDIA_EXT.test(n)) return 'media';
    if (DOC_MIME.test(m) || DOC_EXT.test(n)) return 'document';
    return 'other';
}

function parseOptions(raw = {}) {
    const kind = KINDS.includes(raw.kind) ? raw.kind : 'all';
    const source = SOURCES.includes(raw.source) ? raw.source : 'all';
    const sort = SORTS.includes(raw.sort) ? raw.sort : 'newest';
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(raw.limit, 10) || 50));
    const offset = Math.min(MAX_OFFSET, Math.max(0, parseInt(raw.offset, 10) || 0));
    const q = typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : '';
    let conversationId = null;
    if (raw.conversationId) {
        if (!isId(raw.conversationId)) throw httpErr(400, 'Invalid conversationId');
        conversationId = String(raw.conversationId);
    }
    let sharedBy = null;
    if (raw.sharedBy) {
        if (!isId(raw.sharedBy)) throw httpErr(400, 'Invalid sharedBy');
        sharedBy = String(raw.sharedBy);
    }
    return { kind, source, sort, limit, offset, q, conversationId, sharedBy };
}

/** Newest first by default; name is case-insensitive; ties fall back to newest. */
function compareItems(sort) {
    const time = (x) => new Date(x.sharedAt).getTime() || 0;
    return (a, b) => {
        let d = 0;
        if (sort === 'oldest') d = time(a) - time(b);
        else if (sort === 'name') d = String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' });
        else if (sort === 'size') d = (b.size || 0) - (a.size || 0);
        else d = time(b) - time(a);
        return d || time(b) - time(a) || String(a.id).localeCompare(String(b.id));
    };
}

function mongoSort(sort, p = '') {
    if (sort === 'oldest') return { createdAt: 1, _id: 1 };
    if (sort === 'name') return { [`${p}name`]: 1, createdAt: -1 };
    if (sort === 'size') return { [`${p}size`]: -1, createdAt: -1 };
    return { createdAt: -1, _id: -1 };
}

const latest = (...dates) => {
    const t = dates.filter(Boolean).map((d) => new Date(d).getTime()).filter(Number.isFinite);
    return t.length ? new Date(Math.max(...t)) : null;
};

/**
 * The conversations of this workspace the user can read, with the time from which
 * they can read each one. Returns { channels: [...], dms: [...] } of
 * { id, type, name, since, isPrivate?, isGroup?, participants? }.
 */
async function readableConversations(userId, workspaceId) {
    const me = String(userId);
    const channels = await Channel.find({ workspace: workspaceId, 'members.user': userId })
        .select('_id name isPrivate members.user members.joinedAt')
        .lean();
    const sessions = await DMSession.find({ workspace: workspaceId, participants: userId })
        .select('_id isGroup name participants memberSince clearedAt')
        .lean();
    await hydrate(sessions, { participants: PERSON });

    const { groupDisplayName, memberSinceFor } = require('../../modules/messages/groupDM.service');
    return {
        channels: channels.map((c) => {
            const mine = (c.members || []).find((m) => String(m?.user?._id || m?.user || m) === me);
            return { id: String(c._id), type: 'channel', name: c.name, isPrivate: !!c.isPrivate, since: mine?.joinedAt || null };
        }),
        dms: sessions.map((s) => {
            const cleared = (s.clearedAt || []).find((c) => String(c.user) === me);
            const others = (s.participants || []).filter((p) => String(p?._id || p) !== me);
            const name = s.isGroup
                ? groupDisplayName(s, me)
                : (others[0]?.username || 'Direct message');
            return { id: String(s._id), type: 'dm', name, isGroup: !!s.isGroup, since: latest(cleared?.clearedAt, memberSinceFor(s, me)) };
        }),
    };
}

/** $or clauses scoping messages to the readable part of each conversation. */
function conversationClauses(convs) {
    return convs.map((c) => {
        const clause = { [c.type === 'channel' ? 'channel' : 'dm']: oid(c.id) };
        if (c.since) clause.createdAt = { [c.type === 'channel' ? '$gte' : '$gt']: new Date(c.since) };
        return clause;
    });
}

function attachmentPipeline(userId, clauses, opts) {
    const me = oid(userId);
    const match = {
        $or: clauses,
        'attachments.0': { $exists: true },
        type: { $ne: 'system' },
        isDeleted: { $ne: true },
        isDeletedUniversally: { $ne: true },
        hiddenFor: { $ne: me },
    };
    if (opts.sharedBy) match.sender = oid(opts.sharedBy);
    const after = { 'attachments.url': { $type: 'string', $ne: '' } };
    if (opts.q) after['attachments.name'] = new RegExp(escapeRegex(opts.q), 'i');
    const kind = kindMatch(opts.kind, 'attachments.');
    return [
        { $match: match },
        { $project: { channel: 1, dm: 1, sender: 1, parentId: 1, createdAt: 1, attachments: 1 } },
        { $unwind: { path: '$attachments', includeArrayIndex: 'index' } },
        { $match: { ...after, ...kind } },
    ];
}

function libraryQuery(userId, workspaceId, isAdmin, opts) {
    const and = [{ workspaceId: oid(workspaceId), isDeleted: false }];
    if (!isAdmin) and.push({ $or: [{ access: { $ne: 'restricted' } }, { createdBy: oid(userId) }, { 'permissions.user': oid(userId) }] });
    if (opts.q) and.push({ name: new RegExp(escapeRegex(opts.q), 'i') });
    if (opts.sharedBy) and.push({ createdBy: oid(opts.sharedBy) });
    const kind = kindMatch(opts.kind, '');
    if (Object.keys(kind).length) and.push(kind);
    return { $and: and };
}

function attachmentItem(row, convById) {
    const a = row.attachments || {};
    const convId = String(row.channel || row.dm);
    const conv = convById.get(convId) || { id: convId, type: row.channel ? 'channel' : 'dm', name: '' };
    return {
        id: `msg:${row._id}:${row.index || 0}`,
        source: conv.type,
        name: a.name || 'File',
        mimeType: a.mimeType || '',
        type: a.type || 'file',
        size: a.size || 0,
        url: a.url,
        width: a.width || null,
        height: a.height || null,
        duration: a.duration || null,
        kind: kindOf(a),
        sharedBy: row.sender,
        sharedAt: row.createdAt,
        messageId: String(row._id),
        parentId: row.parentId ? String(row.parentId) : null,
        conversation: { id: conv.id, type: conv.type, name: conv.name, isPrivate: conv.isPrivate || false, isGroup: conv.isGroup || false },
    };
}

function libraryItem(f) {
    return {
        id: `lib:${f._id}`,
        source: 'library',
        fileId: String(f._id),
        name: f.name,
        mimeType: f.mimeType || '',
        type: 'file',
        size: f.size || 0,
        url: f.url,
        kind: kindOf(f),
        tags: f.tags || [],
        sharedBy: f.createdBy,
        sharedAt: f.createdAt,
        messageId: null,
        parentId: null,
        conversation: null,
    };
}

/**
 * GET /api/v2/files/shared — paginated (offset/limit), filtered by kind, source or one
 * conversation, searched by name, sorted newest | oldest | name | size.
 * Responds { items, total, hasMore, offset, limit, conversations }.
 */
async function listSharedFiles(userId, workspaceId, rawOptions = {}, deps = {}) {
    const assertWorkspaceMember = deps.assertWorkspaceMember || require('./files.service').assertWorkspaceMember;
    const { isAdmin } = await assertWorkspaceMember(workspaceId, userId);
    const opts = parseOptions(rawOptions);
    const { channels, dms } = await readableConversations(userId, workspaceId);
    const convById = new Map([...channels, ...dms].map((c) => [c.id, c]));

    let convs = [];
    if (opts.conversationId) {
        // Only a conversation the user can read; anything else answers an empty list.
        const c = convById.get(opts.conversationId);
        convs = c ? [c] : [];
    } else if (opts.source === 'all') convs = [...channels, ...dms];
    else if (opts.source === 'channels') convs = channels;
    else if (opts.source === 'dms') convs = dms;
    const withLibrary = !opts.conversationId && (opts.source === 'all' || opts.source === 'library');

    const take = opts.offset + opts.limit;
    let messageRows = [];
    let messageTotal = 0;
    if (convs.length) {
        const base = attachmentPipeline(userId, conversationClauses(convs), opts);
        const collation = opts.sort === 'name' ? { locale: 'en', strength: 2 } : undefined;
        const listAgg = Message.aggregate([...base, { $sort: mongoSort(opts.sort, 'attachments.') }, { $limit: take }]);
        if (collation && listAgg.collation) listAgg.collation(collation);
        const [rows, counted] = await Promise.all([listAgg, Message.aggregate([...base, { $count: 'n' }])]);
        messageRows = rows || [];
        messageTotal = counted?.[0]?.n || 0;
    }

    let libraryRows = [];
    let libraryTotal = 0;
    if (withLibrary) {
        const query = libraryQuery(userId, workspaceId, isAdmin, opts);
        let find = WorkspaceFile.find(query).sort(mongoSort(opts.sort)).limit(take);
        if (opts.sort === 'name' && find.collation) find = find.collation({ locale: 'en', strength: 2 });
        const [rows, n] = await Promise.all([find.lean(), WorkspaceFile.countDocuments(query)]);
        libraryRows = rows || [];
        libraryTotal = n || 0;
    }

    const merged = [
        ...messageRows.map((r) => attachmentItem(r, convById)),
        ...libraryRows.map(libraryItem),
    ].sort(compareItems(opts.sort));
    const items = merged.slice(opts.offset, take);
    await hydrate(items, { sharedBy: PERSON });

    const total = messageTotal + libraryTotal;
    const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' });
    return {
        items,
        total,
        offset: opts.offset,
        limit: opts.limit,
        hasMore: take < total,
        conversations: [
            ...channels.map(({ id, type, name, isPrivate }) => ({ id, type, name, isPrivate })).sort(byName),
            ...dms.map(({ id, type, name, isGroup }) => ({ id, type, name, isGroup })).sort(byName),
        ],
    };
}

module.exports = {
    listSharedFiles,
    // exported for tests
    kindMatch,
    kindOf,
    parseOptions,
    compareItems,
    conversationClauses,
    readableConversations,
};
