'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, openDm, waitForComposerReady, seedData, withDb } = require('./helpers');

async function openWorkspaceSettings(page, tab) {
  await page.getByRole('button', { name: 'Home' }).first().click();
  await page.getByText(E2E.workspaceName, { exact: true }).first().click();
  await page.getByText('Workspace Settings', { exact: true }).click();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

test.describe('workspace admin', () => {
  let alice, bob, contexts;
  const ws = () => seedData().workspaceId;

  test.beforeAll(async ({ browser }) => {
    contexts = await Promise.all([browser.newContext(), browser.newContext()]);
    [alice, bob] = await Promise.all(contexts.map((c) => c.newPage()));
    await login(bob, 'bob'); await openWorkspace(bob);
    await login(alice, 'alice'); await openWorkspace(alice);
  });
  test.afterAll(async () => { await Promise.all(contexts.map((c) => c.close())); });

  const api = (page) => ({
    token: () => page.evaluate(() => localStorage.getItem('accessToken')),
    async put(p, data) { return page.request.put(`${E2E.apiUrl}${p}`, { data, headers: { Authorization: `Bearer ${await this.token()}` } }); },
    async post(p, data) { return page.request.post(`${E2E.apiUrl}${p}`, { data, headers: { Authorization: `Bearer ${await this.token()}` } }); },
    async get(p) { return page.request.get(`${E2E.apiUrl}${p}`, { headers: { Authorization: `Bearer ${await this.token()}` } }); },
  });

  test('a member cannot change feature toggles', async () => {
    const res = await api(bob).put(`/api/workspaces/${ws()}/features`, { featureToggles: { polls: false } });
    expect(res.status()).toBe(403);
  });

  test('turning features off hides them for members and the server refuses them', async () => {
    await openWorkspaceSettings(alice, 'Features');
    for (const key of ['polls', 'reactions', 'huddles']) {
      await alice.getByTestId(`feature-${key}`).locator('input[type="checkbox"]').uncheck();
      await expect(alice.getByTestId(`feature-${key}`).locator('input[type="checkbox"]')).not.toBeChecked();
    }
    await alice.keyboard.press('Escape');

    await openDm(bob, 'alice');
    await waitForComposerReady(bob);
    // Call buttons are gone, and the attach menu has no Poll.
    await expect(bob.locator('button[title="Start Voice Call"]')).toHaveCount(0);
    await bob.locator('button[title="Attach"]').click();
    await expect(bob.getByText('Poll', { exact: true })).toHaveCount(0);
    await bob.keyboard.press('Escape');

    const dmId = bob.url().split('/dm/')[1];
    const poll = await api(bob).post('/api/v2/messages/poll', { dmSessionId: dmId, question: 'Lunch?', options: ['Yes', 'No'] });
    expect(poll.status()).toBe(403);
    expect((await poll.json()).code).toBe('FEATURE_DISABLED_FOR_WORKSPACE');
  });

  test('turning them back on restores them', async () => {
    const res = await api(alice).put(`/api/workspaces/${ws()}/features`, { featureToggles: { polls: true, reactions: true, huddles: true } });
    expect(res.status()).toBe(200);
    await bob.reload();
    await waitForComposerReady(bob).catch(() => {});
    await expect(bob.locator('button[title="Start Voice Call"]')).toBeVisible({ timeout: 20_000 });
  });

  test('analytics and data tabs work; cloning creates a workspace', async () => {
    // Polls off in the source, so the clone should inherit that.
    expect((await api(alice).put(`/api/workspaces/${ws()}/features`, { featureToggles: { polls: false } })).status()).toBe(200);
    await openWorkspaceSettings(alice, 'Analytics');
    await expect(alice.getByText(/messages|members|activity/i).first()).toBeVisible();
    await alice.getByRole('button', { name: 'Data', exact: true }).click();
    const clone = alice.getByTestId('clone-workspace');
    await clone.locator('input').first().fill('E2E Clone');
    await clone.getByRole('button', { name: 'Clone workspace' }).click();
    await expect(clone.getByText(/Created “E2E Clone”/)).toBeVisible();
    const toggles = await withDb(async (db) => {
      const wsDoc = await db.collection('workspaces').findOne({ name: 'E2E Clone' });
      return (await db.collection('workspacepermissions').findOne({ workspace: wsDoc._id }))?.featureToggles;
    });
    expect(toggles).toMatchObject({ polls: false });
    await api(alice).put(`/api/workspaces/${ws()}/features`, { featureToggles: { polls: true } });
  });

  test('members cannot export or clone', async () => {
    expect((await api(bob).get(`/api/workspace-os/${ws()}/export`)).status()).toBe(403);
    expect((await api(bob).post(`/api/workspace-os/${ws()}/clone`, { name: 'x' })).status()).toBe(403);
  });

  test('a template applies its channels (with keys), settings and feature toggles', async () => {
    const templateId = await withDb(async (db) => {
      const { insertedId } = await db.collection('workspacetemplates').insertOne({
        name: 'E2E Design Team', description: 'For designers', category: 'design', isPublic: true, isActive: true,
        company: null, createdBy: null, usageCount: 0,
        defaultChannels: [{ name: 'design-reviews', description: 'Crits', isPrivate: false, isDefault: false }],
        settings: { allowMemberChannelCreation: false },
        featureToggles: { tasks: true, notes: true, polls: false, ai: true, huddles: false },
      });
      return String(insertedId);
    });

    const created = await api(alice).post('/api/workspaces', { name: 'From Template', templateId });
    expect(created.status()).toBe(201);
    const body = await created.json();
    expect(body.templateError).toBeUndefined();
    const newWs = String(body.workspace.id);

    const state = await withDb(async (db) => {
      const { ObjectId } = require(require.resolve('mongodb', { paths: [require('path').join(__dirname, '..', '..', 'server')] }));
      const wsDoc = await db.collection('workspaces').findOne({ _id: new ObjectId(newWs) });
      const channel = await db.collection('channels').findOne({ workspace: wsDoc._id, name: 'design-reviews' });
      const key = channel && await db.collection('conversationkeys').findOne({ conversationId: channel._id });
      const perms = await db.collection('workspacepermissions').findOne({ workspace: wsDoc._id });
      const template = await db.collection('workspacetemplates').findOne({ _id: new ObjectId(templateId) });
      return { wsDoc, channel, key, perms, usage: template.usageCount };
    });
    expect(state.channel).toBeTruthy();
    expect(state.key).toBeTruthy();
    expect(String(state.wsDoc.templateId)).toBe(templateId);
    expect(state.wsDoc.settings.allowMemberChannelCreation).toBe(false);
    expect(state.perms.featureToggles).toMatchObject({ polls: false, huddles: false });
    expect(state.usage).toBe(1);

    // The same template can be applied to an existing workspace; channels are not duplicated.
    const imported = await api(alice).post(`/api/workspace-templates/${templateId}/import`, { workspaceId: newWs });
    expect(imported.status()).toBe(200);
    expect((await imported.json()).createdCount).toBe(0);
    // That was alice's third workspace: the free-plan cap now applies to clones too.
    const overLimit = await api(alice).post(`/api/workspace-os/${ws()}/clone`, { name: 'One Too Many' });
    expect(overLimit.status()).toBe(403);
    // Members cannot apply templates to the shared workspace.
    expect((await api(bob).post(`/api/workspace-templates/${templateId}/import`, { workspaceId: ws() })).status()).toBe(403);
  });

  test('the template marketplace list loads', async () => {
    const res = await api(alice).get('/api/workspace-templates/public');
    expect(res.status()).toBe(200);
  });
});
