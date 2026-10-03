'use strict';

/**
 * Store-aware task queries for features outside src/features/tasks
 * (dashboards, analytics, search, GDPR, integrations, public API, AI).
 *
 * Every function takes the Mongo-style filter those features already build
 * and runs it on whichever store holds tasks (tasks.store.js): MongoDB via
 * models/Task, PostgreSQL via tasks.repository's reports section. Results are
 * plain lean-shaped objects in both cases.
 *
 *   countDocuments(filter)
 *   find(filter, { select, sort, limit, skip })
 *   findOne(filter, { select })
 *   findById(id)
 *   deleteMany(filter)
 *   statusCounts(filter)                    [{ _id: status, count }]
 *   groupCount(filter, by, opts)            [{ _id, count, done }] by status|priority|workspace|createdBy|assignee
 *   totals(filter)                          { total, completed }
 *   avgCompletionHours(filter)              number | null
 *   countBuckets(filter, field, buckets)    [n, ...] per { start, end }
 *   create(data)                            insert with a fresh issue key (writes from outside the tasks service)
 *   updateById(id, patch)                   Mongo field names; returns the updated task
 *   logActivity({ task, user, action, field, from, to, metadata })   task history row
 *
 * Writes that need permissions, notifications and history go through
 * tasks.service instead.
 */

const mongoose = require('mongoose');
const { tasksStore } = require('./tasks.store');

const onPg = () => tasksStore() === 'pg';
const repo = () => require('./tasks.repository');
const Task = () => require('../../../models/Task');

/** ObjectId-cast the id fields of a filter for Mongo aggregation stages ($match does not cast). */
function castForAggregate(filter) {
    const out = {};
    const cast = (v) => (typeof v === 'string' && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v);
    const castCond = (v) => {
        if (Array.isArray(v)) return v.map(cast);
        if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof RegExp) && typeof v.toHexString !== 'function') {
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.map(cast) : cast(x)]));
        }
        return cast(v);
    };
    for (const [k, v] of Object.entries(filter || {})) {
        if (k === '$or' || k === '$and') out[k] = v.map(castForAggregate);
        else if (['_id', 'workspace', 'company', 'createdBy', 'assignedTo', 'channel', 'project', 'sprintId', 'milestoneId'].includes(k)) out[k] = castCond(v);
        else out[k] = v;
    }
    return out;
}

function countDocuments(filter = {}) {
    if (onPg()) return repo().countWhere(filter);
    return Task().countDocuments(filter);
}

function find(filter = {}, { select, sort, limit, skip } = {}) {
    if (onPg()) return repo().findWhere(filter, { select, sort, limit, skip });
    let q = Task().find(filter);
    if (select) q = q.select(select);
    if (sort) q = q.sort(sort);
    if (skip) q = q.skip(skip);
    if (limit) q = q.limit(limit);
    return q.lean();
}

function findOne(filter = {}, { select, sort } = {}) {
    if (onPg()) return repo().findOneWhere(filter, { select, sort });
    let q = Task().findOne(filter);
    if (select) q = q.select(select);
    if (sort) q = q.sort(sort);
    return q.lean();
}

function findById(id) {
    if (!id || !mongoose.isValidObjectId(String(id))) return Promise.resolve(null);
    if (onPg()) return repo().findById(String(id));
    return Task().findById(id).lean();
}

function deleteMany(filter = {}) {
    if (onPg()) return repo().deleteWhere(filter);
    return Task().deleteMany(filter);
}

async function groupCount(filter, by, opts = {}) {
    if (onPg()) return repo().groupCount(filter, by, opts);
    const field = { status: '$status', priority: '$priority', workspace: '$workspace', company: '$company', createdBy: '$createdBy', assignee: '$assignedTo' }[by];
    if (!field) throw new Error(`tasks groupCount: unsupported key ${by}`);
    const pipeline = [{ $match: castForAggregate(filter) }];
    if (by === 'assignee') {
        pipeline.push({ $unwind: '$assignedTo' });
        if (opts.onlyAssignees) pipeline.push({ $match: { assignedTo: { $in: opts.onlyAssignees.map((x) => new mongoose.Types.ObjectId(String(x))) } } });
    }
    pipeline.push(
        { $group: { _id: field, count: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', opts.doneStatus || 'done'] }, 1, 0] } } } },
        { $sort: { count: -1 } }
    );
    return Task().aggregate(pipeline);
}

async function statusCounts(filter) {
    return (await groupCount(filter, 'status')).map(({ _id, count }) => ({ _id, count }));
}

async function totals(filter = {}, { doneStatuses = ['done'] } = {}) {
    if (onPg()) return repo().totals(filter, { doneStatuses });
    const [row] = await Task().aggregate([
        { $match: castForAggregate(filter) },
        { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ['$status', doneStatuses] }, 1, 0] } } } },
    ]);
    return { total: row?.total || 0, completed: row?.completed || 0 };
}

async function avgCompletionHours(filter = {}) {
    if (onPg()) return repo().avgCompletionHours(filter);
    const [row] = await Task().aggregate([
        { $match: { ...castForAggregate(filter), completedAt: { $ne: null } } },
        { $project: { h: { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 3600000] } } },
        { $group: { _id: null, avg: { $avg: '$h' } } },
    ]);
    return row ? row.avg : null;
}

async function countBuckets(filter, field, buckets) {
    if (onPg()) return repo().countBuckets(filter, field, buckets);
    return Promise.all(buckets.map((b) => Task().countDocuments({ ...filter, [field]: { $gte: b.start, $lte: b.end } })));
}

/**
 * Insert a task from outside the tasks service (integrations, AI, managers).
 * On PostgreSQL the issue key comes from the per-workspace counter so keys
 * never collide with tasks created through the service.
 */
async function create(data) {
    if (onPg()) {
        const r = repo();
        let issueKey = data.issueKey || null;
        if (!issueKey && data.workspace) {
            const identity = require('../../identity');
            const ws = await identity.workspaces.findById(String(data.workspace));
            issueKey = await r.nextIssueKey(String(data.workspace), ws?.name);
        }
        return r.insert({ deleted: false, ...data, issueKey });
    }
    const issueKey = data.issueKey || (data.workspace ? await require('./tasks.shared').nextIssueKey(String(data.workspace)) : null);
    const doc = await Task().create(issueKey ? { ...data, issueKey } : data);
    return doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

async function updateById(id, patch) {
    if (onPg()) return repo().update(String(id), patch);
    const q = Task().findByIdAndUpdate(id, patch, { new: true });
    return q && typeof q.lean === 'function' ? q.lean() : q;
}

async function logActivity(entry) {
    if (onPg()) return repo().appendActivity(entry);
    const TaskActivity = require('../../../models/TaskActivity');
    return TaskActivity.create(entry);
}

module.exports = {
    countDocuments, find, findOne, findById, deleteMany,
    groupCount, statusCounts, totals, avgCompletionHours, countBuckets,
    create, updateById, logActivity, castForAggregate,
};
