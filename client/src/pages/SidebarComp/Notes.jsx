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
import SlashCommandMenu from "./notesComponents/ui/SlashCommandMenu";
import AIPanel from "./notesComponents/ui/AIPanel";
import VersionHistoryPanel from "./notesComponents/ui/VersionHistoryPanel";

// Icons
import {
    Sparkles, Share2, Check, Trash2, MoreHorizontal, Copy, Download,
    Info, Clock, Tag, X, Plus, ChevronDown, History, GripVertical
} from "lucide-react";

const NOTE_TYPE_CONFIG = {
    note: { emoji: '📄', label: 'Document', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    brainstorm: { emoji: '🧠', label: 'Brainstorm', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    meeting: { emoji: '📋', label: 'Meeting', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    sop: { emoji: '📋', label: 'SOP', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    projectspec: { emoji: '🗂', label: 'Project Spec', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
    techdesign: { emoji: '🛠', label: 'Tech Design', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400' },
    announcement: { emoji: '📢', label: 'Announcement', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};
const DEFAULT_TYPE = NOTE_TYPE_CONFIG.note;

const Notes = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { notes, updateNote, deleteNote, addNote, loading, noteVersions, addVersion } = useNotes();
    const { showToast } = useToast();

    // Navigate from universal search
    useEffect(() => {
        const noteIdParam = searchParams.get('noteId');
        if (noteIdParam && noteIdParam !== id) navigate(`/workspace/${workspaceId}/notes/${noteIdParam}`, { replace: true });
    }, [searchParams, id, workspaceId, navigate]);

    const note = notes.find(n => n.id === id);

    // ── Editor State ──────────────────────────────────────────────────────────
    const [title, setTitle] = useState("");
    const [blocks, setBlocks] = useState([]);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    // ── UI State ──────────────────────────────────────────────────────────────
    const [showMenu, setShowMenu] = useState(false);
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
    const handleShare = () => {
        navigator.clipboard.writeText(`${window.location.origin}/workspace/${workspaceId}/notes/${id}`);
        setShowShareTooltip(true);
        setTimeout(() => setShowShareTooltip(false), 2000);
        showToast("Link copied to clipboard", "success");
    };

    // ── Duplicate ─────────────────────────────────────────────────────────────
    const handleDuplicate = async () => {
        const newNote = await addNote();
        if (!newNote) return;
        await updateNote(newNote.id, { title: `${title} (Copy)`, content: JSON.stringify(blocks), tags });
        setShowMenu(false);
        showToast("Note duplicated", "success");
    };

    // ── PDF download ──────────────────────────────────────────────────────────
    const handleDownloadPDF = () => {
        const textContent = blocks.filter(b => b.type === 'text').map(b => `<p style="white-space:pre-wrap;margin-bottom:12px;">${(b.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');
        const imageContent = blocks.filter(b => b.type === 'image' && b.content).map(b => `<img src="${b.content}" style="max-width:100%;margin-bottom:12px;border-radius:8px;" />`).join('');
        const headingsContent = blocks.filter(b => b.type === 'heading').map(b => `<h${b.meta?.level || 2} style="margin:16px 0 8px;">${(b.content || '').replace(/&/g, '&amp;')}</h${b.meta?.level || 2}>`).join('');

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<!DOCTYPE html><html><head><title>${title || 'Untitled Note'}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:32px;font-weight:700;margin-bottom:8px}.meta{color:#888;font-size:13px;margin-bottom:24px}.tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px}.tag{background:#eff6ff;color:#1d4ed8;padding:2px 10px;border-radius:20px;font-size:12px}@media print{body{margin:0}}</style></head><body><h1>${(title || 'Untitled Note').replace(/&/g, '&amp;')}</h1><div class="meta">Last edited: ${new Date(note?.updatedAt).toLocaleString()}</div>${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">#${t}</span>`).join('')}</div>` : ''}${headingsContent}${textContent}${imageContent}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);
        printWindow.document.close();
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
                className={`relative group/block transition-all ${dragOverId === block.id ? 'ring-2 ring-blue-400 ring-offset-2 rounded-lg' : ''}`}
                draggable
                onDragStart={e => handleDragStart(e, block.id)}
                onDragOver={e => handleDragOver(e, block.id)}
                onDrop={e => handleDrop(e, block.id)}
                onDragLeave={() => setDragOverId(null)}
            >
                {/* Drag handle */}
                <div className="absolute -left-7 top-2 opacity-0 group-hover/block:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-10">
                    <GripVertical size={14} className="text-gray-400" />
                </div>
                {el}
            </div>
        );
    };

    return (
        <div className="flex h-full bg-white dark:bg-gray-900 relative overflow-hidden">
            {/* Main editor column */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* ── Toolbar ── */}
                <div className="h-14 px-8 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 z-10 relative">
                    <div className="flex items-center gap-3">
                        {/* Note type badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${typeConf.color}`}>
                            {typeConf.emoji} {typeConf.label}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <Clock size={12} />
                            <span className="hidden sm:block">{formattedDate}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* AI button */}
                        <button
                            onClick={() => { setShowAI(v => !v); setShowHistory(false); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showAI ? 'bg-violet-600 text-white shadow-md' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-105'}`}
                        >
                            <Sparkles size={13} /> AI
                        </button>

                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

                        {/* Share */}
                        <button onClick={handleShare} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Copy link">
                            {showShareTooltip ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
                        </button>

                        {/* History */}
                        <button
                            onClick={() => { setShowHistory(v => !v); setShowAI(false); }}
                            className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            title="Version history"
                        >
                            <History size={16} />
                        </button>

                        {/* Delete */}
                        <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete note">
                            <Trash2 size={16} />
                        </button>

                        {/* More menu */}
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setShowMenu(v => !v)} className={`p-2 rounded-lg transition-colors ${showMenu ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                <MoreHorizontal size={16} />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                    <button onClick={handleDuplicate} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"><Copy size={14} className="text-gray-400" /> Duplicate</button>
                                    <button onClick={handleDownloadPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"><Download size={14} className="text-gray-400" /> Download PDF</button>
                                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                    <button onClick={() => { setShowInfoModal(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"><Info size={14} className="text-gray-400" /> Note Info</button>
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
                            className="text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 border-none focus:ring-0 p-0 mb-3 w-full bg-transparent outline-none"
                            placeholder="Untitled Note"
                        />

                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 min-h-[28px]">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                                    #{tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors ml-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            {showTagInput ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
                                    onBlur={addTag}
                                    placeholder="tag name..."
                                    className="px-2 py-1 border border-blue-300 dark:border-blue-600 rounded-full text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 outline-none focus:ring-1 focus:ring-blue-400 w-28"
                                />
                            ) : (
                                <button onClick={() => setShowTagInput(true)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
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
                            className="mt-6 py-3 text-sm text-gray-300 dark:text-gray-600 cursor-text hover:text-gray-400 dark:hover:text-gray-500 transition-colors select-none"
                            onClick={() => {
                                const rect = { x: 120, y: 400 };
                                addBlock('text', '');
                            }}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                Type <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">/</kbd> to insert a block, or click to add text
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
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium transition-colors"
                                >
                                    <span className="text-[11px]">{emoji}</span> {label}
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
