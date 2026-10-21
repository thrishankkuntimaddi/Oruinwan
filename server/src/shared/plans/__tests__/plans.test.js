'use strict';

const plans = require('../plans');

describe('plan definitions', () => {
    test('free plan numbers', () => {
        const l = plans.limitsFor('free', {});
        expect(l).toMatchObject({
            'workspaces.create': 2, 'workspaces.join': 2, 'members.perWorkspace': 11, 'channels.perWorkspace': 10,
            'huddles.participants': 10, 'huddles.minutes': 30, 'notes.perTemplate': 2, 'notes.externalSharing': false,
            'tasks.perWorkspace': 300, 'tasks.selfCreated': 30, 'tasks.assignedToOthers': 30, 'ai.userDaily': 50, 'ai.workspaceDaily': 300,
        });
    });

    test('pro and enterprise are coming soon; enterprise and company are unlimited', () => {
        const list = plans.publicPlans({});
        expect(list.map((p) => [p.id, p.comingSoon])).toEqual([['free', false], ['pro', true], ['enterprise', true]]);
        expect(plans.limitOf('enterprise', 'ai.userDaily', {})).toBeNull();
        expect(plans.limitOf('company', 'workspaces.create', {})).toBeNull();
        expect(plans.limitOf('pro', 'ai.userDaily', {})).toBeGreaterThan(50);
    });

    test('unknown plans fall back to free', () => {
        expect(plans.normalizePlan('gold')).toBe('free');
        expect(plans.limitOf('gold', 'channels.perWorkspace', {})).toBe(10);
    });

    test('PLAN_LIMITS_JSON overrides single limits', () => {
        const env = { PLAN_LIMITS_JSON: JSON.stringify({ free: { 'ai.userDaily': 200, 'channels.perWorkspace': null, bogus: 3 } }) };
        expect(plans.limitOf('free', 'ai.userDaily', env)).toBe(200);
        expect(plans.limitOf('free', 'channels.perWorkspace', env)).toBeNull();
        expect(plans.limitOf('free', 'workspaces.create', env)).toBe(2);
        expect(plans.limitOf('free', 'ai.userDaily', { PLAN_LIMITS_JSON: '{not json' })).toBe(50);
    });

    test('ORUINWAN_UNLIMITED=1 lifts every limit', () => {
        const env = { ORUINWAN_UNLIMITED: '1' };
        expect(plans.limitOf('free', 'workspaces.create', env)).toBeNull();
        expect(plans.limitOf('free', 'notes.externalSharing', env)).toBe(true);
        expect(plans.isUnlimitedServer(env)).toBe(true);
    });

    test('the PLAN_LIMIT body has one shape', () => {
        const err = new plans.PlanLimitError('workspaces.create', { max: 2, used: 2 });
        expect(err.status).toBe(403);
        expect(err.code).toBe('PLAN_LIMIT');
        expect(err.body).toEqual(expect.objectContaining({
            code: 'PLAN_LIMIT', limit: 'workspaces.create', max: 2, used: 2, plan: 'free', upgradeUrl: '/pricing',
            message: "You've reached the free plan limit: 2 workspaces you created. Pro and Enterprise are coming soon.",
        }));
    });

    test('sendPlanLimit answers 403 with the body and ignores other errors', () => {
        const { sendPlanLimit } = require('..');
        const res = { status: jest.fn(function s() { return this; }), json: jest.fn() };
        expect(sendPlanLimit(res, new Error('x'))).toBe(false);
        expect(sendPlanLimit(res, new plans.PlanLimitError('channels.perWorkspace', { max: 10, used: 10 }))).toBe(true);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'PLAN_LIMIT', limit: 'channels.perWorkspace', max: 10, used: 10 });
    });
});
