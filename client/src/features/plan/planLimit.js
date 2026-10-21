/**
 * Free plan limits on the web client: detecting the server's PLAN_LIMIT refusal,
 * a tiny event bus that opens the one app-wide upgrade dialog, and helpers that
 * turn GET /api/plan into button states and counter text.
 *
 * Contract: ~/.oruinwan/build-notes/plan-limits-contract.md (403 body
 * { code: 'PLAN_LIMIT', limit, max, used, plan, upgradeUrl, message }).
 */

export const PLAN_LIMIT_CODE = 'PLAN_LIMIT';
export const UPGRADE_URL = '/pricing';
export const COMING_SOON_LINE = 'Pro and Enterprise are coming soon.';
export const UPGRADE_TITLE = 'Free plan limit reached';

/** True for a PLAN_LIMIT body (HTTP 403 JSON or a socket refusal payload). */
export function isPlanLimitBody(body) {
    return !!body && typeof body === 'object' && body.code === PLAN_LIMIT_CODE;
}

/** True for an axios-style error (or a raw response) carrying a PLAN_LIMIT refusal. */
export function isPlanLimitError(error) {
    if (!error) return false;
    const res = error.response || error;
    if (res.status != null && res.status !== 403) return false;
    return isPlanLimitBody(res.data);
}

/** The text the dialog shows for a refusal. */
export function planLimitMessage(body) {
    if (body?.message) return body.message;
    if (body?.error && typeof body.error === 'string') return body.error;
    if (body?.max != null) return `You've reached the free plan limit (${body.max}). ${COMING_SOON_LINE}`;
    return `You've reached a free plan limit. ${COMING_SOON_LINE}`;
}

// ── Event bus ────────────────────────────────────────────────────────────────

const listeners = new Set();
let lastRefusal = null; // { message, at } — lets the toast layer skip a duplicate error toast

/** Subscribe to plan-limit refusals. Returns an unsubscribe function. */
export function onPlanLimit(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Announce a refusal: opens the upgrade dialog and refreshes plan usage. */
export function emitPlanLimit(body = {}) {
    const detail = { ...body, code: PLAN_LIMIT_CODE, message: planLimitMessage(body) };
    lastRefusal = { message: detail.message, at: Date.now() };
    listeners.forEach((fn) => {
        try { fn(detail); } catch { /* one bad listener must not stop the others */ }
    });
    return detail;
}

/**
 * Hook for the central HTTP layers: if `error` is a PLAN_LIMIT refusal, announce it
 * once and mark the error so callers can tell. Returns true when it was one.
 */
export function handlePlanLimitError(error) {
    if (!isPlanLimitError(error)) return false;
    if (error && typeof error === 'object') {
        if (error.__planLimitHandled) return true;
        try { error.__planLimitHandled = true; } catch { /* frozen */ }
    }
    emitPlanLimit((error.response || error).data);
    return true;
}

/** For fetch() callers: pass the parsed JSON body and status of a failed response. */
export function handlePlanLimitResponse(status, body) {
    if (status !== 403 || !isPlanLimitBody(body)) return false;
    emitPlanLimit(body);
    return true;
}

/**
 * True when an error toast would only repeat the refusal the dialog is already
 * showing (same text, or a generic failure) within a few seconds of it.
 */
export function isDuplicateOfPlanLimit(message, now = Date.now()) {
    if (!lastRefusal || now - lastRefusal.at > 4000) return false;
    const text = String(message || '').trim();
    if (!text) return true;
    if (text === lastRefusal.message) return true;
    return /^(server error|something went wrong|request failed)/i.test(text);
}

export function __resetPlanBusForTests() {
    listeners.clear();
    lastRefusal = null;
}

// ── GET /api/plan helpers ────────────────────────────────────────────────────

/** Short human reason for each blockable action. */
const BLOCK_REASONS = {
    'workspaces.create': (max) => `You've created ${max} workspaces, the free plan limit.`,
    'workspaces.join': (max) => `You've joined ${max} workspaces, the free plan limit.`,
    'members.perWorkspace': (max) => `This workspace has ${max} people (including pending invites), the free plan limit.`,
    'channels.perWorkspace': (max) => `This workspace has ${max} channels besides #general, #random and its project channel, the free plan limit.`,
    'tasks.perWorkspace': (max) => `This workspace has ${max} active tasks, the free plan limit.`,
    'tasks.selfCreated': (max) => `You have ${max} active tasks for yourself, the free plan limit.`,
    'tasks.assignedToOthers': (max) => `You've assigned ${max} active tasks to others, the free plan limit.`,
    'ai.userDaily': (max) => `You've used all ${max} AI requests for today.`,
    'ai.workspaceDaily': (max) => `This workspace has used all ${max} AI requests for today.`,
};

/**
 * Whether the next addition of `keys` (one key or a list; blocked when ANY is) would
 * be refused. `{ blocked, key, reason, message }` — reason is a one-line explanation.
 */
export function planBlock(plan, keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (!plan || plan.exempt) return { blocked: false, key: null, reason: '', message: '' };
    const key = list.find((k) => plan.blocked?.[k]);
    if (!key) return { blocked: false, key: null, reason: '', message: '' };
    const max = plan.limits?.[key] ?? plan.items?.find((i) => i.key === key)?.max;
    const reason = (BLOCK_REASONS[key] || (() => 'You have reached a free plan limit.'))(max);
    return {
        blocked: true,
        key,
        reason: `${reason} ${COMING_SOON_LINE}`,
        message: `You've reached the free plan limit. ${reason} ${COMING_SOON_LINE}`,
    };
}

/** Props that make a create button look disabled but still explain itself (focusable, with a tooltip). */
export function blockedButtonProps(block) {
    if (!block?.blocked) return {};
    return { 'aria-disabled': 'true', 'data-plan-blocked': 'true', title: block.reason };
}

/** Wrap a create action: when blocked, open the upgrade dialog instead. */
export function guardAction(block, action) {
    return (...args) => {
        if (block?.blocked) {
            emitPlanLimit({ limit: block.key, message: block.message });
            return undefined;
        }
        return action?.(...args);
    };
}

/** Normalise GET /api/plan/ai, plan.ai or a plan:ai_usage payload into one shape. */
export function normalizeAIUsage(raw, exempt = false) {
    if (!raw) return null;
    const rem = (used, max, given) => {
        if (max == null) return null;
        if (given != null) return given;
        return Math.max(0, max - (used || 0));
    };
    const userMax = raw.userMax ?? null;
    const workspaceMax = raw.workspaceMax ?? null;
    return {
        userUsed: raw.userUsed ?? 0,
        userMax,
        userRemaining: rem(raw.userUsed, userMax, raw.userRemaining),
        workspaceUsed: raw.workspaceUsed ?? 0,
        workspaceMax,
        workspaceRemaining: rem(raw.workspaceUsed, workspaceMax, raw.workspaceRemaining),
        resetsAt: raw.resetsAt || null,
        exempt: !!(raw.exempt ?? exempt),
    };
}

/** Requests left before either the personal or the workspace cap stops AI (null = unlimited). */
export function aiRemaining(ai) {
    if (!ai || ai.exempt) return null;
    const vals = [ai.userRemaining, ai.workspaceRemaining].filter((v) => v != null);
    return vals.length ? Math.min(...vals) : null;
}

/** "12 of 50 AI requests left today" (empty string when there is nothing to show). */
export function aiUsageText(ai) {
    if (!ai || ai.exempt) return '';
    const userLeft = ai.userRemaining;
    const wsLeft = ai.workspaceRemaining;
    if (userLeft == null && wsLeft == null) return '';
    if (wsLeft != null && (userLeft == null || wsLeft < userLeft)) {
        return wsLeft === 0
            ? `This workspace has used all ${ai.workspaceMax} AI requests for today`
            : `${wsLeft} of ${ai.workspaceMax} workspace AI requests left today`;
    }
    return userLeft === 0
        ? `You've used all ${ai.userMax} AI requests for today`
        : `${userLeft} of ${ai.userMax} AI requests left today`;
}

/** "resets at 05:30" in the viewer's local time (or "" without a time). */
export function resetText(resetsAt) {
    if (!resetsAt) return '';
    const d = new Date(resetsAt);
    if (Number.isNaN(d.getTime())) return '';
    return `resets at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

/** Template ids accepted by POST /api/notes (blank → none, unlimited). */
export function noteTemplateId(template) {
    const id = template?.id;
    if (!id || id === 'blank') return undefined;
    return id;
}
