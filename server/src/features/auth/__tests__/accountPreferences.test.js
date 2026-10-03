'use strict';

const mockStore = { prefs: {} };

function mockApplySet($set) {
  for (const [path, value] of Object.entries($set)) {
    const parts = path.split('.').slice(1); // drop "preferences"
    let o = mockStore.prefs;
    for (const p of parts.slice(0, -1)) { o[p] = o[p] || {}; o = o[p]; }
    o[parts[parts.length - 1]] = value;
  }
}

jest.mock('../../../identity', () => ({
  users: { findById: jest.fn(async () => ({ preferences: mockStore.prefs })) },
}));
jest.mock('../../../identity/queries/auth', () => ({
  setUserPaths: jest.fn(async (id, $set) => { mockApplySet($set); return { preferences: mockStore.prefs }; }),
}));

const { setUserPaths } = require('../../../identity/queries/auth');
const prefs = require('../accountPreferences');
const privacyService = require('../privacy.service');

function run(handler, body) {
  const req = { user: { sub: 'u1' }, body };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return handler(req, res).then(() => res);
}

beforeEach(() => { mockStore.prefs = {}; });

describe('privacy preferences', () => {
  test('GET returns defaults merged in, without dataSharing', async () => {
    mockStore.prefs = { privacy: { readReceipts: false, dataSharing: true } };
    const res = await run(prefs.getPrivacyPreferences);
    expect(res.body).toEqual({ readReceipts: false, typingIndicators: true, allowDiscovery: true });
  });

  test('PUT is a partial update and returns the saved object', async () => {
    mockStore.prefs = { privacy: { readReceipts: false, typingIndicators: false, allowDiscovery: true } };
    const res = await run(prefs.updatePrivacyPreferences, { allowDiscovery: false });
    expect(res.statusCode).toBe(200);
    expect(setUserPaths.mock.calls[0][1]).toEqual({ 'preferences.privacy.allowDiscovery': false });
    expect(res.body).toEqual({ readReceipts: false, typingIndicators: false, allowDiscovery: false });
  });

  test('PUT rejects non-booleans and empty bodies', async () => {
    expect((await run(prefs.updatePrivacyPreferences, { readReceipts: 'no' })).statusCode).toBe(400);
    expect((await run(prefs.updatePrivacyPreferences, {})).statusCode).toBe(400);
    expect(setUserPaths).not.toHaveBeenCalled();
  });

  test('PUT refreshes the enforcement cache at once', async () => {
    await run(prefs.updatePrivacyPreferences, { typingIndicators: false });
    const cached = await privacyService.getPrivacy('u1');
    expect(cached.typingIndicators).toBe(false);
  });
});

describe('region preferences', () => {
  test('GET fills defaults (timezone auto, 12h)', async () => {
    const res = await run(prefs.getRegionPreferences);
    expect(res.body).toEqual({ language: 'en', timezone: 'auto', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' });
  });

  test('PUT validates each field', async () => {
    const bad = [
      { timezone: 'Mars/Olympus' },
      { timezone: 42 },
      { dateFormat: 'YYYY/MM/DD' },
      { timeFormat: '48h' },
      { language: 'fr' },
      {},
    ];
    for (const body of bad) {
      expect((await run(prefs.updateRegionPreferences, body)).statusCode).toBe(400);
    }
    expect(setUserPaths).not.toHaveBeenCalled();
  });

  test('PUT is partial and returns the saved object', async () => {
    mockStore.prefs = { region: { language: 'en', timezone: 'auto', dateFormat: 'DD/MM/YYYY', timeFormat: '12h' } };
    const res = await run(prefs.updateRegionPreferences, { timezone: 'Asia/Kolkata', timeFormat: '24h' });
    expect(res.statusCode).toBe(200);
    expect(setUserPaths.mock.calls[0][1]).toEqual({ 'preferences.region.timezone': 'Asia/Kolkata', 'preferences.region.timeFormat': '24h' });
    expect(res.body).toEqual({ language: 'en', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', timeFormat: '24h' });
  });

  test("accepts 'auto' and every supported date format", async () => {
    for (const dateFormat of prefs.DATE_FORMATS) {
      expect((await run(prefs.updateRegionPreferences, { dateFormat, timezone: 'auto' })).statusCode).toBe(200);
    }
  });
});

describe('redactReadBy', () => {
  test('hides readers with receipts off from others, but not from themselves', async () => {
    privacyService.rememberPrivacy('quiet', { readReceipts: false });
    privacyService.rememberPrivacy('loud', { readReceipts: true });
    const msgs = [{ _id: 'm1', readBy: ['quiet', 'loud'] }];
    expect((await privacyService.redactReadBy(msgs, 'viewer'))[0].readBy).toEqual(['loud']);
    expect((await privacyService.redactReadBy(msgs, 'quiet'))[0].readBy).toEqual(['quiet', 'loud']);
  });
});
