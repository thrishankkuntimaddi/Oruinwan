import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
let reply = {};
vi.mock('./http.js', () => {
  const record = (method) => async (path, a, b) => {
    calls.push({ method, path, a, b });
    const r = typeof reply === 'function' ? reply(method, path) : reply;
    if (r instanceof Error) throw r;
    return r;
  };
  return {
    api: { get: record('GET'), post: record('POST'), put: record('PUT'), patch: record('PATCH'), del: record('DELETE') },
    deviceId: () => 'android-test-device',
    configure: () => {},
  };
});

const { opsAdapter, mapAutomation, mapRun, mapDevice, sortDevices, scheduleLabel } = await import('./adapter.ops.js');
const { runSummary } = await import('../../features/automations/automationsUi.js');

beforeEach(() => {
  calls.length = 0;
  reply = {};
});

describe('automations', () => {
  it('maps an automation', () => {
    const a = mapAutomation({
      _id: 'a1', name: 'Ship it', isActive: false,
      trigger: { type: 'github.pr_merged' },
      conditions: [{ field: 'repo', operator: 'equals', value: 'web' }],
      actions: [{ id: 'announce', type: 'send_message' }, { type: 'create_task', name: 'Release task', continueOnError: true }],
    });
    expect(a).toMatchObject({ id: 'a1', name: 'Ship it', active: false, triggerLabel: 'A GitHub pull request is merged', conditions: 1, scheduleLabel: null });
    expect(a.steps).toEqual([
      { id: 'announce', type: 'send_message', label: 'Post a message', continueOnError: false },
      { id: '1', type: 'create_task', label: 'Release task', continueOnError: true },
    ]);
  });

  it('labels schedules', () => {
    expect(scheduleLabel({ type: 'interval', expression: '2h' })).toBe('Every 2h');
    expect(scheduleLabel({ type: 'cron', expression: '30 9 * * 1-5', timezone: 'Europe/Berlin' })).toBe('Cron 30 9 * * 1-5 · Europe/Berlin');
    expect(mapAutomation({ _id: 'x', trigger: { type: 'scheduled' } }).scheduleLabel).toBe('Every 24h');
  });

  it('maps a run and summarises it', () => {
    const r = mapRun({
      _id: 'r1', status: 'partial', source: 'manual', conditionsMet: true, durationMs: 182,
      actionsExecuted: [
        { index: 0, stepId: 'announce', type: 'send_message', status: 'success', durationMs: 95 },
        { index: 1, type: 'create_task', status: 'failed', error: 'No title' },
      ],
    });
    expect(r.steps[1]).toMatchObject({ label: 'Create a task', status: 'failed', error: 'No title' });
    expect(runSummary(r)).toBe('Run by hand · 1 of 2 steps · 182 ms');
    expect(runSummary(mapRun({ status: 'skipped', source: 'test', dryRun: true, conditionsMet: false }))).toBe('Test · conditions not met');
  });

  it('calls the automation routes', async () => {
    reply = { automations: [{ _id: 'a1', name: 'A', trigger: { type: 'task.created' } }] };
    expect(await opsAdapter.automations('ws1')).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/v2/automations', a: { workspaceId: 'ws1' } });

    reply = { automation: { _id: 'a1', isActive: true } };
    await opsAdapter.setAutomationActive('ws1', 'a1', true);
    expect(calls[1]).toMatchObject({ method: 'PATCH', path: '/v2/automations/a1', a: { workspaceId: 'ws1', isActive: true } });

    reply = { run: { _id: 'r1', status: 'success', source: 'manual' } };
    expect((await opsAdapter.runAutomation('ws1', 'a1')).id).toBe('r1');
    expect(calls[2]).toMatchObject({ method: 'POST', path: '/v2/automations/a1/run', a: { workspaceId: 'ws1', dryRun: false } });

    reply = { runs: [] };
    await opsAdapter.automationRuns('ws1', 'a1');
    expect(calls[3]).toMatchObject({ method: 'GET', path: '/v2/automations/a1/runs', a: { workspaceId: 'ws1', limit: 30 } });
  });

  it('reads as empty on a server without automations', async () => {
    reply = Object.assign(new Error('nope'), { status: 404 });
    expect(await opsAdapter.automations('ws1')).toEqual([]);
  });
});

describe('devices', () => {
  it('maps and sorts devices: this one first, then most recent', () => {
    const list = [
      { deviceId: 'old', deviceName: 'Old laptop', platform: 'web', lastActiveAt: '2026-01-01T00:00:00Z', sessionCount: 1 },
      { deviceId: 'me', deviceName: 'Pixel', platform: 'android', lastActiveAt: '2025-01-01T00:00:00Z', isCurrent: true, pushTokenCount: 1 },
      { deviceId: 'new', reportedName: 'iPhone', platform: 'ios', lastActiveAt: '2026-06-01T00:00:00Z' },
    ].map(mapDevice);
    expect(sortDevices(list).map((d) => d.id)).toEqual(['me', 'new', 'old']);
    expect(list[1]).toMatchObject({ current: true, pushTokens: 1, name: 'Pixel' });
    expect(list[2].name).toBe('iPhone');
  });

  it('leaves out revoked devices; null when the server has no device API', async () => {
    reply = { devices: [{ deviceId: 'a', revoked: true }, { deviceId: 'b' }] };
    expect((await opsAdapter.deviceList()).map((d) => d.id)).toEqual(['b']);
    reply = Object.assign(new Error('nope'), { status: 404 });
    expect(await opsAdapter.deviceList()).toBeNull();
  });

  it('renames, signs out and signs out the others', async () => {
    reply = { device: { deviceId: 'b', deviceName: 'Work phone' } };
    expect((await opsAdapter.renameDevice('b', '  Work phone ')).name).toBe('Work phone');
    expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/v2/devices/b', a: { name: 'Work phone' } });
    await opsAdapter.renameDevice('b', '');
    expect(calls[1].a).toEqual({ name: null });
    await opsAdapter.signOutDevice('b');
    expect(calls[2]).toMatchObject({ method: 'DELETE', path: '/v2/devices/b' });
    await opsAdapter.signOutOtherDevices();
    expect(calls[3]).toMatchObject({ method: 'POST', path: '/v2/devices/revoke-others' });
  });
});

describe('account notification settings', () => {
  it('reads the digest frequency (emailDigest off means off)', async () => {
    reply = { emailDigest: true, digestFrequency: 'weekly' };
    expect(await opsAdapter.accountNotificationPrefs()).toEqual({ digestFrequency: 'weekly', newSignInEmails: true });
    reply = { emailDigest: false, digestFrequency: 'daily' };
    expect(await opsAdapter.accountNotificationPrefs()).toEqual({ digestFrequency: 'off', newSignInEmails: true });
    reply = { emailDigest: true };
    expect(await opsAdapter.accountNotificationPrefs()).toEqual({ digestFrequency: 'smart', newSignInEmails: true });
    reply = { emailDigest: true, digestFrequency: 'smart', newSignInEmails: false };
    expect(await opsAdapter.accountNotificationPrefs()).toEqual({ digestFrequency: 'smart', newSignInEmails: false });
  });

  it('turns new sign-in emails on and off', async () => {
    await opsAdapter.saveNewSignInEmails(false);
    expect(calls[0]).toMatchObject({ method: 'PUT', path: '/auth/me/preferences/notifications', a: { newSignInEmails: false } });
  });

  it('saves it, keeping emailDigest in step for older servers', async () => {
    await opsAdapter.saveDigestFrequency('off');
    expect(calls[0]).toMatchObject({ method: 'PUT', path: '/auth/me/preferences/notifications', a: { digestFrequency: 'off', emailDigest: false } });
    await expect(opsAdapter.saveDigestFrequency('hourly')).rejects.toThrow();
  });
});

describe('SSO discovery', () => {
  it('returns the start URL, or not enabled', async () => {
    reply = { enabled: true, protocol: 'saml', startUrl: 'https://api.x/api/auth/sso/saml/c1/login' };
    expect(await opsAdapter.ssoDiscover({ email: ' ada@acme.com ' })).toEqual({ enabled: true, protocol: 'saml', startUrl: 'https://api.x/api/auth/sso/saml/c1/login' });
    expect(calls[0]).toMatchObject({ path: '/auth/sso/discover', a: { email: 'ada@acme.com' } });
    reply = Object.assign(new Error('off'), { status: 404 });
    expect((await opsAdapter.ssoDiscover({ email: 'a@b.c' })).enabled).toBe(false);
  });
});
