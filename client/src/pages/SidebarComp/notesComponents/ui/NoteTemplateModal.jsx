import React from 'react';
import { X } from 'lucide-react';

const TEMPLATES = [
    {
        id: 'blank',
        emoji: '📄',
        label: 'Blank Note',
        desc: 'Start from scratch',
        color: 'from-gray-400 to-gray-500',
        blocks: [],
        title: 'Untitled Note',
    },
    {
        id: 'document',
        emoji: '📝',
        label: 'Document',
        desc: 'Structured doc with headings',
        color: 'from-blue-500 to-blue-600',
        title: 'New Document',
        blocks: [
            { type: 'heading', content: 'Overview', meta: { level: 1 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Details', meta: { level: 2 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Next Steps', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: '', done: false }]), meta: {} },
        ],
    },
    {
        id: 'brainstorm',
        emoji: '🧠',
        label: 'Brainstorm',
        desc: 'Ideas + toggle sections',
        color: 'from-violet-500 to-purple-600',
        title: 'Brainstorm Session',
        blocks: [
            { type: 'callout', content: '💡 Capture every idea — refine later.', meta: { variant: 'info' } },
            { type: 'heading', content: 'Problem Statement', meta: { level: 2 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Ideas', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: 'Idea 1', done: false }, { id: 2, text: 'Idea 2', done: false }]), meta: {} },
            { type: 'toggle', content: 'Explore alternatives here...', meta: { title: 'Alternative Approaches', open: false } },
        ],
    },
    {
        id: 'meeting',
        emoji: '📋',
        label: 'Meeting Notes',
        desc: 'Date, attendees, action items',
        color: 'from-emerald-500 to-teal-600',
        title: 'Meeting Notes',
        blocks: [
            { type: 'heading', content: 'Meeting Details', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Date', 'Time', 'Location'], rows: [['', '', '']] }), meta: {} },
            { type: 'heading', content: 'Attendees', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: '', done: false }]), meta: {} },
            { type: 'divider', content: 'Agenda', meta: {} },
            { type: 'text', content: '', meta: {} },
            { type: 'divider', content: 'Action Items', meta: {} },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: '', done: false }]), meta: {} },
        ],
    },
    {
        id: 'sop',
        emoji: '📋',
        label: 'SOP',
        desc: 'Step-by-step procedure',
        color: 'from-amber-500 to-orange-500',
        title: 'Standard Operating Procedure',
        blocks: [
            { type: 'callout', content: 'Purpose: Describe the goal of this SOP.', meta: { variant: 'info' } },
            { type: 'heading', content: 'Scope', meta: { level: 2 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Steps', meta: { level: 2 } },
            { type: 'toggle', content: 'Describe step 1 in detail...', meta: { title: 'Step 1: ', open: true } },
            { type: 'toggle', content: 'Describe step 2 in detail...', meta: { title: 'Step 2: ', open: false } },
            { type: 'toggle', content: 'Describe step 3 in detail...', meta: { title: 'Step 3: ', open: false } },
        ],
    },
    {
        id: 'projectspec',
        emoji: '🗂',
        label: 'Project Spec',
        desc: 'Goal, scope, timeline',
        color: 'from-cyan-500 to-blue-500',
        title: 'Project Specification',
        blocks: [
            { type: 'heading', content: 'Goal', meta: { level: 1 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Scope', meta: { level: 2 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Timeline', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Milestone', 'Target Date', 'Owner', 'Status'], rows: [['', '', '', ''], ['', '', '', '']] }), meta: {} },
            { type: 'heading', content: 'Open Questions', meta: { level: 2 } },
            { type: 'callout', content: 'List unresolved questions here.', meta: { variant: 'warning' } },
        ],
    },
    {
        id: 'techdesign',
        emoji: '🛠',
        label: 'Tech Design Doc',
        desc: 'Architecture + API spec',
        color: 'from-slate-600 to-gray-700',
        title: 'Technical Design Document',
        blocks: [
            { type: 'heading', content: 'Overview', meta: { level: 1 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Architecture', meta: { level: 2 } },
            { type: 'text', content: 'Describe the system design here...', meta: {} },
            { type: 'heading', content: 'API Endpoints', meta: { level: 2 } },
            { type: 'table', content: JSON.stringify({ headers: ['Method', 'Endpoint', 'Description', 'Auth'], rows: [['GET', '', '', ''], ['POST', '', '', '']] }), meta: {} },
            { type: 'heading', content: 'Risks & Mitigations', meta: { level: 2 } },
            { type: 'callout', content: 'Document risks and how to address them.', meta: { variant: 'warning' } },
        ],
    },
    {
        id: 'announcement',
        emoji: '📢',
        label: 'Announcement',
        desc: 'Structured update draft',
        color: 'from-pink-500 to-rose-500',
        title: 'Announcement Draft',
        blocks: [
            { type: 'callout', content: '📢 Draft announcement — review before publishing.', meta: { variant: 'warning' } },
            { type: 'heading', content: 'What is changing', meta: { level: 2 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'Why it matters', meta: { level: 2 } },
            { type: 'text', content: '', meta: {} },
            { type: 'heading', content: 'What to do next', meta: { level: 2 } },
            { type: 'checklist', content: JSON.stringify([{ id: 1, text: '', done: false }]), meta: {} },
        ],
    },
];

const NoteTemplateModal = ({ onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Start a note</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Choose a template or start blank</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Grid */}
                <div className="overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {TEMPLATES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => onSelect(t)}
                                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 text-left"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform`}>
                                    {t.emoji}
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">{t.label}</p>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export { TEMPLATES };
export default NoteTemplateModal;
