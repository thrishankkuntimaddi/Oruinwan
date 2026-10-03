'use strict';

const { resolveRole, capabilities, roleWarnings } = require('../processRole');

describe('process roles', () => {
    test('defaults to all, ignores unknown values', () => {
        expect(resolveRole({})).toBe('all');
        expect(resolveRole({ PROCESS_ROLE: 'banana' })).toBe('all');
        expect(resolveRole({ PROCESS_ROLE: ' Worker ' })).toBe('worker');
    });

    test('capabilities per role', () => {
        expect(capabilities('all')).toEqual({ http: true, sockets: true, jobs: true, storage: true });
        expect(capabilities('api')).toEqual({ http: true, sockets: false, jobs: false, storage: true });
        expect(capabilities('realtime')).toEqual({ http: true, sockets: true, jobs: false, storage: true });
        expect(capabilities('worker')).toEqual({ http: false, sockets: false, jobs: true });
        expect(capabilities('storage')).toEqual({ http: false, sockets: false, jobs: false, storage: true });
    });

    test('warns when a split role has no Redis', () => {
        expect(roleWarnings({}, 'all')).toEqual([]);
        expect(roleWarnings({}, 'worker')).toHaveLength(1);
        expect(roleWarnings({ REDIS_URL: 'redis://x' }, 'worker')).toEqual([]);
    });
});
