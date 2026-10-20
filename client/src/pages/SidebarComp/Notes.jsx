import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useNotes } from "../../contexts/NotesContext";
import { useToast } from "../../contexts/ToastContext";
import { Confirm, Btn } from "../../components/ui/page";
import api from '@services/api';
import '../../styles/gloss-x-panels.css';
import logger from '../../utils/logger';
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import { getMediaUrl } from "../../utils/mediaUrl";

import TextBlock from "./notesComponents/blocks/TextBlock";
import ImageBlock from "./notesComponents/blocks/ImageBlock";
import VideoBlock from "./notesComponents/blocks/VideoBlock";
import AudioBlock from "./notesComponents/blocks/AudioBlock";
import FileBlock from "./notesComponents/blocks/FileBlock";
import HeadingBlock from "./notesComponents/blocks/HeadingBlock";
import CodeBlock from "./notesComponents/blocks/CodeBlock";
import CalloutBlock from "./notesComponents/blocks/CalloutBlock";
import ChecklistBlock from "./notesComponents/blocks/ChecklistBlock";
import ToggleBlock from "./notesComponents/blocks/ToggleBlock";
import DividerBlock from "./notesComponents/blocks/DividerBlock";
import TableBlock from "./notesComponents/blocks/TableBlock";
import ReadOnlyBlock from "./notesComponents/blocks/ReadOnlyBlock";
import { isStoredFile } from "./notesComponents/blocks/mediaUtils";

import EmptyState from "./notesComponents/ui/EmptyState";
import NoteInfoModal from "./notesComponents/ui/NoteInfoModal";
import ShareNoteModal from "./notesComponents/ui/ShareNoteModal";
import SlashCommandMenu from "./notesComponents/ui/SlashCommandMenu";
import AIPanel from "./notesComponents/ui/AIPanel";
import { useAIContext } from "../../contexts/AIContext";
import VersionHistoryPanel from "./notesComponents/ui/VersionHistoryPanel";
import { noteTypeOf } from "./notesComponents/noteTypes";
import { formatDayHeading, formatTime } from "../../utils/userDateFormat";
import { getUserPreferences } from "../../hooks/useUserPreferences";

import {
    Sparkles, Share2, Check, Trash2, MoreHorizontal, Copy, Download,
    Info, Clock, Tag, X, Plus, History, GripVertical, Users, Eye, Globe,
    Star, Archive, ArchiveRestore, Loader2, AlertCircle, Lock, ArrowLeft,
    Type, Heading1, Code2, CheckSquare, ChevronRight, Minus, Table2, Image as ImageIcon, Paperclip,
} from "lucide-react";

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file']);

let blockSeq = 0;
/** Unique block id (Date.now() alone collides when blocks are added quickly). */
const newBlockId = () => `${Date.now().toString(36)}-${(blockSeq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Parse stored content into blocks with unique ids. */
function parseBlocks(content) {
    let parsed = null;
    try { parsed = JSON.parse(content); } catch { /* legacy plain/HTML content */ }
    const list = Array.isArray(parsed)
        ? parsed.filter(b => b && typeof b === 'object')
        : [{ id: 'legacy', type: "text", content: content || "", meta: {} }];
    const seen = new Set();
    return list.map((b) => {
        let bid = b.id;
        if (bid === undefined || bid === null || seen.has(String(bid))) bid = newBlockId();
        seen.add(String(bid));
        return { ...b, id: bid, meta: b.meta || {} };
    });
}


function SaveIndicator({ status }) {
    if (!status) return null;
    const conf = {
        saving: { Icon: Loader2, text: 'Saving…', color: 'var(--text-muted)', spin: true },
        saved: { Icon: Check, text: 'Saved', color: 'var(--text-muted)' },
        error: { Icon: AlertCircle, text: 'Not saved', color: 'var(--state-danger)' },
    }[status];
    if (!conf) return null;
    return (
        <span data-testid="note-save-status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: conf.color, fontFamily: 'var(--font)' }}>
            <conf.Icon size={11} className={conf.spin ? 'animate-spin' : ''} /> {conf.text}
        </span>
    );
}

const NOTE_CSS = `
.nt-head { height: 52px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-base); flex-shrink: 0; z-index: 40; position: relative; }
.nt-head-meta { display: flex; align-items: center; gap: 12px; min-width: 0; }
.nt-head-hint { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--text-secondary); }
.nt-head-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.nt-head-actions .gl-btn--primary { margin-left: 6px; }
.nt-body { max-width: 760px; margin: 0 auto; padding: 40px 48px 56px; min-height: 100%; display: flex; flex-direction: column; }
.nt-title { font-size: 2.5rem; font-weight: 800; color: var(--text-primary); border: none; outline: none; padding: 0; margin: 0 0 10px; width: 100%; background: transparent; font-family: var(--font); line-height: 1.15; letter-spacing: -0.02em; }
.nt-ghost-link { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; font-size: 11.5px; color: var(--text-secondary); background: transparent; border: none; cursor: pointer; font-family: var(--font); transition: color 150ms ease; }
.nt-ghost-link:hover { color: var(--accent); }
.nt-add { margin-top: 24px; padding-top: 12px; border-top: 1px dashed var(--border-subtle); display: flex; flex-direction: column; gap: 10px; }
.nt-add-hint { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 6px 0; font-size: 12.5px; color: var(--text-secondary); background: none; border: 0; cursor: text; font-family: var(--font); }
.nt-add-hint:hover { color: var(--text-primary); }
.nt-add-hint kbd { padding: 1px 6px; background: var(--bg-active); border: 1px solid var(--border-default); border-radius: var(--gl-radius); font-size: 11px; font-family: var(--font); }
.nt-quick { display: flex; flex-wrap: wrap; gap: 2px; margin-left: -8px; }
.nt-side { display: flex; flex-direction: column; height: 100%; width: 300px; flex-shrink: 0; background: var(--bg-surface); background-image: var(--gl-glass); border-left: 1px solid var(--border-subtle); font-family: var(--font); }
.nt-ver-row { display: flex; align-items: flex-start; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); }
.nt-ver-row:hover { background: var(--bg-hover); }
@media (hover: hover) and (pointer: fine) {
  .nt-ver-restore { opacity: 0; transition: opacity 150ms ease; }
  .nt-ver-row:hover .nt-ver-restore, .nt-ver-row:focus-within .nt-ver-restore { opacity: 1; }
}
/* Touch screens have no hover: show the block tools that otherwise appear on hover. */
@media (hover: none) {
  .nt-body .group-hover\\:\\!opacity-100, .nt-body .group-hover\\:opacity-100 { opacity: 1 !important; }
}
@media (max-width: 900px) {
  .nt-side { position: absolute; top: 52px; right: 0; bottom: 0; height: auto; z-index: 30; box-shadow: var(--gl-drop); }
}
@media (max-width: 640px) {
  .nt-side { left: 0; width: auto; border-left: 0; }
  .nt-head { padding: 0 8px 0 12px; gap: 8px; }
  .nt-hide-phone { display: none !important; }
  .nt-body { padding: 24px 16px 40px 28px; }
  .nt-title { font-size: 1.85rem; }
}
`;

const Notes = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {
        allNotes, updateNote, flushNote, saveStatus, deleteNote, addNote, shareNote, loading,
        noteVersions, addVersion, loadVersions, togglePin, toggleArchive, fetchNote, getNoteAccess,
    } = useNotes();
    const { showToast } = useToast();

    useEffect(() => {
        const noteIdParam = searchParams.get('noteId');
        if (noteIdParam && noteIdParam !== id) navigate(`/workspace/${workspaceId}/notes/${noteIdParam}`, { replace: true });
    }, [searchParams, id, workspaceId, navigate]);

    const note = (allNotes || []).find(n => n.id === id);
    const { isOwner, canEdit } = getNoteAccess(note);

    // Deep link to a note that is not in the list (e.g. opened from a notification).
    const [fetchState, setFetchState] = useState({});
    useEffect(() => {
        if (!id || note || loading || fetchState[id]) return;
        setFetchState(prev => ({ ...prev, [id]: { status: 'loading' } }));
        fetchNote(id).then((res) => {
            setFetchState(prev => ({ ...prev, [id]: res.note ? { status: 'done' } : { status: 'error', code: res.error, message: res.message } }));
        });
    }, [id, note, loading, fetchState, fetchNote]);

    const [title, setTitle] = useState("");
    const [blocks, setBlocks] = useState([]);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    const [showMenu, setShowMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showShareTooltip, setShowShareTooltip] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});

    const [slashMenu, setSlashMenu] = useState({ open: false, query: '', blockId: null, position: { x: 0, y: 0 } });

    const blockRefsMap = useRef({});
    const registerBlockRef = useCallback((blockId, node) => {
        if (node) blockRefsMap.current[blockId] = node;
        else delete blockRefsMap.current[blockId];
    }, []);

    const [dragOverId, setDragOverId] = useState(null);
    const dragBlockId = useRef(null);
    const menuRef = useRef(null);

    // Latest values for callbacks, so state updaters stay pure.
    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;
    const titleRef = useRef(title);
    titleRef.current = title;

    // Load the editor state when another note is opened.
    useEffect(() => {
        if (note) {
            setTitle(note.title === 'Untitled' ? '' : (note.title || ""));
            setTags(note.tags || []);
            setBlocks(parseBlocks(note.content));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [note?.id]);

    // Viewers get live updates; editors keep their local copy while typing.
    useEffect(() => {
        if (note && !canEdit) {
            setTitle(note.title || '');
            setTags(note.tags || []);
        }
    }, [note, canEdit]);
    const viewBlocks = useMemo(() => (note && !canEdit ? parseBlocks(note.content) : null), [note, canEdit]);

    // Send unsaved edits when leaving a note (other note, other page, unmount).
    useEffect(() => {
        const noteId = id;
        return () => { if (noteId) flushNote(noteId); };
    }, [id, flushNote]);

    useEffect(() => {
        if (id && loadVersions) loadVersions(id);
    }, [id, loadVersions]);

    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /** Remove the stored attachment behind a media URL once no block uses it any more. */
    const releaseAttachment = useCallback(async (url, remainingBlocks) => {
        if (!isStoredFile(url) || !id) return;
        if (remainingBlocks.some(b => b.content === url)) return;
        try {
            const res = await api.get(`/api/v2/notes/${id}`);
            const matches = (res.data?.note?.attachments || []).filter(a => a.url === url);
            await Promise.all(matches.map(a => api.delete(`/api/v2/notes/${id}/attachments/${a._id}`)));
        } catch (err) {
            logger.warn('Failed to remove note attachment', err?.message);
        }
    }, [id]);

    /** Replace the block list and save it. */
    const commitBlocks = useCallback((next, { snapshot = false } = {}) => {
        if (!canEdit || !id) return;
        const prev = blocksRef.current;
        blocksRef.current = next;
        setBlocks(next);
        const content = JSON.stringify(next);
        if (snapshot && addVersion) addVersion(id, { title: titleRef.current, content, timestamp: Date.now() });
        updateNote(id, { content });
        // Media removed or replaced: drop the now-unused upload.
        prev.forEach((b) => {
            if (!MEDIA_TYPES.has(b.type) || !isStoredFile(b.content)) return;
            const after = next.find(n => n.id === b.id);
            if (!after || after.content !== b.content) releaseAttachment(b.content, next);
        });
    }, [canEdit, id, updateNote, addVersion, releaseAttachment]);

    const handleTitleChange = (e) => {
        const value = e.target.value;
        setTitle(value);
        // An empty title is fine: the server stores it as "Untitled".
        updateNote(id, { title: value });
    };

    const handleBlockChange = useCallback((blockId, newContent, newMeta) => {
        const next = blocksRef.current.map(b =>
            b.id === blockId ? { ...b, content: newContent, meta: newMeta !== undefined ? newMeta : b.meta } : b
        );
        commitBlocks(next);
    }, [commitBlocks]);

    const focusBlock = (blockId) => {
        setTimeout(() => {
            const node = blockRefsMap.current[blockId];
            if (!node) return;
            node.focus();
            try {
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(node);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch { /* not a text node */ }
        }, 50);
    };

    const addBlock = useCallback((type, content = '', meta = {}) => {
        const newBlock = { id: newBlockId(), type, content, meta };
        commitBlocks([...blocksRef.current, newBlock], { snapshot: true });
        if (type === 'text' || type === 'heading') focusBlock(newBlock.id);
        return newBlock;
    }, [commitBlocks]);

    const insertBlockAfter = useCallback((afterId, type, content = '', meta = {}) => {
        const newBlock = { id: newBlockId(), type, content, meta };
        const prev = blocksRef.current;
        const idx = prev.findIndex(b => b.id === afterId);
        const next = idx === -1 ? [...prev, newBlock] : [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
        commitBlocks(next, { snapshot: true });
        focusBlock(newBlock.id);
        return newBlock;
    }, [commitBlocks]);

    const handleAddBlockAfter = useCallback((afterId) => {
        insertBlockAfter(afterId, 'text', '', {});
    }, [insertBlockAfter]);

    const removeBlock = useCallback((blockId) => {
        commitBlocks(blocksRef.current.filter(b => b.id !== blockId), { snapshot: true });
    }, [commitBlocks]);

    const openSlashMenu = useCallback((blockId, query, position) => {
        setSlashMenu({ open: true, query, blockId, position });
    }, []);
    const closeSlashMenu = () => setSlashMenu(prev => ({ ...prev, open: false, query: '' }));

    const handleSlashSelect = useCallback(({ type, meta }) => {
        const defaultContent = type === 'checklist'
            ? JSON.stringify([{ id: Date.now(), text: '', done: false }])
            : '';

        if (slashMenu.blockId) {
            const domNode = blockRefsMap.current[slashMenu.blockId];
            const isBlank = domNode ? (domNode.textContent || '').replace(/​/g, '').trim() === '' : false;
            if (isBlank) {
                // Turn the empty block into the chosen type (a new id remounts the editor).
                const replacement = { id: newBlockId(), type, content: defaultContent, meta: meta || {} };
                commitBlocks(blocksRef.current.map(b => (b.id === slashMenu.blockId ? replacement : b)), { snapshot: true });
                if (type === 'text' || type === 'heading') focusBlock(replacement.id);
            } else {
                insertBlockAfter(slashMenu.blockId, type, defaultContent, meta || {});
            }
        } else {
            addBlock(type, defaultContent, meta || {});
        }
        closeSlashMenu();
    }, [slashMenu.blockId, commitBlocks, insertBlockAfter, addBlock]);

    const addTag = () => {
        const t = tagInput.trim().replace(/^#/, '').toLowerCase();
        if (t && !tags.includes(t)) {
            const newTags = [...tags, t];
            setTags(newTags);
            updateNote(id, { tags: newTags });
        }
        setTagInput("");
        setShowTagInput(false);
    };

    const removeTag = (tag) => {
        const newTags = tags.filter(t => t !== tag);
        setTags(newTags);
        updateNote(id, { tags: newTags });
    };

    // shareNote shows the (single) toast; the modal closes only on success.
    const handleShareModalSave = (settings) => shareNote(id, settings);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/workspace/${workspaceId}/notes/${id}`);
        setShowShareTooltip(true);
        setTimeout(() => setShowShareTooltip(false), 2000);
        showToast('Link copied to clipboard', 'success');
    };

    const handleDuplicate = async () => {
        setShowMenu(false);
        await flushNote(id);
        const copy = await addNote(`${title || 'Untitled'} (Copy)`, note?.type || 'note', {
            content: JSON.stringify(blocksRef.current.map(b => ({ ...b, id: newBlockId() }))),
            tags,
            silent: true,
        });
        if (copy) showToast("Note duplicated", "success");
    };

    const handleDownloadPDF = async () => {
        setShowMenu(false);
        const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const source = canEdit ? blocksRef.current : (viewBlocks || []);
        // Open the window synchronously (popup blockers), fill it once images are signed.
        const win = window.open('', '_blank');
        if (!win) { showToast('Allow pop-ups to export the PDF', 'error'); return; }

        const imageSrc = {};
        await Promise.all(source.filter(b => b.type === 'image' && b.content).map(async (b) => {
            try {
                const src = isStoredFile(b.content) ? await getMediaUrl({ url: b.content }) : b.content;
                if (/^(https?:|data:image\/(png|jpe?g|gif|webp);)/i.test(src || '')) imageSrc[b.id] = src;
            } catch { /* image left out */ }
        }));

        const blockHtml = source.map(b => {
            switch (b.type) {
                case 'text':
                    return `<div class="block-text">${sanitizeHtml(b.content || '')}</div>`;
                case 'heading': {
                    const lvl = Math.min(Math.max(Number(b.meta?.level) || 2, 1), 4);
                    return `<h${lvl} class="block-heading">${esc(b.content)}</h${lvl}>`;
                }
                case 'code':
                    return `<pre class="block-code"><code>${esc(b.content)}</code></pre>`;
                case 'callout':
                    return `<div class="block-callout">${esc(b.content)}</div>`;
                case 'divider':
                    return `<hr class="block-divider">${b.content ? `<p class="divider-label">${esc(b.content)}</p>` : ''}`;
                case 'checklist': {
                    let items = [];
                    try { items = JSON.parse(b.content); } catch { /* empty */ }
                    return `<ul class="block-checklist">${(Array.isArray(items) ? items : []).map(it =>
                        `<li class="${it.done ? 'done' : ''}"><span class="cb">${it.done ? '☑' : '☐'}</span> ${esc(it.text)}</li>`
                    ).join('')}</ul>`;
                }
                case 'toggle':
                    return `<details class="block-toggle" open><summary>${esc(b.meta?.title || 'Toggle')}</summary><p>${esc(b.content)}</p></details>`;
                case 'table': {
                    let tdata = { headers: [], rows: [] };
                    try { tdata = JSON.parse(b.content) || tdata; } catch { /* empty */ }
                    const hdrs = (tdata.headers || []).map(h => `<th>${esc(h)}</th>`).join('');
                    const rows = (tdata.rows || []).map(r => `<tr>${(r || []).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
                    return `<table class="block-table"><thead><tr>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
                }
                case 'image':
                    return imageSrc[b.id] ? `<img src="${esc(imageSrc[b.id])}" class="block-image" alt="" />` : '';
                case 'file':
                    return b.content ? `<p class="block-file">Attachment: ${esc(b.meta?.name || 'file')}</p>` : '';
                default:
                    return '';
            }
        }).join('\n');

        const tagHtml = (note?.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title) || 'Untitled Note'}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #111; font-size: 15px; line-height: 1.7; }
  h1.title { font-size: 36px; font-weight: 800; margin-bottom: 6px; }
  .meta { color: #888; font-size: 12px; margin-bottom: 16px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 24px; }
  .tag { background: #f3ede5; color: #7a5c36; padding: 2px 8px; border-radius: 2px; font-size: 12px; font-weight: 500; }
  .block-text { margin-bottom: 12px; white-space: pre-wrap; }
  .block-heading { margin: 20px 0 8px; font-weight: 700; }
  h1.block-heading { font-size: 28px; } h2.block-heading { font-size: 22px; } h3.block-heading { font-size: 18px; }
  .block-code { background: #f8f8f7; border: 1px solid #e5e2dd; border-left: 3px solid #b8956a; padding: 14px 16px; font-family: Menlo, monospace; font-size: 13px; white-space: pre-wrap; margin-bottom: 14px; border-radius: 2px; }
  .block-callout { background: #faf6f0; border-left: 3px solid #b8956a; padding: 12px 16px; border-radius: 2px; margin-bottom: 14px; white-space: pre-wrap; }
  .block-divider { border: none; border-top: 1px solid #e5e2dd; margin: 20px 0; }
  .divider-label { text-align: center; color: #9c9790; font-size: 12px; }
  .block-checklist { list-style: none; margin-bottom: 14px; }
  .block-checklist li { padding: 3px 0; display: flex; align-items: flex-start; gap: 8px; }
  .block-checklist li.done { color: #9c9790; text-decoration: line-through; }
  .block-toggle { border: 1px solid #e5e2dd; border-radius: 2px; padding: 10px 14px; margin-bottom: 14px; }
  .block-toggle summary { font-weight: 600; margin-bottom: 6px; }
  .block-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 14px; }
  .block-table th { background: #f8f8f7; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e5e2dd; }
  .block-table td { padding: 8px 12px; border: 1px solid #e5e2dd; }
  .block-image { max-width: 100%; border-radius: 2px; margin-bottom: 14px; }
  .block-file { color: #5c5852; font-size: 13px; margin-bottom: 12px; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1 class="title">${esc(title) || 'Untitled Note'}</h1>
<p class="meta">Last edited: ${esc(new Date(note?.updatedAt).toLocaleString())}</p>
${tagHtml ? `<div class="tags">${tagHtml}</div>` : ''}
${blockHtml}
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
</body></html>`;

        win.document.write(html);
        win.document.close();
    };

    const handleDeleteConfirm = async () => {
        setIsDeleteModalOpen(false);
        await deleteNote(id);
    };

    const handleRestore = (version) => {
        const restored = parseBlocks(version.content);
        setTitle(version.title || '');
        blocksRef.current = restored;
        setBlocks(restored);
        updateNote(id, { title: version.title || '', content: JSON.stringify(restored) }, { immediate: true });
        showToast("Version restored", "success");
        setShowHistory(false);
    };

    const handleDragStart = useCallback((e, blockId) => {
        dragBlockId.current = blockId;
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e, blockId) => {
        e.preventDefault();
        setDragOverId(blockId);
    }, []);

    const handleDrop = useCallback((e, targetId) => {
        e.preventDefault();
        const fromId = dragBlockId.current;
        setDragOverId(null);
        dragBlockId.current = null;
        if (!fromId || fromId === targetId) return;
        const prev = blocksRef.current;
        const fromIdx = prev.findIndex(b => b.id === fromId);
        const toIdx = prev.findIndex(b => b.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const arr = [...prev];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        commitBlocks(arr);
    }, [commitBlocks]);

    // Let Oruinwan AI (⌘⇧A) see the open note.
    const aiCtx = useAIContext();
    const setAINote = aiCtx?.setNote;
    useEffect(() => {
        if (!setAINote || !id) return undefined;
        setAINote({ id, title, getText: () => (blocksRef.current || []).map(b => String(b.content || '').replace(/<[^>]*>/g, '')).filter(Boolean).join('\n') });
        return () => setAINote(null);
    }, [setAINote, id, title]);

    const handleAIInsertBlock = (type, content, meta) => {
        addBlock(type, content, meta);
        showToast("AI result inserted", "success");
    };

    if (!id) return <EmptyState />;
    if (!note) {
        const fs = fetchState[id];
        if (loading || !fs || fs.status === 'loading') return <EmptyState loading />;
        const notFound = fs.code === 404 || fs.code === 400;
        return (
            <div className="cd-state" style={{ height: '100%', background: 'var(--bg-base)' }}>
                <span className="gl-empty-mark"><Lock size={18} /></span>
                <p className="gl-empty-title">{notFound ? 'Note not found' : "You don't have access to this note"}</p>
                <p className="gl-empty-text">It may have been deleted, or its owner hasn't shared it with you. Ask the owner to share it, or go back to your notes.</p>
                <Btn icon={ArrowLeft} onClick={() => navigate(`/workspace/${workspaceId}/notes`)}>Back to notes</Btn>
            </div>
        );
    }

    const typeConf = noteTypeOf(note.type);
    const versions = noteVersions?.[id] || [];
    const region = getUserPreferences().region;
    const formattedDate = note.updatedAt ? `${formatDayHeading(note.updatedAt, region)}, ${formatTime(note.updatedAt, region)}` : '';
    const ownerName = note.owner?.username || 'the owner';
    const mediaProps = { workspaceId, noteId: id, uploadProgress, setUploadProgress, showToast };

    const renderBlock = (block) => {
        const common = { block, onBlockChange: handleBlockChange, onRemoveBlock: removeBlock };
        const el = (() => {
            switch (block.type) {
                case 'text': return <TextBlock {...common} onSlashCommand={openSlashMenu} onAddBlockAfter={handleAddBlockAfter} registerRef={registerBlockRef} />;
                case 'heading': return <HeadingBlock {...common} onAddBlockAfter={handleAddBlockAfter} registerRef={registerBlockRef} />;
                case 'code': return <CodeBlock {...common} />;
                case 'callout': return <CalloutBlock {...common} />;
                case 'checklist': return <ChecklistBlock {...common} />;
                case 'toggle': return <ToggleBlock {...common} />;
                case 'divider': return <DividerBlock {...common} />;
                case 'table': return <TableBlock {...common} />;
                case 'image': return <ImageBlock {...common} {...mediaProps} />;
                case 'video': return <VideoBlock {...common} {...mediaProps} />;
                case 'audio': return <AudioBlock {...common} {...mediaProps} />;
                case 'file': return <FileBlock {...common} {...mediaProps} />;
                default: return null;
            }
        })();

        return (
            <div
                key={block.id}
                className={`relative group/block transition-all ${dragOverId === block.id ? 'outline outline-1 outline-offset-2' : ''}`}
                style={dragOverId === block.id ? { outlineColor: 'var(--accent)' } : undefined}
                draggable
                onDragStart={e => handleDragStart(e, block.id)}
                onDragOver={e => handleDragOver(e, block.id)}
                onDrop={e => handleDrop(e, block.id)}
                onDragLeave={() => setDragOverId(null)}
            >
                <div className="absolute -left-7 top-2 opacity-0 group-hover/block:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-10">
                    <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                {el}
            </div>
        );
    };

    const menuItems = [
        canEdit && { label: 'Duplicate', Icon: Copy, action: handleDuplicate },
        { label: 'Download as PDF', Icon: Download, action: handleDownloadPDF },
        { label: showShareTooltip ? 'Link copied' : 'Copy link', Icon: showShareTooltip ? Check : Share2, action: () => { handleCopyLink(); setShowMenu(false); } },
        { label: 'Note details', Icon: Info, action: () => { setShowInfoModal(true); setShowMenu(false); } },
    ].filter(Boolean);

    const QUICK_BLOCKS = [
        { type: 'text', label: 'Text', Icon: Type },
        { type: 'heading', label: 'Heading', Icon: Heading1, meta: { level: 1 } },
        { type: 'code', label: 'Code', Icon: Code2 },
        { type: 'checklist', label: 'Checklist', Icon: CheckSquare, content: () => JSON.stringify([{ id: Date.now(), text: '', done: false }]) },
        { type: 'toggle', label: 'Toggle', Icon: ChevronRight },
        { type: 'callout', label: 'Callout', Icon: Info },
        { type: 'divider', label: 'Divider', Icon: Minus },
        { type: 'table', label: 'Table', Icon: Table2 },
        { type: 'image', label: 'Image', Icon: ImageIcon },
        { type: 'file', label: 'File', Icon: Paperclip },
    ];

    return (
        <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden', fontFamily: 'var(--font)' }}>
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header: what this note is on the left, what you can do with it on the right */}
                <div className="nt-head">
                    <div className="nt-head-meta">
                        <span data-testid="note-type-pill" className="cd-chip" style={{ flexShrink: 0 }}>
                            <typeConf.Icon size={12} style={{ color: 'var(--accent)' }} />
                            {typeConf.label}
                        </span>
                        {note.isPublic && (
                            <span className="nt-head-hint nt-hide-phone" title="Visible to everyone in this workspace">
                                <Globe size={11} /> Workspace
                            </span>
                        )}
                        <span className="nt-head-hint nt-hide-phone" style={{ minWidth: 0 }}>
                            <Clock size={11} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formattedDate}</span>
                        </span>
                        {canEdit && <SaveIndicator status={saveStatus?.[id]} />}
                    </div>

                    <div className="nt-head-actions">
                        {canEdit && (
                            <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" aria-pressed={showAI}
                                onClick={() => { setShowAI(v => !v); setShowHistory(false); }}
                                style={showAI ? { color: 'var(--accent)', background: 'var(--gl-accent-soft)' } : undefined}
                                title="Summarise, rewrite or extract tasks with AI">
                                <Sparkles size={13} style={{ color: 'var(--accent)' }} /> <span className="nt-hide-phone">Ask </span>AI
                            </button>
                        )}
                        <button type="button" className="gl-icon-btn" aria-pressed={showHistory}
                            onClick={() => { setShowHistory(v => !v); setShowAI(false); }}
                            title="Version history" aria-label="Version history">
                            <History size={15} />
                        </button>
                        {isOwner && (
                            <button type="button" className="gl-icon-btn" aria-pressed={note.isPinned}
                                onClick={() => togglePin && togglePin(id)}
                                title={note.isPinned ? 'Remove star' : 'Star this note'} aria-label={note.isPinned ? 'Remove star' : 'Star this note'}>
                                <Star size={15} style={{ fill: note.isPinned ? 'currentColor' : 'none' }} />
                            </button>
                        )}

                        <div className="relative" ref={menuRef}>
                            <button type="button" className="gl-icon-btn" aria-expanded={showMenu} aria-haspopup="menu"
                                onClick={() => setShowMenu(v => !v)} title="More" aria-label="More actions">
                                <MoreHorizontal size={16} />
                            </button>
                            {showMenu && (
                                <div className="gl-x-menu" role="menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', width: '208px', zIndex: 20 }}>
                                    {menuItems.map(({ label, Icon: Ic, action }) => (
                                        <button key={label} type="button" role="menuitem" className="gl-x-menu-item" onClick={action}>
                                            <Ic size={13} /> {label}
                                        </button>
                                    ))}
                                    {isOwner && (
                                        <>
                                            <div className="gl-x-menu-sep" />
                                            <button type="button" role="menuitem" className="gl-x-menu-item"
                                                onClick={() => { setShowMenu(false); toggleArchive && toggleArchive(id); }}>
                                                {note.isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                                {note.isArchived ? 'Restore from archive' : 'Archive'}
                                            </button>
                                            <button type="button" role="menuitem" className="gl-x-menu-item gl-x-menu-item--danger" data-testid="note-delete-button"
                                                onClick={() => { setShowMenu(false); setIsDeleteModalOpen(true); }}>
                                                <Trash2 size={13} /> Delete note
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {isOwner && (
                            <Btn variant="primary" size="sm" icon={Users} onClick={() => setShowShareModal(true)} data-testid="note-share-button" title="Share note">
                                Share
                            </Btn>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="nt-body">
                        {!canEdit && (
                            <div data-testid="note-readonly-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', marginBottom: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <Eye size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                View only — {ownerName} {note.isPublic ? 'shared this note with the workspace' : 'shared this note with you'}.
                            </div>
                        )}

                        {canEdit ? (
                            <input
                                type="text"
                                value={title}
                                onChange={handleTitleChange}
                                onBlur={() => flushNote(id)}
                                aria-label="Note title"
                                data-testid="note-title-input"
                                className="nt-title placeholder:text-[var(--text-muted)]"
                                placeholder="Untitled"
                            />
                        ) : (
                            <h1 className="nt-title">{title || 'Untitled'}</h1>
                        )}

                        {/* Tags (owner only) */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 min-h-[28px]">
                            {tags.map(tag => (
                                <span key={tag} className="cd-chip" data-tone="accent">
                                    #{tag}
                                    {isOwner && (
                                        <button onClick={() => removeTag(tag)} title={`Remove #${tag}`}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', transition: 'color 150ms ease' }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--state-danger)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                                        ><X size={10} /></button>
                                    )}
                                </span>
                            ))}
                            {isOwner && (showTagInput ? (
                                <input
                                    autoFocus type="text" value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                                    onBlur={addTag}
                                    placeholder="tag name…"
                                    style={{ padding: '2px 8px', border: '1px solid var(--border-accent)', borderRadius: '2px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '11px', fontFamily: 'var(--font)', outline: 'none', width: '110px' }}
                                />
                            ) : (
                                <button type="button" className="nt-ghost-link" onClick={() => setShowTagInput(true)}>
                                    <Tag size={11} /> Add tag
                                </button>
                            ))}
                        </div>

                        {canEdit ? (
                            <>
                                <div className="space-y-1 flex-1 pl-8 -ml-8">
                                    {blocks.map(block => renderBlock(block))}
                                </div>

                                <div className="nt-add">
                                    <button type="button" className="nt-add-hint" onClick={() => addBlock('text', '')}>
                                        <Plus size={13} /> Click to add text, or type <kbd>/</kbd> in a line for more blocks
                                    </button>
                                    <div className="nt-quick" role="group" aria-label="Add a block">
                                        {QUICK_BLOCKS.map(({ type, label, Icon: Ic, meta, content }) => (
                                            <button key={`${type}-${label}`} type="button" className="gl-btn gl-btn--ghost gl-btn--sm"
                                                onClick={() => addBlock(type, content ? content() : '', meta || {})}>
                                                <Ic size={12} /> {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div data-testid="note-readonly-body" className="flex-1">
                                {(viewBlocks || []).map(block => (
                                    <div key={block.id}><ReadOnlyBlock block={block} mediaProps={mediaProps} /></div>
                                ))}
                                {!(viewBlocks || []).length && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>This note is empty.</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showAI && canEdit && (
                <AIPanel
                    blocks={blocks}
                    title={title}
                    workspaceId={workspaceId}
                    onInsertBlock={handleAIInsertBlock}
                    onClose={() => setShowAI(false)}
                />
            )}

            {showHistory && (
                <VersionHistoryPanel
                    versions={versions}
                    currentContent={JSON.stringify(canEdit ? blocks : (viewBlocks || []))}
                    currentTitle={title}
                    onRestore={canEdit ? handleRestore : undefined}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {slashMenu.open && (
                <SlashCommandMenu
                    position={slashMenu.position}
                    query={slashMenu.query}
                    onSelect={handleSlashSelect}
                    onClose={closeSlashMenu}
                />
            )}

            <NoteInfoModal note={note} blocks={canEdit ? blocks : (viewBlocks || [])} showInfoModal={showInfoModal} setShowInfoModal={setShowInfoModal} />
            {showShareModal && isOwner && (
                <ShareNoteModal
                    note={note}
                    workspaceId={workspaceId}
                    onClose={() => setShowShareModal(false)}
                    onShare={handleShareModalSave}
                />
            )}
            <Confirm
                open={isDeleteModalOpen}
                title={`Delete “${title || 'Untitled'}”?`}
                confirmLabel="Delete note"
                tone="danger"
                onConfirm={handleDeleteConfirm}
                onClose={() => setIsDeleteModalOpen(false)}
            >
                The note, its version history and its attachments are removed for everyone it's shared with. This can't be undone. To keep it out of the way instead, archive it.
            </Confirm>
            <style>{NOTE_CSS}</style>
        </div>
    );
};

export default Notes;

