'use strict';

/**
 * Whose plan limits a call is decided on the server: a client-sent workspace id
 * never exempts a call. A DM outside any workspace follows the caller's own plan,
 * and the people cap is checked in the same step that adds the person.
 */

jest.mock('../../../../models/DMSession', () => ({ findById: jest.fn() }));
jest.mock('../../../identity', () => ({ workspaces: { membership: jest.fn() } }));

const DMSession = require('../../../../models/DMSession');
const identity = require('../../../identity');
const { verifyScopeMembership, planMeta } = require('../huddles.socket');
const { HuddleRegistry, planSourceOf } = require('../huddleRegistry');
const { timeLimitFor } = require('../../../shared/plans/huddleTimer');

const socket = { user: { id: 'me' } };
const dm = (doc) => DMSession.findById.mockReturnValue({ select: async () => doc });

beforeEach(() => jest.clearAllMocks());

describe('scope', () => {
    test('a DM in a workspace uses that workspace, whatever the client sent', async () => {
        dm({ participants: ['me', 'you'], workspace: 'w1', blockedBy: [] });
        const r = await verifyScopeMembership(socket, { dmId: 'd1', workspaceId: 'corp' });
        expect(r.scope).toMatchObject({ dmId: 'd1', workspaceId: 'w1', planWorkspaceId: 'w1' });
        expect(planMeta(r.scope, 'me')).toEqual({});
    });

    test('a DM outside any workspace: the client workspace only groups the call, the caller\'s plan applies', async () => {
        dm({ participants: ['me', 'you'], workspace: null, blockedBy: [] });
        identity.workspaces.membership.mockResolvedValue({ member: true });
        const r = await verifyScopeMembership(socket, { dmId: 'd1', workspaceId: 'corp' });
        expect(r.scope).toMatchObject({ workspaceId: 'corp', planWorkspaceId: null });
        expect(planMeta(r.scope, 'me')).toEqual({ planUserId: 'me' });

        identity.workspaces.membership.mockResolvedValue({ member: false });
        const notMember = await verifyScopeMembership(socket, { dmId: 'd1', workspaceId: 'corp' });
        expect(notMember.scope.workspaceId).toBeNull();
    });

    test('the registry keeps whose plan applies (and replicates it)', () => {
        const reg = new HuddleRegistry();
        const { huddle } = reg.ensure('h1', { dmId: 'd1' }, { workspaceId: 'corp', planUserId: 'me' });
        expect(planSourceOf(huddle)).toEqual({ workspaceId: null, userId: 'me' });
        const copy = new HuddleRegistry();
        copy.restore(reg.snapshot());
        expect(planSourceOf(copy.get('h1'))).toEqual({ workspaceId: null, userId: 'me' });
        const ch = reg.ensure('h2', { channelId: 'c1' }, { workspaceId: 'w1' }).huddle;
        expect(planSourceOf(ch)).toEqual({ workspaceId: 'w1', userId: null });
    });
});

describe('limits', () => {
    test('the 30-minute cap applies to a workspace-less DM call through the caller\'s plan', async () => {
        const reg = new HuddleRegistry();
        const { huddle } = reg.ensure('h1', { dmId: 'd1' }, { workspaceId: 'corp', planUserId: 'me', startedAt: new Date('2026-10-21T10:00:00Z') });
        const limitsFor = jest.fn(async (ws, opts) => (ws ? { minutes: null } : opts?.userId === 'me' ? { plan: 'free', minutes: 30 } : null));
        const limit = await timeLimitFor(huddle, limitsFor);
        expect(limitsFor).toHaveBeenCalledWith(null, { userId: 'me' });
        expect(limit).toMatchObject({ maxMinutes: 30 });
    });

    test('the people cap is part of the join itself', () => {
        const reg = new HuddleRegistry({ maxParticipants: 50 });
        reg.ensure('h1', { channelId: 'c1' }, { workspaceId: 'w1' });
        for (let i = 0; i < 10; i++) expect(reg.join('h1', { userId: `u${i}`, socketId: `s${i}`, max: 10 }).error).toBeUndefined();
        expect(reg.join('h1', { userId: 'u10', socketId: 's10', max: 10 })).toEqual({ error: 'PLAN_LIMIT', used: 10 });
        // Someone already in the call may re-join.
        expect(reg.join('h1', { userId: 'u3', socketId: 's3b', max: 10 }).error).toBeUndefined();
        expect(reg.get('h1').participants.size).toBe(10);
    });
});
