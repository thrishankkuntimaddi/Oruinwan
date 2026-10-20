import {
    Hash, MessageCircle, GitBranch, Headphones, ListChecks, NotebookPen, Bot, Plug, Columns2,
    Workflow, FolderOpen, Search, Video, MessagesSquare, KanbanSquare,
    ShieldCheck, KeyRound, ScrollText, Lock, Users, EyeOff, Fingerprint,
} from 'lucide-react';
import BRAND from '../../shared/brand';

export const NAV_LINKS = [
    { id: 'platform', label: 'Platform' },
    { id: 'ai', label: 'Agents' },
    { id: 'security', label: 'Security' },
    { id: 'plans', label: 'Plans' },
    { id: 'download', label: 'Download' },
];

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
        id: 'pm', kind: 'dm', name: 'Product lead', topic: 'Direct message · end-to-end encrypted', presence: true,
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
    { icon: Columns2, label: 'Split view' },
    { icon: ListChecks, label: 'Tasks' },
    { icon: NotebookPen, label: 'Notes' },
    { icon: FolderOpen, label: 'Files' },
    { icon: Search, label: 'Search' },
    { icon: Bot, label: 'Claude, ChatGPT, Gemini, Grok' },
    { icon: Workflow, label: 'Workflows' },
    { icon: Plug, label: 'GitHub, Jira, Zoom' },
];

// ── Platform tabs ──────────────────────────────────────────────────────
export const PLATFORM_TABS = [
    {
        id: 'communicate', icon: MessagesSquare, title: 'Communicate',
        blurb: 'Channels, DMs, threads and huddles.',
        heading: 'Conversations with structure, not noise.',
        body: 'Channels keep work organised by team and topic. Threads keep side discussions out of the main feed, and a huddle starts in one click when typing gets slow.',
        points: ['Public and private channels, DMs and group DMs', 'Threads, open beside the conversation in split view on desktop and tablet', 'Huddles with audio, video, screen share and raise hand, plus scheduled meetings'],
        visual: 'thread',
    },
    {
        id: 'plan', icon: KanbanSquare, title: 'Plan',
        blurb: 'Tasks, boards and notes.',
        heading: 'Plans live next to the talk.',
        body: 'Turn a message into a task, track it on a board and record decisions in notes, without leaving the conversation that started it.',
        points: ['Boards with owners, due dates and progress', 'Shared notes for specs and team wikis', 'Files and search across the workspace'],
        visual: 'kanban',
    },
    {
        id: 'automate', icon: Workflow, title: 'Automate',
        blurb: 'Agents, workflows and integrations.',
        heading: 'Put the busywork on rails.',
        body: 'Bring AI agents into your channels, build workflows with triggers and actions, and connect the tools your team already uses.',
        points: ['Agents: Claude, ChatGPT, Gemini and Grok', 'Workflows with triggers and actions', 'GitHub, Jira, Zoom and incoming webhooks, with personal GitHub and Jira connections'],
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
    { icon: Hash, color: '#8ea6ff', title: 'Channels', desc: 'Organised, searchable spaces for every team, project and topic.' },
    { icon: MessageCircle, color: '#b59cff', title: 'Direct messages', desc: 'Private 1:1 and group conversations, end-to-end encrypted between devices.' },
    { icon: Headphones, color: '#5cc995', title: 'Huddles & meetings', desc: 'Audio, video and screen share in one click, or schedule a meeting ahead.' },
    { icon: Columns2, color: '#7fd4e0', title: 'Split view', desc: 'Keep a thread or a second conversation open side by side on desktop and tablet.' },
    { icon: ListChecks, color: '#f5c46b', title: 'Tasks', desc: 'Boards, assignees, deadlines and progress, created straight from chat.' },
    { icon: NotebookPen, color: '#f39a6b', title: 'Notes', desc: 'Docs and wikis that sit right beside the conversation they came from.' },
    { icon: Workflow, color: '#f0a3c4', title: 'Workflows & apps', desc: 'Automate routine steps and connect GitHub, Jira, Zoom and webhooks.' },
    { icon: Bot, color: '#c8a274', title: 'Agents', desc: 'Claude, ChatGPT, Gemini and Grok, installed by admins or connected with your own key.' },
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
    { icon: Lock, title: 'End-to-end encryption', desc: 'Channel and DM messages are encrypted between devices with per-conversation keys (X25519 + AES-GCM), and stay encrypted in transit and at rest.' },
    { icon: KeyRound, title: 'Escrowed keys, stated plainly', desc: 'The server keeps an escrowed copy of each conversation key, protected by a server master key, so agents can answer in encrypted conversations and you can recover access after a password reset.' },
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
    { q: `What is ${BRAND.name}?`, a: `${BRAND.name} is a workspace for teams: channels, DMs, threads, huddles, tasks, notes and AI agents in one place, with a company console for the people who run it.` },
    { q: 'How do I sign in?', a: 'With your email and password, or with Google. New accounts verify their email address, and you can add passkeys and two-factor authentication in Settings.' },
    { q: 'How do I bring my team in?', a: 'Create a workspace with the setup wizard, then share a team invite link anyone on your team can use, or send one-time links that work once. You can also invite people by email.' },
    { q: 'Are messages end-to-end encrypted?', a: 'Messages in channels and DMs are end-to-end encrypted between devices with per-conversation keys, and they are encrypted in transit and at rest. The server also keeps an escrowed copy of each conversation key, protected by a server master key. That copy lets agents answer in encrypted conversations and lets you recover access after a password reset. Messages are never shown to admins.' },
    { q: 'Can admins read our messages or see who is most active?', a: 'No. Admins manage people, workspaces and permissions. They never see messages or message counts, and there are no per-person activity metrics.' },
    { q: 'Which AI agents can we use?', a: 'Claude, ChatGPT, Gemini and Grok. A workspace admin can install an agent for everyone, or each member can connect one personally with their own API key. Mention an agent in a channel or open a DM with it.' },
    { q: 'What integrations are there?', a: 'GitHub, Jira, Zoom and incoming webhooks, plus workflows that run on triggers you choose. Members can also connect their personal GitHub and Jira accounts.' },
    { q: 'Which platforms are supported?', a: `${BRAND.name} runs in any modern browser. There are desktop apps for Mac, Windows and Linux with split view, phone apps for Android and iOS, and the full workspace with split view on Android tablets and iPads. Everything syncs in real time.` },
];
