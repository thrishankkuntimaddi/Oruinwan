// The HTTP layer keeps a free-plan refusal's details on the error and tells the app about it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, configure, request } from './http.js';
import { on } from '../../lib/bus.js';

const PLAN_LIMIT = {
  success: false,
  code: 'PLAN_LIMIT',
  limit: 'workspaces.create',
  max: 2,
  used: 2,
  plan: 'free',
  upgradeUrl: '/pricing',
  message: "You've reached the free plan limit: 2 workspaces you created. Pro and Enterprise are coming soon.",
  error: "You've reached the free plan limit: 2 workspaces you created. Pro and Enterprise are coming soon.",
};

afterEach(() => vi.unstubAllGlobals());

describe('PLAN_LIMIT errors', () => {
  it('keeps code, limit, max, used, plan and upgradeUrl on the thrown error', async () => {
    configure('https://api.example');
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 403, ok: false, text: async () => JSON.stringify(PLAN_LIMIT) })));
    const seen = [];
    const off = on('plan:limit', (info) => seen.push(info));
    const err = await request('POST', '/workspaces', { body: { name: 'Third' } }).catch((e) => e);
    off();
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'PLAN_LIMIT', planLimit: true, limit: 'workspaces.create', max: 2, used: 2, plan: 'free', upgradeUrl: '/pricing' });
    expect(err.message).toBe(PLAN_LIMIT.message);
    expect(seen).toEqual([{ code: 'PLAN_LIMIT', limit: 'workspaces.create', max: 2, used: 2, plan: 'free', upgradeUrl: '/pricing', message: PLAN_LIMIT.message }]);
  });

  it('leaves other refusals alone', () => {
    const seen = [];
    const off = on('plan:limit', (info) => seen.push(info));
    const err = new ApiError("You don't have access to that.", 403, { code: 'FORBIDDEN' });
    off();
    expect(err.planLimit).toBeUndefined();
    expect(err.code).toBe('FORBIDDEN');
    expect(seen).toEqual([]);
  });
});
