'use strict';

const express = require('express');
const http = require('http');

jest.mock('../../../shared/middleware/auth', () => (req, res, next) => {
  req.user = { sub: req.headers['x-user'] };
  next();
});

const users = { companyUser: { _id: 'u1', companyId: 'c1' }, personalUser: { _id: 'u2', companyId: null } };
jest.mock('../../../../models/User', () => ({
  findById: jest.fn((id) => ({ select: () => ({ lean: async () => users[id] || null }) })),
}));

const saved = [];
jest.mock('../../../../models/SupportTicket', () => {
  function SupportTicket(doc) { Object.assign(this, doc, { _id: 't1' }); }
  SupportTicket.prototype.save = async function save() { saved.push(this); return this; };
  SupportTicket.findOne = jest.fn(async (q) => {
    const t = saved.find((x) => x._id === q._id && String(x.companyId) === String(q.companyId));
    return t || null;
  });
  return SupportTicket;
});

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
    expect(res.body.ticket).toMatchObject({ companyId: 'c1', creatorId: 'companyUser', subject: 'Help' });
  });

  test('personal accounts get a clear 403 instead of a 500', async () => {
    const res = await call('POST', '/api/support/tickets', 'personalUser', { subject: 'Help', description: 'Broken' });
    expect(res.status).toBe(403);
  });

  test('replies are stored with the schema field names', async () => {
    const res = await call('POST', '/api/support/tickets/t1/message', 'companyUser', { message: 'Any update?' });
    expect(res.status).toBe(200);
    const msg = saved[0].messages.at(-1);
    expect(msg).toMatchObject({ sender: 'companyUser', content: 'Any update?', isFromAdmin: false });
  });
});
