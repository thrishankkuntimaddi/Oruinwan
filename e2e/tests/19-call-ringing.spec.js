'use strict';

/**
 * Ringing (server/src/modules/huddles/huddleRinging.js, docs/api/calls.md): a DM call rings the
 * other person with an incoming-call screen; declining, nobody answering (the test server rings
 * for 8 seconds) and answering on another device all stop it. A channel huddle never rings: the
 * others get a "Join" banner. Three people can be in one call.
 */

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, waitForComposerReady, openDm, seedData, withDb, withPg } = require('./helpers');

const trackPeerConnections = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...args) { const pc = new Orig(...args); window.__pcs.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
};
const connectedPeers = (page, n) => page.waitForFunction((count) => window.__pcs.filter((pc) => pc.connectionState === 'connected').length >= count, n, { timeout: 30_000 });

const spaNavigate = (page, p) => page.evaluate((to) => {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, p);

const api = (page) => ({
  token: () => page.evaluate(() => localStorage.getItem('accessToken')),
  async req(method, p, data) {
    return page.request[method](`${E2E.apiUrl}${p}`, { data, headers: { Authorization: `Bearer ${await this.token()}` } });
  },
});

const startDmCall = async (caller, callee) => {
  await openDm(caller, callee);
  await waitForComposerReady(caller);
  await caller.locator('button[title="Start Voice Call"], button[title="Start huddle"]').first().click();
  await expect(caller.getByTestId('call-screen')).toBeVisible();
};

async function pair(browser, extra = 0) {
  const contexts = await Promise.all(Array.from({ length: 2 + extra }, () => browser.newContext()));
  await Promise.all(contexts.map((c) => c.addInitScript(trackPeerConnections)));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  return { contexts, pages, close: () => Promise.all(contexts.map((c) => c.close())) };
}

test.describe('call ringing', () => {
  test.describe.configure({ mode: 'serial' });

  test('declining a DM call tells the caller and hangs up', async ({ browser }) => {
    const { pages: [alice, bob], close } = await pair(browser);
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);

    await startDmCall(alice, 'bob');
    const ring = bob.getByTestId('incoming-call');
    await expect(ring).toContainText('alice');
    await bob.getByTestId('incoming-call-decline').click();
    await expect(ring).toBeHidden();

    await expect(alice.getByText(/declined the call\./)).toBeVisible();
    await expect(alice.getByTestId('call-screen')).toBeHidden();
    await close();
  });

  test('nobody answers: the ring stops, the caller sees "No answer", the callee has a missed call', async ({ browser }) => {
    const { users } = seedData();
    const { pages: [alice, bob], close } = await pair(browser);
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);

    await startDmCall(alice, 'bob');
    const ring = bob.getByTestId('incoming-call');
    await expect(ring).toBeVisible();
    // The test server rings for 8 seconds.
    await expect(ring).toBeHidden({ timeout: 20_000 });
    await expect(alice.getByText('No answer.')).toBeVisible();
    await expect(alice.getByTestId('call-screen')).toBeHidden();

    const { ObjectId } = require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] }));
    await expect.poll(() => withDb((db) => db.collection('notifications').countDocuments({ recipient: new ObjectId(users.bob.id), type: 'missed_call' })))
      .toBeGreaterThan(0);
    // Bob's bell shows it.
    await bob.locator('button[title="Notifications"], button[aria-label="Notifications"]').first().click();
    await expect(bob.getByText(/Missed call from alice/).first()).toBeVisible();
    await close();
  });

  test('answering on one device stops the ring on the other', async ({ browser }) => {
    const { pages: [alice, bobLaptop, bobPhone], close } = await pair(browser, 1);
    await login(bobLaptop, 'bob'); await openWorkspace(bobLaptop);
    await login(bobPhone, 'bob'); await openWorkspace(bobPhone);
    await login(alice, 'alice'); await openWorkspace(alice);

    await startDmCall(alice, 'bob');
    await expect(bobLaptop.getByTestId('incoming-call')).toBeVisible();
    await expect(bobPhone.getByTestId('incoming-call')).toBeVisible();

    await bobLaptop.getByTestId('incoming-call-accept').click();
    await expect(bobLaptop.getByTestId('call-screen')).toContainText('2 participants');
    await expect(bobPhone.getByTestId('incoming-call')).toBeHidden();
    await expect(alice.getByTestId('call-screen')).toContainText('2 participants');

    // A 1:1 call ends for both when one hangs up.
    await alice.getByTestId('call-screen').getByTitle('Leave huddle').click();
    await expect(bobLaptop.getByTestId('call-screen')).toBeHidden();
    await close();
  });

  test.describe('channel huddles', () => {
    let channelId;
    const { workspaceId, users } = seedData();

    test.beforeAll(async () => {
      // Carol joins the workspace for these tests (a third person in one call).
      await withPg((sql) => sql(
        `INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET status = 'active', removed_at = NULL`,
        [workspaceId, users.carol.id],
      ));
    });
    test.afterAll(async () => {
      await withPg((sql) => sql('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, users.carol.id]));
    });

    test('a channel huddle shows a Join banner (no ringing), and three people meet in one call', async ({ browser }) => {
      const { pages: [alice, bob, carol], close } = await pair(browser, 1);
      await login(bob, 'bob'); await openWorkspace(bob);
      await login(carol, 'carol'); await openWorkspace(carol);
      await login(alice, 'alice'); await openWorkspace(alice);

      const res = await api(alice).req('post', '/api/channels', {
        name: `call-${Date.now().toString(36)}`, workspaceId, memberIds: [users.bob.id, users.carol.id],
      });
      expect(res.status(), await res.text()).toBeLessThan(300);
      const body = await res.json();
      channelId = String(body.channel?._id || body.channel?.id || body._id || body.id);

      await spaNavigate(alice, `/workspace/${workspaceId}/channel/${channelId}`);
      await alice.waitForURL(new RegExp(`/channel/${channelId}`));
      await alice.locator('button[title="Start huddle"]').first().click();
      const aliceCall = alice.getByTestId('call-screen');
      await expect(aliceCall).toBeVisible();

      // Bob and Carol are somewhere else in the app: a banner, never the ringing screen.
      for (const page of [bob, carol]) {
        const banner = page.getByTestId('huddle-started-banner');
        await expect(banner).toContainText('alice started a huddle');
        await expect(page.getByTestId('incoming-call')).toHaveCount(0);
        await banner.getByTestId('huddle-started-join').click();
        await expect(page.getByTestId('call-screen')).toBeVisible();
      }
      await expect(aliceCall).toContainText('3 participants');
      await expect(bob.getByTestId('call-screen')).toContainText('3 participants');
      await expect(carol.getByTestId('call-screen')).toContainText('3 participants');
      // Everyone connects to the two others.
      await Promise.all([connectedPeers(alice, 2), connectedPeers(bob, 2), connectedPeers(carol, 2)]);

      for (const page of [carol, bob, alice]) await page.getByTestId('call-screen').getByTitle('Leave huddle').click();
      await close();
    });
  });
});
