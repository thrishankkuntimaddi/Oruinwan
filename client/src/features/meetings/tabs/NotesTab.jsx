import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ExternalLink, Type, Heading2, CheckSquare, NotebookPen } from 'lucide-react';
import api from '../../../services/api';
import { Btn, EmptyState } from '../../../components/ui/page';
import { useToast } from '../../../contexts/ToastContext';
import useCollabDoc from '../../../lib/collab/useCollabDoc';
import CollabPresence, { PeerMarks } from '../../../lib/collab/CollabPresence';
import { readBlocks, applyBlocksToY, LOCAL_ORIGIN } from '../../../lib/collab/noteBlocks';
import TextBlock from '../../../pages/SidebarComp/notesComponents/blocks/TextBlock';
import HeadingBlock from '../../../pages/SidebarComp/notesComponents/blocks/HeadingBlock';
import ChecklistBlock from '../../../pages/SidebarComp/notesComponents/blocks/ChecklistBlock';
import ReadOnlyBlock from '../../../pages/SidebarComp/notesComponents/blocks/ReadOnlyBlock';
import { errorText } from '../meetingModel';

let seq = 0;
const newBlockId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const EDITABLE = new Set(['text', 'heading', 'checklist']);

function parseBlocks(content) {
    try {
        const parsed = JSON.parse(content || '[]');
        if (Array.isArray(parsed)) return parsed.filter((b) => b && typeof b === 'object').map((b) => ({ ...b, id: b.id ?? newBlockId(), meta: b.meta || {} }));
    } catch { /* legacy text */ }
    return content ? [{ id: 'legacy', type: 'text', content: String(content), meta: {} }] : [];
}

/**
 * The meeting's one Note, edited live by everyone who may open the meeting
 * (collab docType "note", docs/api/collab.md). The same note is used before,
 * during and after every run of the meeting's huddle; it also shows in Notes.
 */
export function MeetingNoteEditor({ noteId, workspaceId }) {
    const collab = useCollabDoc('note', noteId, { enabled: !!noteId });
    const { showToast } = useToast();
    const [blocks, setBlocks] = useState([]);
    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;
    const refs = useRef({});
    const registerRef = useCallback((id, node) => { if (node) refs.current[id] = node; else delete refs.current[id]; }, []);
    const doc = collab.doc;
    const live = collab.live;
    const canEdit = live && !collab.readOnly;

    useEffect(() => {
        if (!live || !doc) return undefined;
        const yBlocks = doc.getArray('blocks');
        const pull = () => { const next = readBlocks(yBlocks); blocksRef.current = next; setBlocks(next); };
        pull();
        const onChange = (_e, tx) => { if (tx.origin !== LOCAL_ORIGIN) pull(); };
        yBlocks.observeDeep(onChange);
        return () => yBlocks.unobserveDeep(onChange);
    }, [live, doc]);

    // Could not go live: show the saved note read-only.
    const [fallback, setFallback] = useState(null);
    useEffect(() => {
        if (!collab.failed || !noteId) return undefined;
        let cancelled = false;
        api.get(`/api/v2/notes/${noteId}`)
            .then((r) => { if (!cancelled) setFallback({ blocks: parseBlocks(r.data?.note?.content), error: null }); })
            .catch((err) => { if (!cancelled) setFallback({ blocks: [], error: errorText(err, 'Could not open the notes') }); });
        return () => { cancelled = true; };
    }, [collab.failed, noteId]);

    const commit = useCallback((next) => {
        if (!canEdit || !doc) return;
        blocksRef.current = next;
        setBlocks(next);
        doc.transact(() => applyBlocksToY(doc.getArray('blocks'), next), LOCAL_ORIGIN);
    }, [canEdit, doc]);

    const focus = (id) => setTimeout(() => refs.current[id]?.focus?.(), 50);
    const add = (type, afterId = null) => {
        const meta = type === 'heading' ? { level: 2 } : {};
        const content = type === 'checklist' ? JSON.stringify([{ id: Date.now(), text: '', done: false }]) : '';
        const block = { id: newBlockId(), type, content, meta };
        const prev = blocksRef.current;
        const idx = afterId ? prev.findIndex((b) => b.id === afterId) : -1;
        commit(idx < 0 ? [...prev, block] : [...prev.slice(0, idx + 1), block, ...prev.slice(idx + 1)]);
        if (type !== 'checklist') focus(block.id);
    };
    const change = useCallback((id, content, meta) => {
        commit(blocksRef.current.map((b) => (b.id === id ? { ...b, content, meta: meta !== undefined ? meta : b.meta } : b)));
    }, [commit]);
    const remove = useCallback((id) => commit(blocksRef.current.filter((b) => b.id !== id)), [commit]);

    const peersByBlock = useMemo(() => {
        const map = {};
        collab.peers.forEach((p) => { if (p.blockId) (map[p.blockId] = map[p.blockId] || []).push(p); });
        return map;
    }, [collab.peers]);
    const mediaProps = { workspaceId, noteId, uploadProgress: {}, setUploadProgress: () => {}, showToast };

    if (!noteId) return null;
    if (collab.failed) {
        return (
            <div className="mt-note" data-testid="meeting-note-readonly">
                {collab.closedText && <p className="mt-muted">{collab.closedText}</p>}
                {!fallback ? <p className="mt-muted"><Loader2 size={12} className="animate-spin" /> Loading notes…</p>
                    : fallback.error ? <p className="mt-error">{fallback.error}</p>
                        : (
                            <div className="mt-note-body">
                                {fallback.blocks.length ? fallback.blocks.map((b) => <div key={b.id} className="mt-note-block"><ReadOnlyBlock block={b} mediaProps={mediaProps} /></div>)
                                    : <p className="mt-muted">No notes yet.</p>}
                            </div>
                        )}
            </div>
        );
    }
    if (!live) return <p className="mt-muted" data-testid="meeting-note-connecting"><Loader2 size={12} className="animate-spin" /> Connecting to the notes…</p>;

    return (
        <div className="mt-note" data-testid="meeting-note-editor">
            <div className="mt-note-head">
                <span className="mt-muted mt-grow">{canEdit ? 'Everyone with this meeting open edits these notes together.' : 'You can read these notes.'}</span>
                <CollabPresence collab={collab} />
            </div>
            <div className="mt-note-body">
                {blocks.length === 0 && (
                    <p className="mt-muted" style={{ marginBottom: 8 }}>{canEdit ? 'No notes yet. Add a line below.' : 'No notes yet.'}</p>
                )}
                {blocks.map((block) => {
                    const common = { block, onBlockChange: change, onRemoveBlock: remove };
                    let el;
                    if (!canEdit || !EDITABLE.has(block.type)) el = <ReadOnlyBlock block={block} mediaProps={mediaProps} />;
                    else if (block.type === 'text') el = <TextBlock {...common} onAddBlockAfter={(id) => add('text', id)} registerRef={registerRef} />;
                    else if (block.type === 'heading') el = <HeadingBlock {...common} onAddBlockAfter={(id) => add('text', id)} registerRef={registerRef} />;
                    else el = <ChecklistBlock {...common} />;
                    const peers = peersByBlock[block.id];
                    return (
                        <div key={block.id} className={`mt-note-block${peers ? ' gl-collab-block-busy' : ''}`}
                            onFocus={() => collab.setPresence({ blockId: String(block.id) })}
                            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) collab.setPresence({ blockId: null }); }}>
                            {peers && <span className="gl-collab-block-tag"><PeerMarks peers={peers} label="editing" /></span>}
                            {el}
                        </div>
                    );
                })}
            </div>
            {canEdit && (
                <div className="mt-row" role="group" aria-label="Add to the notes">
                    <Btn size="sm" variant="ghost" icon={Type} onClick={() => add('text')} data-testid="meeting-note-add-text">Text</Btn>
                    <Btn size="sm" variant="ghost" icon={Heading2} onClick={() => add('heading')}>Heading</Btn>
                    <Btn size="sm" variant="ghost" icon={CheckSquare} onClick={() => add('checklist')}>Checklist</Btn>
                </div>
            )}
        </div>
    );
}

/** Notes tab: opens (or creates) the meeting's note, then edits it live. */
export default function NotesTab({ meeting, workspaceId, ensureNote }) {
    const navigate = useNavigate();
    const meetingId = String(meeting.id || meeting._id);
    const [state, setState] = useState({ loading: true, error: null });
    const ensureRef = useRef(ensureNote);
    ensureRef.current = ensureNote;

    // POST /:id/notes also adds me to the note's sharing, so it shows in my Notes.
    useEffect(() => {
        let cancelled = false;
        setState({ loading: true, error: null });
        Promise.resolve(ensureRef.current?.())
            .then(() => { if (!cancelled) setState({ loading: false, error: null }); })
            .catch((err) => { if (!cancelled) setState({ loading: false, error: errorText(err, 'Could not open the notes') }); });
        return () => { cancelled = true; };
    }, [meetingId]);

    const noteId = meeting.noteId ? String(meeting.noteId) : null;
    const notesHref = noteId && workspaceId ? `/workspace/${workspaceId}/notes/${noteId}` : null;

    return (
        <div className="mt-stack mt-stack--wide" data-testid="meeting-tab-notes">
            <div className="mt-row">
                <p className="mt-label mt-grow"><NotebookPen size={12} /><span>Meeting notes</span></p>
                {notesHref && (
                    <button type="button" className="gl-x-link" onClick={() => navigate(notesHref)}>
                        <ExternalLink size={11} /> Open in Notes
                    </button>
                )}
            </div>
            {state.error && !noteId ? (
                <EmptyState icon={NotebookPen} title="Notes are not available" text={state.error} />
            ) : !noteId ? (
                <p className="mt-muted"><Loader2 size={12} className="animate-spin" /> Opening the notes…</p>
            ) : (
                <MeetingNoteEditor key={noteId} noteId={noteId} workspaceId={workspaceId} />
            )}
        </div>
    );
}
