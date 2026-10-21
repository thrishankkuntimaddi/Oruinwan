'use strict';

/** HTTP wiring of /api/v2/roadmap, /api/v2/design-reviews and /api/milestones (services mocked). */

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => { req.user = { sub: 'u1' }; next(); });
jest.mock('../roadmap.service', () => ({
    ROADMAP_STATUSES: ['planned'], ROADMAP_COLORS: ['accent'],
    listItems: jest.fn(async () => ({ items: [] })),
    createItem: jest.fn(async (u, b) => ({ item: { _id: 'i1', workspaceId: b.workspaceId } })),
    getItem: jest.fn(async () => { throw Object.assign(new Error('Roadmap item not found'), { statusCode: 404 }); }),
    updateItem: jest.fn(async () => ({ item: { _id: 'i1', workspaceId: 'w1' } })),
    deleteItem: jest.fn(async () => ({ message: 'Roadmap item deleted', workspaceId: 'w1' })),
    reorder: jest.fn(async () => ({ order: ['i1'] })),
}));
jest.mock('../../design-review/designReview.service', () => ({
    listReviews: jest.fn(async () => ({ reviews: [] })),
    createReview: jest.fn(async () => ({ review: { _id: 'r1' } })),
    compareVersions: jest.fn(async () => ({ from: {}, to: {} })),
    getReview: jest.fn(async () => { throw new Error('boom'); }),
    decide: jest.fn(async () => ({ review: { status: 'approved' } })),
    addAnnotation: jest.fn(async () => ({ annotation: { _id: 'a1' } })),
    resolveAnnotation: jest.fn(async () => ({ annotation: { resolved: true } })),
    replyToAnnotation: jest.fn(async () => ({ annotation: {}, reply: {} })),
}));
jest.mock('../../milestones/milestones.service', () => ({
    linkTasks: jest.fn(async () => ({ linked: ['t1'] })),
    getProgress: jest.fn(async () => ({ progress: { percent: 50 } })),
}));

const roadmap = require('../roadmap.service');
const reviews = require('../../design-review/designReview.service');
const milestones = require('../../milestones/milestones.service');

const emitted = [];
function call(method, path, body) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.io = { to: (room) => ({ emit: (e, p) => emitted.push({ room, e, p }) }) }; next(); });
    app.use('/api/v2/roadmap', require('../roadmap.routes'));
    app.use('/api/v2/design-reviews', require('../../design-review/designReview.routes'));
    app.use('/api/milestones', require('../../milestones/milestones.routes'));
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = body ? JSON.stringify(body) : null;
            const req = http.request({ port: server.address().port, path, method, headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } }, (res) => {
                let text = '';
                res.on('data', (c) => { text += c; });
                res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); });
            });
            req.on('error', (e) => { server.close(); reject(e); });
            if (data) req.write(data);
            req.end();
        });
    });
}

test('roadmap routes', async () => {
    expect((await call('GET', '/api/v2/roadmap')).status).toBe(400);
    expect((await call('GET', '/api/v2/roadmap?workspaceId=w1&quarter=2026-Q4')).status).toBe(200);
    expect(roadmap.listItems).toHaveBeenCalledWith('u1', 'w1', { quarter: '2026-Q4', status: undefined });
    const created = await call('POST', '/api/v2/roadmap', { workspaceId: 'w1', title: 'X' });
    expect(created.status).toBe(201);
    expect(emitted.pop()).toMatchObject({ room: 'workspace:w1', e: 'roadmap:updated', p: { action: 'created' } });
    expect((await call('GET', '/api/v2/roadmap/i9')).status).toBe(404);
    expect((await call('PATCH', '/api/v2/roadmap/i1', { status: 'done' })).status).toBe(200);
    expect((await call('POST', '/api/v2/roadmap/reorder', { workspaceId: 'w1', order: ['i1'] })).body).toEqual({ order: ['i1'] });
    expect((await call('GET', '/api/v2/roadmap/meta')).body).toEqual({ statuses: ['planned'], colors: ['accent'] });
});

test('design review routes', async () => {
    expect((await call('POST', '/api/v2/design-reviews', { fileId: 'f1' })).status).toBe(201);
    expect((await call('GET', '/api/v2/design-reviews/compare?fileId=f1&from=1&to=2')).status).toBe(200);
    expect(reviews.compareVersions).toHaveBeenCalledWith('u1', { fileId: 'f1', from: '1', to: '2' });
    const err = await call('GET', '/api/v2/design-reviews/r1');
    expect(err).toEqual({ status: 500, body: { message: 'Internal server error' } });
    expect((await call('POST', '/api/v2/design-reviews/r1/decision', { decision: 'approved' })).body.review.status).toBe('approved');
    expect((await call('POST', '/api/v2/design-reviews/r1/annotations', { x: 0, y: 0, body: 'b' })).status).toBe(201);
    expect((await call('POST', '/api/v2/design-reviews/r1/annotations/a1/resolve', {})).status).toBe(200);
    expect((await call('POST', '/api/v2/design-reviews/r1/annotations/a1/replies', { body: 'ok' })).status).toBe(201);
});

test('milestone task-link routes', async () => {
    expect((await call('POST', '/api/milestones/m1/tasks', { taskIds: ['t1'] })).body).toEqual({ linked: ['t1'] });
    expect(milestones.linkTasks).toHaveBeenCalledWith('u1', 'm1', ['t1']);
    expect((await call('GET', '/api/milestones/m1/progress')).body.progress.percent).toBe(50);
});
