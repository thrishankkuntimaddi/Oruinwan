// Live adapter part: free-plan limits and usage. Merged into liveAdapter (adapter.js), so screens
// call these through api().
//
// Server contract (docs/api/plan.md):
//   GET /api/plan?workspaceId=     plan, limits, usage, items (progress bars), notes per template,
//                                  huddle limits, AI today, blocked (the next addition is refused)
//   GET /api/plan/ai?workspaceId=  { userUsed, userMax, userRemaining, workspaceUsed, workspaceMax,
//                                    workspaceRemaining, resetsAt, exempt }
// A server without plans (older, or self-hosted without limits) answers 404: that reads as
// "no limits" (null), so nothing in the app is blocked.
import { api } from './http.js';

const noPlan = (err) => {
  if (err?.status === 404) return null;
  throw err;
};

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export function mapAiQuota(d) {
  if (!d || typeof d !== 'object') return null;
  const userMax = num(d.userMax);
  const userUsed = num(d.userUsed) ?? 0;
  const workspaceMax = num(d.workspaceMax);
  const workspaceUsed = num(d.workspaceUsed) ?? 0;
  return {
    userUsed,
    userMax,
    userRemaining: num(d.userRemaining) ?? (userMax !== null ? Math.max(0, userMax - userUsed) : null),
    workspaceUsed,
    workspaceMax,
    workspaceRemaining: num(d.workspaceRemaining) ?? (workspaceMax !== null ? Math.max(0, workspaceMax - workspaceUsed) : null),
    resetsAt: d.resetsAt || null,
    exempt: Boolean(d.exempt),
  };
}

/** The server's plan answer in the app's shape (tolerant of missing fields). */
export function mapPlan(d) {
  if (!d || typeof d !== 'object') return null;
  const exempt = Boolean(d.exempt) || d.plan === 'company';
  return {
    plan: d.plan || 'free',
    userPlan: d.userPlan || d.plan || 'free',
    workspacePlan: d.workspacePlan ?? null,
    exempt,
    upgradeUrl: d.upgradeUrl || '/pricing',
    plans: Array.isArray(d.plans) ? d.plans.map((p) => ({ id: p.id, name: p.name || p.id, comingSoon: Boolean(p.comingSoon) })) : [],
    limits: d.limits || {},
    usage: d.usage || {},
    items: (Array.isArray(d.items) ? d.items : []).map((i) => {
      const used = num(i.used) ?? 0;
      const max = num(i.max);
      return { key: i.key, label: i.label || i.key, used, max, atLimit: i.atLimit ?? (max !== null && used >= max), scope: i.scope || 'user' };
    }),
    notes: { perTemplate: num(d.notes?.perTemplate), byTemplate: d.notes?.byTemplate || {} },
    huddles: { participants: num(d.huddles?.participants), minutes: num(d.huddles?.minutes) },
    ai: d.ai ? mapAiQuota({ ...d.ai, exempt }) : null,
    blocked: exempt ? {} : d.blocked || {},
  };
}

export const planAdapter = {
  /** Plan, usage and limits for me (and the workspace, when given). Null when the server has no plans. */
  async getPlan(workspaceId) {
    const data = await api.get('/plan', { workspaceId }).catch(noPlan);
    return mapPlan(data);
  },
  /** Today's AI requests (for "12 of 50 AI requests left today"). Null when the server has no plans. */
  async getAiQuota(workspaceId) {
    const data = await api.get('/plan/ai', { workspaceId }).catch(noPlan);
    return mapAiQuota(data);
  },
};
