import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../../../components/company-dash/dash.css';
import '../../../../styles/gloss.css';
import '../../../../features/plan/plan.css';
import { useOptionalWorkspace } from '../../../../contexts/WorkspaceContext';
import { usePlan } from '../../../../features/plan/usePlan';
import { COMING_SOON_LINE, emitPlanLimit } from '../../../../features/plan/planLimit';
import { X, ArrowRight, FileText, Zap, Layers, ClipboardList, Lightbulb, Users, FolderKanban, Cpu, Megaphone, StickyNote } from 'lucide-react';

export const TEMPLATES = [
    
    {
        id: 'blank', category: 'quick',
        TypeIcon: StickyNote,
        label: 'Blank note', tag: 'EMPTY',
        desc: 'Start from a clean slate with no structure.',
        preview: ['No pre-filled blocks', 'Full freedom to shape', 'Start typing immediately'],
        blocks: [], title: 'Untitled Note',
    },

    
    {
        id: 'projectspec', category: 'project',
        TypeIcon: FolderKanban,
        label: 'Project spec', tag: 'PLANNING',
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
        TypeIcon: Cpu,
        label: 'Tech design', tag: 'ENGINEERING',
        desc: 'Architecture decisions, API endpoints, and risk mitigations.',
        preview: ['Overview & architecture', 'API endpoint table', 'Risks callout'],
        title: 'Technical Design Document',
        blocks: [
            { type: 'heading', content: 'Overview', meta: { level: 1 } },
            { type: 'text', content: 'This document describes the technical approach for implementing the Notifications Service.', meta: {} },
            { type: 'heading', content: 'Architecture', meta: { level: 2 } },
            { type: 'text', content: 'The service follows an event-bus pattern. Producers emit events to a Redis Pub/Sub channel. A dedicated consumer worker processes events and fans out to delivery channels.', meta: {} },
            { type: 'heading', content: 'API Endpoints', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Method', 'Endpoint', 'Description', 'Auth'], rows: [['GET', '/api/notifications', 'List notifications for user', 'Bearer'], ['PATCH', '/api/notifications/:id/read', 'Mark single notification read', 'Bearer'], ['DELETE', '/api/notifications/:id', 'Delete a notification', 'Bearer']] }), meta: {} },
            { type: 'heading', content: 'Risks & Mitigations', meta: { level: 2 } },
            { type: 'callout', content: 'Risk: Redis failure causes missed events → Mitigation: persist events to MongoDB with a retry queue.', meta: { variant: 'warning' } },
        ],
    },
    {
        id: 'brainstorm', category: 'project',
        TypeIcon: Lightbulb,
        label: 'Brainstorm', tag: 'IDEATION',
        desc: 'Capture every idea fast — refine and group later.',
        preview: ['Problem statement', 'Ideas checklist', 'Alternative approaches toggle'],
        title: 'Brainstorm Session',
        blocks: [
            { type: 'callout', content: '💡 Capture every idea — refine later. No filtering during brainstorm.', meta: { variant: 'info' } },
            { type: 'heading', content: 'Problem Statement', meta: { level: 2 } },
            { type: 'text', content: 'Users churn after 7 days because they do not get enough value from the onboarding experience.', meta: {} },
            { type: 'heading', content: 'Ideas', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: 'Interactive product tour with real data', done: false }, { id: 2, text: 'Personalize onboarding path based on user role', done: false }, { id: 3, text: 'Gamified checklist — unlock features as milestones are hit', done: false }]), meta: {} },
        ],
    },

    
    {
        id: 'meeting', category: 'meeting',
        TypeIcon: Users,
        label: 'Meeting notes', tag: 'MEETING',
        desc: 'Date, attendees, agenda, and action items.',
        preview: ['Date / time / location table', 'Attendees checklist', 'Action items'],
        title: 'Meeting Notes',
        blocks: [
            { type: 'heading', content: 'Meeting Details', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Date', 'Time', 'Location'], rows: [['March 10, 2026', '10:00 AM IST', 'Google Meet']] }), meta: {} },
            { type: 'heading', content: 'Attendees', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: 'Alice Nguyen (PM) — facilitator', done: true }, { id: 2, text: 'Bob Kamal (Backend)', done: true }, { id: 3, text: 'Carol Smith (Frontend)', done: true }]), meta: {} },
            { type: 'divider', content: 'Action Items', meta: {} },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: 'Bob: Set up Stripe sandbox env by EOD Thursday', done: false }, { id: 2, text: 'Carol: Share Figma prototype link before Friday standup', done: false }]), meta: {} },
        ],
    },
    {
        id: 'sop', category: 'meeting',
        TypeIcon: ClipboardList,
        label: 'SOP', tag: 'PROCESS',
        desc: 'Standard operating procedure with step-by-step toggles.',
        preview: ['Purpose callout', 'Scope & steps', 'Toggle per step'],
        title: 'Standard Operating Procedure',
        blocks: [
            { type: 'callout', content: 'Purpose: This SOP outlines the process for deploying a new release to production.', meta: { variant: 'info' } },
            { type: 'heading', content: 'Scope', meta: { level: 2 } },
            { type: 'text', content: 'Applies to all backend and frontend services.', meta: {} },
            { type: 'toggle', content: '1. Create a release branch\n2. Run full test suite\n3. Tag the release', meta: { title: 'Step 1: Cut release branch & run tests', open: true } },
            { type: 'toggle', content: '1. Open a PR from release → main\n2. Require 2 approvals\n3. Ensure CI pipeline passes', meta: { title: 'Step 2: Code review & CI gate', open: false } },
        ],
    },
    {
        id: 'announcement', category: 'meeting',
        TypeIcon: Megaphone,
        label: 'Announcement', tag: 'COMMS',
        desc: 'Draft a structured update with what, why, and next steps.',
        preview: ['Draft review callout', 'What / Why / What to do', 'Action checklist'],
        title: 'Announcement Draft',
        blocks: [
            { type: 'callout', content: '📢 DRAFT — Review with comms team before publishing.', meta: { variant: 'warning' } },
            { type: 'heading', content: 'What is changing', meta: { level: 2 } },
            { type: 'text', content: 'Starting April 1, 2026, all workspaces on the Free plan will be limited to 5,000 messages per month.', meta: {} },
            { type: 'heading', content: 'Why it matters', meta: { level: 2 } },
            { type: 'text', content: 'This change allows us to invest in infrastructure improvements for all users.', meta: {} },
        ],
    },

    
    {
        id: 'document', category: 'docs',
        TypeIcon: FileText,
        label: 'Document', tag: 'DOCUMENT',
        desc: 'Structured document with overview, details, and next steps.',
        preview: ['Overview H1 header', 'Details & sub-sections', 'Next steps checklist'],
        title: 'New Document',
        blocks: [
            { type: 'heading', content: 'Overview', meta: { level: 1 } },
            { type: 'text', content: 'This document captures the end-to-end design and implementation details for the User Authentication Module.', meta: {} },
            { type: 'heading', content: 'Details', meta: { level: 2 } },
            { type: 'text', content: 'Authentication is handled via JWT access tokens (15-min expiry) and rotating refresh tokens (30-day expiry).', meta: {} },
            { type: 'heading', content: 'Next Steps', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: 'Add biometric auth support for mobile PWA', done: false }, { id: 2, text: 'Implement TOTP-based 2FA', done: false }]), meta: {} },
        ],
    },
];

const CATEGORIES = [
    { id: 'quick',   label: 'Quick start',     Icon: Zap },
    { id: 'project', label: 'Projects',        Icon: Layers },
    { id: 'meeting', label: 'Meetings & ops',  Icon: ClipboardList },
    { id: 'docs',    label: 'Documents',       Icon: FileText },
];

/** Note type stored for a template (blank and document are plain documents). */
const TYPE_MAP = { blank: 'note', document: 'note' };

/** What addNote needs to create a note from a template: [title, type, { content }]. */
export function templateToNote(template) {
    const noteType = TYPE_MAP[template.id] || template.id || 'note';
    const stamp = Date.now().toString(36);
    const blocks = (template.blocks || []).map((b, i) => ({ ...b, id: `${stamp}-${i}` }));
    const extra = { content: blocks.length ? JSON.stringify(blocks) : '' };
    // Free plan: notes per template are counted on the server (blank is unlimited).
    if (template.id && template.id !== 'blank') extra.templateId = template.id;
    return [template.title, noteType, extra];
}

/** The templates suggested first on the notes home. */
export const STARTER_TEMPLATE_IDS = ['meeting', 'projectspec', 'brainstorm', 'sop'];

/** Templates shown under a category; "Quick start" also offers the most used ones. */
const templatesIn = (category) => {
    const own = TEMPLATES.filter(t => t.category === category);
    if (category !== 'quick') return own;
    return [...own, ...STARTER_TEMPLATE_IDS.map(id => TEMPLATES.find(t => t.id === id)).filter(Boolean)];
};

/** A template as a card: icon, name, one line, what it contains. */
export function TemplateCard({ tmpl, onSelect, compact = false, limit = null }) {
    // limit = { used, max } on the free plan (notes per template in this workspace).
    const atLimit = !!limit && limit.max != null && limit.used >= limit.max;
    const choose = () => {
        if (atLimit) {
            emitPlanLimit({ limit: 'notes.perTemplate', max: limit.max, used: limit.used, message: `You've reached the free plan limit: ${limit.max} notes from the ${tmpl.label} template in this workspace. ${COMING_SOON_LINE}` });
            return;
        }
        onSelect(tmpl);
    };
    return (
        <button type="button" className="gl-card gl-card--interactive nt-card" onClick={choose}
            aria-disabled={atLimit ? 'true' : undefined} data-plan-blocked={atLimit ? 'true' : undefined}
            title={atLimit ? `Free plan: ${limit.max} notes per template. Blank notes are unlimited.` : undefined}>
            <span className="nt-card-top">
                <span className="gl-empty-mark" style={{ margin: 0 }}><tmpl.TypeIcon size={16} /></span>
                <span style={{ minWidth: 0 }}>
                    <strong className="nt-card-title">{tmpl.label}</strong>
                    <span className="nt-card-desc">{tmpl.desc}</span>
                </span>
            </span>
            {!compact && tmpl.preview?.length > 0 && (
                <ul className="nt-card-list">
                    {tmpl.preview.map((line) => <li key={line}>{line}</li>)}
                </ul>
            )}
            {limit && limit.max != null && (
                <span className="pl-template-limit" data-at-limit={atLimit ? 'true' : undefined} data-testid={`template-limit-${tmpl.id}`}>
                    {atLimit ? `Free plan limit reached (${limit.used} of ${limit.max})` : `${limit.used} of ${limit.max} used on the free plan`}
                </span>
            )}
            <span className="nt-card-foot">
                {tmpl.blocks.length ? `${tmpl.blocks.length} blocks` : 'Empty page'}
                <span className="nt-card-use">Use template <ArrowRight size={12} /></span>
            </span>
        </button>
    );
}

export const templateCardCss = `
.nt-card { padding: 14px; text-align: left; display: flex; flex-direction: column; gap: 10px; font-family: var(--font); cursor: pointer; min-width: 0; }
.nt-card-top { display: flex; align-items: flex-start; gap: 12px; }
.nt-card-title { display: block; font-size: 14px; color: var(--text-primary); }
.nt-card-desc { display: block; margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); }
.nt-card-list { margin: 0; padding: 0 0 0 16px; list-style: disc; font-size: 12px; line-height: 1.6; color: var(--text-secondary); }
.nt-card-foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--text-muted); }
.nt-card-use { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--text-secondary); transition: color 150ms ease; }
.nt-card:hover .nt-card-use, .nt-card:focus-visible .nt-card-use { color: var(--accent); }
`;

/** Pick a template for a new note. Two panes on desktop; tabs over one column on phones. */
const NoteTemplateModal = ({ onSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('quick');
    const visible = templatesIn(activeCategory);
    // Free plan: notes per template (blank is unlimited).
    const wsId = useOptionalWorkspace()?.activeWorkspace?.id || null;
    const { plan } = usePlan(wsId || false);
    const perTemplate = plan && !plan.exempt ? plan.notes?.perTemplate : null;
    const limitFor = (id) => (perTemplate != null && id !== 'blank' ? { used: plan.notes?.byTemplate?.[id] || 0, max: perTemplate } : null);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <div className="cd-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cd-dialog nt-modal" data-size="lg" role="dialog" aria-modal="true" aria-labelledby="nt-modal-title">
                <div className="cd-dialog-head">
                    <div style={{ minWidth: 0 }}>
                        <h2 id="nt-modal-title">New note</h2>
                        <p>Start blank or from a template. You can change everything afterwards.</p>
                    </div>
                    <button type="button" className="gl-icon-btn" onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
                </div>
                <div className="nt-modal-body">
                    <nav className="nt-modal-nav" aria-label="Template categories">
                        {CATEGORIES.map(cat => {
                            const count = templatesIn(cat.id).length;
                            return (
                                <button key={cat.id} type="button"
                                    className={`gl-item${activeCategory === cat.id ? ' is-active' : ''}`}
                                    aria-pressed={activeCategory === cat.id}
                                    onClick={() => setActiveCategory(cat.id)}>
                                    <cat.Icon size={13} style={{ flexShrink: 0 }} />
                                    <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{cat.label}</span>
                                    <span className="gl-count">{count}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <div className="nt-modal-grid">
                        {visible.map(tmpl => <TemplateCard key={tmpl.id} tmpl={tmpl} onSelect={onSelect} limit={limitFor(tmpl.id)} />)}
                    </div>
                </div>
            </div>
            <style>{`${templateCardCss}
                .nt-modal { max-width: 880px; height: min(620px, calc(100dvh - 32px)); }
                .nt-modal-body { display: flex; min-height: 0; flex: 1; overflow: hidden; }
                .nt-modal-nav { width: 196px; flex-shrink: 0; padding: 8px; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid var(--border-subtle); }
                .nt-modal-nav .gl-item { width: 100%; }
                .nt-modal-grid { flex: 1; min-width: 0; overflow-y: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; align-content: start; }
                @media (max-width: 640px) {
                    .nt-modal-body { flex-direction: column; }
                    .nt-modal-nav { width: auto; flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--border-subtle); }
                    .nt-modal-nav .gl-item { width: auto; flex-shrink: 0; }
                    .nt-modal-grid { grid-template-columns: 1fr; padding: 12px; }
                }
            `}</style>
        </div>,
        document.body,
    );
};

export default NoteTemplateModal;
