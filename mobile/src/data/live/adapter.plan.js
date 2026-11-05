// Live adapter part: free-plan limits and usage. Merged into liveAdapter (adapter.js), so screens
// call these through api().
//
// Server contract (docs/api/plan.md):
//   GET /api/plan?workspaceId=     plan, limits, usage, items (progress bars), notes per template,
//                                  huddle limits, AI today, blocked (the next addition is refused)
//   GET /api/plan/ai?workspaceId=  { userUsed, userMax, userRemaining, workspaceUsed, workspaceMax,
//                                    workspaceRemaining, resetsAt, exempt }
//   GET  /api/billing/workspaces/:id           Pro paid online: { plan, seats, subscription, payments,
//                                               billing: { enabled, offers } } (owner and admins)
//   POST /api/billing/workspaces/:id/checkout  { cycle, currency } → { shortUrl, amount, ... } (owner)
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

/** Billing of a workspace in the app's shape, or null (no billing on this server, or not an admin). */
export function mapBilling(d) {
  if (!d || typeof d !== 'object') return null;
  const sub = d.subscription || null;
  return {
    plan: d.plan || 'free',
    seats: num(d.seats),
    subscription: sub
      ? {
          status: sub.status,
          active: Boolean(sub.active),
          cycle: sub.cycle,
          currency: sub.currency,
          quantity: num(sub.quantity) ?? 1,
          amount: num(sub.amount),
          currentEnd: sub.currentEnd || null,
          cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          shortUrl: sub.shortUrl || null,
        }
      : null,
    payments: Array.isArray(d.payments) ? d.payments.map((p) => ({ id: p.id, amount: num(p.amount), currency: p.currency, status: p.status, paidAt: p.paidAt })) : [],
    enabled: Boolean(d.billing?.enabled),
    offers: Array.isArray(d.billing?.offers) ? d.billing.offers.map((o) => ({ cycle: o.cycle, currency: o.currency, unitAmount: num(o.unitAmount) })) : [],
  };
}

const noBilling = (err) => {
  if (err?.status === 404 || err?.status === 403) return null;
  throw err;
};

export const planAdapter = {
  /** Pro billing for a workspace (owner and admins). Null when unavailable. */
  async getBilling(workspaceId) {
    if (!workspaceId) return null;
    const data = await api.get(`/billing/workspaces/${encodeURIComponent(workspaceId)}`).catch(noBilling);
    return mapBilling(data);
  },
  /** Start paying for Pro: { shortUrl, amount, currency, quantity, ... } (the hosted payment page). */
  startProCheckout(workspaceId, { cycle, currency }) {
    return api.post(`/billing/workspaces/${encodeURIComponent(workspaceId)}/checkout`, { cycle, currency });
  },
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
