'use strict';

const fake = (defaults, extra = {}) => Object.assign(require('../../roadmap/__tests__/fakeModel').makeFakeModel(defaults), extra);

jest.mock('../DesignReview', () => fake({ description: '', status: 'open', reviewers: [], rounds: [], deleted: false, dueDate: null, fileVersionId: null },
    { REVIEW_STATUSES: ['open', 'changes_requested', 'approved'], DECISIONS: ['pending', 'approved', 'changes_requested'] }));
jest.mock('../Annotation', () => fake({ page: 1, w: 0, h: 0, timeMs: null, resolved: false, resolvedBy: null, resolvedAt: null, replies: [], deleted: false }));
jest.mock('../../files/WorkspaceFile', () => fake({ isDeleted: false, currentVersion: 1 }));
jest.mock('../../files/FileVersion', () => fake({}));
jest.mock('../../../modules/notifications/notificationService', () => ({ createMany: jest.fn().mockResolvedValue([]) }));

const mongoose = require('mongoose');
const identity = require('../../../identity');
const DesignReview = require('../DesignReview');
const Annotation = require('../Annotation');
const WorkspaceFile = require('../../files/WorkspaceFile');
const FileVersion = require('../../files/FileVersion');
const notificationService = require('../../../modules/notifications/notificationService');
const service = require('../designReview.service');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const OWNER = oid();   // designer, creates reviews
const R1 = oid();      // reviewer
const R2 = oid();      // reviewer
const MEMBER = oid();  // workspace member, not a reviewer
const ADMIN = oid();
const OUTSIDER = oid();

const roles = { [OWNER]: 'member', [R1]: 'member', [R2]: 'member', [MEMBER]: 'member', [ADMIN]: 'admin' };

function makeIo() {
    const emitted = [];
    return {
        emitted,
        to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
    };
}

let IMG, PDF, VID, DOC;
beforeEach(() => {
    jest.restoreAllMocks();
    [DesignReview, Annotation, WorkspaceFile, FileVersion].forEach((m) => m.reset());
    notificationService.createMany.mockClear();
    jest.spyOn(identity.workspaces, 'membership').mockImplementation(async (ws, uid) => {
        if (String(ws) !== WS) return null;
        const role = roles[String(uid)];
        return { workspace: { _id: WS }, member: role ? { role } : null, role: role || null, isAdmin: role === 'admin' || role === 'owner' };
    });
    jest.spyOn(identity.workspaces, 'findById').mockImplementation(async (id) => (String(id) === WS
        ? { _id: WS, members: Object.entries(roles).map(([user, role]) => ({ user, role, status: 'active' })) }
        : null));
    jest.spyOn(identity.users, 'findById').mockImplementation(async (id) => ({ _id: id, username: `u${String(id).slice(-3)}` }));
    jest.spyOn(identity.users, 'findManyByIds').mockImplementation(async (ids) => new Map(ids.map((id) => [String(id), { _id: String(id), username: 'x' }])));

    IMG = WorkspaceFile._insert({ workspaceId: WS, createdBy: OWNER, name: 'home.png', mimeType: 'image/png', url: '/u/home-v2.png', currentVersion: 2 });
    FileVersion._insert({ fileId: IMG._id, versionNumber: 1, url: '/u/home-v1.png', mimeType: 'image/png', size: 10, createdBy: OWNER });
    PDF = WorkspaceFile._insert({ workspaceId: WS, createdBy: OWNER, name: 'spec.pdf', mimeType: 'application/pdf', url: '/u/spec.pdf' });
    VID = WorkspaceFile._insert({ workspaceId: WS, createdBy: OWNER, name: 'flow.mp4', mimeType: 'video/mp4', url: '/u/flow.mp4' });
    DOC = WorkspaceFile._insert({ workspaceId: WS, createdBy: OWNER, name: 'a.zip', mimeType: 'application/zip', url: '/u/a.zip' });
});

const create = (body = {}, io) => service.createReview(OWNER, { fileId: IMG._id, title: 'Home', reviewers: [R1, R2], ...body }, io);

describe('reviews', () => {
    test('create: current version by default, reviewers notified, bad input rejected', async () => {
        const io = makeIo();
        const { review } = await create({}, io);
        expect(review).toMatchObject({ versionNumber: 2, fileVersionId: null, status: 'open', title: 'Home' });
        expect(review.reviewers.map((r) => r.decision)).toEqual(['pending', 'pending']);
        expect(notificationService.createMany).toHaveBeenCalledWith(io, [R1, R2], expect.objectContaining({ type: 'design_review', workspaceId: WS }));
        expect(io.emitted.find((e) => e.event === 'design-review:created').room).toBe(`workspace:${WS}`);

        const old = await create({ versionNumber: 1 });
        expect(old.review.versionNumber).toBe(1);
        expect(old.review.fileVersionId).toBeTruthy();

        await expect(create({ versionNumber: 9 })).rejects.toMatchObject({ statusCode: 404 });
        await expect(create({ reviewers: [OUTSIDER] })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createReview(OWNER, { fileId: DOC._id, reviewers: [] })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.createReview(OUTSIDER, { fileId: IMG._id })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('decisions drive the status; only reviewers decide; creator notified', async () => {
        const { review } = await create();
        await expect(service.decide(MEMBER, review._id, { decision: 'approved' })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.decide(R1, review._id, { decision: 'maybe' })).rejects.toMatchObject({ statusCode: 400 });
        expect((await service.decide(R1, review._id, { decision: 'approved' })).review.status).toBe('open');
        expect((await service.decide(R2, review._id, { decision: 'changes_requested', note: 'Bigger logo' })).review.status).toBe('changes_requested');
        expect(notificationService.createMany).toHaveBeenLastCalledWith(undefined, [OWNER], expect.objectContaining({ meta: expect.objectContaining({ kind: 'changes_requested' }) }));
        expect((await service.decide(R2, review._id, { decision: 'approved' })).review.status).toBe('approved');
    });

    test('a new round moves to the latest version and resets decisions', async () => {
        const { review } = await create({ versionNumber: 1 });
        await service.decide(R1, review._id, { decision: 'approved' });
        await expect(service.newRound(R1, review._id, {})).rejects.toMatchObject({ statusCode: 403 });
        const out = await service.newRound(OWNER, review._id, {});
        expect(out.review.versionNumber).toBe(2);
        expect(out.review.rounds.map((r) => r.versionNumber)).toEqual([1, 2]);
        expect(out.review.reviewers.every((r) => r.decision === 'pending')).toBe(true);
    });

    test('list by file and workspace with annotation counts; mine filter', async () => {
        const a = (await create()).review;
        await service.createReview(OWNER, { fileId: PDF._id, reviewers: [R2] });
        await service.addAnnotation(R1, a._id, { x: 0.1, y: 0.1, body: 'hi' });
        const byFile = await service.listReviews(MEMBER, { fileId: IMG._id });
        expect(byFile.reviews).toHaveLength(1);
        expect(byFile.reviews[0].annotationCounts).toEqual({ total: 1, open: 1 });
        expect((await service.listReviews(MEMBER, { workspaceId: WS })).reviews).toHaveLength(2);
        expect((await service.listReviews(R1, { workspaceId: WS, mine: 'true' })).reviews).toHaveLength(1);
        await expect(service.listReviews(OUTSIDER, { workspaceId: WS })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.listReviews(MEMBER, {})).rejects.toMatchObject({ statusCode: 400 });
    });

    test('update and delete are for the creator or an admin', async () => {
        const { review } = await create();
        await expect(service.updateReview(R1, review._id, { title: 'x' })).rejects.toMatchObject({ statusCode: 403 });
        const out = await service.updateReview(OWNER, review._id, { reviewers: [R1, MEMBER] });
        expect(out.review.reviewers.map((r) => String(r.user._id))).toEqual([R1, MEMBER]);
        await expect(service.deleteReview(MEMBER, review._id)).rejects.toMatchObject({ statusCode: 403 });
        await service.deleteReview(ADMIN, review._id);
        await expect(service.getReview(OWNER, review._id)).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('annotations', () => {
    test('geometry is validated per media kind', async () => {
        const img = (await create()).review;
        await expect(service.addAnnotation(R1, img._id, { x: 1.2, y: 0, body: 'x' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.addAnnotation(R1, img._id, { x: 0.8, y: 0, w: 0.5, h: 0.1, body: 'x' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.addAnnotation(R1, img._id, { x: 0.1, y: 0.1, page: 2, body: 'x' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.addAnnotation(R1, img._id, { x: 0.1, y: 0.1, timeMs: 5, body: 'x' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.addAnnotation(R1, img._id, { x: 0.1, y: 0.1, body: '  ' })).rejects.toMatchObject({ statusCode: 400 });

        const pdf = (await service.createReview(OWNER, { fileId: PDF._id, reviewers: [R1] })).review;
        const p = await service.addAnnotation(R1, pdf._id, { x: 0.5, y: 0.5, w: 0.2, h: 0.2, page: 3, body: 'typo' });
        expect(p.annotation).toMatchObject({ page: 3, w: 0.2, versionNumber: 1 });

        const vid = (await service.createReview(OWNER, { fileId: VID._id, reviewers: [R1] })).review;
        const v = await service.addAnnotation(R1, vid._id, { x: 0.5, y: 0.5, timeMs: 12500, body: 'jump cut' });
        expect(v.annotation.timeMs).toBe(12500);
    });

    test('create, reply, resolve and delete emit to the review room and notify', async () => {
        const io = makeIo();
        const { review } = await create();
        const { annotation } = await service.addAnnotation(R1, review._id, { x: 0.2, y: 0.3, body: 'Align this' }, io);
        expect(io.emitted.pop()).toMatchObject({ room: `design-review:${review._id}`, event: 'design-review:annotation', payload: { action: 'created' } });
        expect(notificationService.createMany).toHaveBeenLastCalledWith(io, [OWNER, R2], expect.objectContaining({ meta: expect.objectContaining({ kind: 'annotation' }) }));

        const r = await service.replyToAnnotation(OWNER, review._id, annotation._id, { body: 'Done' }, io);
        expect(r.annotation.replies).toHaveLength(1);
        expect(io.emitted.pop().payload.action).toBe('reply');
        expect(notificationService.createMany).toHaveBeenLastCalledWith(io, [R1], expect.anything());

        await expect(service.resolveAnnotation(MEMBER, review._id, annotation._id, {})).rejects.toMatchObject({ statusCode: 403 });
        const res = await service.resolveAnnotation(OWNER, review._id, annotation._id, {}, io);
        expect(res.annotation.resolved).toBe(true);
        expect(io.emitted.pop().payload.action).toBe('resolved');
        const reopened = await service.resolveAnnotation(R2, review._id, annotation._id, { resolved: false }, io);
        expect(reopened.annotation.resolved).toBe(false);

        await expect(service.updateAnnotation(OWNER, review._id, annotation._id, { body: 'x' })).rejects.toMatchObject({ statusCode: 403 });
        const ed = await service.updateAnnotation(R1, review._id, annotation._id, { body: 'Align left', x: 0.25 });
        expect(ed.annotation).toMatchObject({ body: 'Align left', x: 0.25, y: 0.3 });

        await expect(service.deleteAnnotation(MEMBER, review._id, annotation._id)).rejects.toMatchObject({ statusCode: 403 });
        await service.deleteAnnotation(OWNER, review._id, annotation._id, io);
        expect(io.emitted.pop().payload.action).toBe('deleted');
        expect((await service.listAnnotations(MEMBER, review._id)).annotations).toHaveLength(0);
    });

    test('an annotation from another review is not found', async () => {
        const a = (await create()).review;
        const b = (await create()).review;
        const { annotation } = await service.addAnnotation(R1, a._id, { x: 0.1, y: 0.1, body: 'x' });
        await expect(service.resolveAnnotation(OWNER, b._id, annotation._id, {})).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('compare versions', () => {
    test('returns both sources with their annotations', async () => {
        const { review } = await create({ versionNumber: 1 });
        await service.addAnnotation(R1, review._id, { x: 0.1, y: 0.1, body: 'old issue' });
        await service.newRound(OWNER, review._id, {});
        const { annotation } = await service.addAnnotation(R1, review._id, { x: 0.2, y: 0.2, body: 'new issue' });
        await service.resolveAnnotation(R1, review._id, annotation._id, {});

        const out = await service.compareVersions(MEMBER, { fileId: IMG._id });
        expect(out.from).toMatchObject({ versionNumber: 1, url: '/u/home-v1.png', current: false, summary: { total: 1, open: 1, resolved: 0 } });
        expect(out.to).toMatchObject({ versionNumber: 2, url: '/u/home-v2.png', current: true, summary: { total: 1, open: 0, resolved: 1 } });
        await expect(service.compareVersions(MEMBER, { fileId: IMG._id, from: 7 })).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.compareVersions(OUTSIDER, { fileId: IMG._id })).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.compareVersions(MEMBER, { fileId: DOC._id })).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('status rule', () => {
    test('computeStatus', () => {
        expect(service.computeStatus([])).toBe('open');
        expect(service.computeStatus([{ decision: 'approved' }, { decision: 'pending' }])).toBe('open');
        expect(service.computeStatus([{ decision: 'approved' }, { decision: 'changes_requested' }])).toBe('changes_requested');
        expect(service.computeStatus([{ decision: 'approved' }])).toBe('approved');
    });
});
