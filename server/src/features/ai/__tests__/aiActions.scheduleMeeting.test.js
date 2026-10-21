'use strict';

// schedule_meeting tool: without a time it books the availability finder's first all-free slot.

const WS = '64b000000000000000000001';
const ME = '64b0000000000000000000a1';
const BOB = '64b0000000000000000000b2';
const OUTSIDER = '64b0000000000000000000c3';

jest.mock('../../../identity', () => ({
  workspaces: {
    findById: jest.fn(async () => ({
      _id: '64b000000000000000000001',
      members: [
        { user: '64b0000000000000000000a1', role: 'owner', status: 'active' },
        { user: '64b0000000000000000000b2', role: 'member', status: 'active' },
      ],
    })),
  },
  users: { findById: jest.fn(async () => ({ _id: 'me', companyId: null, preferences: { region: { timezone: 'Europe/London' } } })) },
}));
jest.mock('../../../identity/hydrate', () => ({ hydrate: async (x) => x, USER_MIN: {} }));
const mockCreate = jest.fn(async (doc) => ({ _id: 'm1', ...doc }));
jest.mock('../../../models/ScheduledMeeting', () => ({ create: (...a) => mockCreate(...a) }));
const mockSuggest = jest.fn();
jest.mock('../../meetings/meetings.service', () => ({ suggestTime: (...a) => mockSuggest(...a) }));
jest.mock('../../../modules/notifications/notificationService', () => ({ scheduleCreated: jest.fn(async () => {}) }));

const { scheduleMeeting } = require('../../../../utils/aiActions');

const ctx = { userId: ME, workspaceId: WS };

beforeEach(() => { mockCreate.mockClear(); mockSuggest.mockReset(); });

test('books the given time without asking the availability finder', async () => {
  const out = await scheduleMeeting({ title: 'Sync', startsAt: '2026-11-02T10:00:00Z', participantIds: [BOB] }, ctx);
  expect(out).toMatchObject({ success: true, chosenBy: 'user', duration: 30 });
  expect(mockSuggest).not.toHaveBeenCalled();
  expect(mockCreate.mock.calls[0][0].startTime.toISOString()).toBe('2026-11-02T10:00:00.000Z');
});

test('no startsAt: books the first slot where everyone is free', async () => {
  mockSuggest.mockResolvedValue({
    slots: [{ start: '2026-11-03T14:00:00.000Z', end: '2026-11-03T14:45:00.000Z', allAvailable: true, availableCount: 2, attendeeCount: 2 }],
    window: { from: 'a', to: 'b' },
  });
  const out = await scheduleMeeting({ title: 'Plan', durationMinutes: 45, participantIds: [BOB, OUTSIDER], earliest: '2026-11-03T00:00:00Z' }, ctx);
  expect(out).toMatchObject({ success: true, chosenBy: 'availability', duration: 45 });
  const args = mockSuggest.mock.calls[0][0];
  // non-members are dropped; the caller is always an attendee
  expect(args.participantIds).toEqual([ME, BOB]);
  expect(args).toMatchObject({ durationMinutes: 45, from: '2026-11-03T00:00:00Z', timezone: 'Europe/London' });
  const created = mockCreate.mock.calls[0][0];
  expect(created.startTime.toISOString()).toBe('2026-11-03T14:00:00.000Z');
  expect(created.participants).toEqual([BOB]);
});

test('no slot suits everyone: nothing booked, candidates returned', async () => {
  mockSuggest.mockResolvedValue({
    slots: [{ start: 's1', end: 'e1', allAvailable: false, availableCount: 1, attendeeCount: 2 }],
    window: { from: 'a', to: 'b' },
  });
  const out = await scheduleMeeting({ title: 'Plan', participantIds: [BOB] }, ctx);
  expect(out.success).toBe(false);
  expect(out.candidates).toEqual([{ start: 's1', end: 'e1', availableCount: 1, attendeeCount: 2 }]);
  expect(mockCreate).not.toHaveBeenCalled();
});

test('no free slot at all', async () => {
  mockSuggest.mockResolvedValue({ slots: [], window: {} });
  const out = await scheduleMeeting({ title: 'Plan' }, ctx);
  expect(out).toMatchObject({ success: false, candidates: [] });
  expect(out.error).toMatch(/No free slot/);
});

test('rejects a bad startsAt and a missing title', async () => {
  expect((await scheduleMeeting({ title: 'x', startsAt: 'nope' }, ctx)).success).toBe(false);
  expect((await scheduleMeeting({ startsAt: '2026-11-02T10:00:00Z' }, ctx)).error).toMatch(/title/);
});
