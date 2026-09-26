import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen, MessageSquare, Hash, GitBranch, CheckSquare, FileText,
    Shield, Sparkles, BellRing, Settings, Building2, Zap, Search, ArrowRight, X,
} from 'lucide-react';
import PublicPageShell from '../components/layout/PublicPageShell';
import { PageHero, DocLayout, Callout } from '../components/public/PublicKit';
import BRAND from '../shared/brand';

const AI_HANDLE = `@${BRAND.ai.replace(/\s+/g, '')}`;

const Code = ({ children }) => <code>{children}</code>;
const Kbd = ({ children }) => <kbd className="orw-code">{children}</kbd>;
const List = ({ items }) => <ul>{items.map(t => <li key={t}>{t}</li>)}</ul>;
const Steps = ({ items }) => <ol className="orw-steps-list">{items.map(t => <li key={t}>{t}</li>)}</ol>;

// Wide tables scroll inside their own box so the page never scrolls sideways.
const TableWrap = ({ children }) => <div style={{ overflowX: 'auto', margin: '18px 0' }}>{children}</div>;

const SECTIONS = [
    {
        id: 'intro', icon: BookOpen, title: 'Introduction',
        content: (
            <>
                <p>{BRAND.name} is an all-in-one workspace OS designed for modern teams. It combines real-time messaging, voice huddles, task management, collaborative notes, and an AI layer into a single unified platform.</p>
                <p>Unlike traditional tools that require switching between Slack, Notion, Jira, and Zoom, {BRAND.name} keeps everything in context: conversations next to tasks, notes next to channels, and AI woven throughout.</p>
                <Callout type="good">New to {BRAND.name}? Start with <strong>Getting Started</strong> below to create your first workspace and invite your team.</Callout>
                <h3>Core concepts</h3>
                <List items={[
                    'Workspace: your company\'s root environment, managed by an Owner and Admins',
                    'Channels: topic-based rooms for structured team conversations',
                    'Threads: replies to specific messages that keep discussions organized',
                    'Huddles: instant voice calls, no scheduling required',
                    'Tasks: native project management with Kanban and assignment',
                    'Notes: collaborative documents that live alongside channels',
                    `${BRAND.ai}: the intelligence layer that understands your workspace context`,
                ]} />
            </>
        ),
    },
    {
        id: 'getting-started', icon: Zap, title: 'Getting Started',
        content: (
            <>
                <p>Getting your team onto {BRAND.name} takes less than 5 minutes. Here’s the fastest path from sign-up to full team collaboration.</p>
                <h3>Option A: Personal Workspace</h3>
                <Steps items={[
                    'Visit oruinwan.com and click "Log In → Sign Up"',
                    'Enter your email and create a password',
                    'Verify your email address',
                    'Your personal workspace is ready immediately',
                ]} />
                <h3>Option B: Company HQ</h3>
                <Steps items={[
                    'Go to oruinwan.com and click "Register Company HQ"',
                    'Fill in your organization details (name, domain, size)',
                    'Create the Owner account; this is your superadmin',
                    'Invite Admins and configure departments',
                    'Admins then onboard team members via invite links',
                ]} />
                <Callout>Company HQ includes the full Admin dashboard with org chart, department management, permission matrix, and audit logs. Personal workspaces are single-user by default.</Callout>
            </>
        ),
    },
    {
        id: 'workspaces', icon: Building2, title: 'Workspaces',
        content: (
            <>
                <p>A Workspace is the root container for your organization on {BRAND.name}. Every channel, member, file, and conversation lives inside a workspace.</p>
                <h3>Workspace roles</h3>
                <List items={[
                    'Owner: full platform control, billing, and security settings',
                    'Admin: manage members, departments, channels, and integrations',
                    'Manager: oversee teams, projects, and direct reports',
                    'Employee: standard workspace member',
                ]} />
                <h3>Workspace settings</h3>
                <p>Access workspace settings from <Code>Admin Dashboard → Settings</Code>. Here you can configure: company profile, branding, billing plan, SSO/domain, notification defaults, security policies, and data privacy settings.</p>
            </>
        ),
    },
    {
        id: 'channels', icon: Hash, title: 'Channels',
        content: (
            <>
                <p>Channels are the backbone of {BRAND.name}: topic-based spaces for team communication. Every message in a channel is persistent, searchable, and threaded.</p>
                <h3>Channel types</h3>
                <List items={[
                    'Public: anyone in the workspace can join and browse',
                    'Private: invite-only, content hidden from non-members',
                    'Announcement: only admins can post, everyone can read',
                    'Project: linked to a task board for project-specific work',
                ]} />
                <h3>Creating a channel</h3>
                <p>Click the <Code>+</Code> button next to “Channels” in the sidebar. Give it a name, choose public or private, add a purpose, and select initial members. Channel names should be lowercase, hyphenated, and descriptive (e.g., <Code>#engineering-backend</Code>, <Code>#design-reviews</Code>).</p>
                <Callout type="good">Use the <Code>#general</Code> channel for company-wide announcements and the <Code>#random</Code> channel for casual conversations. Keep project channels focused.</Callout>
            </>
        ),
    },
    {
        id: 'messaging', icon: MessageSquare, title: 'Messaging & DMs',
        content: (
            <>
                <p>{BRAND.name} supports real-time messaging in channels, 1:1 DMs, and group DMs. All messages support rich formatting, reactions, file sharing, and inline tasks.</p>
                <p>Messages in channels and DMs are end-to-end encrypted on your device (X25519 key exchange with AES-GCM) before they are sent.</p>
                <h3>Message formatting</h3>
                <TableWrap>
                    <table>
                        <thead><tr><th scope="col">Type this</th><th scope="col">To get</th></tr></thead>
                        <tbody>
                            <tr><td><Code>**bold**</Code> / <Code>*italic*</Code></td><td>Bold and italic markdown</td></tr>
                            <tr><td><Code>`code`</Code> / <Code>```block```</Code></td><td>Inline code and code blocks</td></tr>
                            <tr><td><Code>@name</Code> / <Code>@channel</Code></td><td>Mention a user, or notify everyone in the channel</td></tr>
                            <tr><td><Code>#channel-name</Code></td><td>Link to another channel</td></tr>
                            <tr><td><Code>:emoji:</Code></td><td>Emoji shortcodes for reactions</td></tr>
                        </tbody>
                    </table>
                </TableWrap>
                <h3>Direct messages</h3>
                <p>Start a DM from the sidebar by clicking “Direct Messages → New DM.” You can DM individuals or create group DMs with up to 8 people. DMs are private and not visible to admins.</p>
            </>
        ),
    },
    {
        id: 'threads', icon: GitBranch, title: 'Threads',
        content: (
            <>
                <p>Threads let you reply to a specific message without cluttering the main channel. Hover any message and click the <Code>Reply in thread</Code> icon.</p>
                <p>Threads appear in the right-side panel. Members who are part of the thread or @mentioned receive notifications. Thread activity is tracked in your Threads inbox.</p>
                <Callout type="good">Use threads for decisions, code reviews, and in-depth discussions. Keep the main channel for high-level updates and quick questions.</Callout>
            </>
        ),
    },
    {
        id: 'tasks', icon: CheckSquare, title: 'Tasks',
        content: (
            <>
                <p>{BRAND.name} Tasks is a native project management system that lives alongside your conversations. No separate tool needed.</p>
                <h3>Key features</h3>
                <List items={[
                    'Kanban boards with customizable columns',
                    'Task assignment, due dates, and priority levels',
                    'Subtasks and checklists',
                    'Convert any message into a task in one click',
                    'Task comments sync back to the linked channel thread',
                ]} />
                <h3>Creating tasks</h3>
                <p>Access Tasks from the left sidebar. Create a task board per project or per team. You can also ask <Code>{AI_HANDLE}</Code> to “create tasks from the last 10 messages” and it’ll auto-generate a structured task list.</p>
            </>
        ),
    },
    {
        id: 'notes', icon: FileText, title: 'Notes',
        content: (
            <>
                <p>Notes are collaborative, rich-text documents that live inside channels. Think of them as wikis, specs, meeting minutes, and runbooks, all in the same context as your conversations.</p>
                <List items={[
                    'Rich text editing with headings, bullet lists, tables, and code blocks',
                    'Share notes with teammates',
                    'Link notes to tasks, channels, or other notes',
                    'Version history and change tracking',
                    'Download as PDF',
                ]} />
            </>
        ),
    },
    {
        id: 'ai', icon: Sparkles, title: BRAND.ai,
        content: (
            <>
                <p>{BRAND.ai} is the workspace-aware AI assistant built into every part of the platform. It understands your channel history, tasks, and notes to provide relevant, contextual assistance.</p>
                <h3>How to use {BRAND.ai}</h3>
                <List items={[
                    `Mention ${AI_HANDLE} in any channel or DM`,
                    'Use the AI panel in the right sidebar for deeper queries',
                    'Highlight any text and click "Ask AI" for inline assistance',
                    'AI automatically summarizes long threads if you\'ve been inactive',
                ]} />
                <h3>Capabilities</h3>
                <List items={[
                    'Summarize threads, channels, and meeting notes',
                    'Generate tasks from conversations',
                    'Draft messages, reports, and documentation',
                    'Answer questions using workspace context',
                    'Identify blockers and suggest next actions',
                ]} />
                <Callout type="warn">{BRAND.ai} processes data within your isolated tenant environment. It does not share your data across tenants or use it to train shared models without explicit opt-in.</Callout>
            </>
        ),
    },
    {
        id: 'search', icon: Search, title: 'Search',
        content: (
            <>
                <p>Global search covers all channels, DMs, messages, files, tasks, and notes you have access to.</p>
                <h3>Keyboard shortcuts</h3>
                <TableWrap>
                    <table>
                        <thead><tr><th scope="col">Action</th><th scope="col">Mac</th><th scope="col">Windows / Linux</th></tr></thead>
                        <tbody>
                            <tr><td>Open search</td><td><Kbd>⌘K</Kbd></td><td><Kbd>Ctrl+K</Kbd></td></tr>
                        </tbody>
                    </table>
                </TableWrap>
                <h3>Search filters</h3>
                <List items={[
                    'Filter results by type: messages, files, people, channels, tasks, notes, or knowledge',
                    'Narrow results to a date range',
                    'Filter by tags',
                    'Toggle AI-powered semantic search on or off',
                ]} />
            </>
        ),
    },
    {
        id: 'notifications', icon: BellRing, title: 'Notifications',
        content: (
            <>
                <p>{BRAND.name} has granular notification controls at the channel, workspace, and keyword level.</p>
                <List items={[
                    'Desktop notifications for @mentions and DMs',
                    'Per-channel notification preferences (All / Mentions / Nothing)',
                    'Mute channels or conversations temporarily or permanently',
                    'Set Do Not Disturb schedules by timezone',
                    'Custom keyword notifications for alerts on specific terms',
                ]} />
                <p>Access notification settings via your avatar → <Code>Settings → Notifications</Code>.</p>
            </>
        ),
    },
    {
        id: 'security', icon: Shield, title: 'Security & Roles',
        content: (
            <>
                <p>{BRAND.name} uses a role-based access control (RBAC) model at the workspace, department, and channel level.</p>
                <h3>Permission hierarchy</h3>
                <List items={[
                    'Owner: workspace superadmin, billing, security policy',
                    'Admin: member management, channel creation, integrations',
                    'Manager: team oversight, report access',
                    'Employee: standard member access per channel permissions',
                ]} />
                <Callout>Security settings are managed in <Code>Owner Dashboard → Security</Code>. Enterprise plans support SAML 2.0 SSO and custom IP allowlists.</Callout>
            </>
        ),
    },
    {
        id: 'settings', icon: Settings, title: 'Settings',
        content: (
            <>
                <p>Personal settings are accessible via your avatar in the bottom-left corner. Workspace settings are in the Admin Dashboard.</p>
                <h3>Personal settings</h3>
                <List items={[
                    'Profile: name, avatar, status, bio',
                    'Notifications: all notification preferences',
                    'Security: password, 2FA, active sessions',
                    'Appearance: theme, density, font size',
                    'Privacy: data controls and AI preferences',
                ]} />
                <h3>Admin settings</h3>
                <List items={[
                    'Company Profile: name, logo, website',
                    'Branding: colors and custom logo',
                    'Billing Plan: subscription and usage',
                    'Domain & SSO: SAML integration',
                    'Security: password policy, 2FA enforcement',
                    'Data & Privacy: retention, exports, compliance',
                ]} />
            </>
        ),
    },
];

// Plain text of a JSX tree, so search matches exactly what the section shows.
const textOf = (node) => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    if (React.isValidElement(node)) {
        const { children, items } = node.props;
        return [textOf(children), Array.isArray(items) ? items.join(' ') : ''].join(' ');
    }
    return '';
};

const INDEX = SECTIONS.map(s => ({ ...s, haystack: `${s.title} ${textOf(s.content)}`.toLowerCase() }));

const isTypingTarget = (el) =>
    el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const ChttrixDocs = () => {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const termKey = terms.join(' ');
    const visible = useMemo(() => {
        const t = termKey ? termKey.split(' ') : [];
        return t.length ? INDEX.filter(s => t.every(w => s.haystack.includes(w))) : INDEX;
    }, [termKey]);

    // "/" focuses the search, unless the user is already typing somewhere.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
            e.preventDefault();
            inputRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const clear = () => { setQuery(''); inputRef.current?.focus(); };

    const search = (
        <div style={{ marginBottom: 16 }}>
            <label htmlFor="docs-search" className="orw-sr">Search the docs</label>
            <div className="orw-input-wrap">
                <input
                    ref={inputRef}
                    id="docs-search"
                    type="search"
                    className="orw-input orw-toc__search"
                    style={{ marginBottom: 0, paddingRight: query ? 46 : 12 }}
                    placeholder="Search docs  ( / )"
                    autoComplete="off"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
                    aria-describedby="docs-search-status"
                />
                {query && (
                    <button type="button" className="orw-input-wrap__btn" onClick={clear} aria-label="Clear search">
                        <X size={15} aria-hidden="true" />
                    </button>
                )}
            </div>
            <p id="docs-search-status" aria-live="polite" style={{ fontSize: 12, color: 'var(--o-text-3)', marginTop: 8, minHeight: 18 }}>
                {terms.length ? `${visible.length} of ${SECTIONS.length} sections match` : ''}
            </p>
        </div>
    );

    const empty = visible.length === 0 && (
        <div className="orw-callout" role="status" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Search size={16} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 180, overflowWrap: 'anywhere' }}>
                No results for <strong>“{query.trim()}”</strong>. Try a different word, or browse all sections.
            </div>
            <button type="button" className="orw-btn orw-btn--ghost" onClick={clear}>Clear search</button>
        </div>
    );

    return (
        <PublicPageShell title="Docs">
            {/*
              * Kit candidates: keep headings clear of the sticky nav when jumping to a
              * section, and restore the container gutter that `.orw-doc { padding: 64px 0 … }` resets.
              */}
            <PageHero
                eyebrow="Documentation"
                icon={BookOpen}
                title={<>{BRAND.name} <span className="orw-gloss-text">Docs</span></>}
                lead={`Everything you need to get the most out of ${BRAND.name}, from setting up your first workspace to mastering ${BRAND.ai} and enterprise security.`}
                actions={
                    <>
                        <Link to="/login?mode=signup" className="orw-btn orw-btn--primary orw-btn--lg">
                            Get started <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/contact" className="orw-btn orw-btn--ghost orw-btn--lg">Contact support</Link>
                    </>
                }
            />
            <div className="orw-docs">
                <DocLayout sections={visible} tocLabel="Sections" tocTop={search} footer={empty} />
            </div>
        </PublicPageShell>
    );
};

export default ChttrixDocs;
