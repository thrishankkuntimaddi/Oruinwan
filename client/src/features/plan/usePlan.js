import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { normalizeAIUsage, onPlanLimit } from './planLimit';

/**
 * GET /api/plan for a workspace (or just the user without one), shared by every
 * component on screen: one request per workspace, cached briefly, refetched when
 * the workspace changes, after a PLAN_LIMIT refusal and after things are added or
 * removed. AI numbers update live from the `plan:ai_usage` socket event.
 */

const TTL_MS = 15000;
const cache = new Map(); // key -> { data, at, promise }
const subscribers = new Map(); // key -> Set<setState>

const keyOf = (workspaceId) => (workspaceId ? String(workspaceId) : '__user__');

function publish(key, data) {
    const entry = cache.get(key) || {};
    cache.set(key, { ...entry, data, at: Date.now(), promise: null });
    subscribers.get(key)?.forEach((fn) => fn(data));
}

export function fetchPlan(workspaceId, { force = false } = {}) {
    const key = keyOf(workspaceId);
    const entry = cache.get(key);
    if (!force && entry?.promise) return entry.promise;
    if (!force && entry?.data && Date.now() - entry.at < TTL_MS) return Promise.resolve(entry.data);
    const promise = api.get('/api/plan', { params: workspaceId ? { workspaceId } : {} })
        .then(({ data }) => { publish(key, data); return data; })
        .catch((err) => {
            const cur = cache.get(key);
            if (cur) cache.set(key, { ...cur, promise: null });
            throw err;
        });
    cache.set(key, { ...(entry || {}), promise });
    return promise;
}

/** Drop cached plans (all, or one workspace) so the next read refetches. */
export function invalidatePlan(workspaceId) {
    if (workspaceId === undefined) cache.clear();
    else cache.delete(keyOf(workspaceId));
}

export function __resetPlanCacheForTests() {
    cache.clear();
    subscribers.clear();
}

/** Merge a plan:ai_usage payload into a GET /api/plan body. */
export function applyAIUsage(plan, payload) {
    if (!plan || !payload) return plan;
    const ai = normalizeAIUsage({ ...plan.ai, ...payload, userRemaining: undefined, workspaceRemaining: undefined }, plan.exempt);
    const items = (plan.items || []).map((it) => {
        if (it.key === 'ai.userDaily' && ai.userMax != null) return { ...it, used: ai.userUsed, max: ai.userMax, atLimit: ai.userUsed >= ai.userMax };
        if (it.key === 'ai.workspaceDaily' && ai.workspaceMax != null) return { ...it, used: ai.workspaceUsed, max: ai.workspaceMax, atLimit: ai.workspaceUsed >= ai.workspaceMax };
        return it;
    });
    const blocked = { ...(plan.blocked || {}) };
    if (ai.userMax != null) blocked['ai.userDaily'] = ai.userUsed >= ai.userMax;
    if (ai.workspaceMax != null) blocked['ai.workspaceDaily'] = ai.workspaceUsed >= ai.workspaceMax;
    return { ...plan, ai: { ...plan.ai, ...ai }, items, blocked };
}

// Socket events after which counts can change (creations and removals).
const CHANGE_EVENTS = [
    'workspace-created', 'workspace-joined', 'workspace-deleted', 'member-left',
    'channel-created', 'channel-deleted', 'task-created', 'task-updated', 'task-deleted',
    'note-created', 'note-deleted',
];

/**
 * usePlan(workspaceId) → { plan, loading, error, refresh }.
 * Pass `null` for the user-level plan (workspaces you created/joined).
 * Pass `false` to skip loading entirely.
 */
export function usePlan(workspaceId) {
    const enabled = workspaceId !== false;
    const key = keyOf(enabled ? workspaceId : null);
    const [plan, setPlan] = useState(() => (enabled ? cache.get(key)?.data || null : null));
    const [loading, setLoading] = useState(enabled && !cache.get(key)?.data);
    const [error, setError] = useState(null);
    const socket = useOptionalSocket()?.socket || null;
    const wsRef = useRef(workspaceId);
    wsRef.current = workspaceId;

    const refresh = useCallback((force = true) => {
        if (!enabled) return Promise.resolve(null);
        setError(null);
        return fetchPlan(wsRef.current || null, { force })
            .then((data) => { setLoading(false); return data; })
            .catch((err) => { setLoading(false); setError(err); return null; });
    }, [enabled]);

    // Subscribe to this key and load it.
    useEffect(() => {
        if (!enabled) return undefined;
        let set = subscribers.get(key);
        if (!set) { set = new Set(); subscribers.set(key, set); }
        const onData = (data) => setPlan(data);
        set.add(onData);
        setPlan(cache.get(key)?.data || null);
        setLoading(!cache.get(key)?.data);
        refresh(false);
        return () => { set.delete(onData); };
    }, [enabled, key, refresh]);

    // A refusal means our numbers are stale.
    useEffect(() => {
        if (!enabled) return undefined;
        return onPlanLimit(() => { invalidatePlan(); refresh(true); });
    }, [enabled, refresh]);

    // Live AI counts and debounced refetch after additions/removals.
    useEffect(() => {
        if (!enabled || !socket) return undefined;
        let timer = null;
        const onAI = (payload) => {
            if (payload?.workspaceId && workspaceId && String(payload.workspaceId) !== String(workspaceId)) return;
            const cur = cache.get(key)?.data;
            if (cur) publish(key, applyAIUsage(cur, payload));
        };
        const onChange = () => {
            clearTimeout(timer);
            timer = setTimeout(() => { invalidatePlan(); refresh(true); }, 800);
        };
        socket.on('plan:ai_usage', onAI);
        CHANGE_EVENTS.forEach((e) => socket.on(e, onChange));
        return () => {
            clearTimeout(timer);
            socket.off('plan:ai_usage', onAI);
            CHANGE_EVENTS.forEach((e) => socket.off(e, onChange));
        };
    }, [enabled, socket, key, workspaceId, refresh]);

    return { plan, loading, error, refresh };
}

/**
 * Small AI counter: GET /api/plan/ai for the workspace, kept live by `plan:ai_usage`.
 * Returns the normalised usage (see normalizeAIUsage) or null while loading/unknown.
 */
export function useAIUsage(workspaceId) {
    const [ai, setAI] = useState(null);
    const socket = useOptionalSocket()?.socket || null;

    const load = useCallback(() => {
        if (!workspaceId) { setAI(null); return; }
        api.get('/api/plan/ai', { params: { workspaceId } })
            .then(({ data }) => setAI(normalizeAIUsage(data, data?.exempt)))
            .catch(() => setAI(null));
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => onPlanLimit((d) => { if (String(d?.limit || '').startsWith('ai.')) load(); }), [load]);

    useEffect(() => {
        if (!socket || !workspaceId) return undefined;
        const onAI = (payload) => {
            if (payload?.workspaceId && String(payload.workspaceId) !== String(workspaceId)) return;
            setAI((cur) => normalizeAIUsage({ ...(cur || {}), ...payload, userRemaining: undefined, workspaceRemaining: undefined }, cur?.exempt));
        };
        socket.on('plan:ai_usage', onAI);
        return () => socket.off('plan:ai_usage', onAI);
    }, [socket, workspaceId]);

    return ai;
}

export default usePlan;
