'use strict';

const { tenantMap, tenantUri, hasDedicatedDatabase, modelFor } = require('../tenantDb');

describe('tenant database routing', () => {
    test('no map: every company stays on the default model', () => {
        const Model = { modelName: 'Thing' };
        expect(tenantUri('abc', {})).toBeNull();
        expect(hasDedicatedDatabase('abc', {})).toBe(false);
        expect(modelFor(Model, 'abc', {})).toBe(Model);
    });

    test('parses the map and resolves a company', () => {
        const env = { TENANT_DB_MAP: JSON.stringify({ c1: 'mongodb://tenant-one/db' }) };
        expect(tenantMap(env)).toEqual({ c1: 'mongodb://tenant-one/db' });
        expect(tenantUri('c1', env)).toBe('mongodb://tenant-one/db');
        expect(tenantUri('c2', env)).toBeNull();
    });

    test('a broken map is ignored instead of crashing', () => {
        expect(tenantMap({ TENANT_DB_MAP: '{not json' })).toEqual({});
        expect(tenantMap({ TENANT_DB_MAP: '[1,2]' })).toEqual({});
    });
});
