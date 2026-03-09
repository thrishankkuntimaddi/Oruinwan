import React, { useState } from 'react';
import { X, ArrowRight, FileText, Zap, Layers, ClipboardList, Lightbulb, Users, FolderKanban, Cpu, Megaphone, StickyNote } from 'lucide-react';

// ─────────────────────────────────────────────
// Template Definitions — all pre-filled with realistic dummy data
// ─────────────────────────────────────────────
export const TEMPLATES = [
    /* ───── Quick Start ───── */
    {
        id: 'blank', category: 'quick',
        TypeIcon: StickyNote, iconColor: '#64748b', color: '#0f172a', accent: '#334155',
        label: 'Blank Note',
        tag: 'EMPTY',
        desc: 'Start from a clean slate with no structure.',
        preview: ['No pre-filled blocks', 'Full freedom to shape', 'Start typing immediately'],
        blocks: [],
        title: 'Untitled Note',
    },

    /* ───── Project Templates ───── */
    {
        id: 'projectspec', category: 'project',
        TypeIcon: FolderKanban, iconColor: '#7dd3fc', color: '#0369a1', accent: '#0284c7',
        label: 'Project Spec',
        tag: 'PLANNING',
        desc: 'Goals, scope, timeline, and open questions.',
        preview: ['Goal & scope sections', 'Milestone table', 'Open questions callout'],
        title: 'Project Specification',
        blocks: [
            { type: 'heading', content: 'Goal', meta: { level: 1 } },
            { type: 'text', content: 'Build and ship a fully responsive dashboard that allows users to view, filter, and export analytics data in real time.', meta: {} },
            { type: 'heading', content: 'Scope', meta: { level: 2 } },
            { type: 'text', content: 'In scope: data ingestion pipeline, chart components, CSV export. Out of scope: mobile native app, third-party integrations (Phase 2).', meta: {} },
            { type: 'heading', content: 'Timeline', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Milestone', 'Target Date', 'Owner', 'Status'], rows: [['Design mockups', 'Mar 15', 'Alice', '✅ Done'], ['Backend API', 'Mar 25', 'Bob', '🔄 In Progress'], ['Frontend integration', 'Apr 5', 'Carol', '⏳ Pending'], ['QA & launch', 'Apr 12', 'Team', '⏳ Pending']] }), meta: {} },
            { type: 'heading', content: 'Open Questions', meta: { level: 2 } },
            { type: 'callout', content: '1. Should we support real-time WebSocket updates or polling?\n2. What is the max data retention window for the charts?\n3. Do we need role-based visibility on datasets?', meta: { variant: 'warning' } },
        ],
    },
    {
        id: 'techdesign', category: 'project',
        TypeIcon: Cpu, iconColor: '#94a3b8', color: '#1e293b', accent: '#334155',
        label: 'Tech Design',
        tag: 'ENGINEERING',
        desc: 'Architecture decisions, API endpoints, and risk mitigations.',
        preview: ['Overview & architecture', 'API endpoint table', 'Risks callout'],
        title: 'Technical Design Document',
        blocks: [
            { type: 'heading', content: 'Overview', meta: { level: 1 } },
            { type: 'text', content: 'This document describes the technical approach for implementing the Notifications Service — a centralized, event-driven system for delivering in-app and email alerts to users across all platform modules.', meta: {} },
            { type: 'heading', content: 'Architecture', meta: { level: 2 } },
            { type: 'text', content: 'The service follows an event-bus pattern. Producers (e.g. TaskService, MessageService) emit events to a Redis Pub/Sub channel. A dedicated consumer worker processes events, deduplicates them, and fans out to the appropriate delivery channels (WebSocket for in-app, SendGrid for email).', meta: {} },
            { type: 'heading', content: 'API Endpoints', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Method', 'Endpoint', 'Description', 'Auth'], rows: [['GET', '/api/notifications', 'List notifications for user', 'Bearer'], ['PATCH', '/api/notifications/:id/read', 'Mark single notification read', 'Bearer'], ['PATCH', '/api/notifications/read-all', 'Mark all as read', 'Bearer'], ['DELETE', '/api/notifications/:id', 'Delete a notification', 'Bearer']] }), meta: {} },
            { type: 'heading', content: 'Risks & Mitigations', meta: { level: 2 } },
            { type: 'callout', content: 'Risk: Redis failure causes missed events → Mitigation: persist events to MongoDB with a retry queue.\nRisk: Email rate limits on SendGrid free tier → Mitigation: batch digest emails, upgrade plan before launch.', meta: { variant: 'warning' } },
        ],
    },
    {
        id: 'brainstorm', category: 'project',
        TypeIcon: Lightbulb, iconColor: '#c4b5fd', color: '#4c1d95', accent: '#6d28d9',
        label: 'Brainstorm',
        tag: 'IDEATION',
        desc: 'Capture every idea fast — refine and group later.',
        preview: ['Problem statement', 'Ideas checklist', 'Alternative approaches toggle'],
        title: 'Brainstorm Session',
        blocks: [
            { type: 'callout', content: '💡 Capture every idea — refine later. No filtering during brainstorm.', meta: { variant: 'info' } },
            { type: 'heading', content: 'Problem Statement', meta: { level: 2 } },
            { type: 'text', content: 'Users churn after 7 days because they do not get enough value from the onboarding experience. We need to redesign the first-run flow to drive meaningful activation within 24 hours.', meta: {} },
            { type: 'heading', content: 'Ideas', meta: { level: 2 } },
            {
                type: 'checklist', content: JSON.stringify([
                    { id: 1, text: 'Interactive product tour with real data instead of dummy placeholders', done: false },
                    { id: 2, text: 'Personalize onboarding path based on user role (dev, PM, designer)', done: false },
                    { id: 3, text: 'Gamified checklist — unlock features as milestones are hit', done: false },
                    { id: 4, text: 'Email drip campaign synced to in-app progress', done: false },
                    { id: 5, text: 'One-click sample workspace pre-loaded with realistic data', done: false },
                ]), meta: {}
            },
            { type: 'toggle', content: '- Guided video walkthrough with skip option\n- AI-powered setup wizard that asks 3 questions and configures the workspace\n- Pair new users with a "buddy" (existing power user) for the first week', meta: { title: 'Alternative Approaches', open: false } },
        ],
    },

    /* ───── Meeting & Ops ───── */
    {
        id: 'meeting', category: 'meeting',
        TypeIcon: Users, iconColor: '#6ee7b7', color: '#065f46', accent: '#059669',
        label: 'Meeting Notes',
        tag: 'MEETING',
        desc: 'Date, attendees, agenda, and action items.',
        preview: ['Date / time / location table', 'Attendees checklist', 'Action items'],
        title: 'Meeting Notes',
        blocks: [
            { type: 'heading', content: 'Meeting Details', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Date', 'Time', 'Location'], rows: [['March 10, 2026', '10:00 AM IST', 'Google Meet / War Room B']] }), meta: {} },
            { type: 'heading', content: 'Attendees', meta: { level: 2 } },
            {
                type: 'checklist', content: JSON.stringify([
                    { id: 1, text: 'Alice Nguyen (PM) — facilitator', done: true },
                    { id: 2, text: 'Bob Kamal (Backend)', done: true },
                    { id: 3, text: 'Carol Smith (Frontend)', done: true },
                    { id: 4, text: 'David Lee (QA)', done: false },
                ]), meta: {}
            },
            { type: 'divider', content: 'Agenda', meta: {} },
            { type: 'text', content: '1. Review last sprint retro action items (15 min)\n2. Q2 roadmap prioritization vote (20 min)\n3. Unblock: payment gateway integration (10 min)\n4. AOB', meta: {} },
            { type: 'divider', content: 'Action Items', meta: {} },
            {
                type: 'checklist', content: JSON.stringify([
                    { id: 1, text: 'Bob: Set up Stripe sandbox env by EOD Thursday', done: false },
                    { id: 2, text: 'Carol: Share Figma prototype link in #design before Friday standup', done: false },
                    { id: 3, text: 'Alice: Circulate Q2 roadmap doc for async comments by Wednesday', done: false },
                ]), meta: {}
            },
        ],
    },
    {
        id: 'sop', category: 'meeting',
        TypeIcon: ClipboardList, iconColor: '#fcd34d', color: '#92400e', accent: '#d97706',
        label: 'SOP',
        tag: 'PROCESS',
        desc: 'Standard operating procedure with step-by-step toggles.',
        preview: ['Purpose callout', 'Scope & steps', 'Toggle per step'],
        title: 'Standard Operating Procedure',
        blocks: [
            { type: 'callout', content: 'Purpose: This SOP outlines the process for deploying a new release to production. Following these steps ensures zero-downtime deployments and a clear rollback path.', meta: { variant: 'info' } },
            { type: 'heading', content: 'Scope', meta: { level: 2 } },
            { type: 'text', content: 'Applies to all backend and frontend services. Excludes database schema migrations (see SOP-DB-002) and third-party integrations (see SOP-INT-001).', meta: {} },
            { type: 'heading', content: 'Steps', meta: { level: 2 } },
            { type: 'toggle', content: '1. Create a release branch from `main`: `git checkout -b release/v2.4.0`\n2. Run full test suite: `npm test && npm run e2e`\n3. Tag the release: `git tag v2.4.0 && git push origin v2.4.0`', meta: { title: 'Step 1: Cut release branch & run tests', open: true } },
            { type: 'toggle', content: '1. Open a PR from `release/v2.4.0` → `main`\n2. Require 2 approvals from senior engineers\n3. Ensure CI pipeline passes all checks (lint, tests, build)', meta: { title: 'Step 2: Code review & CI gate', open: false } },
            { type: 'toggle', content: '1. Merge PR to main — CI triggers auto-deploy to staging\n2. Smoke test the staging URL against the test checklist\n3. Get PO sign-off on staging before proceeding', meta: { title: 'Step 3: Deploy to staging & smoke test', open: false } },
            { type: 'toggle', content: '1. Run `npm run deploy:prod` from CI/CD panel\n2. Monitor error rate on Datadog for 15 minutes post-deploy\n3. If error rate spikes >1%, run `npm run rollback` immediately and page on-call', meta: { title: 'Step 4: Production deploy & monitoring', open: false } },
        ],
    },
    {
        id: 'announcement', category: 'meeting',
        TypeIcon: Megaphone, iconColor: '#fda4af', color: '#9f1239', accent: '#e11d48',
        label: 'Announcement',
        tag: 'COMMS',
        desc: 'Draft a structured update with what, why, and next steps.',
        preview: ['Draft review callout', 'What / Why / What to do', 'Action checklist'],
        title: 'Announcement Draft',
        blocks: [
            { type: 'callout', content: '📢 DRAFT — Review with comms team and legal before publishing. Do not share externally yet.', meta: { variant: 'warning' } },
            { type: 'heading', content: 'What is changing', meta: { level: 2 } },
            { type: 'text', content: 'Starting April 1, 2026, all workspaces on the Free plan will be limited to 5,000 messages per month. Workspaces currently exceeding this limit will receive a 30-day grace period before enforcement begins.', meta: {} },
            { type: 'heading', content: 'Why it matters', meta: { level: 2 } },
            { type: 'text', content: 'This change allows us to invest in infrastructure improvements, faster search, and reliable uptime for all users. Pro and Business plans remain unlimited with no changes to pricing.', meta: {} },
            { type: 'heading', content: 'What to do next', meta: { level: 2 } },
            {
                type: 'checklist', content: JSON.stringify([
                    { id: 1, text: 'Check your current usage in Settings → Workspace → Usage', done: false },
                    { id: 2, text: 'Upgrade to Pro if needed — 50% off for the first 3 months with code UPGRADE26', done: false },
                    { id: 3, text: 'Reach out to support@chttrix.com with questions', done: false },
                ]), meta: {}
            },
        ],
    },

    /* ───── Documents ───── */
    {
        id: 'document', category: 'docs',
        TypeIcon: FileText, iconColor: '#93c5fd', color: '#1d4ed8', accent: '#3b82f6',
        label: 'Document',
        tag: 'DOCUMENT',
        desc: 'Structured document with overview, details, and next steps.',
        preview: ['Overview H1 header', 'Details & sub-sections', 'Next steps checklist'],
        title: 'New Document',
        blocks: [
            { type: 'heading', content: 'Overview', meta: { level: 1 } },
            { type: 'text', content: 'This document captures the end-to-end design and implementation details for the User Authentication Module including OAuth2 (Google, GitHub), email/password, and magic-link flows.', meta: {} },
            { type: 'heading', content: 'Details', meta: { level: 2 } },
            { type: 'text', content: 'Authentication is handled via JWT access tokens (15-min expiry) and rotating refresh tokens (30-day expiry). Sessions are tracked in Redis. All tokens are signed with RS256 private key stored in AWS Secrets Manager.', meta: {} },
            { type: 'heading', content: 'Sub-sections', meta: { level: 2 } },
            { type: 'text', content: 'Rate limiting: 10 failed login attempts → 15-min lockout via Redis counter. Password hashing: bcrypt with 12 salt rounds. OAuth scope: email + profile only (no offline access).', meta: {} },
            { type: 'heading', content: 'Next Steps', meta: { level: 2 } },
            {
                type: 'checklist', content: JSON.stringify([
                    { id: 1, text: 'Add biometric auth support for mobile PWA (Face ID / Touch ID)', done: false },
                    { id: 2, text: 'Implement TOTP-based 2FA (Google Authenticator / Authy)', done: false },
                    { id: 3, text: 'Audit log for all auth events → ship to SIEM', done: false },
                ]), meta: {}
            },
        ],
    },
];

// ─────────────────────────────────────────────
// Category sidebar config
// ─────────────────────────────────────────────
const CATEGORIES = [
    { id: 'quick', label: 'Quick Start', Icon: Zap },
    { id: 'project', label: 'Project Templates', Icon: Layers },
    { id: 'meeting', label: 'Meeting & Ops', Icon: ClipboardList },
    { id: 'docs', label: 'Documents', Icon: FileText },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const NoteTemplateModal = ({ onSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('quick');
    const [hovered, setHovered] = useState(null);

    const visible = TEMPLATES.filter(t => t.category === activeCategory);
    const catInfo = CATEGORIES.find(c => c.id === activeCategory);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div
                className="bg-white dark:bg-[#0f172a] w-full max-w-4xl flex overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl"
                style={{ height: '580px', borderRadius: 0 }}
            >
                {/* ── Left category sidebar ── */}
                <div className="w-[210px] flex-shrink-0 bg-gray-50 dark:bg-[#020617] border-r border-gray-200 dark:border-gray-800 flex flex-col">
                    <div className="px-5 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                        <h2 className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight uppercase">New Note</h2>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Choose a template</p>
                    </div>

                    <nav className="flex-1 p-2 space-y-px overflow-y-auto">
                        {CATEGORIES.map(cat => {
                            const Ic = cat.Icon;
                            const isActive = activeCategory === cat.id;
                            const count = TEMPLATES.filter(t => t.category === cat.id).length;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-medium transition-all
                                        ${isActive
                                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                >
                                    <Ic size={13} className="flex-shrink-0" />
                                    <span className="flex-1">{cat.label}</span>
                                    <span className="text-[10px] font-semibold tabular-nums text-gray-300 dark:text-gray-600">{count}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">
                            {TEMPLATES.length} TEMPLATES · {CATEGORIES.length} CATEGORIES
                        </p>
                    </div>
                </div>

                {/* ── Right panel ── */}
                <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f172a]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            {catInfo?.Icon && <catInfo.Icon size={14} className="text-gray-400" />}
                            <div>
                                <h3 className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight uppercase">
                                    {catInfo?.label}
                                </h3>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                                    {visible.length} TEMPLATE{visible.length !== 1 ? 'S' : ''} AVAILABLE
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                        <div className="grid grid-cols-2 gap-3">
                            {visible.map(tmpl => {
                                const isHov = hovered === tmpl.id;
                                return (
                                    <button
                                        key={tmpl.id}
                                        onClick={() => onSelect(tmpl)}
                                        onMouseEnter={() => setHovered(tmpl.id)}
                                        onMouseLeave={() => setHovered(null)}
                                        className={`group text-left overflow-hidden border transition-all duration-150
                                            ${isHov
                                                ? 'border-gray-900 dark:border-white shadow-lg -translate-y-px'
                                                : 'border-gray-200 dark:border-gray-800 shadow-sm'
                                            }`}
                                        style={{ borderRadius: 0 }}
                                    >
                                        {/* Bold color header */}
                                        <div
                                            className="px-4 pt-4 pb-3.5 relative overflow-hidden"
                                            style={{ backgroundColor: tmpl.color }}
                                        >
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-[3px]"
                                                style={{ backgroundColor: tmpl.accent }}
                                            />
                                            <div
                                                className="absolute inset-0 opacity-[0.04]"
                                                style={{
                                                    backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 14px,rgba(255,255,255,.5) 14px,rgba(255,255,255,.5) 15px),repeating-linear-gradient(90deg,transparent,transparent 14px,rgba(255,255,255,.5) 14px,rgba(255,255,255,.5) 15px)'
                                                }}
                                            />
                                            <div className="relative z-10 flex items-start justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold tracking-widest text-white/50 block mb-2 font-mono">{tmpl.tag}</span>
                                                    <div className="flex items-center gap-2">
                                                        <tmpl.TypeIcon size={18} className="flex-shrink-0" style={{ color: tmpl.iconColor }} />
                                                        <h4 className="text-[14px] font-bold text-white leading-tight">{tmpl.label}</h4>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-mono text-white/30 mt-0.5">{tmpl.blocks.length}B</span>
                                            </div>
                                        </div>

                                        {/* Card body */}
                                        <div className="p-4 bg-white dark:bg-[#0f172a]">
                                            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                                                {tmpl.desc}
                                            </p>
                                            <div className="space-y-1 mb-4">
                                                {tmpl.preview.map((line, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-gray-300 dark:text-gray-700 font-mono">—</span>
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{line}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                                                <span className="text-[10px] font-bold text-gray-300 dark:text-gray-700 font-mono uppercase tracking-wider">
                                                    {tmpl.blocks.length} BLOCKS
                                                </span>
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition-all font-mono
                                                    ${isHov ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>
                                                    Use template <ArrowRight size={11} className={`transition-transform ${isHov ? 'translate-x-0.5' : ''}`} />
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NoteTemplateModal;
