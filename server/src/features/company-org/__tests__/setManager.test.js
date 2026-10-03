'use strict';

// alice ← bob ← carol (carol reports to bob, bob reports to alice); dave is in another company.
jest.mock('../../../identity', () => require('../../admin/__tests__/identityStore').identity);
jest.mock('../../../identity/queries/org', () => require('../../admin/__tests__/identityStore').org);
jest.mock('../../../shared/postgres', () => require('../../admin/__tests__/identityStore').postgres);
jest.mock('../../../shared/adminAudit', () => ({ recordAdminAction: jest.fn(async () => {}) }));

const store = require('../../admin/__tests__/identityStore');

beforeAll(() => {
  store.reset();
  store.addUser({ _id: 'alice', companyId: 'c1', username: 'alice', reportsTo: null });
  store.addUser({ _id: 'bob', companyId: 'c1', username: 'bob', reportsTo: 'alice' });
  store.addUser({ _id: 'carol', companyId: 'c1', username: 'carol', reportsTo: 'bob' });
  store.addUser({ _id: 'dave', companyId: 'c2', username: 'dave', reportsTo: null });
});

const { setManager } = require('../org-chart.controller');
const { recordAdminAction } = require('../../../shared/adminAudit');

function call(userId, managerId, { companyId = 'c1', callerCompany = 'c1' } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    setManager({ params: { id: companyId, userId }, body: { managerId }, user: { sub: 'admin' }, companyId: callerCompany }, res);
  });
}

describe('setManager', () => {
  test('sets a reporting line and records it', async () => {
    const r = await call('carol', 'alice');
    expect(r).toMatchObject({ status: 200, body: { reportsTo: 'alice' } });
    expect(recordAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.reporting_line_changed', companyId: 'c1' }));
    expect(store.state.users.get('carol').reportsTo).toBe('alice');
    await call('carol', 'bob'); // restore
  });

  test('refuses a loop, including self-reporting', async () => {
    expect((await call('alice', 'carol')).body.message).toMatch(/loop/);
    expect((await call('bob', 'bob')).status).toBe(400);
  });

  test('both people must be in the company the caller administers', async () => {
    expect((await call('carol', 'dave')).status).toBe(400);
    expect((await call('dave', null)).status).toBe(404);
    expect((await call('carol', 'alice', { callerCompany: 'c2' })).status).toBe(403);
  });

  test('clearing the manager makes the employee a root', async () => {
    expect(await call('bob', null)).toMatchObject({ status: 200, body: { reportsTo: null } });
  });
});
