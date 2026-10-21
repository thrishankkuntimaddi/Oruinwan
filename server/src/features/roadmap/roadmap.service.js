'use strict';

/**
 * Roadmap items ("initiatives") built on milestones and tasks.
 *
 * Access:
 *   read    any active member of the workspace
 *   create  workspace owner/admin, or a company owner/admin/manager of the
 *           workspace's company ("managers")
 *   edit    the above, or the item's owner (ownerId) or creator
 *   delete  workspace owner/admin/manager, or the item's creator
 *
 * Progress is computed on read from the linked milestones' tasks, the directly
 * linked tasks and the linked project's tasks (see milestones.progress.js).
 */

const RoadmapItem = require('./RoadmapItem');
const { ROADMAP_STATUSES, ROADMAP_COLORS, QUARTER_RE } = RoadmapItem;
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const { isValidId } = require('../../shared/utils/workspaceAccess');
const store = require('../milestones/milestones.store');
const { itemProgress } = require('../milestones/milestones.progress');
const { canSeeTask } = require('../milestones/milestones.service');

const PERSON = { type: 'user', fields: ['username', 'profilePicture'] };
const MANAGER_COMPANY_ROLES = ['owner', 'admin', 'manager'];
const MAX_LINKS = 200;

const fail = (statusCode, message, extra) => Object.assign(new Error(message), { statusCode }, extra || {});
const idStr = (v) => String(v?._id || v || '');

/** { workspace, member, role, isAdmin, isManager } for an active member; throws 403 otherwise. */
async function access(userId, workspaceId) {
    if (!workspaceId || !isValidId(workspaceId)) throw fail(400, 'Invalid workspaceId');
    const m = await identity.workspaces.membership(workspaceId, userId);
    if (!m) throw fail(404, 'Workspace not found');
    if (!m.member) throw fail(403, 'You are not a member of this workspace');
    let isManager = !!m.isAdmin;
    if (!isManager && m.workspace?.company) {
        const user = await identity.users.findById(userId);
        isManager = !!user && idStr(user.companyId) === idStr(m.workspace.company)
            && (MANAGER_COMPANY_ROLES.includes(user.companyRole) || idStr(user.coOwnerOf) === idStr(m.workspace.company));
    }
    return { ...m, isManager };
}

function canEdit(item, userId, acc) {
    const uid = String(userId);
    return acc.isManager || idStr(item.ownerId) === uid || idStr(item.createdBy) === uid;
}

function parseDate(v, field) {
    if (v === null || v === '') return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw fail(400, `${field} must be a valid date`);
    return d;
}

function parseIdList(v, field) {
    if (!Array.isArray(v)) throw fail(400, `${field} must be an array`);
    const ids = [...new Set(v.map(String))];
    if (ids.length > MAX_LINKS) throw fail(400, `${field}: at most ${MAX_LINKS} entries`);
    if (ids.some((id) => !isValidId(id))) throw fail(400, `${field} contains an invalid id`);
    return ids;
}

/** Validate the body; resolves references against the workspace. */
async function cleanBody(body, { workspaceId, userId, partial }) {
    const out = {};
    if (body.title !== undefined || !partial) {
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title) throw fail(400, 'title is required');
        if (title.length > 200) throw fail(400, 'title is too long (200 max)');
        out.title = title;
    }
    if (body.description !== undefined) {
        if (typeof body.description !== 'string') throw fail(400, 'description must be a string');
        out.description = body.description.slice(0, 10000);
    }
    if (body.status !== undefined) {
        if (!ROADMAP_STATUSES.includes(body.status)) throw fail(400, `status must be one of ${ROADMAP_STATUSES.join(', ')}`);
        out.status = body.status;
    }
    if (body.color !== undefined) {
        if (!ROADMAP_COLORS.includes(body.color)) throw fail(400, `color must be one of ${ROADMAP_COLORS.join(', ')}`);
        out.color = body.color;
    }
    if (body.quarter !== undefined) {
        if (body.quarter !== null && body.quarter !== '' && !QUARTER_RE.test(String(body.quarter))) throw fail(400, 'quarter must look like 2026-Q4');
        out.quarter = body.quarter || null;
    }
    if (body.order !== undefined) {
        const n = Number(body.order);
        if (!Number.isFinite(n)) throw fail(400, 'order must be a number');
        out.order = n;
    }
    if (body.startDate !== undefined) out.startDate = parseDate(body.startDate, 'startDate');
    if (body.endDate !== undefined) out.endDate = parseDate(body.endDate, 'endDate');

    if (body.ownerId !== undefined) {
        if (body.ownerId === null || body.ownerId === '') out.ownerId = null;
        else {
            if (!isValidId(body.ownerId)) throw fail(400, 'Invalid ownerId');
            const m = await identity.workspaces.membership(workspaceId, body.ownerId);
            if (!m || !m.member) throw fail(400, 'ownerId must be an active member of this workspace');
            out.ownerId = String(body.ownerId);
        }
    }
    if (body.milestoneIds !== undefined) {
        const ids = parseIdList(body.milestoneIds, 'milestoneIds');
        const found = ids.length ? await store.findMilestones(workspaceId, ids) : [];
        const ok = new Set(found.map((m) => idStr(m._id)));
        const bad = ids.filter((id) => !ok.has(id));
        if (bad.length) throw fail(400, 'Some milestones are not in this workspace', { errors: bad });
        out.milestoneIds = ids;
    }
    if (body.taskIds !== undefined) {
        const ids = parseIdList(body.taskIds, 'taskIds');
        const found = ids.length ? await store.findTasks(workspaceId, { ids }) : [];
        const ok = new Set(found.filter((t) => canSeeTask(t, userId)).map((t) => t._id));
        const bad = ids.filter((id) => !ok.has(id));
        if (bad.length) throw fail(400, 'Some tasks are not in this workspace or not visible to you', { errors: bad });
        out.taskIds = ids;
    }
    if (body.projectId !== undefined) {
        if (body.projectId === null || body.projectId === '') out.projectId = null;
        else if (!isValidId(body.projectId)) throw fail(400, 'Invalid projectId');
        else out.projectId = String(body.projectId);
    }
    if (body.channelId !== undefined) {
        if (body.channelId === null || body.channelId === '') out.channelId = null;
        else {
            if (!isValidId(body.channelId)) throw fail(400, 'Invalid channelId');
            const Channel = require('../channels/channel.model');
            const ch = await Channel.findById(body.channelId).select('workspace').lean();
            if (!ch || idStr(ch.workspace) !== String(workspaceId)) throw fail(400, 'channelId must be a channel of this workspace');
            out.channelId = String(body.channelId);
        }
    }
    return out;
}

function assertDateOrder(item) {
    if (item.startDate && item.endDate && new Date(item.startDate) > new Date(item.endDate)) {
        throw fail(400, 'startDate must be before endDate');
    }
}

/** Attach progress (and owner/creator) to lean items. */
async function decorate(items, workspaceId) {
    if (!items.length) return items;
    const allMilestoneIds = [...new Set(items.flatMap((i) => i.milestoneIds || []))];
    const allTaskIds = [...new Set(items.flatMap((i) => i.taskIds || []))];
    const milestones = allMilestoneIds.length ? await store.findMilestones(workspaceId, allMilestoneIds) : [];
    const milestoneById = new Map(milestones.map((m) => [idStr(m._id), m]));
    const tasks = (allMilestoneIds.length || allTaskIds.length)
        ? await store.findTasks(workspaceId, { ids: allTaskIds, milestoneIds: allMilestoneIds })
        : [];
    const projectTasks = new Map();
    for (const pid of new Set(items.map((i) => i.projectId).filter(Boolean))) {
        projectTasks.set(pid, await store.findTasks(workspaceId, { projectId: pid }));
    }
    for (const item of items) {
        const mIds = new Set(item.milestoneIds || []);
        const tIds = new Set(item.taskIds || []);
        const reach = new Map();
        for (const t of tasks) if (tIds.has(t._id) || (t.milestoneId && mIds.has(t.milestoneId))) reach.set(t._id, t);
        for (const t of projectTasks.get(item.projectId) || []) reach.set(t._id, t);
        const ms = [...mIds].map((id) => milestoneById.get(id)).filter(Boolean);
        item.progress = itemProgress(item, ms, [...reach.values()]);
    }
    await hydrate(items, { ownerId: PERSON, createdBy: PERSON });
    return items;
}

async function loadItem(userId, itemId) {
    if (!isValidId(itemId)) throw fail(404, 'Roadmap item not found');
    const item = await RoadmapItem.findById(itemId);
    if (!item || item.deleted) throw fail(404, 'Roadmap item not found');
    let acc;
    try {
        acc = await access(userId, String(item.workspaceId));
    } catch (err) {
        if (err.statusCode === 403 || err.statusCode === 404) throw fail(404, 'Roadmap item not found');
        throw err;
    }
    return { item, acc };
}

const toPlain = (doc) => (typeof doc.toObject === 'function' ? doc.toObject() : { ...doc });

async function listItems(userId, workspaceId, filters = {}) {
    const acc = await access(userId, workspaceId);
    const q = { workspaceId: String(workspaceId), deleted: false };
    if (filters.quarter) {
        if (!QUARTER_RE.test(String(filters.quarter))) throw fail(400, 'quarter must look like 2026-Q4');
        q.quarter = String(filters.quarter);
    }
    if (filters.status) {
        if (!ROADMAP_STATUSES.includes(filters.status)) throw fail(400, 'Invalid status');
        q.status = filters.status;
    }
    const items = await RoadmapItem.find(q).sort({ order: 1, startDate: 1, createdAt: 1 }).lean();
    for (const i of items) i.canEdit = canEdit(i, userId, acc);
    await decorate(items, String(workspaceId));
    return { items, canCreate: acc.isManager, statuses: ROADMAP_STATUSES, colors: ROADMAP_COLORS };
}

async function getItem(userId, itemId) {
    const { item, acc } = await loadItem(userId, itemId);
    const out = toPlain(item);
    out.canEdit = canEdit(out, userId, acc);
    await decorate([out], String(item.workspaceId));
    return { item: out };
}

async function createItem(userId, body = {}) {
    const workspaceId = body.workspaceId;
    const acc = await access(userId, workspaceId);
    if (!acc.isManager) throw fail(403, 'Only workspace admins and managers can add roadmap items');
    const fields = await cleanBody(body, { workspaceId: String(workspaceId), userId, partial: false });
    assertDateOrder(fields);
    if (fields.order === undefined) {
        fields.order = await RoadmapItem.countDocuments({ workspaceId: String(workspaceId), deleted: false });
    }
    const doc = await RoadmapItem.create({
        ...fields,
        workspaceId: String(workspaceId),
        createdBy: String(userId),
        ownerId: fields.ownerId === undefined ? String(userId) : fields.ownerId,
    });
    const out = toPlain(doc);
    await decorate([out], String(workspaceId));
    out.canEdit = true;
    return { item: out };
}

async function updateItem(userId, itemId, body = {}) {
    const { item, acc } = await loadItem(userId, itemId);
    if (!canEdit(item, userId, acc)) throw fail(403, 'Only workspace admins, managers or the item owner can edit it');
    const ws = String(item.workspaceId);
    const fields = await cleanBody(body, { workspaceId: ws, userId, partial: true });
    // Only managers hand an item to someone else.
    if (fields.ownerId !== undefined && idStr(fields.ownerId) !== idStr(item.ownerId) && !acc.isManager) {
        throw fail(403, 'Only workspace admins and managers can change the owner');
    }
    Object.assign(item, fields);
    assertDateOrder(item);
    await item.save();
    const out = toPlain(item);
    out.canEdit = canEdit(out, userId, acc);
    await decorate([out], ws);
    return { item: out };
}

async function deleteItem(userId, itemId) {
    const { item, acc } = await loadItem(userId, itemId);
    if (!acc.isManager && idStr(item.createdBy) !== String(userId)) {
        throw fail(403, 'Only workspace admins, managers or the creator can delete this item');
    }
    item.deleted = true;
    await item.save();
    return { message: 'Roadmap item deleted', itemId: idStr(item._id), workspaceId: String(item.workspaceId) };
}

/** Body: { workspaceId, order: [itemId, ...] } — sets order = index. Managers only. */
async function reorder(userId, body = {}) {
    const { workspaceId, order } = body;
    const acc = await access(userId, workspaceId);
    if (!acc.isManager) throw fail(403, 'Only workspace admins and managers can reorder the roadmap');
    const ids = parseIdList(order || [], 'order');
    const items = await RoadmapItem.find({ _id: { $in: ids }, workspaceId: String(workspaceId), deleted: false }).select('_id').lean();
    const known = new Set(items.map((i) => idStr(i._id)));
    const bad = ids.filter((id) => !known.has(id));
    if (bad.length) throw fail(400, 'Some items are not on this roadmap', { errors: bad });
    await RoadmapItem.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })));
    return { order: ids };
}

module.exports = {
    access, canEdit, decorate,
    listItems, getItem, createItem, updateItem, deleteItem, reorder,
    ROADMAP_STATUSES, ROADMAP_COLORS,
};
