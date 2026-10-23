import {
    Hash, MessageCircle, GitBranch, Headphones, ListChecks, NotebookPen, Bot, Plug, Columns2,
    Workflow, FolderOpen, Search, Video, MessagesSquare, KanbanSquare, Captions, Map, PenTool,
    ShieldCheck, KeyRound, ScrollText, Lock, Users, EyeOff, Fingerprint, MonitorSmartphone, HardDriveUpload,
} from 'lucide-react';
import BRAND from '../../shared/brand';

// `id` scrolls to a section of the landing page; `to` opens another page.
export const NAV_LINKS = [
    { id: 'platform', label: 'Features' },
    { id: 'security', label: 'Security' },
    { id: 'download', label: 'Download' },
    { id: 'open-source', label: 'Open source' },
    { id: 'pricing', label: 'Pricing', to: '/pricing' },
];

export const REPO_URL = 'https://github.com/thrishankkuntimaddi/Oruinwan';

// ── Hero product mock ──────────────────────────────────────────────────
// Example teammates are roles, not people.
export const PEOPLE = {
    pm: { name: 'Product lead', initials: 'PL', color: '#8ea6ff' },
    eng: { name: 'Engineering lead', initials: 'EL', color: '#5cc995' },
    design: { name: 'Design lead', initials: 'DL', color: '#f0a3c4' },
    qa: { name: 'QA lead', initials: 'QA', color: '#f5c46b' },
};

export const MOCK_CHANNELS = [
    {
        id: 'launch', kind: 'channel', name: 'launch', topic: 'v2.4 ship room · 8 members', unread: 3,
        messages: [
            { who: 'pm', at: '9:41', text: 'Release branch is cut. QA sign-off by 3pm, then we flip the flag.' },
            { who: 'eng', at: '9:43', text: 'Migration dry-run passed on staging. Rolling out `orders_v2` behind the flag.', thread: '4 replies' },
            { who: 'ai', at: '9:44', title: `${BRAND.ai} · Thread summary`, points: ['Ship target: today, after 3pm QA', 'Rollback plan: Engineering lead', 'Open: copy review on pricing page'] },
        ],
        typing: 'Design lead is typing',
    },
    {
        id: 'design', kind: 'channel', name: 'design', topic: 'Critiques, specs & assets · 5 members',
        messages: [
            { who: 'design', at: '10:02', text: 'New onboarding flow is in Notes → “Onboarding v3”. Feedback welcome before Thursday.' },
            { who: 'qa', at: '10:05', text: 'Love the empty states. Can we try the glossy CTA on step 2?', thread: '2 replies' },
            { who: 'pm', at: '10:07', text: 'Turned the open comments into tasks and assigned them on the Design board.' },
        ],
        typing: 'QA lead is typing',
    },
    {
        id: 'pm', kind: 'dm', name: 'Product lead', topic: 'Direct message · encrypted', presence: true,
        messages: [
            { who: 'pm', at: '11:20', text: 'Got 10 minutes for a huddle about the launch post?' },
            { who: 'eng', at: '11:21', text: 'Yes, starting one now.' },
            { who: 'huddle', at: '11:21', text: 'Huddle started · 2 people are talking' },
        ],
        typing: 'Product lead is typing',
    },
];

// ── Marquee ────────────────────────────────────────────────────────────
export const CAPABILITIES = [
    { icon: Hash, label: 'Channels' },
    { icon: MessageCircle, label: 'Direct messages' },
    { icon: GitBranch, label: 'Threads' },
    { icon: Headphones, label: 'Huddles' },
    { icon: Video, label: 'Video and screen share' },
    { icon: Captions, label: 'Recording, captions and AI recap' },
    { icon: Columns2, label: 'Split view' },
    { icon: ListChecks, label: 'Tasks and planning' },
    { icon: PenTool, label: 'Design reviews' },
    { icon: NotebookPen, label: 'Notes with live co-editing' },
    { icon: Map, label: 'Roadmap' },
    { icon: FolderOpen, label: 'Files and knowledge' },
    { icon: Search, label: 'Search' },
    { icon: Bot, label: 'Claude, ChatGPT, Gemini, Grok' },
    { icon: Workflow, label: 'Automations' },
    { icon: Plug, label: 'GitHub, GitLab, Jira, Linear, Slack' },
];

// ── Platform tabs ──────────────────────────────────────────────────────
export const PLATFORM_TABS = [
    {
        id: 'communicate', icon: MessagesSquare, title: 'Communicate',
        blurb: 'Channels, DMs, threads and huddles.',
        heading: 'Conversations with structure, not noise.',
        body: 'Channels keep work organised by team and topic. Threads keep side discussions out of the main feed, and a huddle starts in one click when typing gets slow.',
        points: ['Public and private channels, direct messages and group DMs of up to 10 people, with encrypted messages', 'Threads, open beside the conversation in split view on desktop and tablet', 'Huddles and scheduled meetings with screen share, recording, live captions and an AI recap'],
        visual: 'thread',
    },
    {
        id: 'plan', icon: KanbanSquare, title: 'Plan',
        blurb: 'Tasks, planning and notes.',
        heading: 'Plans live next to the talk.',
        body: 'Turn a message into a task, plan the work, review designs and write decisions down in notes your team edits together, without leaving the conversation that started it.',
        points: ['Tasks with owners, due dates, boards and planning', 'Design reviews with comments on the work itself', 'Notes and a roadmap with live co-editing, templates and a knowledge base'],
        visual: 'kanban',
    },
    {
        id: 'automate', icon: Workflow, title: 'Automate',
        blurb: 'AI, automations and integrations.',
        heading: 'Put the busywork on rails.',
        body: 'Bring AI into your channels, build automations with triggers and actions, and connect the tools your team already uses with a personal token or a webhook.',
        points: ['AI with your choice of model: Claude, ChatGPT, Gemini, Grok or one you host', 'Automations with triggers, conditions, schedules and actions', 'GitHub, GitLab, Bitbucket, Jira, Linear, Slack, Zoom, cloud drives and webhooks'],
        visual: 'flow',
    },
    {
        id: 'govern', icon: ShieldCheck, title: 'Govern',
        blurb: 'Roles, permissions and audit.',
        heading: 'Company-grade control, built in.',
        body: 'Workspace admin and the company console give owners and admins departments, roles, permissions and an audit trail. They manage people and access, not conversations.',
        points: ['Owner, admin, manager and member roles', 'Permission matrix and audit logs', 'Admins never see messages or message counts'],
        visual: 'matrix',
    },
];

// ── Feature bento ──────────────────────────────────────────────────────
export const FEATURES = [
    { icon: MessageCircle, color: '#c8a274', title: 'Chat', desc: 'Channels, DMs and group DMs with messages encrypted on your device, reactions, mentions, pins and files.' },
    { icon: GitBranch, color: '#7fd4e0', title: 'Threads', desc: 'Side discussions that stay out of the main feed, open beside the conversation in split view.' },
    { icon: Headphones, color: '#5cc995', title: 'Huddles & meetings', desc: 'Audio, video and screen share in one click. Record, follow live captions and get an AI recap after.' },
    { icon: ListChecks, color: '#f5c46b', title: 'Tasks & planning', desc: 'Tasks straight from chat, boards, planning and design reviews, with owners, due dates and progress.' },
    { icon: NotebookPen, color: '#f39a6b', title: 'Notes & knowledge', desc: 'Notes, templates, a roadmap and a knowledge base your team edits together, live.' },
    { icon: Bot, color: '#ecd6b0', title: 'AI assistant', desc: 'Summaries, drafts and answers in context, with your choice of model: Claude, ChatGPT, Gemini, Grok or your own.' },
    { icon: Plug, color: '#f0a3c4', title: 'Integrations', desc: 'GitHub, GitLab, Bitbucket, Jira, Linear, Slack, Zoom, cloud drives and webhooks, connected with a token.' },
    { icon: Workflow, color: '#9fd8a6', title: 'Automations', desc: 'Triggers, conditions, schedules and actions that take the routine steps off your plate.' },
    { icon: MonitorSmartphone, wide: true, color: '#d9b98f', title: 'Apps for every platform', desc: 'Web, Mac, Windows, Linux and Android phones and tablets, all in sync, with one-click updates.' },
    { icon: HardDriveUpload, wide: true, color: '#a6c8d9', title: 'Your data, your copy', desc: 'Optional encrypted backup to your own Google Drive, and a server you can host yourself.' },
];

// ── AI console demo ────────────────────────────────────────────────────
export const AI_PROMPTS = [
    {
        id: 'summarize', label: 'Summarize #launch',
        question: 'Summarize what happened in #launch today.',
        answer: 'Here’s today in #launch:\n• Release branch v2.4 is cut; QA sign-off is due at 3pm.\n• The orders_v2 migration passed its staging dry-run and ships behind a flag.\n• The engineering lead owns the rollback plan.\n• Still open: copy review on the pricing page (design).',
        sources: ['#launch · 23 messages', 'Thread · 4 replies'],
    },
    {
        id: 'tasks', label: 'Create tasks from this thread',
        question: 'Turn the open items in this thread into tasks.',
        answer: 'I found 3 action items and drafted them as tasks on the Launch board:',
        tasks: [
            { label: 'Finish QA sign-off for v2.4', who: 'QA lead · today' },
            { label: 'Write the rollback runbook for orders_v2', who: 'Engineering lead · today' },
            { label: 'Review the pricing page copy', who: 'Design lead · Thu' },
        ],
        sources: ['#launch thread', 'Launch board'],
    },
    {
        id: 'decide', label: 'What did we decide on pricing?',
        question: 'What did we decide about the pricing page?',
        answer: 'On Tuesday the team agreed to keep three tiers, move annual billing to the default toggle and add a comparison table. The QA lead asked for one more copy pass before publishing. That review is still open.',
        sources: ['#design · Tue', 'Notes · Pricing v2'],
    },
    {
        id: 'draft', label: 'Draft the launch announcement',
        question: 'Draft a short launch announcement for #general.',
        answer: 'Draft for #general:\n\n“v2.4 is live 🎉 Orders are faster and more reliable thanks to the new orders_v2 pipeline. Thanks to everyone who worked on it. Questions? Drop them in #launch.”\n\nWant me to post it or adjust the tone?',
        sources: ['#launch', 'Release notes'],
    },
];

// ── Security pillars ───────────────────────────────────────────────────
export const SECURITY = [
    { icon: Lock, title: 'Encrypted messages', desc: 'Channel and DM messages are encrypted on your device with a key per conversation (AES-256-GCM), and stay encrypted in transit and at rest. Your server keeps a protected copy of each key so agents can post and you can recover your account.' },
    { icon: KeyRound, title: 'A sealed key, stated plainly', desc: `${BRAND.name}'s server keeps a sealed copy of your key, protected by a server master key, so your devices unlock automatically after sign-in and AI can answer in encrypted conversations. Self-host to hold that key yourself.` },
    { icon: EyeOff, title: 'Private from admins', desc: 'Admins never see messages or message counts, and there are no per-person activity metrics.' },
    { icon: Fingerprint, title: 'Strong sign-in', desc: 'Email and password or Google, with email verification, passkeys and two-factor authentication.' },
    { icon: Users, title: 'Roles & permissions', desc: 'Owner, admin, manager and member roles with a permission matrix across workspaces and channels.' },
    { icon: ScrollText, title: 'Audit logs', desc: 'Sensitive admin actions are recorded, searchable and exportable for review.' },
];

// ── Steps ──────────────────────────────────────────────────────────────
export const STEPS = [
    { n: '01', title: 'Create your workspace', desc: 'Sign up, verify your email and name your workspace in a short setup wizard. Companies can register for the company console.' },
    { n: '02', title: 'Bring your team', desc: 'Share a team invite link, send one-time links or invite by email, then organise people into channels, departments and roles.' },
    { n: '03', title: 'Work in one place', desc: 'Chat, meet, plan and bring in agents, on the web, desktop, tablet and phone.' },
];

// ── FAQ ────────────────────────────────────────────────────────────────
export const FAQ = [
    { q: `What is ${BRAND.name}?`, a: `${BRAND.name} is a free, open-source workspace for teams: chat, threads, huddles, tasks, notes and AI in one place, on the web, desktop, phone and tablet.` },
    { q: 'Is it really free?', a: 'Yes. The Free plan has every feature, with limits sized for small teams: up to 4 signed-in devices, 2 workspaces you create and 2 you join, the owner plus 10 members per workspace, huddles of up to 10 people for 30 minutes, and 50 AI requests per person and 300 AI requests per workspace per day. Pro and Enterprise, with bigger limits and admin controls, are coming soon.' },
    { q: 'Is it open source? Can I host it myself?', a: `Yes. ${BRAND.name} is MIT-licensed on GitHub. You can run the whole server yourself with Docker Compose, and every plan limit is configurable on your own server.` },
    { q: 'How do I sign in?', a: 'With your email and password, or with Google. New accounts verify their email address, and you can add passkeys and two-factor authentication in Settings.' },
    { q: 'How do I bring my team in?', a: 'Create a workspace with the setup wizard, then share a team invite link anyone on your team can use, or send one-time links that work once. You can also invite people by email.' },
    { q: 'Are messages encrypted?', a: `Yes. Messages in channels and DMs are encrypted on your device with per-conversation keys, and stay encrypted in transit and at rest. ${BRAND.name}'s server keeps a sealed copy of your key, protected by a server master key, so your devices unlock automatically after you sign in and AI agents can answer in encrypted conversations. Messages are never shown to admins. To hold that key yourself, run your own server.` },
    { q: 'Can admins read our messages or see who is most active?', a: 'No. Admins manage people, workspaces and permissions. They never see messages or message counts, and there are no per-person activity metrics.' },
    { q: 'Which AI models can we use?', a: 'Claude, ChatGPT, Gemini and Grok, or a model you host yourself. A workspace admin can install an agent for everyone, or each member can connect one with their own API key. Mention an agent in a channel or open a DM with it.' },
    { q: 'What integrations are there?', a: 'GitHub, GitLab, Bitbucket, Jira, Linear, Slack, Zoom, cloud drives and incoming webhooks, plus automations that run on triggers you choose. You connect them with a personal token or a webhook URL.' },
    { q: 'Which platforms are supported?', a: `${BRAND.name} runs in any modern browser. There are desktop apps for Mac, Windows and Linux, and an app for Android phones and tablets, with split view on larger screens. Everything syncs in real time, and the apps tell you when an update is ready.` },
];
