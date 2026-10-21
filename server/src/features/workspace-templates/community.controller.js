'use strict';

/**
 * Community template gallery: workspace admins publish a workspace's structure,
 * platform admins moderate, anyone browses and imports. A published template
 * holds only channel names/descriptions (public channels), workspace settings
 * and feature toggles — never messages, files, members or private channels.
 */

const mongoose = require('mongoose');
const WorkspaceTemplate = require('../../models/WorkspaceTemplate');
const TemplateRating = require('./TemplateRating.model');
const Channel = require('../channels/channel.model');
const identity = require('../../identity');
const { hydrate, userSelect } = require('../../identity/hydrate');
const { safeRegex } = require('../../shared/utils/escapeRegex');
const { isValidId } = require('../../shared/utils/workspaceAccess');
const { handleError } = require('../../../utils/responseHelpers');

const CATEGORIES = WorkspaceTemplate.schema.path('category').enumValues;
const SETTING_KEYS = ['isPrivate', 'allowMemberInvite', 'allowMemberChannelCreation', 'requireAdminApproval', 'isDiscoverable', 'autoArchiveInactiveDays'];
const TOGGLE_KEYS = ['tasks', 'notes', 'polls', 'ai', 'huddles'];
const MAX_CHANNELS = 50;

const PUBLIC_FIELDS = 'name description icon color category defaultChannels featureToggles usageCount community.ratingAvg community.ratingCount community.publishedBy community.publishedAt createdAt';

function bad(res, message) { return res.status(400).json({ message }); }

/** Shape a template for the gallery. Channel list is the "preview". */
function toCard(t) {
    const c = t.community || {};
    return {
        _id: t._id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        category: t.category,
        channels: (t.defaultChannels || []).map((ch) => ({ name: ch.name, description: ch.description || '', isDefault: !!ch.isDefault })),
        featureToggles: t.featureToggles || {},
        importCount: t.usageCount || 0,
        ratingAvg: c.ratingAvg ? Math.round(c.ratingAvg * 10) / 10 : 0,
        ratingCount: c.ratingCount || 0,
        publisher: c.publishedBy && typeof c.publishedBy === 'object' ? { _id: c.publishedBy._id, username: c.publishedBy.username } : null,
        publishedAt: c.publishedAt || t.createdAt,
        ...(c.status ? { status: c.status } : {}),
    };
}

function validateMeta(body, { partial = false } = {}) {
    const out = {};
    if (!partial || body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 80) return { error: 'name must be 3–80 characters' };
        out.name = body.name.trim();
    }
    if (!partial || body.description !== undefined) {
        if (typeof body.description !== 'string' || body.description.trim().length < 10 || body.description.trim().length > 1000) {
            return { error: 'description must be 10–1000 characters' };
        }
        out.description = body.description.trim();
    }
    if (body.category !== undefined) {
        if (!CATEGORIES.includes(body.category)) return { error: `category must be one of: ${CATEGORIES.join(', ')}` };
        out.category = body.category;
    }
    if (body.icon !== undefined) {
        if (typeof body.icon !== 'string' || !body.icon.trim() || [...body.icon.trim()].length > 4) return { error: 'icon must be an emoji' };
        out.icon = body.icon.trim();
    }
    if (body.color !== undefined) {
        if (typeof body.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(body.color)) return { error: 'color must be a hex colour like #2563eb' };
        out.color = body.color;
    }
    return { data: out };
}

/** GET /community — approved templates. Public. ?category&q&sort=popular|rating|new&page&limit */
exports.listCommunity = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 24), 60);
        const { category, q } = req.query;
        const query = { isActive: true, isPublic: true, 'community.status': 'approved' };
        if (category !== undefined && category !== '') {
            if (!CATEGORIES.includes(category)) return bad(res, 'Invalid category');
            query.category = category;
        }
        if (q !== undefined && q !== '') {
            if (typeof q !== 'string') return bad(res, 'q must be a string');
            const rx = safeRegex(q.slice(0, 100));
            query.$or = [{ name: rx }, { description: rx }];
        }
        const sort = req.query.sort === 'rating' ? { 'community.ratingAvg': -1, 'community.ratingCount': -1 }
            : req.query.sort === 'new' ? { 'community.publishedAt': -1 }
                : { usageCount: -1, 'community.publishedAt': -1 };

        const [rows, total] = await Promise.all([
            WorkspaceTemplate.find(query).select(PUBLIC_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            WorkspaceTemplate.countDocuments(query),
        ]);
        await hydrate(rows, { 'community.publishedBy': userSelect('username') });
        res.json({ templates: rows.map(toCard), total, page, totalPages: Math.ceil(total / limit), categories: CATEGORIES });
    } catch (err) {
        return handleError(res, err, 'LIST COMMUNITY TEMPLATES ERROR');
    }
};

/** GET /community/mine — what I published, any status. */
exports.listMine = async (req, res) => {
    try {
        const rows = await WorkspaceTemplate.find({ 'community.publishedBy': req.user.sub, isActive: true })
            .select(PUBLIC_FIELDS + ' community.status community.moderationNote community.reportCount')
            .sort({ createdAt: -1 }).lean();
        res.json({ templates: rows.map((t) => ({ ...toCard(t), moderationNote: t.community?.moderationNote || null })) });
    } catch (err) {
        return handleError(res, err, 'LIST MY COMMUNITY TEMPLATES ERROR');
    }
};

/**
 * POST /community/publish { workspaceId, name, description, category?, icon?, color? }
 * Caller must be owner/admin of the workspace (checked by the route).
 */
exports.publish = async (req, res) => {
    try {
        const { error, data } = validateMeta(req.body || {});
        if (error) return bad(res, error);
        const workspaceId = req.workspaceAccess.workspaceId;
        const userId = req.user.sub;

        const pending = await WorkspaceTemplate.countDocuments({ 'community.publishedBy': userId, 'community.status': 'pending', isActive: true });
        if (pending >= 5) return res.status(409).json({ message: 'You already have 5 templates waiting for review' });

        const ws = await identity.workspaces.findById(workspaceId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        // Structure only: public, non-archived channels' names and descriptions.
        const channels = await Channel.find({ workspace: workspaceId, isPrivate: { $ne: true }, isArchived: { $ne: true } })
            .select('name description isDefault').sort({ isDefault: -1, createdAt: 1 }).limit(MAX_CHANNELS).lean();
        if (!channels.length) return bad(res, 'This workspace has no public channels to share');

        const settings = {};
        for (const k of SETTING_KEYS) if (ws.settings && ws.settings[k] !== undefined) settings[k] = ws.settings[k];
        const featureToggles = {};
        try {
            const perms = await identity.workspacePermissions.get(workspaceId);
            for (const k of TOGGLE_KEYS) if (perms?.featureToggles && typeof perms.featureToggles[k] === 'boolean') featureToggles[k] = perms.featureToggles[k];
        } catch { /* defaults */ }

        const template = await WorkspaceTemplate.create({
            ...data,
            icon: data.icon || ws.icon || '📁',
            color: data.color || (typeof ws.color === 'string' && /^#[0-9a-f]{6}$/i.test(ws.color) ? ws.color : '#2563eb'),
            category: data.category || 'general',
            defaultChannels: channels.map((c) => ({
                name: String(c.name).slice(0, 80),
                description: String(c.description || '').slice(0, 250),
                isPrivate: false,
                isDefault: !!c.isDefault,
            })),
            settings,
            featureToggles,
            company: null,
            createdBy: userId,
            isPublic: false,
            community: { status: 'pending', publishedBy: userId, publishedAt: new Date(), sourceWorkspaceId: workspaceId },
        });
        res.status(201).json({ message: 'Submitted to the community gallery. A moderator will review it.', template: toCard(template.toObject()) });
    } catch (err) {
        return handleError(res, err, 'PUBLISH COMMUNITY TEMPLATE ERROR');
    }
};

async function loadCommunity(req, res) {
    if (!isValidId(req.params.id)) { bad(res, 'Invalid template id'); return null; }
    const t = await WorkspaceTemplate.findById(req.params.id);
    if (!t || !t.isActive || !t.community || !t.community.status) { res.status(404).json({ message: 'Template not found' }); return null; }
    return t;
}

/** PATCH /community/:id — publisher edits name/description/category/icon/color; approved → re-review. */
exports.update = async (req, res) => {
    try {
        const t = await loadCommunity(req, res);
        if (!t) return;
        if (String(t.community.publishedBy) !== String(req.user.sub)) return res.status(404).json({ message: 'Template not found' });
        if (t.community.status === 'hidden') return res.status(409).json({ message: 'A hidden template cannot be edited' });
        const { error, data } = validateMeta(req.body || {}, { partial: true });
        if (error) return bad(res, error);
        Object.assign(t, data);
        if (t.community.status === 'approved') { t.community.status = 'pending'; t.isPublic = false; }
        await t.save();
        res.json({ message: 'Updated. It will be listed again once a moderator reviews it.', template: toCard(t.toObject()) });
    } catch (err) {
        return handleError(res, err, 'UPDATE COMMUNITY TEMPLATE ERROR');
    }
};

/** DELETE /community/:id — publisher (or platform admin) removes it from the gallery. */
exports.unpublish = async (req, res) => {
    try {
        const t = await loadCommunity(req, res);
        if (!t) return;
        const { isPlatformAdmin } = require('../developer/platformAdmin.middleware');
        const mine = String(t.community.publishedBy) === String(req.user.sub);
        if (!mine && !(await isPlatformAdmin(req.user.sub))) return res.status(404).json({ message: 'Template not found' });
        t.isActive = false;
        t.isPublic = false;
        await t.save();
        res.json({ message: 'Removed from the community gallery' });
    } catch (err) {
        return handleError(res, err, 'UNPUBLISH COMMUNITY TEMPLATE ERROR');
    }
};

/** POST /community/:id/rate { rating } — one rating per user; the publisher cannot rate. */
exports.rate = async (req, res) => {
    try {
        const rating = Number(req.body?.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(res, 'rating must be a whole number between 1 and 5');
        const t = await loadCommunity(req, res);
        if (!t) return;
        if (t.community.status !== 'approved' || !t.isPublic) return res.status(404).json({ message: 'Template not found' });
        if (String(t.community.publishedBy) === String(req.user.sub)) return res.status(403).json({ message: 'You cannot rate your own template' });

        await TemplateRating.findOneAndUpdate(
            { templateId: t._id, userId: req.user.sub },
            { rating },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const [agg] = await TemplateRating.aggregate([
            { $match: { templateId: new mongoose.Types.ObjectId(String(t._id)) } },
            { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
        ]);
        const ratingAvg = agg ? Math.round(agg.avg * 10) / 10 : rating;
        const ratingCount = agg ? agg.n : 1;
        await WorkspaceTemplate.updateOne({ _id: t._id }, { $set: { 'community.ratingAvg': ratingAvg, 'community.ratingCount': ratingCount } });
        res.json({ message: 'Rating saved', ratingAvg, ratingCount, yourRating: rating });
    } catch (err) {
        return handleError(res, err, 'RATE COMMUNITY TEMPLATE ERROR');
    }
};

/** POST /community/:id/report { reason } — once per user; goes to the moderation queue. */
exports.report = async (req, res) => {
    try {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (reason.length < 3 || reason.length > 500) return bad(res, 'reason must be 3–500 characters');
        const t = await loadCommunity(req, res);
        if (!t) return;
        if (t.community.status !== 'approved') return res.status(404).json({ message: 'Template not found' });
        const upd = await WorkspaceTemplate.updateOne(
            { _id: t._id, 'community.reports.userId': { $ne: req.user.sub } },
            { $push: { 'community.reports': { userId: req.user.sub, reason, at: new Date() } }, $inc: { 'community.reportCount': 1 } }
        );
        if (!(upd.modifiedCount ?? upd.nModified)) return res.status(409).json({ message: 'You already reported this template' });
        res.json({ message: 'Thanks. A moderator will take a look.' });
    } catch (err) {
        return handleError(res, err, 'REPORT COMMUNITY TEMPLATE ERROR');
    }
};

// ── Platform admin moderation ───────────────────────────────────────────────

/** GET /community/admin?status=pending|approved|hidden|reported (default pending) */
exports.adminList = async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const query = { isActive: true };
        if (status === 'reported') { query['community.reportCount'] = { $gt: 0 }; query['community.status'] = { $in: ['approved', 'pending'] }; }
        else if (['pending', 'approved', 'hidden'].includes(status)) query['community.status'] = status;
        else return bad(res, 'Invalid status');

        const rows = await WorkspaceTemplate.find(query)
            .select(PUBLIC_FIELDS + ' community.status community.reports community.reportCount community.moderationNote community.sourceWorkspaceId')
            .sort(status === 'reported' ? { 'community.reportCount': -1 } : { 'community.publishedAt': 1 })
            .limit(200).lean();
        await hydrate(rows, { 'community.publishedBy': userSelect('username email'), 'community.reports.userId': userSelect('username') });
        const counts = await WorkspaceTemplate.aggregate([
            { $match: { isActive: true, 'community.status': { $in: ['pending', 'approved', 'hidden'] } } },
            { $group: { _id: '$community.status', n: { $sum: 1 } } },
        ]);
        const reported = await WorkspaceTemplate.countDocuments({ isActive: true, 'community.reportCount': { $gt: 0 }, 'community.status': { $in: ['approved', 'pending'] } });
        res.json({
            templates: rows.map((t) => ({
                ...toCard(t),
                status: t.community?.status,
                reportCount: t.community?.reportCount || 0,
                reports: (t.community?.reports || []).map((r) => ({ reason: r.reason, at: r.at, by: r.userId?.username || null })),
                moderationNote: t.community?.moderationNote || null,
            })),
            counts: { ...Object.fromEntries(counts.map((c) => [c._id, c.n])), reported },
        });
    } catch (err) {
        return handleError(res, err, 'ADMIN LIST COMMUNITY TEMPLATES ERROR');
    }
};

/** POST /community/admin/:id/moderate { action: 'approve'|'hide'|'dismiss_reports', note? } */
exports.moderate = async (req, res) => {
    try {
        const { action } = req.body || {};
        const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
        if (!['approve', 'hide', 'dismiss_reports'].includes(action)) return bad(res, "action must be 'approve', 'hide' or 'dismiss_reports'");
        const t = await loadCommunity(req, res);
        if (!t) return;
        if (action === 'approve') { t.community.status = 'approved'; t.isPublic = true; }
        if (action === 'hide') {
            if (!note) return bad(res, 'Give a reason when hiding a template');
            t.community.status = 'hidden'; t.isPublic = false;
        }
        if (action === 'dismiss_reports' || action === 'approve') { t.community.reports = []; t.community.reportCount = 0; }
        t.community.moderatedBy = req.user.sub;
        t.community.moderatedAt = new Date();
        if (note) t.community.moderationNote = note;
        await t.save();
        res.json({ message: 'Done', status: t.community.status, isPublic: t.isPublic });
    } catch (err) {
        return handleError(res, err, 'MODERATE COMMUNITY TEMPLATE ERROR');
    }
};

exports.toCard = toCard;
