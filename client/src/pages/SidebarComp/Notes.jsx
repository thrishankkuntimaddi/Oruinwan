import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useNotes } from "../../contexts/NotesContext";
import { useToast } from "../../contexts/ToastContext";
import ConfirmationModal from "../../shared/components/ui/ConfirmationModal";

// Block components
import TextBlock from "./notesComponents/blocks/TextBlock";
import ImageBlock from "./notesComponents/blocks/ImageBlock";
import VideoBlock from "./notesComponents/blocks/VideoBlock";
import AudioBlock from "./notesComponents/blocks/AudioBlock";
import HeadingBlock from "./notesComponents/blocks/HeadingBlock";
import CodeBlock from "./notesComponents/blocks/CodeBlock";
import CalloutBlock from "./notesComponents/blocks/CalloutBlock";
import ChecklistBlock from "./notesComponents/blocks/ChecklistBlock";
import ToggleBlock from "./notesComponents/blocks/ToggleBlock";
import DividerBlock from "./notesComponents/blocks/DividerBlock";
import TableBlock from "./notesComponents/blocks/TableBlock";

// UI components
import EmptyState from "./notesComponents/ui/EmptyState";
import NoteInfoModal from "./notesComponents/ui/NoteInfoModal";
import ShareNoteModal from "./notesComponents/ui/ShareNoteModal";
import SlashCommandMenu from "./notesComponents/ui/SlashCommandMenu";
import AIPanel from "./notesComponents/ui/AIPanel";
import VersionHistoryPanel from "./notesComponents/ui/VersionHistoryPanel";

// Icons
import {
    Sparkles, Share2, Check, Trash2, MoreHorizontal, Copy, Download,
    Info, Clock, Tag, X, Plus, History, GripVertical, Users,
    Star, Archive, FileText, Lightbulb, ClipboardList, FolderKanban, Cpu, Megaphone, StickyNote
} from "lucide-react";

const NOTE_TYPE_CONFIG = {
    note: { Icon: FileText, label: 'Document', color: 'bg-sky-900/30 text-sky-400 dark:bg-sky-900/30 dark:text-sky-400' },
    brainstorm: { Icon: Lightbulb, label: 'Brainstorm', color: 'bg-violet-900/30 text-violet-400 dark:bg-violet-900/30 dark:text-violet-400' },
    meeting: { Icon: Users, label: 'Meeting', color: 'bg-emerald-900/30 text-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400' },
    sop: { Icon: ClipboardList, label: 'SOP', color: 'bg-amber-900/30 text-amber-400 dark:bg-amber-900/30 dark:text-amber-400' },
    projectspec: { Icon: FolderKanban, label: 'Project Spec', color: 'bg-cyan-900/30 text-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-400' },
    techdesign: { Icon: Cpu, label: 'Tech Design', color: 'bg-slate-800/50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-400' },
    announcement: { Icon: Megaphone, label: 'Announcement', color: 'bg-rose-900/30 text-rose-400 dark:bg-rose-900/30 dark:text-rose-400' },
};
const DEFAULT_TYPE = NOTE_TYPE_CONFIG.note;

const Notes = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { allNotes, notes, updateNote, deleteNote, addNote, shareNote, loading, noteVersions, addVersion, loadVersions, togglePin, toggleArchive } = useNotes();
    const { showToast } = useToast();

    // Navigate from universal search
    useEffect(() => {
        const noteIdParam = searchParams.get('noteId');
        if (noteIdParam && noteIdParam !== id) navigate(`/workspace/${workspaceId}/notes/${noteIdParam}`, { replace: true });
    }, [searchParams, id, workspaceId, navigate]);

    // IMPORTANT: Use allNotes (not filteredNotes) so the note resolves regardless of
    // which section/type filter is active in the sidebar.
    const note = (allNotes || notes).find(n => n.id === id);

    // ── Editor State ──────────────────────────────────────────────────────────
    const [title, setTitle] = useState("");
    const [blocks, setBlocks] = useState([]);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    // ── UI State ──────────────────────────────────────────────────────────────
    const [showMenu, setShowMenu] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showShareTooltip, setShowShareTooltip] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});

    // ── Slash menu state ──────────────────────────────────────────────────────
    const [slashMenu, setSlashMenu] = useState({ open: false, query: '', blockId: null, position: { x: 0, y: 0 } });

    // ── Block refs (for auto-focus after adding new block) ────────────────────
    const blockRefsMap = useRef({});  // { [blockId]: domNode }

    const registerBlockRef = useCallback((blockId, node) => {
        if (node) blockRefsMap.current[blockId] = node;
        else delete blockRefsMap.current[blockId];
    }, []);

    // ── Drag state ────────────────────────────────────────────────────────────
    const [dragOverId, setDragOverId] = useState(null);
    const dragBlockId = useRef(null);

    const menuRef = useRef(null);

    // ── Load note ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (note) {
            setTitle(note.title || "");
            setTags(note.tags || []);
            try {
                const parsed = JSON.parse(note.content);
                setBlocks(Array.isArray(parsed) ? parsed : [{ id: Date.now(), type: "text", content: note.content || "", meta: {} }]);
            } catch {
                setBlocks([{ id: Date.now(), type: "text", content: note.content || "", meta: {} }]);
            }
        }
    }, [note?.id]);

    // Load version history from DB whenever note changes
    useEffect(() => {
        if (id && loadVersions) loadVersions(id);
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Click outside menu ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const persistBlocks = useCallback((newBlocks) => {
        const content = JSON.stringify(newBlocks);
        // Save version snapshot before update
        if (addVersion && id) {
            addVersion(id, { title, content, timestamp: Date.now() });
        }
        updateNote(id, { content });
    }, [id, title, updateNote, addVersion]);

    // updateBlocks: save + take version snapshot on every meaningful change
    const updateBlocks = useCallback((newBlocks) => {
        setBlocks(newBlocks);
        const content = JSON.stringify(newBlocks);
        // Snapshot for version history (addVersion is stable via useCallback)
        if (addVersion && id) addVersion(id, { title, content, timestamp: Date.now() });
        updateNote(id, { content });
    }, [id, title, updateNote, addVersion]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        updateNote(id, { title: e.target.value });
    };

    const handleBlockChange = useCallback((blockId, newContent, newMeta) => {
        setBlocks(prev => {
            const newBlocks = prev.map(b =>
                b.id === blockId ? { ...b, content: newContent, meta: newMeta !== undefined ? newMeta : b.meta } : b
            );
            // Debounced save — updateNote handles its own debounce
            updateNote(id, { content: JSON.stringify(newBlocks) });
            return newBlocks;
        });
    }, [id, updateNote]);

    const addBlock = useCallback((type, content = '', meta = {}) => {
        const newBlock = { id: Date.now(), type, content, meta };
        setBlocks(prev => {
            const newBlocks = [...prev, newBlock];
            if (addVersion && id) addVersion(id, { title, content: JSON.stringify(newBlocks), timestamp: Date.now() });
            updateNote(id, { content: JSON.stringify(newBlocks) });
            return newBlocks;
        });
        return newBlock;
    }, [id, title, updateNote, addVersion]);

    // insertBlockAfter — uses functional setState so never stale
    const insertBlockAfter = useCallback((afterId, type, content = '', meta = {}) => {
        const newBlock = { id: Date.now(), type, content, meta };
        setBlocks(prev => {
            const idx = prev.findIndex(b => b.id === afterId);
            const newBlocks = idx === -1
                ? [...prev, newBlock]
                : [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
            if (addVersion && id) addVersion(id, { title, content: JSON.stringify(newBlocks), timestamp: Date.now() });
            updateNote(id, { content: JSON.stringify(newBlocks) });
            // Auto-focus in next tick
            setTimeout(() => {
                const node = blockRefsMap.current[newBlock.id];
                if (node) {
                    node.focus();
                    try {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(node);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } catch { /* input elements don't use range API */ }
                }
            }, 50);
            return newBlocks;
        });
        return newBlock;
    }, [id, title, updateNote, addVersion, blockRefsMap]);

    const handleAddBlockAfter = useCallback((afterId) => {
        insertBlockAfter(afterId, 'text', '', {});
    }, [insertBlockAfter]);

    const removeBlock = useCallback((blockId) => {
        setBlocks(prev => {
            const newBlocks = prev.filter(b => b.id !== blockId);
            updateNote(id, { content: JSON.stringify(newBlocks) });
            return newBlocks;
        });
    }, [id, updateNote]);

    // ── Slash command ─────────────────────────────────────────────────────────
    const openSlashMenu = (blockId, query, position) => {
        setSlashMenu({ open: true, query, blockId, position });
    };

    const closeSlashMenu = () => setSlashMenu(prev => ({ ...prev, open: false, query: '' }));

    const handleSlashSelect = useCallback(({ type, meta }) => {
        const defaultContent = type === 'checklist'
            ? JSON.stringify([{ id: Date.now(), text: '', done: false }])
            : '';

        if (slashMenu.blockId) {
            // Check if the triggering block is truly empty (strip HTML tags for TextBlock)
            const domNode = blockRefsMap.current[slashMenu.blockId];
            const isBlocking = domNode ? (domNode.innerText || '').trim() === '' : false;

            if (isBlocking) {
                // Replace the empty block with the selected type
                setBlocks(prev => {
                    const newBlocks = prev.map(b =>
                        b.id === slashMenu.blockId
                            ? { ...b, type, content: defaultContent, meta: meta || {} }
                            : b
                    );
                    updateNote(id, { content: JSON.stringify(newBlocks) });
                    return newBlocks;
                });
            } else {
                insertBlockAfter(slashMenu.blockId, type, defaultContent, meta || {});
            }
        } else {
            addBlock(type, defaultContent, meta || {});
        }
        closeSlashMenu();
    }, [slashMenu.blockId, id, updateNote, insertBlockAfter, addBlock, blockRefsMap]);

    // ── Tags ──────────────────────────────────────────────────────────────────
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

    // ── Share ─────────────────────────────────────────────────────────────────
    const handleShareModalSave = async (userIds, isPublic) => {
        if (shareNote) await shareNote(id, userIds);
        await updateNote(id, { isPublic, sharedWith: userIds });
        showToast(isPublic ? 'Note visible to entire workspace' : `Shared with ${userIds.length} member${userIds.length !== 1 ? 's' : ''}`, 'success');
    };

    // Copy link to clipboard
    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/workspace/${workspaceId}/notes/${id}`);
        setShowShareTooltip(true);
        setTimeout(() => setShowShareTooltip(false), 2000);
        showToast('Link copied to clipboard', 'success');
    };

    // ── Duplicate ─────────────────────────────────────────────────────────────
    const handleDuplicate = async () => {
        const newNote = await addNote();
        if (!newNote) return;
        await updateNote(newNote.id, { title: `${title} (Copy)`, content: JSON.stringify(blocks), tags });
        setShowMenu(false);
        showToast("Note duplicated", "success");
    };

    // ── PDF download ── full fidelity across all block types ──────────────────
    const handleDownloadPDF = () => {
        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const blockHtml = blocks.map(b => {
            switch (b.type) {
                case 'text':
                    return `<div class="block-text">${b.content || ''}</div>`;
                case 'heading': {
                    const lvl = b.meta?.level || 2;
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
                    try { items = JSON.parse(b.content); } catch { }
                    return `<ul class="block-checklist">${items.map(it =>
                        `<li class="${it.done ? 'done' : ''}"><span class="cb">${it.done ? '☑' : '☐'}</span> ${esc(it.text)}</li>`
                    ).join('')}</ul>`;
                }
                case 'toggle':
                    return `<details class="block-toggle" open><summary>${esc(b.meta?.title || 'Toggle')}</summary><p>${esc(b.content)}</p></details>`;
                case 'table': {

                    let tdata = { headers: [], rows: [] };
                    try { tdata = JSON.parse(b.content); } catch { }
                    const hdrs = (tdata.headers || []).map(h => `<th>${esc(h)}</th>`).join('');
                    const rows = (tdata.rows || []).map(r =>
                        `<tr>${(r || []).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`
                    ).join('');
                    return `<table class="block-table"><thead><tr>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
                }
                case 'image':
                    return b.content ? `<img src="${b.content}" class="block-image" />` : '';
                default:
                    return '';
            }
        }).join('\n');

        const tagHtml = (note.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title) || 'Untitled Note'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #111; font-size: 15px; line-height: 1.7; }
  h1.title { font-size: 36px; font-weight: 800; margin-bottom: 6px; }
  .meta { color: #888; font-size: 12px; margin-bottom: 16px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 24px; }
  .tag { background: #eff6ff; color: #1d4ed8; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .block-text { margin-bottom: 12px; white-space: pre-wrap; }
  .block-heading { margin: 20px 0 8px; font-weight: 700; }
  h1.block-heading { font-size: 28px; } h2.block-heading { font-size: 22px; } h3.block-heading { font-size: 18px; }
  .block-code { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; padding: 14px 16px; font-family: 'Menlo', monospace; font-size: 13px; white-space: pre-wrap; margin-bottom: 14px; border-radius: 4px; overflow-x: auto; }
  .block-callout { background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; margin-bottom: 14px; }
  .block-divider { border: none; border-top: 2px solid #e5e7eb; margin: 20px 0; }
  .divider-label { text-align: center; color: #9ca3af; font-size: 12px; margin-top: -10px; background: white; display: inline-block; padding: 0 8px; }
  .block-checklist { list-style: none; margin-bottom: 14px; }
  .block-checklist li { padding: 3px 0; display: flex; align-items: flex-start; gap: 8px; }
  .block-checklist li.done { color: #9ca3af; text-decoration: line-through; }
  .cb { font-size: 16px; flex-shrink: 0; }
  .block-toggle { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
  .block-toggle summary { font-weight: 600; cursor: pointer; margin-bottom: 6px; }
  .block-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 14px; }
  .block-table th { background: #f8fafc; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }
  .block-table td { padding: 8px 12px; border: 1px solid #e2e8f0; }
  .block-image { max-width: 100%; border-radius: 8px; margin-bottom: 14px; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1 class="title">${esc(title) || 'Untitled Note'}</h1>
<p class="meta">Last edited: ${new Date(note?.updatedAt).toLocaleString()}</p>
${tagHtml ? `<div class="tags">${tagHtml}</div>` : ''}
${blockHtml}
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
</body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setShowMenu(false);
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDeleteConfirm = () => {
        deleteNote(id);
        setIsDeleteModalOpen(false);
        showToast("Note deleted", "success");
    };

    // ── Version restore ───────────────────────────────────────────────────────
    const handleRestore = (version) => {
        setTitle(version.title || '');
        try {
            const p = JSON.parse(version.content);
            setBlocks(Array.isArray(p) ? p : []);
        } catch { }
        updateNote(id, { title: version.title, content: version.content });
        showToast("Version restored", "success");
        setShowHistory(false);
    };

    // ── Drag-to-reorder ───────────────────────────────────────────────────────
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
        if (!fromId || fromId === targetId) { setDragOverId(null); return; }
        setBlocks(prev => {
            const fromIdx = prev.findIndex(b => b.id === fromId);
            const toIdx = prev.findIndex(b => b.id === targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const arr = [...prev];
            const [moved] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, moved);
            updateNote(id, { content: JSON.stringify(arr) });
            return arr;
        });
        setDragOverId(null);
        dragBlockId.current = null;
    }, [id, updateNote]);

    // ── Insert AI result ──────────────────────────────────────────────────────
    const handleAIInsertBlock = (type, content, meta) => {
        addBlock(type, content, meta);
        showToast("AI result inserted", "success");
    };

    // ── Empty state ───────────────────────────────────────────────────────────
    if (!id || !note) return <EmptyState loading={loading} />;

    const typeConf = NOTE_TYPE_CONFIG[note.type] || DEFAULT_TYPE;
    const versions = noteVersions?.[id] || [];
    const formattedDate = new Date(note.updatedAt).toLocaleString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const renderBlock = (block) => {
        const common = { key: block.id, block, onBlockChange: handleBlockChange, onRemoveBlock: removeBlock };
        const mediaProps = { workspaceId, noteId: id, uploadProgress, setUploadProgress, showToast };

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
                default: return null;
            }
        })();

        return (
            <div
                key={block.id}
                className={`relative group/block transition-all ${dragOverId === block.id ? 'outline outline-1 outline-offset-2' : ''}`}
                style={dragOverId === block.id ? { outlineColor: '#b8956a' } : {}}
                draggable
                onDragStart={e => handleDragStart(e, block.id)}
                onDragOver={e => handleDragOver(e, block.id)}
                onDrop={e => handleDrop(e, block.id)}
                onDragLeave={() => setDragOverId(null)}
            >
                {/* Drag handle */}
                <div className="absolute -left-7 top-2 opacity-0 group-hover/block:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-10">
                    <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                {el}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
            {/* Main editor column */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* ── Toolbar ── */}
                <div style={{ height: '52px', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)', flexShrink: 0, zIndex: 10, position: 'relative' }}>
                    <div className="flex items-center gap-3">
                        {/* Note type badge — Lucide icon */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${typeConf.color}`}>
                            <typeConf.Icon size={12} />
                            {typeConf.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            <Clock size={11} />
                            <span className="hidden sm:block">{formattedDate}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* AI button */}
                        <button
                            onClick={() => { setShowAI(v => !v); setShowHistory(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: showAI ? 'rgba(184,149,106,0.2)' : '#b8956a', border: showAI ? '1px solid rgba(184,149,106,0.4)' : 'none', color: showAI ? '#b8956a' : '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            <Sparkles size={13} /> AI
                        </button>

                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

                        {/* Share */}
                        <button
                            onClick={() => setShowShareModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-default)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                            title="Share note"
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        >
                            <Users size={13} /> Share
                        </button>

                        {/* History */}
                        <button
                            onClick={() => { setShowHistory(v => !v); setShowAI(false); }}
                            style={{ padding: '6px', background: showHistory ? 'rgba(184,149,106,0.15)' : 'transparent', border: 'none', color: showHistory ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                            title="Version history"
                            onMouseEnter={e => { if (!showHistory) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                            onMouseLeave={e => { if (!showHistory) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                        >
                            <History size={16} />
                        </button>

                        {/* Pin / Favorite */}
                        <button
                            onClick={() => togglePin && togglePin(id)}
                            style={{ padding: '6px', background: note.isPinned ? 'rgba(251,191,36,0.1)' : 'transparent', border: 'none', color: note.isPinned ? '#fbbf24' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                            title={note.isPinned ? 'Remove from Favorites' : 'Add to Favorites'}
                            onMouseEnter={e => { if (!note.isPinned) { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; } }}
                            onMouseLeave={e => { if (!note.isPinned) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                        >
                            <Star size={16} className={note.isPinned ? 'fill-current' : ''} />
                        </button>

                        {/* Archive */}
                        <button
                            onClick={() => toggleArchive && toggleArchive(id)}
                            style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                            title="Archive note"
                            onMouseEnter={e => { e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Archive size={16} />
                        </button>

                        {/* Delete */}
                        <button onClick={() => setIsDeleteModalOpen(true)}
                            style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                            title="Delete note"
                            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Trash2 size={16} />
                        </button>

                        {/* More menu */}
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setShowMenu(v => !v)}
                                style={{ padding: '6px', background: showMenu ? 'rgba(255,255,255,0.07)' : 'transparent', border: 'none', color: showMenu ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                                onMouseEnter={e => { if (!showMenu) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                                onMouseLeave={e => { if (!showMenu) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                            >
                                <MoreHorizontal size={16} />
                            </button>
                            {showMenu && (
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', width: '200px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: '0 16px 50px rgba(0,0,0,0.7)', padding: '4px 0', zIndex: 20 }}>
                                    {[{ label: 'Duplicate', Icon: Copy, action: handleDuplicate },
                                      { label: 'Download PDF', Icon: Download, action: handleDownloadPDF },
                                      { label: 'Copy link', Icon: showShareTooltip ? Check : Share2, action: () => { handleCopyLink(); setShowMenu(false); }, amber: showShareTooltip },
                                    ].map(({ label, Icon: Ic, action, amber }) => (
                                        <button key={label} onClick={action}
                                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: amber ? 'var(--state-success)' : 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <Ic size={13} style={{ color: 'var(--text-muted)' }} /> {label}
                                        </button>
                                    ))}
                                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 0' }} />
                                    <button onClick={() => { setShowInfoModal(true); setShowMenu(false); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 150ms ease' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Info size={13} style={{ color: 'var(--text-muted)' }} /> Note Info
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Editor area ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-3xl mx-auto px-12 py-10 min-h-full flex flex-col">
                        {/* Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            style={{
                                fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)',
                                border: 'none', outline: 'none', padding: 0, marginBottom: '10px',
                                width: '100%', background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif',
                                lineHeight: 1.15,
                            }}
                            className="placeholder-gray-700 dark:placeholder-gray-700"
                            placeholder="Untitled Note"
                        />

                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 min-h-[28px]">
                            {tags.map(tag => (
                                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.2)', color: '#b8956a', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                                    #{tag}
                                    <button onClick={() => removeTag(tag)}
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(184,149,106,0.5)', cursor: 'pointer', padding: 0, display: 'flex', transition: 'color 150ms ease' }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(184,149,106,0.5)'}
                                    ><X size={10} /></button>
                                </span>
                            ))}
                            {showTagInput ? (
                                <input
                                    autoFocus type="text" value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                                    onBlur={addTag}
                                    placeholder="tag name..."
                                    style={{ padding: '3px 10px', border: '1px solid rgba(184,149,106,0.35)', background: 'rgba(184,149,106,0.08)', color: '#b8956a', fontSize: '11px', fontFamily: 'monospace', outline: 'none', width: '100px', colorScheme: 'dark' }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.6)'}
                                />
                            ) : (
                                <button onClick={() => setShowTagInput(true)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', fontFamily: 'monospace' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.3)'}
                                >
                                    <Tag size={11} /><Plus size={9} /> tag
                                </button>
                            )}
                        </div>

                        {/* Blocks */}
                        <div className="space-y-1 flex-1 pl-8 -ml-8">
                            {blocks.map(block => renderBlock(block))}
                        </div>

                        {/* Add block prompt */}
                        <div
                            style={{ marginTop: '24px', padding: '12px 0', fontSize: '12px', color: 'var(--text-muted)', cursor: 'text', userSelect: 'none', transition: 'color 150ms ease' }}
                            onClick={() => addBlock('text', '')}
                            onMouseEnter={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                Type <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-default)', fontSize: '11px', fontFamily: 'monospace' }}>/</kbd> to insert a block, or click to add text
                            </span>
                        </div>

                        {/* Block type quick-add bar */}
                        <div className="mt-4 flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity flex-wrap">
                            {[
                                { type: 'text', label: 'Text', emoji: 'T' },
                                { type: 'heading', label: 'H1', emoji: 'H1', meta: { level: 1 } },
                                { type: 'code', label: 'Code', emoji: '</>' },
                                { type: 'checklist', label: 'Check', emoji: '☑', content: JSON.stringify([{ id: Date.now(), text: '', done: false }]) },
                                { type: 'toggle', label: 'Toggle', emoji: '▶' },
                                { type: 'callout', label: 'Callout', emoji: '💡' },
                                { type: 'divider', label: 'Divider', emoji: '—' },
                                { type: 'table', label: 'Table', emoji: '⊞' },
                                { type: 'image', label: 'Image', emoji: '🖼' },
                            ].map(({ type, label, emoji, meta, content }) => (
                                <button
                                    key={`${type}-${label}`}
                                    onClick={() => addBlock(type, content ?? '', meta || {})}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <span style={{ fontSize: '11px' }}>{emoji}</span> {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── AI Panel ── */}
            {showAI && (
                <AIPanel
                    blocks={blocks}
                    title={title}
                    onInsertBlock={handleAIInsertBlock}
                    onClose={() => setShowAI(false)}
                />
            )}

            {/* ── Version History Panel ── */}
            {showHistory && (
                <VersionHistoryPanel
                    versions={versions}
                    currentContent={JSON.stringify(blocks)}
                    currentTitle={title}
                    onRestore={handleRestore}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {/* ── Slash Command Menu ── */}
            {slashMenu.open && (
                <SlashCommandMenu
                    position={slashMenu.position}
                    query={slashMenu.query}
                    onSelect={handleSlashSelect}
                    onClose={closeSlashMenu}
                />
            )}

            {/* ── Modals ── */}
            <NoteInfoModal note={note} blocks={blocks} showInfoModal={showInfoModal} setShowInfoModal={setShowInfoModal} />
            {showShareModal && (
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
