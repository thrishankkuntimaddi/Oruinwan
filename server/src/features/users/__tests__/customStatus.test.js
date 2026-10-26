'use strict';

/** PATCH /api/users/status with a custom status ({ emoji, text }), used by /status, /away and /back. */

jest.mock('../../../identity', () => ({ users: { findById: jest.fn(), update: jest.fn() } }));
jest.mock('../../../shared/postgres', () => ({ query: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({}));

const identity = require('../../../identity');
const ctrl = require('../user.controller');

const res = () => {
    const r = {};
    r.status = jest.fn(() => r);
    r.json = jest.fn(() => r);
    return r;
};
const req = (body) => ({ user: { sub: 'u1' }, body, app: { get: () => ({ emit: jest.fn() }) } });

describe('custom status', () => {
    beforeEach(() => {
        identity.users.findById.mockResolvedValue({ _id: 'u1', profile: { about: 'Hi' } });
        identity.users.update.mockImplementation(async (id, patch) => ({ _id: id, username: 'ana', userStatus: patch.userStatus || 'active', profile: patch.profile || { about: 'Hi' } }));
    });

    it('normalises the value', () => {
        expect(ctrl.normalizeCustomStatus({ emoji: ' 🌴 ', text: ' On holiday ' })).toEqual({ emoji: '🌴', text: 'On holiday' });
        expect(ctrl.normalizeCustomStatus(null)).toBeNull();
        expect(ctrl.normalizeCustomStatus({ emoji: '', text: '' })).toBeNull();
        expect(ctrl.normalizeCustomStatus('x')).toBe(false);
        expect(ctrl.normalizeCustomStatus({ text: 'x'.repeat(101) })).toBe(false);
    });

    it('saves it in the profile, keeping the rest', async () => {
        const r = res();
        await ctrl.updateStatus(req({ customStatus: { emoji: '🌴', text: 'On holiday' } }), r);
        const patch = identity.users.update.mock.calls[0][1];
        expect(patch.profile.about).toBe('Hi');
        expect(patch.profile.customStatus).toMatchObject({ emoji: '🌴', text: 'On holiday' });
        expect(patch.userStatus).toBeUndefined();
        expect(r.json.mock.calls[0][0].customStatus).toMatchObject({ text: 'On holiday' });
    });

    it('sets presence and clears the status together', async () => {
        identity.users.findById.mockResolvedValue({ _id: 'u1', profile: { customStatus: { text: 'x' } } });
        const r = res();
        await ctrl.updateStatus(req({ status: 'active', customStatus: null }), r);
        const patch = identity.users.update.mock.calls[0][1];
        expect(patch.userStatus).toBe('active');
        expect(patch.profile.customStatus).toBeUndefined();
    });

    it('rejects bad input', async () => {
        let r = res();
        await ctrl.updateStatus(req({}), r);
        expect(r.status).toHaveBeenCalledWith(400);
        r = res();
        await ctrl.updateStatus(req({ status: 'sleeping' }), r);
        expect(r.status).toHaveBeenCalledWith(400);
    });
});
