import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useNotes } from "../../contexts/NotesContext";
import { useToast } from "../../contexts/ToastContext";
import ConfirmationModal from "../../shared/components/ui/ConfirmationModal";
import api from '@services/api';
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
import { formatDayHeading, formatTime } from "../../utils/userDateFormat";
import { getUserPreferences } from "../../hooks/useUserPreferences";

import {
    Sparkles, Share2, Check, Trash2, MoreHorizontal, Copy, Download,
    Info, Clock, Tag, X, Plus, History, GripVertical, Users, Eye, Globe,
    Star, Archive, FileText, Lightbulb, ClipboardList, FolderKanban, Cpu, Megaphone,
    Loader2, AlertCircle, Lock,
    Type, Heading1, Code2, CheckSquare, ChevronRight, Minus, Table2, Image as ImageIcon, Paperclip,
} from "lucide-react";

const NOTE_TYPE_CONFIG = {
    note: { Icon: FileText, label: 'Document' },
    documentation: { Icon: FileText, label: 'Document' },
    brainstorm: { Icon: Lightbulb, label: 'Brainstorm' },
    meeting: { Icon: Users, label: 'Meeting' },
    sop: { Icon: ClipboardList, label: 'SOP' },
    projectspec: { Icon: FolderKanban, label: 'Project Spec' },
    techdesign: { Icon: Cpu, label: 'Tech Design' },
    announcement: { Icon: Megaphone, label: 'Announcement' },
};
const DEFAULT_TYPE = NOTE_TYPE_CONFIG.note;
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

const iconBtn = { padding: '6px', background: 'transparent', border: 'none', borderRadius: '2px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', display: 'flex', alignItems: 'center' };
const hoverOn = (e, color = 'var(--text-primary)') => { e.currentTarget.style.color = color; e.currentTarget.style.background = 'var(--bg-hover)'; };
const hoverOff = (e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; };

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

    if (!id) return <EmptyState loading={loading} />;
    if (!note) {
        const fs = fetchState[id];
        if (loading || !fs || fs.status === 'loading') return <EmptyState loading />;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-base)', gap: '10px', fontFamily: 'var(--font)' }}>
                <Lock size={28} style={{ color: 'var(--text-muted)' }} />
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {fs.code === 404 || fs.code === 400 ? 'Note not found' : "You don't have access to this note"}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '300px', textAlign: 'center' }}>
                    It may have been deleted, or its owner has not shared it with you.
                </p>
                <button onClick={() => navigate(`/workspace/${workspaceId}/notes`)}
                    style={{ marginTop: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    Back to notes
                </button>
            </div>
        );
    }

    const typeConf = NOTE_TYPE_CONFIG[note.type] || DEFAULT_TYPE;
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
        { label: 'Download PDF', Icon: Download, action: handleDownloadPDF },
        { label: 'Copy link', Icon: showShareTooltip ? Check : Share2, action: () => { handleCopyLink(); setShowMenu(false); }, success: showShareTooltip },
    ].filter(Boolean);

    const QUICK_BLOCKS = [
        { type: 'text', label: 'Text', Icon: Type },
        { type: 'heading', label: 'H1', Icon: Heading1, meta: { level: 1 } },
        { type: 'code', label: 'Code', Icon: Code2 },
        { type: 'checklist', label: 'Check', Icon: CheckSquare, content: () => JSON.stringify([{ id: Date.now(), text: '', done: false }]) },
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
                {/* Header */}
                <div style={{ height: '52px', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)', flexShrink: 0, zIndex: 10, position: 'relative' }}>
                    <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                        <span data-testid="note-type-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', flexShrink: 0 }}>
                            <typeConf.Icon size={12} style={{ color: 'var(--accent)' }} />
                            {typeConf.label}
                        </span>
                        {note.isPublic && (
                            <span title="Visible to everyone in this workspace" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                <Globe size={11} /> Workspace
                            </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', minWidth: 0 }}>
                            <Clock size={11} style={{ flexShrink: 0 }} />
                            <span className="hidden sm:block" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formattedDate}</span>
                        </div>
                        {canEdit && <SaveIndicator status={saveStatus?.[id]} />}
                    </div>

                    <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
                        {canEdit && (
                            <button
                                onClick={() => { setShowAI(v => !v); setShowHistory(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: showAI ? 'var(--accent-dim)' : 'var(--accent)', border: showAI ? '1px solid var(--border-accent)' : '1px solid transparent', borderRadius: '2px', color: showAI ? 'var(--accent)' : '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                            >
                                <Sparkles size={13} /> AI
                            </button>
                        )}

                        {isOwner && (
                            <>
                                <div style={{ width: '1px', height: '16px', background: 'var(--border-default)', margin: '0 4px' }} />
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    data-testid="note-share-button"
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                                    title="Share note"
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                                >
                                    <Users size={13} /> Share
                                </button>
                            </>
                        )}

                        <button
                            onClick={() => { setShowHistory(v => !v); setShowAI(false); }}
                            style={{ ...iconBtn, background: showHistory ? 'var(--accent-dim)' : 'transparent', color: showHistory ? 'var(--accent)' : 'var(--text-muted)' }}
                            title="Version history"
                            onMouseEnter={e => { if (!showHistory) hoverOn(e); }}
                            onMouseLeave={e => { if (!showHistory) hoverOff(e); }}
                        >
                            <History size={16} />
                        </button>

                        {isOwner && (
                            <>
                                <button
                                    onClick={() => togglePin && togglePin(id)}
                                    style={{ ...iconBtn, background: note.isPinned ? 'var(--accent-dim)' : 'transparent', color: note.isPinned ? 'var(--accent)' : 'var(--text-muted)' }}
                                    title={note.isPinned ? 'Remove from Favorites' : 'Add to Favorites'}
                                    onMouseEnter={e => { if (!note.isPinned) hoverOn(e, 'var(--accent)'); }}
                                    onMouseLeave={e => { if (!note.isPinned) hoverOff(e); }}
                                >
                                    <Star size={16} className={note.isPinned ? 'fill-current' : ''} />
                                </button>

                                <button
                                    onClick={() => toggleArchive && toggleArchive(id)}
                                    style={iconBtn}
                                    title={note.isArchived ? 'Restore note' : 'Archive note'}
                                    onMouseEnter={e => hoverOn(e)}
                                    onMouseLeave={hoverOff}
                                >
                                    <Archive size={16} />
                                </button>

                                <button onClick={() => setIsDeleteModalOpen(true)}
                                    style={iconBtn}
                                    title="Delete note"
                                    data-testid="note-delete-button"
                                    onMouseEnter={e => hoverOn(e, 'var(--state-danger)')}
                                    onMouseLeave={hoverOff}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}

                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setShowMenu(v => !v)}
                                style={{ ...iconBtn, background: showMenu ? 'var(--bg-hover)' : 'transparent', color: showMenu ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                title="More"
                                onMouseEnter={e => { if (!showMenu) hoverOn(e); }}
                                onMouseLeave={e => { if (!showMenu) hoverOff(e); }}
                            >
                                <MoreHorizontal size={16} />
                            </button>
                            {showMenu && (
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', width: '200px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', boxShadow: 'var(--card-shadow)', padding: '4px 0', zIndex: 20 }}>
                                    {menuItems.map(({ label, Icon: Ic, action, success }) => (
                                        <button key={label} onClick={action}
                                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: success ? 'var(--state-success)' : 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font)', transition: 'background 150ms ease' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <Ic size={13} style={{ color: 'var(--text-muted)' }} /> {label}
                                        </button>
                                    ))}
                                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 0' }} />
                                    <button onClick={() => { setShowInfoModal(true); setShowMenu(false); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font)', transition: 'background 150ms ease' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <Info size={13} style={{ color: 'var(--text-muted)' }} /> Note Info
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-3xl mx-auto px-12 py-10 min-h-full flex flex-col">
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
                                style={{
                                    fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)',
                                    border: 'none', outline: 'none', padding: 0, marginBottom: '10px',
                                    width: '100%', background: 'transparent', fontFamily: 'var(--font)',
                                    lineHeight: 1.15,
                                }}
                                className="placeholder:text-[var(--text-muted)]"
                                placeholder="Untitled"
                            />
                        ) : (
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.15, fontFamily: 'var(--font)' }}>{title || 'Untitled'}</h1>
                        )}

                        {/* Tags (owner only) */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 min-h-[28px]">
                            {tags.map(tag => (
                                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--accent-dim)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--accent)', fontSize: '11px', fontWeight: 600 }}>
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
                                <button onClick={() => setShowTagInput(true)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', fontFamily: 'var(--font)' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                                >
                                    <Tag size={11} /><Plus size={9} /> tag
                                </button>
                            ))}
                        </div>

                        {canEdit ? (
                            <>
                                <div className="space-y-1 flex-1 pl-8 -ml-8">
                                    {blocks.map(block => renderBlock(block))}
                                </div>

                                <div
                                    style={{ marginTop: '24px', padding: '12px 0', fontSize: '12px', color: 'var(--text-muted)', cursor: 'text', userSelect: 'none', transition: 'color 150ms ease' }}
                                    onClick={() => addBlock('text', '')}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        Type <kbd style={{ padding: '1px 6px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '11px', fontFamily: 'var(--font)' }}>/</kbd> to insert a block, or click to add text
                                    </span>
                                </div>

                                <div className="mt-4 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity flex-wrap">
                                    {QUICK_BLOCKS.map(({ type, label, Icon: Ic, meta, content }) => (
                                        <button
                                            key={`${type}-${label}`}
                                            onClick={() => addBlock(type, content ? content() : '', meta || {})}
                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                                            onMouseEnter={e => hoverOn(e)}
                                            onMouseLeave={hoverOff}
                                        >
                                            <Ic size={12} /> {label}
                                        </button>
                                    ))}
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
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Note"
                message="Are you sure you want to delete this note? This action cannot be undone."
                confirmText="Delete Forever"
                isDestructive={true}
            />
        </div>
    );
};

export default Notes;

