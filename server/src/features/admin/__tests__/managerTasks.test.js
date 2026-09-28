'use strict';

/**
 * Manager task endpoints (B3): department scoping, private-task exclusion and
 * workflow validation on status changes.
 */

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
    req.user = { sub: req.headers['x-user'] };
    next();
});
jest.mock('../../../shared/middleware/permissionMiddleware', () => ({
    requireManager: (req, res, next) => next(),
}));

const oid = (n) => n.toString(16).padStart(24, '0');
const MANAGER = oid(1);
const MEMBER = oid(2);      // in the managed department
const STRANGER = oid(3);    // in no managed department
const COMPANY = oid(40);
const DEPT = oid(50);
const OTHER_DEPT = oid(51);
const TASK = oid(100);

function query(value) {
    const q = {
        select: jest.fn(() => q),
        populate: jest.fn(() => q),
        lean: jest.fn(() => q),
        sort: jest.fn(() => q),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return q;
}

let currentTask;
const taskFind = jest.fn();

jest.mock('../../../../models/User', () => ({
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
}));
jest.mock('../../../../models/Department', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../../models/Workspace', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../modules/messages/message.model.js', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../../models/TaskActivity', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../../models/Task', () => ({ findById: jest.fn(), find: jest.fn() }));

const User = require('../../../../models/User');
const Department = require('../../../../models/Department');
const Task = require('../../../../models/Task');
const router = require('../manager-dashboard.routes');

function makeTask(overrides = {}) {
    const t = {
        _id: TASK, createdBy: MEMBER, assignedTo: [MEMBER], visibility: 'workspace',
        status: 'todo', deleted: false, ...overrides,
    };
    t.save = jest.fn().mockResolvedValue(t);
    t.populate = jest.fn().mockResolvedValue(t);
    t.toJSON = () => ({ _id: t._id, status: t.status, completedAt: t.completedAt, completedBy: t.completedBy });
    return t;
}

function call(method, path, userId, body) {
    const app = express();
    app.use(express.json());
    app.use('/api/manager', router);
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = body ? JSON.stringify(body) : null;
            const req = http.request({
                port: server.address().port, path, method,
                headers: { 'x-user': userId, 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) },
            }, (res) => {
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

beforeEach(() => {
    jest.clearAllMocks();
    currentTask = makeTask();
    User.findById.mockImplementation(() => query({ _id: MANAGER, companyId: COMPANY, companyRole: 'manager', managedDepartments: [DEPT] }));
    User.find.mockImplementation(() => query([{ _id: MEMBER }]));
    User.countDocuments.mockImplementation(async (q) => (q._id.$in.map(String).includes(MEMBER) ? 1 : 0));
    Department.findById.mockImplementation((id) => query(
        String(id) === DEPT ? { _id: DEPT, company: COMPANY, managers: [], head: null }
            : String(id) === OTHER_DEPT ? { _id: OTHER_DEPT, company: COMPANY, managers: [], head: null } : null));
    Department.find.mockImplementation(() => query([{ _id: DEPT }]));
    Task.findById.mockImplementation(() => query(currentTask));
    Task.find.mockImplementation((q) => { taskFind(q); return query([]); });
});

describe('PATCH /api/manager/tasks/:taskId/status', () => {
    it('runs the workflow validator', async () => {
        currentTask.status = 'cancelled';
        const res = await call('PATCH', `/api/manager/tasks/${TASK}/status`, MANAGER, { status: 'done' });
        expect(res.status).toBe(400);
        expect(res.body.allowedTransitions).toEqual(['backlog', 'todo']);
        expect(currentTask.save).not.toHaveBeenCalled();
    });

    it('updates an in-scope task and records completion', async () => {
        const res = await call('PATCH', `/api/manager/tasks/${TASK}/status`, MANAGER, { status: 'done' });
        expect(res.status).toBe(200);
        expect(currentTask.status).toBe('done');
        expect(currentTask.completedBy).toBe(MANAGER);
        expect(currentTask.completedAt).toBeInstanceOf(Date);
    });

    it('requires a reason to block', async () => {
        const res = await call('PATCH', `/api/manager/tasks/${TASK}/status`, MANAGER, { status: 'blocked' });
        expect(res.status).toBe(400);
    });

    it('refuses tasks outside the managed departments', async () => {
        currentTask = makeTask({ createdBy: STRANGER, assignedTo: [STRANGER] });
        const res = await call('PATCH', `/api/manager/tasks/${TASK}/status`, MANAGER, { status: 'done' });
        expect(res.status).toBe(403);
    });

    it('refuses private tasks the manager is not party to', async () => {
        currentTask = makeTask({ visibility: 'private' });
        const res = await call('PATCH', `/api/manager/tasks/${TASK}/status`, MANAGER, { status: 'done' });
        expect(res.status).toBe(403);
    });

    it('404s unknown or malformed ids', async () => {
        currentTask = null;
        expect((await call('PATCH', `/api/manager/tasks/${TASK}/status`, MANAGER, { status: 'done' })).status).toBe(404);
        expect((await call('PATCH', '/api/manager/tasks/nope/status', MANAGER, { status: 'done' })).status).toBe(404);
    });
});

describe('GET /api/manager/tasks/:departmentId', () => {
    it('403s a department the manager does not manage', async () => {
        const res = await call('GET', `/api/manager/tasks/${OTHER_DEPT}`, MANAGER);
        expect(res.status).toBe(403);
    });

    it('excludes private tasks the manager is not party to', async () => {
        const res = await call('GET', `/api/manager/tasks/${DEPT}`, MANAGER);
        expect(res.status).toBe(200);
        const q = taskFind.mock.calls[0][0];
        expect(q.deleted).toEqual({ $ne: true });
        expect(JSON.stringify(q.$and[1])).toContain('"visibility":{"$ne":"private"}');
    });
});
