'use strict';

/**
 * Domain ownership TXT records use `oruinwan-verification=`. Anything else does not verify.
 */

jest.mock('dns', () => ({ promises: { resolveTxt: jest.fn() } }));
jest.mock('../../../identity/queries/org', () => ({}));
jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn() }));

const dns = require('dns').promises;
const svc = require('../domain.service');
const legacy = require('../../../../utils/domainVerification');

describe('domain verification TXT prefix', () => {
    test('new records use the Oruinwan prefix', () => {
        const { token, txtRecord } = svc.generateDomainVerificationToken();
        expect(txtRecord).toBe(`oruinwan-verification=${token}`);
        expect(legacy.generateDomainVerificationToken().txtRecord).toMatch(/^oruinwan-verification=/);
    });

    test.each([
        ['oruinwan-verification=tok', true],
        ['oruinwan-verification=other', false],
        ['something-else=tok', false],
        ['tok', false],
    ])('%s → %s', async (value, ok) => {
        dns.resolveTxt.mockResolvedValue([['v=spf1 -all'], [value]]);
        await expect(svc.verifyDomainTXT('northwind.test', 'tok')).resolves.toBe(ok);
        await expect(legacy.verifyDomainTXT('northwind.test', 'tok')).resolves.toBe(ok);
    });

    test('a record split into several strings is joined before matching', async () => {
        dns.resolveTxt.mockResolvedValue([['oruinwan-verification=', 'tok']]);
        await expect(svc.verifyDomainTXT('northwind.test', 'tok')).resolves.toBe(true);
    });

    test('an empty expected token never matches', () => {
        expect(svc.txtMatches('oruinwan-verification=', '')).toBe(false);
    });
});
