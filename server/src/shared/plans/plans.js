'use strict';

/**
 * Plans and their limits — the single source of truth.
 *
 *   free         the plan every individual account and its workspaces start on
 *   pro          coming soon (higher limits)
 *   enterprise   coming soon (no limits)
 *   company      company accounts and company workspaces: never limited by these numbers
 *
 * A limit of `null` means unlimited. Keys are the `limit` values the API returns
 * in PLAN_LIMIT refusals (see docs/api/plans.md).
 *
 * Self-hosters:
 *   ORUINWAN_UNLIMITED=1        every plan is unlimited (no checks, no counters refuse)
 *   PLAN_LIMITS_JSON='{"free":{"ai.userDaily":200,"channels.perWorkspace":null}}'
 *                               override any limit of any plan (merged over the defaults)
 */

const UPGRADE_URL = '/pricing';

const LIMIT_KEYS = [
    'workspaces.create',
    'workspaces.join',
    'members.perWorkspace',
    'channels.perWorkspace',
    'huddles.participants',
    'huddles.minutes',
    'notes.perTemplate',
    'notes.externalSharing',
    'tasks.perWorkspace',
    'tasks.selfCreated',
    'tasks.assignedToOthers',
    'ai.userDaily',
    'ai.workspaceDaily',
];

const UNLIMITED = Object.freeze(Object.fromEntries(LIMIT_KEYS.map((k) => [k, k === 'notes.externalSharing' ? true : null])));

const DEFAULT_PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        comingSoon: false,
        limits: {
            'workspaces.create': 2,
            'workspaces.join': 2,
            'members.perWorkspace': 11, // owner + 10 others (pending invites count, bots don't)
            'channels.perWorkspace': 10, // besides the ones made with the workspace (#general, #random, the wizard's project channel)
            'huddles.participants': 10,
            'huddles.minutes': 30,
            'notes.perTemplate': 2,
            'notes.externalSharing': false, // notes are shared inside the workspace only
            'tasks.perWorkspace': 300,
            'tasks.selfCreated': 30,
            'tasks.assignedToOthers': 30,
            'ai.userDaily': 50,
            'ai.workspaceDaily': 300,
        },
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        comingSoon: true,
        limits: {
            'workspaces.create': 10,
            'workspaces.join': 20,
            'members.perWorkspace': 101,
            'channels.perWorkspace': null,
            'huddles.participants': 25,
            'huddles.minutes': 300,
            'notes.perTemplate': null,
            'notes.externalSharing': true,
            'tasks.perWorkspace': 10000,
            'tasks.selfCreated': null,
            'tasks.assignedToOthers': null,
            'ai.userDaily': 500,
            'ai.workspaceDaily': 5000,
        },
    },
    enterprise: { id: 'enterprise', name: 'Enterprise', comingSoon: true, limits: { ...UNLIMITED } },
    company: { id: 'company', name: 'Company', comingSoon: false, limits: { ...UNLIMITED } },
};

/** Human wording for messages and usage bars. */
const LABELS = {
    'workspaces.create': { label: 'Workspaces you created', noun: (n) => `${n} workspace${n === 1 ? '' : 's'} you created` },
    'workspaces.join': { label: 'Workspaces you joined', noun: (n) => `${n} workspace${n === 1 ? '' : 's'} you joined` },
    'members.perWorkspace': { label: 'Members (incl. pending invites)', noun: (n) => `${n} members per workspace (the owner + ${Math.max(0, n - 1)} others, pending invites included)` },
    'channels.perWorkspace': { label: 'Channels (besides #general, #random and your project channel)', noun: (n) => `${n} channels per workspace besides #general, #random and the project channel made with it` },
    'huddles.participants': { label: 'People in a call', noun: (n) => `${n} people in a call` },
    'huddles.minutes': { label: 'Minutes per call', noun: (n) => `${n} minutes per call` },
    'notes.perTemplate': { label: 'Notes per template', noun: (n) => `${n} notes from each template per workspace` },
    'notes.externalSharing': { label: 'Sharing notes outside the workspace', noun: () => 'notes are shared inside the workspace only' },
    'tasks.perWorkspace': { label: 'Active tasks in this workspace', noun: (n) => `${n} active tasks per workspace` },
    'tasks.selfCreated': { label: 'Your active tasks for yourself', noun: (n) => `${n} active tasks you created for yourself` },
    'tasks.assignedToOthers': { label: 'Active tasks you assigned to others', noun: (n) => `${n} active tasks you created for others` },
    'ai.userDaily': { label: 'Your AI requests today', noun: (n) => `${n} AI requests per person per day` },
    'ai.workspaceDaily': { label: 'Workspace AI requests today', noun: (n) => `${n} AI requests per workspace per day` },
};

function parseOverrides(env) {
    if (!env.PLAN_LIMITS_JSON) return {};
    try {
        const parsed = JSON.parse(env.PLAN_LIMITS_JSON);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function isUnlimitedServer(env = process.env) {
    return env.ORUINWAN_UNLIMITED === '1' || env.ORUINWAN_UNLIMITED === 'true';
}

/** Every plan with env overrides applied. */
function getPlans(env = process.env) {
    const overrides = parseOverrides(env);
    const out = {};
    for (const [id, plan] of Object.entries(DEFAULT_PLANS)) {
        const extra = overrides[id] && typeof overrides[id] === 'object' ? overrides[id] : {};
        const limits = { ...plan.limits };
        for (const [k, v] of Object.entries(extra)) {
            if (!LIMIT_KEYS.includes(k)) continue;
            if (v === null || typeof v === 'boolean' || (Number.isFinite(Number(v)) && Number(v) >= 0)) {
                limits[k] = v === null || typeof v === 'boolean' ? v : Number(v);
            }
        }
        out[id] = { ...plan, limits: isUnlimitedServer(env) ? { ...UNLIMITED } : limits };
    }
    return out;
}

function normalizePlan(plan) {
    return Object.prototype.hasOwnProperty.call(DEFAULT_PLANS, plan) ? plan : 'free';
}

function limitsFor(plan, env = process.env) {
    return getPlans(env)[normalizePlan(plan)].limits;
}

/** The limit for one key on a plan; null = unlimited. */
function limitOf(plan, key, env = process.env) {
    const v = limitsFor(plan, env)[key];
    return v === undefined ? null : v;
}

/** Public list for the pricing / usage screens. */
function publicPlans(env = process.env) {
    return ['free', 'pro', 'enterprise'].map((id) => {
        const p = getPlans(env)[id];
        return { id, name: p.name, comingSoon: p.comingSoon, limits: p.limits };
    });
}

function limitMessage(key, max) {
    const words = LABELS[key] ? LABELS[key].noun(max) : `${max} ${key}`;
    return `You've reached the free plan limit: ${words}. Pro and Enterprise are coming soon.`;
}

/** The body every PLAN_LIMIT refusal (HTTP 403 or socket) carries. */
function planLimitBody(key, { max, used, plan = 'free', message } = {}) {
    const text = message || limitMessage(key, max);
    return {
        success: false,
        code: 'PLAN_LIMIT',
        limit: key,
        max: max === undefined ? null : max,
        used: used === undefined ? null : used,
        plan,
        upgradeUrl: UPGRADE_URL,
        message: text,
        error: text,
    };
}

class PlanLimitError extends Error {
    constructor(key, details = {}) {
        const body = planLimitBody(key, details);
        super(body.message);
        this.name = 'PlanLimitError';
        this.code = 'PLAN_LIMIT';
        this.status = 403;
        this.statusCode = 403;
        this.body = body;
    }
}

module.exports = {
    UPGRADE_URL, LIMIT_KEYS, LABELS, DEFAULT_PLANS,
    getPlans, limitsFor, limitOf, publicPlans, normalizePlan, isUnlimitedServer,
    limitMessage, planLimitBody, PlanLimitError,
};
