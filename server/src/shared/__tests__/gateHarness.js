'use strict';

/**
 * Tiny harness for company-gate route tests (not a test file itself).
 *
 *   const h = require('.../gateHarness');
 *   h.users[ID] = { _id: ID, companyId: C1, companyRole: 'admin', accountStatus: 'active' };
 *   const res = await h.call(app, 'GET', '/api/x', ID);
 *
 * Tests mock ../middleware/auth so the `x-user` header becomes req.user.sub,
 * and mock models/User with h.userModel() so middleware reads h.users.
 */

const http = require('http');

const oid = (n) => n.toString(16).padStart(24, '0');

/** A mongoose-query look-alike that resolves to `value`. */
function query(value) {
    const q = {
        select: () => q,
        populate: () => q,
        lean: () => q,
        sort: () => q,
        limit: () => q,
        skip: () => q,
        exec: () => Promise.resolve(value),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
        catch: (rej) => Promise.resolve(value).catch(rej),
    };
    return q;
}

const users = {};

function userModel() {
    return {
        findById: jest.fn((id) => query(users[String(id)] ? { ...users[String(id)] } : null)),
        findOne: jest.fn(() => query(null)),
        find: jest.fn(() => query([])),
        countDocuments: jest.fn(async () => 0),
        updateOne: jest.fn(async () => ({})),
        findByIdAndUpdate: jest.fn(async () => ({})),
    };
}

function call(app, method, path, userId, body) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const data = body ? JSON.stringify(body) : null;
            const req = http.request({
                port: server.address().port, path, method,
                headers: {
                    ...(userId ? { 'x-user': userId } : {}),
                    'content-type': 'application/json',
                    ...(data ? { 'content-length': Buffer.byteLength(data) } : {}),
                },
            }, (res) => {
                let text = '';
                res.on('data', (c) => { text += c; });
                res.on('end', () => {
                    server.close();
                    let parsed = null;
                    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
                    resolve({ status: res.statusCode, body: parsed });
                });
            });
            req.on('error', (e) => { server.close(); reject(e); });
            if (data) req.write(data);
            req.end();
        });
    });
}

module.exports = { oid, query, users, userModel, call };
