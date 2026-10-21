// The plans shown on /pricing, the landing page teaser and in-app upgrade prompts.
// The Free numbers mirror the server's default plan limits (self-hosters can change them
// with PLAN_LIMITS_JSON / DEVICE_LIMIT, or turn them off with ORUINWAN_UNLIMITED).

export const NOTIFY_EMAIL = 'admin@poelys.com';
export const REPO_URL = 'https://github.com/thrishankkuntimaddi/Oruniwan';

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
    { id: 'source', label: 'Source code', value: 'Open source, MIT licence' },
];

export const PLANS = [
    {
        id: 'free',
        name: 'Free',
        status: 'available',
        price: '$0',
        priceNote: 'free forever · no card',
        tagline: 'Everything in Oruinwan for small teams, on every platform.',
        features: FREE_LIMITS.map((l) => `${l.label}: ${l.value}`),
        cta: { label: 'Get started free', to: '/login?mode=signup' },
    },
    {
        id: 'pro',
        name: 'Pro',
        status: 'coming-soon',
        price: 'Coming soon',
        priceNote: 'for growing teams',
        tagline: 'More room for teams that live in Oruinwan every day.',
        features: [
            'Bigger workspaces, more members and channels',
            'Longer huddles with more people',
            'More AI requests every day',
            'More notes and tasks',
            'Everything in Free',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        status: 'coming-soon',
        price: 'Coming soon',
        priceNote: 'for organisations',
        tagline: 'Control, compliance and scale for whole companies.',
        features: [
            'Admin controls across every workspace',
            'Single sign-on (SSO)',
            'Compliance tools and longer retention',
            'Custom limits and priority support',
            'Everything in Pro',
        ],
    },
];

export const planById = (id) => PLANS.find((p) => p.id === id) || null;

/** mailto: link for "Notify me" on a plan that isn't available yet. */
export function notifyHref(planName) {
    const subject = `Notify me: Oruinwan ${planName}`;
    const body = `Please let me know when Oruinwan ${planName} is available.`;
    return `mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
