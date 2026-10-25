'use strict';

// Adding people to channels puts them straight in (no invitation); workspace admins may add to
// any channel, not only the ones they created; only workspace members can be added; and default
// channels keep the whole workspace (nobody is removed from them).

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, withDb } = require('./helpers');

// Channels these tests make are removed afterwards: the seeded workspace is on the free plan
// (10 channels), and later tests create channels of their own.
const made = [];
test.afterAll(async () => {
  if (!made.length) return;
  const { ObjectId } = require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] }));
  await withDb((db) => db.collection('channels').deleteMany({ _id: { $in: made.map((id) => new ObjectId(id)) } }));
});

const token = (page) => page.evaluate(() => localStorage.getItem('accessToken'));

async function api(browser, key) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, key);
  const auth = { Authorization: `Bearer ${await token(page)}` };
  const call = (method, path, data) => page.request[method](`${E2E.apiUrl}${path}`, { headers: auth, ...(data ? { data } : {}) });
  return { ctx, call };
}

const ws = () => seedData().workspaceId;
const id = (key) => seedData().users[key].id;
const memberIdsOf = (channel) => (channel.members || []).map((m) => String(m.user?._id || m.user || m));

async function channelsOf(who) {
  const res = await who.call('get', `/api/workspaces/${ws()}/channels`);
  expect(res.status()).toBe(200);
  return (await res.json()).channels || [];
}

async function createChannel(who, name, { isPrivate = false, members = [] } = {}) {
  const res = await who.call('post', '/api/channels', { name, workspaceId: ws(), isPrivate, memberIds: members.map(id) });
  expect(res.status(), await res.text()).toBeLessThan(300);
  const body = await res.json();
  const channelId = String(body.channel?._id || body.channel?.id || body._id || body.id);
  made.push(channelId);
  return channelId;
}

test('a workspace admin adds a member to a private channel straight away; outsiders cannot be added', async ({ browser }) => {
  const t = Date.now();
  const alice = await api(browser, 'alice'); // owner
  const thrishank = await api(browser, 'thrishank'); // workspace admin, not in the channel
  const sandeep = await api(browser, 'sandeep');

  const channelId = await createChannel(alice, `private-${t}`, { isPrivate: true, members: ['vishnu'] });

  const added = await thrishank.call('post', `/api/channels/${channelId}/invite`, { userId: id('sandeep') });
  expect(added.status(), await added.text()).toBe(200);

  // Sandeep is in it now, with nothing to accept.
  const mine = (await channelsOf(sandeep)).find((c) => String(c._id || c.id) === channelId);
  expect(mine, 'the private channel is in sandeep’s list').toBeTruthy();
  expect(memberIdsOf(mine)).toContain(id('sandeep'));

  // Carol isn't in the workspace.
  const outsider = await thrishank.call('post', `/api/channels/${channelId}/invite`, { userId: id('carol') });
  expect(outsider.status()).toBe(400);
  expect((await outsider.json()).message).toMatch(/workspace first/i);

  // A plain member can't add people to a private channel they don't run.
  const vishnu = await api(browser, 'vishnu');
  const refused = await vishnu.call('post', `/api/channels/${channelId}/invite`, { userId: id('shiva') });
  expect(refused.status()).toBe(403);

  await Promise.all([alice.ctx.close(), thrishank.ctx.close(), sandeep.ctx.close(), vishnu.ctx.close()]);
});

test('a default channel holds the whole workspace: everyone is added and nobody is removed', async ({ browser }) => {
  const t = Date.now();
  const alice = await api(browser, 'alice');
  const channelId = await createChannel(alice, `everyone-${t}`);

  const turnedOn = await alice.call('put', `/api/workspaces/${ws()}/channels/${channelId}/default`, { isDefault: true });
  expect(turnedOn.status(), await turnedOn.text()).toBe(200);

  const bob = await api(browser, 'bob');
  const mine = (await channelsOf(bob)).find((c) => String(c._id || c.id) === channelId);
  expect(mine?.isDefault).toBe(true);
  expect(memberIdsOf(mine)).toContain(id('bob'));

  for (const path of ['remove-member', 'member']) {
    const method = path === 'member' ? 'delete' : 'post';
    const res = await alice.call(method, `/api/channels/${channelId}/${path}`, { userId: id('bob') });
    expect(res.status(), `${method} ${path}`).toBe(400);
    expect((await res.json()).message).toMatch(/default channel/i);
  }

  // Turning "Default channel" off makes it a normal channel again (a workspace keeps at least
  // one default channel, so another one is made default first).
  const other = await createChannel(alice, `lobby-${t}`);
  expect((await alice.call('put', `/api/workspaces/${ws()}/channels/${other}/default`, { isDefault: true })).status()).toBe(200);
  const off = await alice.call('put', `/api/workspaces/${ws()}/channels/${channelId}/default`, { isDefault: false });
  expect(off.status(), await off.text()).toBe(200);
  const removed = await alice.call('post', `/api/channels/${channelId}/remove-member`, { userId: id('bob') });
  expect(removed.status(), await removed.text()).toBe(200);

  await Promise.all([alice.ctx.close(), bob.ctx.close()]);
});
