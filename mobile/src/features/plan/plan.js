// Free-plan limits on the phone: the plan and today's AI count from the server (cached like any
// other query), the upgrade sheet's state, and the live events that change them.
import { create } from 'zustand';
import { api, useSession } from '../../data/session.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { on, toast } from '../../lib/bus.js';
import { openExternal } from '../../native/index.js';
import { isBlocked, pricingUrl } from './planText.js';

export const planKey = (ws) => `plan:${ws || 'me'}`;
export const aiKey = (ws) => `planai:${ws || 'me'}`;

const live = (s) => s.mode === 'live' && s.status === 'signed-in';

/** GET /api/plan for this workspace (or just me): { data: plan | null, loading }. */
export function usePlan(ws) {
  const on_ = useSession(live);
  return useQuery(on_ ? planKey(ws) : null, () => api().getPlan?.(ws) ?? null, { staleMs: 30_000 });
}

/** True when creating `key` here would be refused, with the plan for the explanation. */
export function usePlanBlock(ws, key) {
  const { data } = usePlan(ws);
  return { plan: data || null, blocked: isBlocked(data, key) };
}

/** Today's AI requests (GET /api/plan/ai); kept current by plan:ai_usage. */
export function useAiQuota(ws) {
  const on_ = useSession(live);
  return useQuery(on_ ? aiKey(ws) : null, () => api().getAiQuota?.(ws) ?? null, { staleMs: 30_000 });
}

/** After an AI request: fetch the count again (the socket event usually beats this). */
export const refreshAiQuota = (ws) => invalidate(aiKey(ws));

/** The upgrade sheet: open with the refusal's details ({ limit, max, used, plan, upgradeUrl, message }). */
export const useUpgrade = create(() => ({ info: null }));
export const showUpgrade = (info) => useUpgrade.setState({ info: info || {} });
export const closeUpgrade = () => useUpgrade.setState({ info: null });

/** "See plans": the server's pricing page in the system browser. */
export function openPricing(upgradeUrl) {
  const server = useSession.getState().server;
  return openExternal(pricingUrl(server, upgradeUrl));
}

const left = (max, used) => (max === null || max === undefined ? null : Math.max(0, max - (used || 0)));

/** Today's AI count updated from a plan:ai_usage event ({ userUsed, userMax, workspaceUsed, workspaceMax, resetsAt }). */
export function mergeAiUsage(q, p) {
  const userMax = p.userMax !== undefined ? p.userMax : (q?.userMax ?? null);
  const userUsed = p.userUsed ?? q?.userUsed ?? 0;
  const workspaceMax = p.workspaceMax !== undefined ? p.workspaceMax : (q?.workspaceMax ?? null);
  const workspaceUsed = p.workspaceUsed ?? q?.workspaceUsed ?? 0;
  return {
    exempt: Boolean(q?.exempt),
    userUsed,
    userMax,
    userRemaining: left(userMax, userUsed),
    workspaceUsed,
    workspaceMax,
    workspaceRemaining: left(workspaceMax, workspaceUsed),
    resetsAt: p.resetsAt || q?.resetsAt || null,
  };
}

let bound = false;
/** Listen for plan events (once, app-wide, while signed in). Returns a cleanup. */
export function bindPlan() {
  if (bound) return () => {};
  bound = true;
  const offs = [
    // Any refused addition (HTTP 403 PLAN_LIMIT, or a huddle refusal): offer the upgrade sheet,
    // and refresh the plan so create buttons show the limit.
    on('plan:limit', (info) => {
      showUpgrade(info);
      invalidate('plan:');
    }),
    on('plan:ai_usage', (p) => {
      if (!p) return;
      const key = aiKey(p.workspaceId || useSession.getState().workspaceId);
      setQueryData(key, (q) => mergeAiUsage(q, p));
    }),
    // Something counted changed (a channel, task, workspace or member): refresh what's blocked.
    on('data:changed', (keys) => {
      if ((keys || []).some((k) => /^(channels|tasks|task:|workspaces|members)/.test(String(k)))) invalidate('plan:');
    }),
    // Someone I invited couldn't join: they reached their own free-plan limit.
    on('plan:limit_reached', (p) => {
      const who = p?.username || 'Someone you invited';
      toast(p?.message || `${who} couldn't join ${p?.workspaceName || 'your workspace'}: they reached their free plan limit.`, 'warning');
    }),
  ];
  return () => {
    bound = false;
    offs.forEach((off) => off());
  };
}
