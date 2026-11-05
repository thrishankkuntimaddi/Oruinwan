// Free-plan limits: the words and small decisions, kept free of React and the session so the
// huddle client, the adapter tests and the screens can all share them.

export const LIMIT_TITLE = 'Plan limit reached';
export const COMING_SOON = 'Upgrade to Pro for more room, or talk to us about Enterprise.';
/** The Play Store build sells nothing (Play's payments policy): limits are raised by the workspace owner elsewhere. */
export const PLAY_LIMIT_TEXT = 'Your workspace owner can raise these limits.';
export const EXEMPT_TEXT = 'Your company plan has no free-plan limits.';
// The call numbers come from the server (huddle:error max, huddle:roster timeLimit, GET /api/plan);
// these are only the fallbacks when an answer leaves them out.
export const DEFAULT_CALL_PEOPLE = 10;
export const DEFAULT_CALL_MINUTES = 30;
const positive = (n, fallback) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : fallback);
/** "This call is full — 10 people on your plan" with the server's number. */
export const callFullText = (max) => `This call is full — ${positive(max, DEFAULT_CALL_PEOPLE)} people on your plan`;
/** The call ended at the plan's time limit, with the server's number of minutes. */
export const timeLimitEndedText = (minutes) => `This call ended at your plan's ${positive(minutes, DEFAULT_CALL_MINUTES)}-minute limit. Your notes are saved in the meeting notes.`;
export const CALL_FULL = callFullText();
export const TIME_LIMIT_ENDED = timeLimitEndedText();

export const isPlanLimit = (err) => Boolean(err && (err.planLimit || err.code === 'PLAN_LIMIT' || err.data?.code === 'PLAN_LIMIT'));

/** Where "See plans" goes: the server's pricing page (upgradeUrl is relative, e.g. "/pricing"). */
export function pricingUrl(server, upgradeUrl = '/pricing') {
  const path = upgradeUrl || '/pricing';
  if (/^https?:/i.test(path)) return path;
  const base = String(server || '').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

export const planName = (plan) => {
  if (!plan) return 'Free';
  if (plan.exempt || plan.plan === 'company') return 'Company';
  const p = plan.plans?.find((x) => x.id === plan.plan);
  return p?.name || (plan.plan ? plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1) : 'Free');
};

/** True when the next addition of `key` would be refused (from GET /api/plan's `blocked`). */
export const isBlocked = (plan, key) => Boolean(plan && !plan.exempt && plan.blocked?.[key]);

const maxOf = (plan, key) => plan?.limits?.[key] ?? plan?.items?.find((i) => i.key === key)?.max ?? null;

const NOTES = {
  'workspaces.create': (m) => `You've created ${m ?? 'the most'} workspaces, your plan's limit.`,
  'workspaces.join': (m) => `You've joined ${m ?? 'the most'} workspaces, your plan's limit.`,
  'members.perWorkspace': (m) => `This workspace has ${m ?? 'the most'} people (including pending invites), your plan's limit.`,
  'channels.perWorkspace': (m) => `This workspace has ${m ?? 'the most'} channels besides #general, #random and its project channel, your plan's limit.`,
  'tasks.perWorkspace': (m) => `This workspace has ${m ?? 'the most'} active tasks, your plan's limit. Finish or close some to add more.`,
  'tasks.selfCreated': (m) => `You have ${m ?? 'the most'} active tasks for yourself, your plan's limit. Finish some to add more.`,
  'tasks.assignedToOthers': (m) => `You have ${m ?? 'the most'} active tasks assigned to others, your plan's limit. Finish some to add more.`,
};

/** A short line explaining why a create action is off ("This workspace has 10 channels…"). */
export function blockedNote(plan, key) {
  const m = maxOf(plan, key);
  return (NOTES[key] || (() => "You've reached your plan's limit here."))(m);
}

/**
 * Which task limit a new task would hit, or null: the workspace's active tasks, and mine for
 * myself or for others depending on who it is assigned to.
 */
export function taskLimitKey(plan, assigneeIds, myId) {
  if (!plan || plan.exempt) return null;
  if (isBlocked(plan, 'tasks.perWorkspace')) return 'tasks.perWorkspace';
  const ids = (assigneeIds || []).map(String);
  const others = ids.some((id) => id !== String(myId));
  if (others && isBlocked(plan, 'tasks.assignedToOthers')) return 'tasks.assignedToOthers';
  if (!others && isBlocked(plan, 'tasks.selfCreated')) return 'tasks.selfCreated';
  return null;
}

// The phone's note templates send their type as the server's template key; the server also
// knows the older short ids.
const TEMPLATE_ALIASES = { projectspec: ['spec'], techdesign: ['tech'], announcement: ['announce'] };

/** The template key the server counts a note under (none for a blank note). */
export const templateKey = (tpl) => (!tpl || tpl.id === 'blank' ? null : tpl.type && tpl.type !== 'note' ? tpl.type : tpl.id);

/** How many notes I made from a template here, and whether I can make another ({ used, max, atLimit }). */
export function templateUsage(plan, key) {
  if (!plan || plan.exempt || !key) return null;
  const max = plan.notes?.perTemplate ?? null;
  if (max === null) return null;
  const by = plan.notes?.byTemplate || {};
  const used = [key, ...(TEMPLATE_ALIASES[key] || [])].reduce((n, k) => n + (Number(by[k]) || 0), 0);
  return { used, max, atLimit: used >= max };
}

const clock = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

/** "Resets at 5:30 AM" (the UTC day's end, in local time). */
export const resetText = (iso) => (iso && clock(iso) ? `Resets at ${clock(iso)}` : '');

/** "12 of 50 AI requests left today", or null when there's no daily cap (company plan, or no plans). */
export function aiCounterText(q) {
  if (!q || q.exempt || q.userMax === null || q.userMax === undefined) return null;
  const left = Math.max(0, q.userRemaining ?? q.userMax - (q.userUsed || 0));
  if (left === 0) {
    const reset = resetText(q.resetsAt);
    return `No AI requests left today${reset ? ` · ${reset.charAt(0).toLowerCase()}${reset.slice(1)}` : ''}`;
  }
  return `${left} of ${q.userMax} AI requests left today`;
}

/** The banner for huddle:time_warning: "5 minutes left — calls on your plan end at 30 minutes". */
export function timeWarningText(w) {
  if (!w) return null;
  const n = Number(w.minutesLeft) || 0;
  if (n <= 1) return '1 minute left';
  return `${n} minutes left — calls on your plan end at ${positive(w.maxMinutes, DEFAULT_CALL_MINUTES)} minutes`;
}

/** The plans, for the cards on Plan & usage (the same as the website's /pricing). */
export const PLAN_CARDS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    note: 'Free forever, no card',
    features: ['Every feature: chat, huddles, tasks, notes, AI, integrations', 'Create 2 workspaces, join 2', 'Owner + 10 people per workspace', 'Huddles up to 10 people, 30 minutes', '50 AI requests a day'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$5',
    note: 'Per member / month, billed yearly · $6 monthly',
    features: ['Up to 100 people per workspace', 'Unlimited channels and notes', 'Huddles up to 25 people, 5 hours', '100 AI requests a day (unlimited with your own key)', 'Up to 10 signed-in devices', 'Everything in Free'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    note: 'Set up for your company',
    features: ['We install and configure it on your servers or cloud, or host it for you', 'Single sign-on, your domain and the company console', 'No plan limits, unlimited devices', 'Onboarding and priority support', 'Everything in Pro'],
  },
];

/** "$60", "₹4,788" from cents/paise. */
export function money(minor, currency) {
  if (minor === null || minor === undefined) return '';
  const major = Number(minor) / 100;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(major) ? 0 : 2 }).format(major);
  } catch {
    return `${currency} ${major}`;
  }
}

/** "Yearly · ₹4,788 per member" for an offer chip. */
export const offerText = (o) => `${o.cycle === 'yearly' ? 'Yearly' : 'Monthly'} · ${money(o.unitAmount, o.currency)}`;

/** Yearly in the phone's currency (rupees in India) when offered. */
export function defaultOffer(offers, locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US') {
  if (!offers?.length) return null;
  const cur = /-IN$/i.test(String(locale || '')) ? 'INR' : 'USD';
  return offers.find((o) => o.cycle === 'yearly' && o.currency === cur) || offers.find((o) => o.currency === cur) || offers.find((o) => o.cycle === 'yearly') || offers[0];
}

/** The upgrade request email (the team switches the workspace to Pro once it is paid). */
export const upgradeEmail = (workspaceName) => ({
  subject: 'Upgrade to Oruinwan Pro',
  body: `Hi Oruinwan team,\n\nI would like to upgrade ${workspaceName || 'my workspace'} to Pro.\n\nAccount email (workspace owner):\nNumber of members:\nBilling: yearly ($5 per member per month) / monthly ($6 per member per month)\nBilling country:\n\nThanks`,
});

/** The Enterprise enquiry email. */
export const enterpriseEmail = (workspaceName) => ({
  subject: 'Oruinwan Enterprise enquiry',
  body: `Hi Oruinwan team,\n\nWe would like to talk about Oruinwan Enterprise${workspaceName ? ` for ${workspaceName}` : ''}.\n\nCompany:\nYour name and role:\nNumber of people:\nWhere should it run: our own servers / our cloud / hosted by Oruinwan\nSign-in we use:\nPhone number (optional):\n\nThanks`,
});
export const SALES_EMAIL = 'admin@poelys.com';
