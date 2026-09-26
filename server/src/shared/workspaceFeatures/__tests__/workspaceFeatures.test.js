'use strict';

const store = {};
jest.mock('../../../models/WorkspacePermission', () => ({
  findOne: jest.fn(({ workspace }) => ({ select: () => ({ lean: async () => store[workspace] || null }) })),
}));

const WS = '64b000000000000000000001';
const { isFeatureEnabled, requireWorkspaceFeature, invalidateWorkspaceFeatures, getWorkspaceFeatures } = require('..');

function run(mw, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ blocked: true, status: this.statusCode, body: b }); return this; } };
    mw(req, res, (err) => resolve({ blocked: false, err }));
  });
}

describe('workspace feature toggles', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; invalidateWorkspaceFeatures(); });

  test('everything is on by default', async () => {
    expect(Object.values(await getWorkspaceFeatures(WS)).every(Boolean)).toBe(true);
  });

  test('a disabled feature blocks with 403 and the feature name', async () => {
    store[WS] = { featureToggles: { polls: false } };
    expect(await isFeatureEnabled(WS, 'polls')).toBe(false);
    expect(await isFeatureEnabled(WS, 'tasks')).toBe(true);
    const r = await run(requireWorkspaceFeature('polls'), { body: { workspaceId: WS } });
    expect(r).toMatchObject({ blocked: true, status: 403, body: { code: 'FEATURE_DISABLED_FOR_WORKSPACE', feature: 'polls' } });
  });

  test('changes apply after invalidation (the toggle controllers call it)', async () => {
    store[WS] = { featureToggles: { tasks: false } };
    expect(await isFeatureEnabled(WS, 'tasks')).toBe(false);
    store[WS] = { featureToggles: { tasks: true } };
    expect(await isFeatureEnabled(WS, 'tasks')).toBe(false); // cached
    invalidateWorkspaceFeatures(WS);
    expect(await isFeatureEnabled(WS, 'tasks')).toBe(true);
  });

  test('requests without a workspace pass; unknown features throw', async () => {
    expect((await run(requireWorkspaceFeature('tasks'), { body: {} })).blocked).toBe(false);
    expect(() => requireWorkspaceFeature('teleport')).toThrow(/Unknown workspace feature/);
  });
});
