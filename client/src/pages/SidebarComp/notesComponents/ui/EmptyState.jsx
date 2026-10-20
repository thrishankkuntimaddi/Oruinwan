import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NotebookPen, Plus, Star, Globe, Clock } from 'lucide-react';
import { useNotes, noteContentToText } from '../../../../contexts/NotesContext';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import {
    DashPage, PageHead, Section, Panel, Grid, Btn, Chip, LoadingState, EmptyState as KitEmpty, timeAgo,
} from '../../../../components/ui/page';
import NoteTemplateModal, { TEMPLATES, STARTER_TEMPLATE_IDS, TemplateCard, templateCardCss, templateToNote } from './NoteTemplateModal';
import { noteTypeOf } from '../noteTypes';

const RECENT_LIMIT = 8;

function NoteRow({ note, onOpen, first }) {
    const type = noteTypeOf(note.type);
    const preview = noteContentToText(note.content).slice(0, 120);
    return (
        <li style={{ borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
            <button type="button" className="nh-row" onClick={() => onOpen(note)}>
                <span className="gl-empty-mark" style={{ margin: 0 }}><type.Icon size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong className="nh-row-title">{note.title || 'Untitled'}</strong>
                        <Chip>{type.label}</Chip>
                        {note.isPinned && <Chip tone="accent"><Star size={10} style={{ fill: 'currentColor' }} /> Starred</Chip>}
                        {note.isPublic && <Chip><Globe size={10} /> Workspace</Chip>}
                    </span>
                    <span className="nh-row-sub">{preview || 'Empty note'}</span>
                </span>
                <span className="nh-row-time"><Clock size={11} /> {timeAgo(note.updatedAt)}</span>
            </button>
        </li>
    );
}

/**
 * The notes home (no note open): what notes are for, the latest ones, and templates to start from.
 * With `loading` it only shows a loading state (used while a deep-linked note is fetched).
 */
const EmptyState = ({ loading }) => {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { allNotes, addNote, loading: notesLoading } = useNotes();
    const { activeWorkspace } = useWorkspace() || {};
    const [showTemplates, setShowTemplates] = useState(false);

    const notes = useMemo(() => (allNotes || []).filter(n => !n.isArchived), [allNotes]);
    const recent = useMemo(
        () => [...notes].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, RECENT_LIMIT),
        [notes],
    );
    const starred = useMemo(() => notes.filter(n => n.isPinned).slice(0, 4), [notes]);
    const starters = STARTER_TEMPLATE_IDS.map(id => TEMPLATES.find(t => t.id === id)).filter(Boolean);
    const blank = TEMPLATES.find(t => t.id === 'blank');

    const open = (note) => navigate(`/workspace/${workspaceId}/notes/${note.id}`);
    const create = (template) => {
        setShowTemplates(false);
        addNote(...templateToNote(template));
    };

    const busy = notesLoading;
    const hasAny = notes.length > 0;

    if (loading) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
                <LoadingState label="Opening note…" />
            </div>
        );
    }

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Notes` : 'Notes'}
                    title="Notes"
                    icon={NotebookPen}
                    lead="Docs, meeting notes and specs your team writes together. Share a note with people or the whole workspace."
                    actions={!busy && hasAny && <Btn variant="primary" icon={Plus} onClick={() => setShowTemplates(true)}>New note</Btn>}
                />
            )}
        >
            {busy ? (
                <LoadingState label="Loading notes…" />
            ) : !hasAny ? (
                <>
                    <Panel>
                        <KitEmpty
                            icon={NotebookPen}
                            title="Write your first note"
                            text="Capture a meeting, plan a project or document how something works. Type / in a note to add headings, checklists, tables and files."
                            action={(
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <Btn variant="primary" icon={Plus} onClick={() => blank && create(blank)}>Start a blank note</Btn>
                                    <Btn variant="ghost" onClick={() => setShowTemplates(true)}>Browse templates</Btn>
                                </div>
                            )}
                        />
                    </Panel>
                    <Section title="Start from a template" lead="Each one creates a note with the structure filled in.">
                        <Grid min={220}>
                            {starters.map(t => <TemplateCard key={t.id} tmpl={t} onSelect={create} />)}
                        </Grid>
                    </Section>
                </>
            ) : (
                <>
                    {starred.length > 0 && (
                        <Section title="Starred" lead="Notes you keep coming back to.">
                            <Panel flush>
                                <ul className="nh-list">
                                    {starred.map((n, i) => <NoteRow key={n.id} note={n} onOpen={open} first={i === 0} />)}
                                </ul>
                            </Panel>
                        </Section>
                    )}
                    <Section
                        title="Recently edited"
                        lead={notes.length > RECENT_LIMIT ? `The latest ${RECENT_LIMIT} of ${notes.length} notes. Find the rest in the side panel.` : 'Pick up where you left off.'}
                    >
                        <Panel flush>
                            <ul className="nh-list">
                                {recent.map((n, i) => <NoteRow key={n.id} note={n} onOpen={open} first={i === 0} />)}
                            </ul>
                        </Panel>
                    </Section>
                    <Section
                        title="Start from a template"
                        lead="Each one creates a note with the structure filled in."
                        action={<Btn variant="ghost" size="sm" onClick={() => setShowTemplates(true)}>All templates</Btn>}
                    >
                        <Grid min={220}>
                            {starters.map(t => <TemplateCard key={t.id} tmpl={t} onSelect={create} compact />)}
                        </Grid>
                    </Section>
                </>
            )}

            {showTemplates && <NoteTemplateModal onSelect={create} onClose={() => setShowTemplates(false)} />}
            <style>{`${templateCardCss}
                .nh-list { list-style: none; margin: 0; padding: 0; }
                .nh-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: none; border: 0; text-align: left; cursor: pointer; font-family: var(--font); color: inherit; }
                .nh-row:hover, .nh-row:focus-visible { background: var(--bg-hover); }
                .nh-row-title { font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
                .nh-row-sub { display: block; margin-top: 3px; font-size: 12.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .nh-row-time { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 11.5px; color: var(--text-muted); }
                @media (max-width: 640px) { .nh-row { flex-wrap: wrap; } .nh-row-time { padding-left: 52px; } }
            `}</style>
        </DashPage>
    );
};

export default EmptyState;
