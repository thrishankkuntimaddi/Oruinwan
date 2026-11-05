jest.mock('../../../shared/postgres', () => ({ query: jest.fn() }));
jest.mock('../../../identity', () => ({ users: { setOnline: jest.fn(async () => {}), touchActivity: jest.fn(async () => {}) } }));
jest.mock('../../analytics/activeDays', () => ({ markActive: jest.fn() }));

const { query } = require('../../../shared/postgres');
const presence = require('../presence.service');

const io = { to: () => ({ emit: () => {} }) };

describe('presence', () => {
    beforeEach(() => { presence._setRedisForTests(null); query.mockReset(); });

    test('setOffline says when the last socket is gone', async () => {
        await presence.setOnline(io, 'u1', 's1', null);
        await presence.setOnline(io, 'u1', 's2', null);
        expect(await presence.setOffline(io, 'u1', 's1', null)).toBe(false);
        expect(await presence.setOffline(io, 'u1', 's2', null)).toBe(true);
        expect(await presence.setOffline(io, 'u1', 's2', null)).toBe(false);
    });

    test('the sweep clears stored online flags with no live socket', async () => {
        await presence.setOnline(io, 'live', 's9', null);
        query.mockResolvedValueOnce({ rows: [{ id: 'live' }, { id: 'stale' }] }).mockResolvedValueOnce({ rows: [] });
        expect(await presence.sweepStaleOnline()).toEqual(['stale']);
        expect(query).toHaveBeenLastCalledWith(expect.stringContaining('is_online = false'), [['stale']]);
        await presence.setOffline(io, 'live', 's9', null);
    });
});
