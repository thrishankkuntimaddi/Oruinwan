'use strict';

/**
 * Design reviews on file-library files (images, PDFs, videos).
 *
 * Access (every rule also requires active membership of the file's workspace):
 *   see a review / its annotations   any member
 *   create a review                  any member who can see the file
 *   add annotations / replies        any member
 *   resolve / reopen an annotation   its author, the review creator or a reviewer
 *   edit / delete an annotation      its author (delete also: review creator)
 *   decide (approve / request changes)  reviewers only
 *   edit, new round, delete review   review creator or a workspace owner/admin
 *
 * Status: any reviewer at 'changes_requested' -> 'changes_requested'; every
 * reviewer 'approved' -> 'approved'; otherwise 'open'.
 *
 * Realtime: every change is emitted to the room `design-review:<reviewId>`
 * (joined with the `design-review:join` socket event, see designReview.socket.js).
 */

const mongoose = require('mongoose');
const DesignReview = require('./DesignReview');
const { REVIEW_STATUSES, DECISIONS } = DesignReview;
const Annotation = require('./Annotation');
const WorkspaceFile = require('../files/WorkspaceFile');
const FileVersion = require('../files/FileVersion');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');
const logger = require('../../../utils/logger');

const PERSON = { type: 'user', fields: ['username', 'profilePicture'] };
const MAX_REVIEWERS = 50;
const NOTIFY_TYPE = 'design_review';

const fail = (statusCode, message, extra) => Object.assign(new Error(message), { statusCode }, extra || {});
const idStr = (v) => String(v?._id || v || '');
const isId = (v) => v != null && /^[a-f0-9]{24}$/i.test(String(v)) && mongoose.isValidObjectId(String(v));
const roomOf = (reviewId) => `design-review:${reviewId}`;
const notifier = () => require('../../modules/notifications/notificationService');

/** 'image' | 'pdf' | 'video' | null */
function reviewKind(mimeType = '') {
    const m = String(mimeType).toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m === 'application/pdf') return 'pdf';
    if (m.startsWith('video/')) return 'video';
    return null;
}

async function membership(workspaceId, userId) {
    const m = await identity.workspaces.membership(idStr(workspaceId), userId);
    return m && m.member ? m : null;
}

/** File the user may see (member of its workspace). Other workspaces answer 404. */
async function loadFile(fileId, userId) {
    if (!isId(fileId)) throw fail(404, 'File not found');
    const file = await WorkspaceFile.findById(fileId).lean();
    if (!file || file.isDeleted) throw fail(404, 'File not found');
    const access = await membership(file.workspaceId, userId);
    if (!access) throw fail(404, 'File not found');
    return { file, access };
}

/**
 * The source of one version of a file:
 * { versionNumber, fileVersionId, url, mimeType, size, createdAt, current }.
 */
async function resolveVersion(file, versionNumber) {
    const n = Number(versionNumber);
    if (!Number.isInteger(n) || n < 1) throw fail(400, 'versionNumber must be a positive integer');
    if (n === Number(file.currentVersion || 1)) {
        return { versionNumber: n, fileVersionId: null, url: file.url, mimeType: file.mimeType, size: file.size, createdAt: file.updatedAt || file.createdAt || null, current: true };
    }
    const v = await FileVersion.findOne({ fileId: file._id, versionNumber: n }).lean();
    if (!v) throw fail(404, `Version ${n} of this file was not found`);
    return { versionNumber: n, fileVersionId: idStr(v._id), url: v.url, mimeType: v.mimeType, size: v.size, createdAt: v.createdAt || null, current: false };
}

function computeStatus(reviewers) {
    if (!reviewers.length) return 'open';
    if (reviewers.some((r) => r.decision === 'changes_requested')) return 'changes_requested';
    if (reviewers.every((r) => r.decision === 'approved')) return 'approved';
    return 'open';
}

function isReviewer(review, userId) {
    return (review.reviewers || []).some((r) => idStr(r.user) === String(userId));
}

function canManage(review, userId, access) {
    return idStr(review.createdBy) === String(userId) || !!access?.isAdmin;
}

async function validateReviewers(workspaceId, ids) {
    if (!Array.isArray(ids)) throw fail(400, 'reviewers must be an array of user ids');
    const unique = [...new Set(ids.map((r) => idStr(r?.user || r)))];
    if (unique.length > MAX_REVIEWERS) throw fail(400, `At most ${MAX_REVIEWERS} reviewers`);
    if (unique.some((id) => !isId(id))) throw fail(400, 'Invalid reviewer id(s)');
    const ws = await identity.workspaces.findById(idStr(workspaceId));
    const active = new Set((ws?.members || []).filter((m) => (m.status || 'active') === 'active').map((m) => idStr(m.user)));
    const outsiders = unique.filter((id) => !active.has(id));
    if (outsiders.length) throw fail(400, 'Reviewers must be active members of this workspace', { errors: outsiders });
    return unique;
}

function parseDue(v) {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw fail(400, 'dueDate must be a valid date');
    return d;
}

function cleanText(v, field, { required = false, max = 5000 } = {}) {
    if (v === undefined && !required) return undefined;
    if (typeof v !== 'string' || (required && !v.trim())) throw fail(400, `${field} is required`);
    if (v.length > max) throw fail(400, `${field} is too long (${max} max)`);
    return required ? v.trim() : v;
}

async function loadReview(reviewId, userId) {
    if (!isId(reviewId)) throw fail(404, 'Review not found');
    const review = await DesignReview.findById(reviewId);
    if (!review || review.deleted) throw fail(404, 'Review not found');
    const access = await membership(review.workspaceId, userId);
    if (!access) throw fail(404, 'Review not found');
    return { review, access };
}

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

async function present(review) {
    const out = plain(review);
    await hydrate(out, { createdBy: PERSON, 'reviewers.user': PERSON });
    return out;
}

async function presentAnnotations(list) {
    const out = list.map(plain);
    await hydrate(out, { authorId: PERSON, resolvedBy: PERSON, 'replies.authorId': PERSON });
    return out;
}

function emit(io, reviewId, event, payload) {
    if (io) io.to(roomOf(reviewId)).emit(event, { reviewId: String(reviewId), ...payload });
}

function link(review) {
    return `/workspace/${idStr(review.workspaceId)}/files?file=${idStr(review.fileId)}&review=${idStr(review._id)}`;
}

/** Fire-and-forget notification; never fails the request. */
function notify(io, recipients, review, { title, body, kind, extra = {} }) {
    const list = [...new Set(recipients.map(String))];
    if (!list.length) return;
    notifier().createMany(io, list, {
        workspaceId: idStr(review.workspaceId),
        type: NOTIFY_TYPE,
        title,
        body,
        link: link(review),
        meta: { kind, reviewId: idStr(review._id), fileId: idStr(review.fileId), ...extra },
    }).catch((err) => logger.warn(`[design-review] notification failed: ${err.message}`));
}

async function usernameOf(userId) {
    try {
        const u = await identity.users.findById(userId);
        return u?.username || 'Someone';
    } catch {
        return 'Someone';
    }
}

// ── Reviews ───────────────────────────────────────────────────────────────────

async function createReview(userId, body = {}, io) {
    const { file } = await loadFile(body.fileId, userId);
    const kind = reviewKind(file.mimeType);
    if (!kind) throw fail(400, 'Only images, PDFs and videos can be reviewed');
    const version = await resolveVersion(file, body.versionNumber ?? file.currentVersion ?? 1);
    const title = cleanText(body.title ?? file.name, 'title', { required: true, max: 200 });
    const reviewerIds = (await validateReviewers(file.workspaceId, body.reviewers || [])).filter((id) => id !== String(userId));
    const review = await DesignReview.create({
        workspaceId: idStr(file.workspaceId),
        fileId: idStr(file._id),
        fileVersionId: version.fileVersionId,
        versionNumber: version.versionNumber,
        rounds: [{ versionNumber: version.versionNumber, startedAt: new Date() }],
        title,
        description: cleanText(body.description, 'description') || '',
        createdBy: String(userId),
        reviewers: reviewerIds.map((user) => ({ user, decision: 'pending' })),
        status: 'open',
        dueDate: parseDue(body.dueDate) ?? null,
    });
    const name = await usernameOf(userId);
    notify(io, reviewerIds, review, { title: `${name} asked you to review a design`, body: review.title, kind: 'review_requested' });
    if (io) io.to(`workspace:${idStr(review.workspaceId)}`).emit('design-review:created', { reviewId: idStr(review._id), fileId: idStr(review.fileId) });
    return { review: await present(review) };
}

/**
 * List reviews. filters: { workspaceId } (required unless fileId), fileId,
 * status, mine=true (I am a reviewer or creator).
 */
async function listReviews(userId, filters = {}) {
    const q = { deleted: false };
    if (filters.fileId) {
        const { file } = await loadFile(filters.fileId, userId);
        q.fileId = idStr(file._id);
        q.workspaceId = idStr(file.workspaceId);
    } else {
        if (!isId(filters.workspaceId)) throw fail(400, 'workspaceId or fileId is required');
        if (!(await membership(filters.workspaceId, userId))) throw fail(403, 'You are not a member of this workspace');
        q.workspaceId = String(filters.workspaceId);
    }
    if (filters.status) {
        if (!REVIEW_STATUSES.includes(filters.status)) throw fail(400, 'Invalid status');
        q.status = filters.status;
    }
    if (filters.mine === 'true' || filters.mine === true) {
        q.$or = [{ createdBy: String(userId) }, { 'reviewers.user': String(userId) }];
    }
    const reviews = await DesignReview.find(q).sort({ updatedAt: -1 }).limit(200).lean();
    const ids = reviews.map((r) => idStr(r._id));
    const counts = ids.length ? await Annotation.aggregate([
        { $match: { reviewId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, deleted: false } },
        { $group: { _id: '$reviewId', total: { $sum: 1 }, open: { $sum: { $cond: ['$resolved', 0, 1] } } } },
    ]) : [];
    const byId = new Map(counts.map((c) => [idStr(c._id), { total: c.total, open: c.open }]));
    for (const r of reviews) r.annotationCounts = byId.get(idStr(r._id)) || { total: 0, open: 0 };
    await hydrate(reviews, { createdBy: PERSON, 'reviewers.user': PERSON });
    return { reviews };
}

async function getReview(userId, reviewId) {
    const { review, access } = await loadReview(reviewId, userId);
    const file = await WorkspaceFile.findById(review.fileId).lean();
    if (!file || file.isDeleted) throw fail(404, 'File not found');
    const version = await resolveVersion(file, review.versionNumber).catch(() => null);
    const annotations = await Annotation.find({ reviewId: idStr(review._id), deleted: false }).sort({ createdAt: 1 }).lean();
    const out = await present(review);
    out.file = { _id: idStr(file._id), name: file.name, mimeType: file.mimeType, currentVersion: file.currentVersion, kind: reviewKind(file.mimeType) };
    out.version = version;
    out.permissions = {
        canManage: canManage(review, userId, access),
        canDecide: isReviewer(review, userId),
    };
    return { review: out, annotations: await presentAnnotations(annotations) };
}

async function updateReview(userId, reviewId, body = {}, io) {
    const { review, access } = await loadReview(reviewId, userId);
    if (!canManage(review, userId, access)) throw fail(403, 'Only the review creator or a workspace admin can change it');
    const title = cleanText(body.title, 'title', { required: body.title !== undefined, max: 200 });
    if (title !== undefined) review.title = title;
    const description = cleanText(body.description, 'description');
    if (description !== undefined) review.description = description;
    const due = parseDue(body.dueDate);
    if (due !== undefined) review.dueDate = due;
    let added = [];
    if (body.reviewers !== undefined) {
        const ids = (await validateReviewers(review.workspaceId, body.reviewers)).filter((id) => id !== idStr(review.createdBy));
        const existing = new Map((review.reviewers || []).map((r) => [idStr(r.user), r]));
        added = ids.filter((id) => !existing.has(id));
        review.reviewers = ids.map((id) => existing.get(id) || { user: id, decision: 'pending' });
        review.status = computeStatus(review.reviewers);
    }
    await review.save();
    if (added.length) {
        const name = await usernameOf(userId);
        notify(io, added, review, { title: `${name} asked you to review a design`, body: review.title, kind: 'review_requested' });
    }
    const out = await present(review);
    emit(io, review._id, 'design-review:updated', { review: out });
    return { review: out };
}

/** Reviewer decision. Body: { decision: 'approved' | 'changes_requested' | 'pending', note? } */
async function decide(userId, reviewId, body = {}, io) {
    const { review } = await loadReview(reviewId, userId);
    const decision = body.decision;
    if (!DECISIONS.includes(decision)) throw fail(400, `decision must be one of ${DECISIONS.join(', ')}`);
    const reviewer = (review.reviewers || []).find((r) => idStr(r.user) === String(userId));
    if (!reviewer) throw fail(403, 'Only reviewers can approve or request changes');
    reviewer.decision = decision;
    reviewer.note = cleanText(body.note, 'note', { max: 2000 }) || '';
    reviewer.decidedAt = decision === 'pending' ? null : new Date();
    const before = review.status;
    review.status = computeStatus(review.reviewers);
    if (typeof review.markModified === 'function') review.markModified('reviewers');
    await review.save();
    if (decision !== 'pending' && idStr(review.createdBy) !== String(userId)) {
        const name = await usernameOf(userId);
        notify(io, [idStr(review.createdBy)], review, {
            title: decision === 'approved' ? `${name} approved your design` : `${name} requested changes`,
            body: reviewer.note || review.title,
            kind: decision,
            extra: { status: review.status, previousStatus: before },
        });
    }
    const out = await present(review);
    emit(io, review._id, 'design-review:updated', { review: out });
    return { review: out };
}

/**
 * Start a new round on another version (usually after uploading a new file
 * version): decisions reset to pending, status back to open. Body: { versionNumber? } (default current).
 */
async function newRound(userId, reviewId, body = {}, io) {
    const { review, access } = await loadReview(reviewId, userId);
    if (!canManage(review, userId, access)) throw fail(403, 'Only the review creator or a workspace admin can start a new round');
    const file = await WorkspaceFile.findById(review.fileId).lean();
    if (!file || file.isDeleted) throw fail(404, 'File not found');
    const version = await resolveVersion(file, body.versionNumber ?? file.currentVersion ?? 1);
    review.versionNumber = version.versionNumber;
    review.fileVersionId = version.fileVersionId;
    review.rounds = [...(review.rounds || []), { versionNumber: version.versionNumber, startedAt: new Date() }];
    review.reviewers = (review.reviewers || []).map((r) => ({ user: r.user, decision: 'pending', note: '', decidedAt: null }));
    review.status = 'open';
    await review.save();
    const name = await usernameOf(userId);
    notify(io, review.reviewers.map((r) => idStr(r.user)), review, {
        title: `${name} uploaded version ${version.versionNumber} for review`, body: review.title, kind: 'new_round',
        extra: { versionNumber: version.versionNumber },
    });
    const out = await present(review);
    emit(io, review._id, 'design-review:updated', { review: out });
    return { review: out };
}

async function deleteReview(userId, reviewId, io) {
    const { review, access } = await loadReview(reviewId, userId);
    if (!canManage(review, userId, access)) throw fail(403, 'Only the review creator or a workspace admin can delete it');
    review.deleted = true;
    await review.save();
    emit(io, review._id, 'design-review:deleted', {});
    return { message: 'Review deleted' };
}

// ── Annotations ───────────────────────────────────────────────────────────────

function num(v, field, { min = 0, max = 1, integer = false } = {}) {
    const n = Number(v);
    if (v === null || v === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
        throw fail(400, `${field} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`);
    }
    return n;
}

function cleanGeometry(body, kind) {
    const g = {
        x: num(body.x, 'x'),
        y: num(body.y, 'y'),
        w: body.w === undefined ? 0 : num(body.w, 'w'),
        h: body.h === undefined ? 0 : num(body.h, 'h'),
    };
    if (g.x + g.w > 1.000001 || g.y + g.h > 1.000001) throw fail(400, 'The box must stay inside the page (x + w <= 1, y + h <= 1)');
    g.page = body.page === undefined || body.page === null ? 1 : num(body.page, 'page', { min: 1, max: 100000, integer: true });
    if (kind !== 'pdf' && g.page !== 1) throw fail(400, 'page applies to PDFs only');
    if (body.timeMs !== undefined && body.timeMs !== null) {
        if (kind !== 'video') throw fail(400, 'timeMs applies to videos only');
        g.timeMs = num(body.timeMs, 'timeMs', { min: 0, max: 24 * 3600 * 1000, integer: true });
    } else {
        g.timeMs = null;
    }
    return g;
}

async function loadAnnotation(reviewId, annotationId, userId) {
    const { review, access } = await loadReview(reviewId, userId);
    if (!isId(annotationId)) throw fail(404, 'Annotation not found');
    const annotation = await Annotation.findById(annotationId);
    if (!annotation || annotation.deleted || idStr(annotation.reviewId) !== idStr(review._id)) throw fail(404, 'Annotation not found');
    return { review, access, annotation };
}

/** GET annotations of a review; ?versionNumber= narrows to one version. */
async function listAnnotations(userId, reviewId, filters = {}) {
    const { review } = await loadReview(reviewId, userId);
    const q = { reviewId: idStr(review._id), deleted: false };
    if (filters.versionNumber !== undefined) q.versionNumber = num(filters.versionNumber, 'versionNumber', { min: 1, max: 1e6, integer: true });
    if (filters.resolved === 'true' || filters.resolved === 'false') q.resolved = filters.resolved === 'true';
    const list = await Annotation.find(q).sort({ createdAt: 1 }).lean();
    return { annotations: await presentAnnotations(list) };
}

async function addAnnotation(userId, reviewId, body = {}, io) {
    const { review } = await loadReview(reviewId, userId);
    const file = await WorkspaceFile.findById(review.fileId).lean();
    if (!file || file.isDeleted) throw fail(404, 'File not found');
    const kind = reviewKind(file.mimeType);
    const version = await resolveVersion(file, body.versionNumber ?? review.versionNumber);
    const geometry = cleanGeometry(body, reviewKind(version.mimeType) || kind);
    const annotation = await Annotation.create({
        reviewId: idStr(review._id),
        workspaceId: idStr(review.workspaceId),
        fileId: idStr(review.fileId),
        fileVersionId: version.fileVersionId,
        versionNumber: version.versionNumber,
        ...geometry,
        authorId: String(userId),
        body: cleanText(body.body, 'body', { required: true }),
    });
    const [out] = await presentAnnotations([annotation]);
    emit(io, review._id, 'design-review:annotation', { action: 'created', annotation: out });
    const recipients = [idStr(review.createdBy), ...(review.reviewers || []).map((r) => idStr(r.user))].filter((id) => id !== String(userId));
    const name = await usernameOf(userId);
    notify(io, recipients, review, { title: `${name} commented on ${review.title}`, body: annotation.body.slice(0, 200), kind: 'annotation', extra: { annotationId: idStr(annotation._id) } });
    return { annotation: out };
}

/** Edit own annotation: body and/or geometry. */
async function updateAnnotation(userId, reviewId, annotationId, body = {}, io) {
    const { review, annotation } = await loadAnnotation(reviewId, annotationId, userId);
    if (idStr(annotation.authorId) !== String(userId)) throw fail(403, 'Only the author can edit this comment');
    if (body.body !== undefined) annotation.body = cleanText(body.body, 'body', { required: true });
    if (['x', 'y', 'w', 'h', 'page', 'timeMs'].some((k) => body[k] !== undefined)) {
        const file = await WorkspaceFile.findById(review.fileId).lean();
        const g = cleanGeometry({
            x: annotation.x, y: annotation.y, w: annotation.w, h: annotation.h, page: annotation.page, timeMs: annotation.timeMs, ...body,
        }, reviewKind(file?.mimeType));
        Object.assign(annotation, g);
    }
    await annotation.save();
    const [out] = await presentAnnotations([annotation]);
    emit(io, review._id, 'design-review:annotation', { action: 'updated', annotation: out });
    return { annotation: out };
}

/** Body: { resolved: boolean } (default true). */
async function resolveAnnotation(userId, reviewId, annotationId, body = {}, io) {
    const { review, annotation } = await loadAnnotation(reviewId, annotationId, userId);
    const allowed = idStr(annotation.authorId) === String(userId) || idStr(review.createdBy) === String(userId) || isReviewer(review, userId);
    if (!allowed) throw fail(403, 'Only the author, the review creator or a reviewer can resolve comments');
    const resolved = body.resolved === undefined ? true : body.resolved === true;
    annotation.resolved = resolved;
    annotation.resolvedBy = resolved ? String(userId) : null;
    annotation.resolvedAt = resolved ? new Date() : null;
    await annotation.save();
    const [out] = await presentAnnotations([annotation]);
    emit(io, review._id, 'design-review:annotation', { action: resolved ? 'resolved' : 'reopened', annotation: out });
    return { annotation: out };
}

async function replyToAnnotation(userId, reviewId, annotationId, body = {}, io) {
    const { review, annotation } = await loadAnnotation(reviewId, annotationId, userId);
    const text = cleanText(body.body, 'body', { required: true });
    annotation.replies.push({ authorId: String(userId), body: text });
    await annotation.save();
    const [out] = await presentAnnotations([annotation]);
    const reply = out.replies[out.replies.length - 1];
    emit(io, review._id, 'design-review:annotation', { action: 'reply', annotation: out, reply });
    const thread = [idStr(annotation.authorId), idStr(review.createdBy), ...(annotation.replies || []).map((r) => idStr(r.authorId))]
        .filter((id) => id !== String(userId));
    const name = await usernameOf(userId);
    notify(io, thread, review, { title: `${name} replied on ${review.title}`, body: text.slice(0, 200), kind: 'reply', extra: { annotationId: idStr(annotation._id) } });
    return { annotation: out, reply };
}

async function deleteAnnotation(userId, reviewId, annotationId, io) {
    const { review, access, annotation } = await loadAnnotation(reviewId, annotationId, userId);
    if (idStr(annotation.authorId) !== String(userId) && !canManage(review, userId, access)) {
        throw fail(403, 'Only the author or the review creator can delete this comment');
    }
    annotation.deleted = true;
    await annotation.save();
    emit(io, review._id, 'design-review:annotation', { action: 'deleted', annotation: { _id: idStr(annotation._id) } });
    return { message: 'Comment deleted' };
}

// ── Compare ───────────────────────────────────────────────────────────────────

/**
 * Two versions of a file side by side with their annotations.
 * query: { fileId, from, to, reviewId? } — reviewId narrows annotations to one review.
 */
async function compareVersions(userId, query = {}) {
    const { file } = await loadFile(query.fileId, userId);
    if (!reviewKind(file.mimeType)) throw fail(400, 'Only images, PDFs and videos can be compared');
    const current = Number(file.currentVersion || 1);
    const toN = query.to === undefined ? current : query.to;
    const fromN = query.from === undefined ? Math.max(1, Number(toN) - 1) : query.from;
    const [from, to] = await Promise.all([resolveVersion(file, fromN), resolveVersion(file, toN)]);
    const q = { fileId: idStr(file._id), deleted: false, versionNumber: { $in: [from.versionNumber, to.versionNumber] } };
    if (query.reviewId) {
        if (!isId(query.reviewId)) throw fail(400, 'Invalid reviewId');
        q.reviewId = String(query.reviewId);
    }
    const list = await presentAnnotations(await Annotation.find(q).sort({ createdAt: 1 }).lean());
    const pick = (n) => list.filter((a) => a.versionNumber === n);
    const summary = (arr) => ({ total: arr.length, open: arr.filter((a) => !a.resolved).length, resolved: arr.filter((a) => a.resolved).length });
    const fromAnn = pick(from.versionNumber);
    const toAnn = pick(to.versionNumber);
    return {
        file: { _id: idStr(file._id), name: file.name, mimeType: file.mimeType, kind: reviewKind(file.mimeType), currentVersion: current },
        from: { ...from, annotations: fromAnn, summary: summary(fromAnn) },
        to: { ...to, annotations: toAnn, summary: summary(toAnn) },
    };
}

module.exports = {
    roomOf, reviewKind, computeStatus, resolveVersion,
    createReview, listReviews, getReview, updateReview, decide, newRound, deleteReview,
    listAnnotations, addAnnotation, updateAnnotation, resolveAnnotation, replyToAnnotation, deleteAnnotation,
    compareVersions,
    loadReview,
};
