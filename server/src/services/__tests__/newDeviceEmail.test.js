'use strict';

// The "new sign-in" email goes out only for a device that is really new.

jest.mock('../../shared/postgres', () => ({ query: jest.fn() }));
jest.mock('../../identity', () => ({ users: { findById: jest.fn() } }));
jest.mock('../securityNotification.service', () => ({ sendSecurityNotification: jest.fn() }));
jest.mock('../securityAudit.service', () => ({ logSecurityEvent: jest.fn() }));

const { query } = require('../../shared/postgres');
const { users } = require('../../identity');
const securityNotification = require('../securityNotification.service');
const sessions = require('../deviceSession.service');

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const FIREFOX_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';

let userSeq = 0;
const newUser = () => `u${++userSeq}`; // the 10-minute gap is per user

/** Postgres answers: the insert (brand-new row), then the "other devices" lookup. */
function pg({ inserted = true, others = [] } = {}) {
    query.mockImplementation(async (sql) => {
        if (/INSERT INTO user_device_sessions/.test(sql)) {
            return { rows: [{ user_id: 'u', device_id: 'd', device_name: 'Chrome on Mac', platform: 'web', meta: {}, inserted }] };
        }
        if (/SELECT meta FROM user_device_sessions/.test(sql)) return { rows: others.map((meta) => ({ meta })) };
        return { rows: [] };
    });
}

const signIn = (userId, extra = {}) => sessions.createOrUpdateSession({
    userId, deviceId: 'dev-new', deviceName: 'Chrome on Mac', platform: 'web', userAgent: CHROME_MAC, ipAddress: '13.205.1.9', ...extra,
});

beforeEach(() => {
    jest.clearAllMocks();
    users.findById.mockResolvedValue({ _id: 'u', email: 'u@x.io', preferences: {} });
});

describe('new sign-in email', () => {
    test('a brand-new device from an unknown browser and network sends it', async () => {
        pg({ others: [{ userAgent: FIREFOX_WIN, ipAddress: '81.2.3.4' }] });
        await signIn(newUser());
        expect(securityNotification.sendSecurityNotification).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'LOGIN_NEW_DEVICE' }));
    });

    test('a returning device never sends it', async () => {
        pg({ inserted: false });
        await signIn(newUser());
        expect(securityNotification.sendSecurityNotification).not.toHaveBeenCalled();
    });

    test('same browser family on the same network in the last 30 days (cleared storage) does not', async () => {
        pg({ others: [{ userAgent: CHROME_MAC.replace('130.0', '129.0'), ipAddress: '13.205.1.200' }] });
        await signIn(newUser());
        expect(securityNotification.sendSecurityNotification).not.toHaveBeenCalled();
    });

    test('at most one per 10 minutes', async () => {
        pg();
        const id = newUser();
        await signIn(id);
        await signIn(id, { deviceId: 'dev-other' });
        expect(securityNotification.sendSecurityNotification).toHaveBeenCalledTimes(1);
    });

    test('turned off in Settings → Notifications', async () => {
        pg();
        users.findById.mockResolvedValue({ _id: 'u', email: 'u@x.io', preferences: { notifications: { newSignInEmails: false } } });
        await signIn(newUser());
        expect(securityNotification.sendSecurityNotification).not.toHaveBeenCalled();
    });
});

describe('helpers', () => {
    test('userAgentFamily and networkOf', () => {
        expect(sessions.userAgentFamily(CHROME_MAC)).toBe('chrome/mac');
        expect(sessions.userAgentFamily(FIREFOX_WIN)).toBe('firefox/windows');
        expect(sessions.networkOf('::ffff:10.1.2.3')).toBe('10.1.2');
        expect(sessions.networkOf('2001:db8:aa:bb:1::2')).toBe('2001:db8:aa:bb');
        expect(sessions.networkOf('')).toBeNull();
    });
});
