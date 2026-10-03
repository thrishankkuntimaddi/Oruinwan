'use strict';

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  req.user = { sub: req.headers['x-user'] };
  next();
});

const users = {
  companyUser: { _id: 'u1', companyId: 'c1' },
  personalUser: { _id: 'u2', companyId: null },
  otherPersonal: { _id: 'u3', companyId: null },
  spammer: { _id: 'u4', companyId: null },
  validator: { _id: 'u5', companyId: null },
};
jest.mock('../../../identity', () => ({
  users: { findById: jest.fn(async (id) => users[id] || null), findManyByIds: jest.fn(async () => new Map()) },
  companies: { findManyByIds: jest.fn(async () => new Map()) },
}));

const saved = [];
let mockNextId = 1;
// Minimal matcher for the queries the router builds: { _id?, creatorId?, companyId?, $or? }.
function mockMatches(t, q) {
  if (q._id !== undefined && t._id !== q._id) return false;
  if (q.creatorId !== undefined && String(t.creatorId) !== String(q.creatorId)) return false;
  if (q.companyId !== undefined && String(t.companyId) !== String(q.companyId)) return false;
  if (q.$or && !q.$or.some((sub) => mockMatches(t, sub))) return false;
  return true;
}
jest.mock('../../../../models/SupportTicket', () => {
  function SupportTicket(doc) { Object.assign(this, doc, { _id: `t${mockNextId++}` }); }
  SupportTicket.prototype.save = async function save() { if (!saved.includes(this)) saved.push(this); return this; };
  SupportTicket.findOne = jest.fn(async (q) => saved.find((x) => mockMatches(x, q)) || null);
  return SupportTicket;
});

jest.mock('../supportTickets.service', () => ({
  listTicketsForCreator: jest.fn(async (userId) => saved
    .filter((t) => String(t.creatorId) === String(userId))
    .map((t) => ({ _id: t._id, subject: t.subject, category: t.category, status: t.status || 'open', replies: [] }))),
}));

const router = require('../support.routes');

function call(method, path, userId, body) {
  const app = express();
  app.use(express.json());
  app.use('/api/support', router);
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

describe('/api/support', () => {
  test('creates a ticket for the company resolved from the user record', async () => {
    const res = await call('POST', '/api/support/tickets', 'companyUser', { subject: 'Help', description: 'Broken' });
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ companyId: 'c1', creatorId: 'companyUser', subject: 'Help', category: 'question', priority: 'medium' });
  });

  test('personal accounts can open a request (no company)', async () => {
    const res = await call('POST', '/api/support/tickets', 'personalUser', {
      subject: '  Upload fails ', description: 'Files over 5 MB never finish', category: 'problem',
      context: { path: '/workspace/w1/files', appVersion: '1.2.3', userAgent: 'TestAgent/1.0', message: 'secret' },
    });
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ companyId: null, creatorId: 'personalUser', subject: 'Upload fails', category: 'problem' });
    expect(res.body.ticket.context).toEqual({ path: '/workspace/w1/files', appVersion: '1.2.3', userAgent: 'TestAgent/1.0' });
  });

  test('rejects unknown categories, bad priorities and over-long text', async () => {
    const bad = [
      { subject: 'x', description: 'y', category: 'spam' },
      { subject: 'x', description: 'y', priority: 'critical' },
      { subject: 'x'.repeat(151), description: 'y' },
      { subject: 'x', description: 'y'.repeat(5001) },
      { subject: '   ', description: 'y' },
    ];
    for (const body of bad) {
      const res = await call('POST', '/api/support/tickets', 'validator', body);
      expect(res.status).toBe(400);
    }
  });

  test('limits new requests to 5 per hour per user', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await call('POST', '/api/support/tickets', 'spammer', { subject: `Req ${i}`, description: 'Hello' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
    const other = await call('POST', '/api/support/tickets', 'otherPersonal', { subject: 'Mine', description: 'Hello', category: 'feedback' });
    expect(other.status).toBe(201);
  });

  test('GET /tickets/mine returns only the caller\'s requests', async () => {
    const res = await call('GET', '/api/support/tickets/mine', 'otherPersonal');
    expect(res.status).toBe(200);
    expect(res.body.tickets.map((t) => t.subject)).toEqual(['Mine']);
  });

  test('replies are stored with the schema field names', async () => {
    const res = await call('POST', '/api/support/tickets/t1/message', 'companyUser', { message: 'Any update?' });
    expect(res.status).toBe(200);
    const msg = saved[0].messages.at(-1);
    expect(msg).toMatchObject({ sender: 'companyUser', content: 'Any update?', isFromAdmin: false });
  });

  test('personal accounts can reply to their own ticket but not someone else\'s', async () => {
    const own = saved.find((t) => t.creatorId === 'personalUser');
    const ok = await call('POST', `/api/support/tickets/${own._id}/message`, 'personalUser', { message: 'More info' });
    expect(ok.status).toBe(200);
    const denied = await call('POST', `/api/support/tickets/${own._id}/message`, 'otherPersonal', { message: 'Peek' });
    expect(denied.status).toBe(404);
  });
});
