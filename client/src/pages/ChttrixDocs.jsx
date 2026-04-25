import React, { useState, useEffect } from 'react';

import {
    BookOpen, MessageSquare, Hash, GitBranch, Users, CheckSquare, FileText,
    Shield, Sparkles, BellRing, Settings, Building2, Lock, UserCheck,
    Key, Video, Globe, Zap, Layers, Command, Search, ChevronRight, AlertTriangle
} from 'lucide-react';

const SECTIONS = [
    { id: 'intro',           icon: BookOpen,     label: 'Introduction' },
    { id: 'getting-started', icon: Zap,          label: 'Getting Started' },
    { id: 'workspaces',      icon: Building2,    label: 'Workspaces' },
    { id: 'channels',        icon: Hash,         label: 'Channels' },
    { id: 'messaging',       icon: MessageSquare,label: 'Messaging & DMs' },
    { id: 'threads',         icon: GitBranch,    label: 'Threads' },
    { id: 'tasks',           icon: CheckSquare,  label: 'Tasks' },
    { id: 'notes',           icon: FileText,     label: 'Notes' },
    { id: 'ai',              icon: Sparkles,     label: 'Chttrix AI' },
    { id: 'search',          icon: Search,       label: 'Search' },
    { id: 'notifications',   icon: BellRing,     label: 'Notifications' },
    { id: 'security',        icon: Shield,       label: 'Security & Roles' },
    { id: 'settings',        icon: Settings,     label: 'Settings' },
];

const S = {
    h2: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '14px', paddingTop: '8px' },
    h3: { fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', marginTop: '20px' },
    p:  { fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.85', marginBottom: '16px' },
    ul: { paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '18px' },
    li: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7' },
    dot: { width: '5px', height: '5px', background: '#b8956a', flexShrink: 0, marginTop: '9px' },
    code: { fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '12px', background: '#1a1a1a', border: '1px solid var(--border-default)', padding: '2px 6px', color: '#b8956a', borderRadius: '2px' },
};

const TipBox = ({ children, type = 'note' }) => {
    const colors = { note: '#6ea8fe', tip: '#5aba8a', warning: '#c9a87c', danger: '#e05252' };
    const icons  = { note: '◆', tip: '✔', warning: '⚠', danger: '✕' };
    const c = colors[type];
    return (
        <div style={{ padding: '14px 16px', background: `${c}0d`, border: `1px solid ${c}25`, borderLeft: `3px solid ${c}`, marginBottom: '18px', display: 'flex', gap: '10px' }}>
            <span style={{ color: c, fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{icons[type]}</span>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', margin: 0 }}>{children}</p>
        </div>
    );
};

function DocSection({ id, title, icon: Icon, children }) {
    return (
        <section id={id} style={{ paddingBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: '#b8956a' }} />
                </div>
                <h2 style={S.h2}>{title}</h2>
            </div>
            {children}
        </section>
    );
}

const ChttrixDocs = () => {
    const [active, setActive] = useState('intro');
    const [search, setSearch] = useState('');

    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        window.scrollTo(0, 0);
        return () => document.documentElement.classList.remove('public-scroll');
    }, []);

    useEffect(() => {
        const onScroll = () => {
            const pos = window.scrollY + 120;
            for (const s of SECTIONS) {
                const el = document.getElementById(s.id);
                if (el && pos >= el.offsetTop && pos < el.offsetTop + el.offsetHeight) setActive(s.id);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } ::selection { background: rgba(184,149,106,0.3); }`}</style>

            {}
            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px', display: 'flex', gap: '56px', alignItems: 'flex-start' }}>

                {}
                <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '24px' }}>
                    {}
                    <button onClick={() => window.location.href = '/'} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms ease', padding: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7 10L3 6l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        Back to Chttrix
                    </button>

                    {}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <img src="/chttrix-logo.jpg" alt="" style={{ width: '24px', height: '24px', objectFit: 'cover' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Docs</span>
                    </div>

                    {}
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                        <Search size={11} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs..."
                            style={{ width: '100%', padding: '7px 10px 7px 28px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '10px' }}>Sections</p>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {SECTIONS.filter(s => !search || s.label.toLowerCase().includes(search.toLowerCase())).map(s => {
                            const Icon = s.icon; const isAct = active === s.id;
                            return (
                                <button key={s.id} onClick={() => scrollTo(s.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', background: isAct ? 'rgba(184,149,106,0.1)' : 'transparent', border: isAct ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: isAct ? '#b8956a' : 'rgba(228,228,228,0.4)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 150ms ease', width: '100%' }}>
                                    <Icon size={11} />{s.label}
                                </button>
                            );
                        })}
                    </nav>

                    <div style={{ marginTop: '28px', padding: '12px 14px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.15)' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                            Platform v1.0<br />
                            <span style={{ color: '#b8956a' }}>Workspace OS</span>
                        </p>
                    </div>
                </aside>

                {}
                <main style={{ flex: 1, minWidth: 0, paddingTop: '0' }}>
                    {}
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '16px' }}>
                            <BookOpen size={11} style={{ color: '#b8956a' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Documentation</span>
                        </div>
                        <h1 style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Chttrix Docs</h1>
                        <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.75', maxWidth: '600px' }}>
                            Everything you need to get the most out of Chttrix — from setting up your first workspace to mastering Chttrix AI and enterprise security.
                        </p>
                    </div>

                    <DocSection id="intro" icon={BookOpen} title="Introduction">
                        <p style={S.p}>Chttrix is an all-in-one workspace OS designed for modern teams. It combines real-time messaging, video huddles, task management, collaborative notes, and an AI layer into a single unified platform.</p>
                        <p style={S.p}>Unlike traditional tools that require switching between Slack, Notion, Jira, and Zoom, Chttrix keeps everything in context — conversations next to tasks, notes next to channels, and AI woven throughout.</p>
                        <TipBox type="tip">New to Chttrix? Start with <strong>Getting Started</strong> below to create your first workspace and invite your team.</TipBox>
                        <h3 style={S.h3}>Core concepts</h3>
                        <ul style={S.ul}>
                            {[
                                'Workspace — your company\'s root environment, managed by an Owner and Admins',
                                'Channels — topic-based rooms for structured team conversations',
                                'Threads — replies to specific messages that keep discussions organized',
                                'Huddles — instant voice and video calls, no scheduling required',
                                'Tasks — native project management with Kanban and assignment',
                                'Notes — collaborative documents that live alongside channels',
                                'Chttrix AI — the intelligence layer that understands your workspace context',
                            ].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="getting-started" icon={Zap} title="Getting Started">
                        <p style={S.p}>Getting your team onto Chttrix takes less than 5 minutes. Here's the fastest path from sign-up to full team collaboration.</p>
                        <h3 style={S.h3}>Option A — Personal Workspace</h3>
                        <ul style={S.ul}>
                            {['Visit chttrix.io and click "Log In → Sign Up"', 'Enter your email and create a password', 'Verify your email address', 'Your personal workspace is ready immediately'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Option B — Company HQ</h3>
                        <ul style={S.ul}>
                            {['Go to chttrix.io and click "Register Company HQ"', 'Fill in your organization details (name, domain, size)', 'Create the Owner account — this is your superadmin', 'Invite Admins and configure departments', 'Admins then onboard team members via invite links'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <TipBox type="note">Company HQ includes the full Admin dashboard with org chart, department management, permission matrix, and audit logs. Personal workspaces are single-user by default.</TipBox>
                    </DocSection>

                    <DocSection id="workspaces" icon={Building2} title="Workspaces">
                        <p style={S.p}>A Workspace is the root container for your organization on Chttrix. Every channel, member, file, and conversation lives inside a workspace.</p>
                        <h3 style={S.h3}>Workspace Roles</h3>
                        <ul style={S.ul}>
                            {[
                                'Owner — full platform control, billing, and security settings',
                                'Admin — manage members, departments, channels, and integrations',
                                'Manager — oversee teams, projects, and direct reports',
                                'Employee — standard workspace member',
                            ].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Workspace Settings</h3>
                        <p style={S.p}>Access workspace settings from <span style={S.code}>Admin Dashboard → Settings</span>. Here you can configure: company profile, branding, billing plan, SSO/domain, notification defaults, security policies, and data privacy settings.</p>
                    </DocSection>

                    <DocSection id="channels" icon={Hash} title="Channels">
                        <p style={S.p}>Channels are the backbone of Chttrix — topic-based spaces for team communication. Every message in a channel is persistent, searchable, and threaded.</p>
                        <h3 style={S.h3}>Channel Types</h3>
                        <ul style={S.ul}>
                            {[
                                'Public — anyone in the workspace can join and browse',
                                'Private — invite-only, content hidden from non-members',
                                'Announcement — only admins can post, everyone can read',
                                'Project — linked to a task board for project-specific work',
                            ].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Creating a Channel</h3>
                        <p style={S.p}>Click the <span style={S.code}>+</span> button next to "Channels" in the sidebar. Give it a name, choose public or private, add a purpose, and select initial members. Channel names should be lowercase, hyphenated, and descriptive (e.g., <span style={S.code}>#engineering-backend</span>, <span style={S.code}>#design-reviews</span>).</p>
                        <TipBox type="tip">Use the <span style={S.code}>#general</span> channel for company-wide announcements and the <span style={S.code}>#random</span> channel for casual conversations. Keep project channels focused.</TipBox>
                    </DocSection>

                    <DocSection id="messaging" icon={MessageSquare} title="Messaging & DMs">
                        <p style={S.p}>Chttrix supports real-time messaging in channels, 1:1 DMs, and group DMs. All messages support rich formatting, reactions, file sharing, and inline tasks.</p>
                        <h3 style={S.h3}>Message Formatting</h3>
                        <ul style={S.ul}>
                            {['**bold** and *italic* markdown', '`inline code` and ```code blocks```', '@mention a user or @channel to notify everyone', '#channel-link to reference another channel', ':emoji: shortcodes for reactions'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Direct Messages</h3>
                        <p style={S.p}>Start a DM from the sidebar by clicking "Direct Messages → New DM." You can DM individuals or create group DMs with up to 8 people. DMs are private and not visible to admins unless a legal hold is active.</p>
                    </DocSection>

                    <DocSection id="threads" icon={GitBranch} title="Threads">
                        <p style={S.p}>Threads let you reply to a specific message without cluttering the main channel. Hover any message and click the <span style={S.code}>Reply in thread</span> icon.</p>
                        <p style={S.p}>Threads appear in the right-side panel. Members who are part of the thread or @mentioned receive notifications. Thread activity is tracked in your Threads inbox.</p>
                        <TipBox type="tip">Use threads for decisions, code reviews, and in-depth discussions. Keep the main channel for high-level updates and quick questions.</TipBox>
                    </DocSection>

                    <DocSection id="tasks" icon={CheckSquare} title="Tasks">
                        <p style={S.p}>Chttrix Tasks is a native project management system that lives alongside your conversations. No separate tool needed.</p>
                        <h3 style={S.h3}>Key Features</h3>
                        <ul style={S.ul}>
                            {['Kanban boards with customizable columns', 'Task assignment, due dates, and priority levels', 'Subtasks and checklists', 'Convert any message into a task in one click', 'Task comments sync back to the linked channel thread'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Creating Tasks</h3>
                        <p style={S.p}>Access Tasks from the left sidebar. Create a task board per project or per team. You can also ask <span style={S.code}>@ChttrixAI</span> to "create tasks from the last 10 messages" and it'll auto-generate a structured task list.</p>
                    </DocSection>

                    <DocSection id="notes" icon={FileText} title="Notes">
                        <p style={S.p}>Notes are collaborative, rich-text documents that live inside channels. Think of them as wikis, specs, meeting minutes, and runbooks — all in the same context as your conversations.</p>
                        <ul style={S.ul}>
                            {['Rich text editing with headings, bullet lists, tables, and code blocks', 'Real-time co-editing with user presence cursors', 'Link notes to tasks, channels, or other notes', 'Version history and change tracking', 'Export to PDF or Markdown'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="ai" icon={Sparkles} title="Chttrix AI">
                        <p style={S.p}>Chttrix AI (Chttrix Intelligence™) is the workspace-aware AI assistant built into every part of the platform. It understands your channel history, tasks, and notes to provide relevant, contextual assistance.</p>
                        <h3 style={S.h3}>How to Use Chttrix AI</h3>
                        <ul style={S.ul}>
                            {['Mention @ChttrixAI in any channel or DM', 'Use the AI panel in the right sidebar for deeper queries', 'Highlight any text and click "Ask AI" for inline assistance', 'AI automatically summarizes long threads if you\'ve been inactive'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Capabilities</h3>
                        <ul style={S.ul}>
                            {['Summarize threads, channels, and meeting notes', 'Generate tasks from conversations', 'Draft messages, reports, and documentation', 'Answer questions using workspace context', 'Identify blockers and suggest next actions'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <TipBox type="warning">Chttrix AI processes data within your isolated tenant environment. It does not share your data across tenants or use it to train shared models without explicit opt-in.</TipBox>
                    </DocSection>

                    <DocSection id="search" icon={Search} title="Search">
                        <p style={S.p}>Global search covers all channels, DMs, messages, files, tasks, and notes you have access to. Press <span style={S.code}>⌘K</span> (Mac) or <span style={S.code}>Ctrl+K</span> (Windows) to open the command palette.</p>
                        <h3 style={S.h3}>Search Filters</h3>
                        <ul style={S.ul}>
                            {['Filter by channel, user, date range, or content type', 'Use "in:#channel" to limit search to a specific channel', 'Use "from:@user" to filter by who sent the message', 'Use "has:file" to find messages with attachments', 'AI-powered semantic search available in Company plan'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="notifications" icon={BellRing} title="Notifications">
                        <p style={S.p}>Chttrix has granular notification controls at the channel, workspace, and keyword level.</p>
                        <ul style={S.ul}>
                            {['Desktop notifications for @mentions and DMs', 'Per-channel notification preferences (All / Mentions / Nothing)', 'Mute channels or conversations temporarily or permanently', 'Set Do Not Disturb schedules by timezone', 'Custom keyword notifications for alerts on specific terms'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <p style={S.p}>Access notification settings via your avatar → <span style={S.code}>Settings → Notifications</span>.</p>
                    </DocSection>

                    <DocSection id="security" icon={Shield} title="Security & Roles">
                        <p style={S.p}>Chttrix uses a role-based access control (RBAC) model at the workspace, department, and channel level.</p>
                        <h3 style={S.h3}>Permission Hierarchy</h3>
                        <ul style={S.ul}>
                            {['Owner — workspace superadmin, billing, security policy', 'Admin — member management, channel creation, integrations', 'Manager — team oversight, report access', 'Employee — standard member access per channel permissions'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <TipBox type="note">Security settings are managed in <span style={S.code}>Owner Dashboard → Security</span>. Enterprise plans support SAML 2.0 SSO and custom IP allowlists.</TipBox>
                    </DocSection>

                    <DocSection id="settings" icon={Settings} title="Settings">
                        <p style={S.p}>Personal settings are accessible via your avatar in the bottom-left corner. Workspace settings are in the Admin Dashboard.</p>
                        <h3 style={S.h3}>Personal Settings</h3>
                        <ul style={S.ul}>
                            {['Profile — name, avatar, status, bio', 'Notifications — all notification preferences', 'Security — password, 2FA, active sessions', 'Appearance — theme, density, font size', 'Privacy — data controls and AI preferences'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={S.h3}>Admin Settings</h3>
                        <ul style={S.ul}>
                            {['Company Profile — name, logo, website', 'Branding — colors and custom logo', 'Billing Plan — subscription and usage', 'Domain & SSO — SAML integration', 'Security — password policy, 2FA enforcement', 'Data & Privacy — retention, exports, compliance'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>
                </main>
            </div>

            {}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>© 2026 Chttrix Inc. · <button onClick={() => window.location.href = '/privacy'} style={{ background: 'none', border: 'none', color: 'rgba(184,149,106,0.5)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Privacy</button> · <button onClick={() => window.location.href = '/terms'} style={{ background: 'none', border: 'none', color: 'rgba(184,149,106,0.5)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Terms</button></p>
            </div>
        </div>
    );
};

export default ChttrixDocs;
