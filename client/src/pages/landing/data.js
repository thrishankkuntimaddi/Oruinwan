import {
    Hash, MessageCircle, GitBranch, Headphones, ListChecks, NotebookPen, Megaphone, Sparkles,
    Workflow, LayoutTemplate, FolderOpen, Search, Video, MessagesSquare, KanbanSquare,
    ShieldCheck, KeyRound, ScrollText, Lock, Users,
} from 'lucide-react';
import BRAND from '../../shared/brand';

export const NAV_LINKS = [
    { id: 'platform', label: 'Platform' },
    { id: 'ai', label: 'AI' },
    { id: 'security', label: 'Security' },
    { id: 'plans', label: 'Plans' },
    { id: 'download', label: 'Download' },
];

// ── Hero product mock ──────────────────────────────────────────────────
export const PEOPLE = {
    maya: { name: 'Maya Chen', initials: 'MC', color: '#8ea6ff' },
    arjun: { name: 'Arjun Rao', initials: 'AR', color: '#5cc995' },
    lena: { name: 'Lena Ortiz', initials: 'LO', color: '#f0a3c4' },
    sam: { name: 'Sam Patel', initials: 'SP', color: '#f5c46b' },
};

export const MOCK_CHANNELS = [
    {
        id: 'launch', kind: 'channel', name: 'launch', topic: 'v2.4 ship room · 8 members', unread: 3,
        messages: [
            { who: 'maya', at: '9:41', text: 'Release branch is cut. QA sign-off by 3pm, then we flip the flag.' },
            { who: 'arjun', at: '9:43', text: 'Migration dry-run passed on staging. Rolling out `orders_v2` behind the flag.', thread: '4 replies' },
            { who: 'ai', at: '9:44', title: `${BRAND.ai} · Thread summary`, points: ['Ship target: today, after 3pm QA', 'Owner for rollback plan: Arjun', 'Open: copy review on pricing page'] },
        ],
        typing: 'Lena is typing',
    },
    {
        id: 'design', kind: 'channel', name: 'design', topic: 'Critiques, specs & assets · 5 members',
        messages: [
            { who: 'lena', at: '10:02', text: 'New onboarding flow is in Notes → “Onboarding v3”. Feedback welcome before Thursday.' },
            { who: 'sam', at: '10:05', text: 'Love the empty states. Can we try the glossy CTA on step 2?', thread: '2 replies' },
            { who: 'maya', at: '10:07', text: 'Turned the open comments into tasks and assigned them on the Design board.' },
        ],
        typing: 'Sam is typing',
    },
    {
        id: 'maya', kind: 'dm', name: 'Maya Chen', topic: 'Direct message · end-to-end encrypted', presence: true,
        messages: [
            { who: 'maya', at: '11:20', text: 'Got 10 minutes for a huddle about the launch post?' },
            { who: 'arjun', at: '11:21', text: 'Yes, starting one now.' },
            { who: 'huddle', at: '11:21', text: 'Huddle started · 2 people are talking' },
        ],
        typing: 'Maya is typing',
    },
];

// ── Marquee ────────────────────────────────────────────────────────────
export const CAPABILITIES = [
    { icon: Hash, label: 'Channels' },
    { icon: MessageCircle, label: 'Direct messages' },
    { icon: GitBranch, label: 'Threads' },
    { icon: Headphones, label: 'Voice huddles' },
    { icon: Video, label: 'Meetings' },
    { icon: ListChecks, label: 'Tasks & boards' },
    { icon: NotebookPen, label: 'Notes' },
    { icon: Megaphone, label: 'Async updates' },
    { icon: Workflow, label: 'Automations' },
    { icon: FolderOpen, label: 'Files' },
    { icon: Search, label: 'Workspace search' },
    { icon: Sparkles, label: BRAND.ai },
];

// ── Platform tabs ──────────────────────────────────────────────────────
export const PLATFORM_TABS = [
    {
        id: 'communicate', icon: MessagesSquare, title: 'Communicate',
        blurb: 'Channels, DMs, threads and huddles.',
        heading: 'Conversations with structure, not noise.',
        body: 'Topic channels keep work organised. Threads keep side-discussions out of the main feed, and a huddle starts with one click when typing gets slow.',
        points: ['Public and private channels per workspace', 'Threads, reactions, pins, saved items and edit history', 'One-click voice huddles and scheduled meetings'],
        visual: 'thread',
    },
    {
        id: 'plan', icon: KanbanSquare, title: 'Plan',
        blurb: 'Tasks, boards, notes and updates.',
        heading: 'Plans live next to the talk.',
        body: 'Turn a message into a task, track it on a board and document decisions in notes, without leaving the conversation that started it.',
        points: ['Kanban boards with owners, due dates and progress', 'Collaborative notes for specs and wikis', 'Async updates instead of status meetings'],
        visual: 'kanban',
    },
    {
        id: 'automate', icon: Workflow, title: 'Automate',
        blurb: 'Automations, templates and apps.',
        heading: 'Put the busywork on rails.',
        body: 'Build if-this-then-that automations, start new spaces from templates and connect the apps your team already uses.',
        points: ['Visual automation builder with triggers and actions', 'Workspace template marketplace', 'Integrations and apps directory'],
        visual: 'flow',
    },
    {
        id: 'govern', icon: ShieldCheck, title: 'Govern',
        blurb: 'Roles, permissions, audit and org chart.',
        heading: 'Company-grade control, built in.',
        body: 'Company HQ gives owners and admins departments, managers, a permission matrix, analytics and a full audit trail, all in the same product your team uses.',
        points: ['Owner, admin, manager and member roles', 'Permission matrix, audit and compliance logs', 'Departments, employee directory and org chart'],
        visual: 'matrix',
    },
];

// ── Feature bento ──────────────────────────────────────────────────────
export const FEATURES = [
    { icon: Hash, color: '#8ea6ff', title: 'Channels', desc: 'Organised, searchable spaces for every team, project and topic.' },
    { icon: MessageCircle, color: '#b59cff', title: 'Direct messages', desc: 'Private 1:1 and group conversations, encrypted on your device.' },
    { icon: Headphones, color: '#5cc995', title: 'Huddles & meetings', desc: 'Jump into voice in one click, or schedule a meeting from the channel.' },
    { icon: ListChecks, color: '#f5c46b', title: 'Tasks', desc: 'Boards, assignees, deadlines and progress, created straight from chat.' },
    { icon: NotebookPen, color: '#f39a6b', title: 'Notes', desc: 'Docs and wikis that sit right beside the conversation they came from.' },
    { icon: Megaphone, color: '#f0a3c4', title: 'Updates', desc: 'Async stand-ups and announcements. Fewer meetings, same alignment.' },
    { icon: LayoutTemplate, color: '#7fd4e0', title: 'Templates & apps', desc: 'Start fast with templates and extend with integrations.' },
    { icon: Sparkles, color: '#c8a274', title: BRAND.ai, desc: 'Summaries, drafts and tasks from anything in your workspace.' },
];

// ── AI console demo ────────────────────────────────────────────────────
export const AI_PROMPTS = [
    {
        id: 'summarize', label: 'Summarize #launch',
        question: 'Summarize what happened in #launch today.',
        answer: 'Here’s today in #launch:\n• Release branch v2.4 is cut; QA sign-off is due at 3pm.\n• The orders_v2 migration passed its staging dry-run and ships behind a flag.\n• Arjun owns the rollback plan.\n• Still open: copy review on the pricing page (Lena).',
        sources: ['#launch · 23 messages', 'Thread · 4 replies'],
    },
    {
        id: 'tasks', label: 'Create tasks from this thread',
        question: 'Turn the open items in this thread into tasks.',
        answer: 'I found 3 action items and drafted them as tasks on the Launch board:',
        tasks: [
            { label: 'Finish QA sign-off for v2.4', who: 'Maya · today' },
            { label: 'Write the rollback runbook for orders_v2', who: 'Arjun · today' },
            { label: 'Review the pricing page copy', who: 'Lena · Thu' },
        ],
        sources: ['#launch thread', 'Launch board'],
    },
    {
        id: 'decide', label: 'What did we decide on pricing?',
        question: 'What did we decide about the pricing page?',
        answer: 'On Tuesday the team agreed to keep three tiers, move annual billing to the default toggle and add a comparison table. Sam asked for one more copy pass before publishing. That review is still open.',
        sources: ['#design · Tue', 'Notes · Pricing v2'],
    },
    {
        id: 'draft', label: 'Draft the launch announcement',
        question: 'Draft a short launch announcement for #general.',
        answer: 'Draft for #general:\n\n“v2.4 is live 🎉 Orders are faster and more reliable thanks to the new orders_v2 pipeline. Huge thanks to Arjun, Maya and Lena. Questions? Drop them in #launch.”\n\nWant me to post it or adjust the tone?',
        sources: ['#launch', 'Release notes'],
    },
];

// ── Security pillars ───────────────────────────────────────────────────
export const SECURITY = [
    { icon: Lock, title: 'End-to-end encryption', desc: 'Channel and DM messages are encrypted on your device with per-conversation keys (X25519 + AES-GCM) before they reach our servers.' },
    { icon: KeyRound, title: 'Keys you control', desc: 'Your identity key is unlocked on your device, with a recovery flow if you switch machines. We can’t read your messages.' },
    { icon: Users, title: 'Roles & permissions', desc: 'Owner, admin, manager and member roles with a permission matrix across workspaces and channels.' },
    { icon: ScrollText, title: 'Audit & compliance logs', desc: 'Every sensitive admin action is recorded, searchable and exportable for review.' },
];

// ── Steps ──────────────────────────────────────────────────────────────
export const STEPS = [
    { n: '01', title: 'Create your space', desc: 'Sign up free for a personal workspace, or register your company to get Company HQ.' },
    { n: '02', title: 'Bring your team', desc: 'Invite people by email or link, then organise them into channels, departments and roles.' },
    { n: '03', title: 'Work in one place', desc: `Chat, plan, meet and ask ${BRAND.ai}, without switching between five different apps.` },
];

// ── FAQ ────────────────────────────────────────────────────────────────
export const FAQ = [
    { q: `What is ${BRAND.name}?`, a: `${BRAND.name} is a collaboration platform that puts team chat, voice huddles, tasks, notes, updates and an AI assistant into one workspace, so your team stops juggling separate tools.` },
    { q: `Is ${BRAND.name} the same product as ${BRAND.formerName}?`, a: `Yes. ${BRAND.formerName} is now ${BRAND.name}. Your existing account, workspaces and messages carry over unchanged, and you sign in exactly as before.` },
    { q: 'What’s the difference between Personal and Company HQ?', a: 'Personal is a free workspace you can set up in seconds, for individuals and small groups. Company HQ is for organisations: after a quick verification you get an admin dashboard, departments, roles, a permission matrix, analytics and audit logs.' },
    { q: 'Are my messages really end-to-end encrypted?', a: 'Yes. Messages in channels and DMs are encrypted in your browser or app with per-conversation keys before they are sent. Our servers only store ciphertext, which is why you unlock encryption with your password on a new device.' },
    { q: `What can ${BRAND.ai} do?`, a: `${BRAND.ai} can summarise channels and threads, turn conversations into tasks, answer questions about your workspace, translate messages and draft replies. Mention it in any message or open it from the sidebar.` },
    { q: 'Which platforms are supported?', a: `${BRAND.name} runs in any modern browser today. Desktop apps for macOS and Windows and mobile apps for iOS and Android are in development and will sync with your web workspace in real time.` },
];
