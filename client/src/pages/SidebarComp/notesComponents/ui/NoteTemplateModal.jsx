import React, { useState } from 'react';
import { X, ArrowRight, FileText, Zap, Layers, ClipboardList, Lightbulb, Users, FolderKanban, Cpu, Megaphone, StickyNote } from 'lucide-react';

// ─────────────────────────────────────────────
// Template Definitions
// ─────────────────────────────────────────────
export const TEMPLATES = [
    /* ── Quick Start ── */
    {
        id: 'blank', category: 'quick',
        TypeIcon: StickyNote, iconColor: '#64748b', color: '#0f172a', accent: '#334155',
        label: 'Blank Note', tag: 'EMPTY',
        desc: 'Start from a clean slate with no structure.',
        preview: ['No pre-filled blocks', 'Full freedom to shape', 'Start typing immediately'],
        blocks: [], title: 'Untitled Note',
    },

    /* ── Project ── */
    {
        id: 'projectspec', category: 'project',
        TypeIcon: FolderKanban, iconColor: '#7dd3fc', color: '#0369a1', accent: '#0284c7',
        label: 'Project Spec', tag: 'PLANNING',
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
        label: 'Tech Design', tag: 'ENGINEERING',
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
        TypeIcon: Lightbulb, iconColor: '#c4b5fd', color: '#4c1d95', accent: '#6d28d9',
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

    /* ── Meeting & Ops ── */
    {
        id: 'meeting', category: 'meeting',
        TypeIcon: Users, iconColor: '#6ee7b7', color: '#065f46', accent: '#059669',
        label: 'Meeting Notes', tag: 'MEETING',
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
        TypeIcon: ClipboardList, iconColor: '#fcd34d', color: '#92400e', accent: '#d97706',
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
        TypeIcon: Megaphone, iconColor: '#fda4af', color: '#9f1239', accent: '#e11d48',
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

    /* ── Documents ── */
    {
        id: 'document', category: 'docs',
        TypeIcon: FileText, iconColor: '#93c5fd', color: '#1d4ed8', accent: '#3b82f6',
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#111111', width: '100%', maxWidth: '900px', height: '600px', display: 'flex', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

                {/* Left sidebar */}
                <div style={{ width: '200px', flexShrink: 0, background: '#0c0c0c', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>New Note</h2>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.35)', marginTop: '3px' }}>Choose a template</p>
                    </div>
                    <nav style={{ flex: 1, padding: '6px', overflowY: 'auto' }}>
                        {CATEGORIES.map(cat => {
                            const Ic = cat.Icon;
                            const isActive = activeCategory === cat.id;
                            const count = TEMPLATES.filter(t => t.category === cat.id).length;
                            return (
                                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', textAlign: 'left', fontSize: '12px', fontWeight: isActive ? 700 : 500, background: isActive ? 'rgba(184,149,106,0.15)' : 'transparent', color: isActive ? '#b8956a' : 'rgba(228,228,228,0.5)', border: isActive ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter,system-ui,sans-serif', marginBottom: '2px' }}
                                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e4e4e4'; } }}
                                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; } }}
                                >
                                    <Ic size={13} style={{ flexShrink: 0 }} />
                                    <span style={{ flex: 1 }}>{cat.label}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: isActive ? '#b8956a' : 'rgba(228,228,228,0.25)' }}>{count}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.2)', fontFamily: 'monospace', margin: 0 }}>
                            {TEMPLATES.length} TEMPLATES · {CATEGORIES.length} CATEGORIES
                        </p>
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#111111' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {catInfo?.Icon && <catInfo.Icon size={14} style={{ color: 'rgba(228,228,228,0.35)' }} />}
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>{catInfo?.label}</h3>
                                <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.3)', fontFamily: 'monospace', margin: 0 }}>
                                    {visible.length} TEMPLATE{visible.length !== 1 ? 'S' : ''} AVAILABLE
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            style={{ padding: '6px', background: 'transparent', border: 'none', color: 'rgba(228,228,228,0.35)', cursor: 'pointer', transition: 'color 150ms ease' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#e4e4e4')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(228,228,228,0.35)')}>
                            <X size={15} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {visible.map(tmpl => {
                                const isHov = hovered === tmpl.id;
                                return (
                                    <button key={tmpl.id} onClick={() => onSelect(tmpl)}
                                        onMouseEnter={() => setHovered(tmpl.id)}
                                        onMouseLeave={() => setHovered(null)}
                                        style={{ textAlign: 'left', overflow: 'hidden', border: `1px solid ${isHov ? 'rgba(184,149,106,0.45)' : 'rgba(255,255,255,0.07)'}`, background: 'transparent', cursor: 'pointer', transition: 'all 150ms ease', transform: isHov ? 'translateY(-1px)' : 'none' }}>
                                        <div style={{ padding: '14px 14px 12px', position: 'relative', overflow: 'hidden', backgroundColor: tmpl.color }}>
                                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: tmpl.accent }} />
                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                <div>
                                                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: '6px', fontFamily: 'monospace' }}>{tmpl.tag}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                        <tmpl.TypeIcon size={17} style={{ color: tmpl.iconColor, flexShrink: 0 }} />
                                                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.2, margin: 0 }}>{tmpl.label}</h4>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>{tmpl.blocks.length}B</span>
                                            </div>
                                        </div>
                                        <div style={{ padding: '14px', background: '#0c0c0c' }}>
                                            <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.45)', lineHeight: 1.5, marginBottom: '10px' }}>{tmpl.desc}</p>
                                            <div style={{ marginBottom: '14px' }}>
                                                {tmpl.preview.map((line, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(228,228,228,0.2)', fontFamily: 'monospace' }}>—</span>
                                                        <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.4)' }}>{line}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(228,228,228,0.2)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    {tmpl.blocks.length} BLOCKS
                                                </span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace', color: isHov ? '#b8956a' : 'rgba(228,228,228,0.2)', transition: 'color 150ms ease' }}>
                                                    USE TEMPLATE <ArrowRight size={11} style={{ transform: isHov ? 'translateX(2px)' : 'none', transition: 'transform 150ms ease' }} />
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
