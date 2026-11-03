// The plans shown on /pricing, the landing page and in-app upgrade prompts.
// The numbers mirror the server's plan limits (server/src/shared/plans/plans.js); prices and the
// business model are in docs/BUSINESS_MODEL.md. Self-hosters can change limits with
// PLAN_LIMITS_JSON / DEVICE_LIMIT, or turn them off with ORUINWAN_UNLIMITED.

/** Where upgrade requests and Enterprise enquiries go. Change it here only. */
export const SALES_EMAIL = 'admin@poelys.com';
/** Kept for older imports: the same inbox. */
export const NOTIFY_EMAIL = SALES_EMAIL;
export const REPO_URL = 'https://github.com/thrishankkuntimaddi/Oruinwan';

/** Pro price per member per month, in US dollars. */
export const PRO_PRICE = { yearly: 5, monthly: 6, currency: 'USD' };

/** What the Free plan includes, as short label/value rows. */
export const FREE_LIMITS = [
    { id: 'devices', label: 'Signed-in devices', value: 'Up to 4 per person' },
    { id: 'workspaces', label: 'Workspaces', value: 'Create 2, join 2' },
    { id: 'members', label: 'Members per workspace', value: 'Owner + 10' },
    { id: 'channels', label: 'Channels', value: '10 besides the ones made with the workspace (#general, #random, your project)' },
    { id: 'huddles', label: 'Huddles', value: 'Up to 10 people, 30 minutes' },
    { id: 'notes', label: 'Notes', value: '2 per template, blank notes unlimited' },
    { id: 'tasks', label: 'Tasks', value: '300 active per workspace; 30 for yourself + 30 assigned per person' },
    { id: 'ai', label: 'AI requests', value: '50 per person per day, 300 per workspace per day' },
    { id: 'backup', label: 'Backup', value: 'Encrypted backup to your Google Drive' },
];

/** What Pro raises, as the same rows. */
export const PRO_LIMITS = [
    { id: 'devices', label: 'Signed-in devices', value: 'Up to 10 per person' },
    { id: 'workspaces', label: 'Workspaces', value: 'Create 10, join 20' },
    { id: 'members', label: 'Members per workspace', value: 'Owner + 100' },
    { id: 'channels', label: 'Channels', value: 'Unlimited' },
    { id: 'huddles', label: 'Huddles', value: 'Up to 25 people, 5 hours' },
    { id: 'notes', label: 'Notes', value: 'Unlimited from every template' },
    { id: 'tasks', label: 'Tasks', value: '10,000 active per workspace, no per-person cap' },
    { id: 'ai', label: 'AI requests', value: '100 per person per day, 2,000 per workspace per day; unlimited with your own AI key' },
    { id: 'support', label: 'Support', value: 'Email support, answered within one business day' },
];

/** What Enterprise adds. */
export const ENTERPRISE_FEATURES = [
    'We set Oruinwan up for you: on your own servers or cloud, or hosted by us',
    'Your domain, your sign-in (Google Workspace, SAML single sign-on) and your branding',
    'Company console: departments, roles, permissions and audit logs',
    'No plan limits, unlimited devices, calls up to 25 people with no time cap',
    'Your own AI keys or a model you host, kept inside your network',
    'Onboarding sessions for your admins and your team',
    'Priority support and an agreed response time',
];

export const PLANS = [
    {
        id: 'free',
        name: 'Free',
        status: 'available',
        price: '$0',
        priceNote: 'free forever · no card',
        tagline: 'Every feature, for small teams getting started.',
        features: FREE_LIMITS.map((l) => `${l.label}: ${l.value}`),
        cta: { label: 'Get started free', to: '/login?mode=signup' },
    },
    {
        id: 'pro',
        name: 'Pro',
        status: 'request',
        price: `$${PRO_PRICE.yearly}`,
        priceNote: `per member / month, billed yearly · $${PRO_PRICE.monthly} monthly`,
        tagline: 'More room for teams that run their work in one workspace.',
        features: [...PRO_LIMITS.map((l) => `${l.label}: ${l.value}`), 'Everything in Free'],
        cta: { label: 'Upgrade to Pro' },
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        status: 'contact',
        price: 'Custom',
        priceNote: 'set up for your company · yearly contract',
        tagline: 'We install, configure and support Oruinwan for your whole company.',
        features: [...ENTERPRISE_FEATURES, 'Everything in Pro'],
        cta: { label: 'Talk to us' },
    },
];

export const planById = (id) => PLANS.find((p) => p.id === id) || null;

const mailto = (subject, body) => `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** mailto: link asking to move a workspace to Pro (activated by the team after payment). */
export function upgradeHref() {
    return mailto('Upgrade to Oruinwan Pro', [
        'Hi Oruinwan team,',
        '',
        'I would like to upgrade to Pro.',
        '',
        'Workspace name:',
        'Account email (workspace owner):',
        'Number of members:',
        'Billing: yearly ($5 per member per month) / monthly ($6 per member per month)',
        'Billing country:',
        '',
        'Thanks',
    ].join('\n'));
}

/** mailto: link for an Enterprise conversation. */
export function enterpriseHref() {
    return mailto('Oruinwan Enterprise enquiry', [
        'Hi Oruinwan team,',
        '',
        'We would like to talk about Oruinwan Enterprise.',
        '',
        'Company:',
        'Your name and role:',
        'Number of people:',
        'Where should it run: our own servers / our cloud (AWS, Azure, GCP) / hosted by Oruinwan',
        'Sign-in we use (Google Workspace, Microsoft, Okta, other):',
        'Moving from (Slack, Teams, other):',
        'Phone number (optional):',
        '',
        'Thanks',
    ].join('\n'));
}

/** The contact link for a plan's button. Kept as notifyHref for older imports. */
export function notifyHref(planName) {
    return String(planName).toLowerCase() === 'enterprise' ? enterpriseHref() : upgradeHref();
}
