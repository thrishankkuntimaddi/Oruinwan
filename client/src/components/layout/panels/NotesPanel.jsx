import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Plus, Search, Star, Archive, MoreHorizontal,
    ChevronRight, ChevronDown, ArchiveRestore,
    ArrowUpDown, BookOpen, Layers, Hash,
    FileText, Trash2, FolderPlus, Lightbulb,
    FolderOpen, Move, Users, ClipboardList,
    FolderKanban, Cpu, Megaphone, StickyNote,
    Check, X
} from "lucide-react";
import api from "../../../services/api";
import { useNotes } from "../../../contexts/NotesContext";
import NoteTemplateModal from "../../../pages/SidebarComp/notesComponents/ui/NoteTemplateModal";

// ─── Note types (Lucide icon components) ──────────────────────────────────────
const NOTE_TYPES = [
    { id: "note", Icon: FileText, color: "text-blue-500", label: "Document" },
    { id: "brainstorm", Icon: Lightbulb, color: "text-amber-500", label: "Brainstorm" },
    { id: "meeting", Icon: Users, color: "text-emerald-500", label: "Meeting Notes" },
    { id: "sop", Icon: ClipboardList, color: "text-orange-500", label: "SOP" },
    { id: "projectspec", Icon: FolderKanban, color: "text-cyan-500", label: "Project Spec" },
    { id: "techdesign", Icon: Cpu, color: "text-slate-500", label: "Tech Design" },
    { id: "announcement", Icon: Megaphone, color: "text-rose-500", label: "Announcement" },
];

// ─── Canvas hook ──────────────────────────────────────────────────────────────
function useCanvasByChannel(workspaceId) {
    const [channels, setChannels] = useState([]);
    const load = useCallback(async () => {
        if (!workspaceId) return;
        try {
            // Must pass workspaceId as query param — the API requires it
            const res = await api.get(`/api/channels/my?workspaceId=${workspaceId}`);
            const all = res.data?.channels || [];
            // Server already scopes to workspace, but filter here too for safety
            const withTabs = await Promise.all(all.map(async ch => {
                try {
                    const tr = await api.get(`/api/channels/${ch._id}/tabs`);
                    const tabs = tr.data?.tabs || [];
                    return { ...ch, canvasTabs: tabs };
                } catch {
                    return { ...ch, canvasTabs: [] };
                }
            }));
            // Only keep channels that actually have canvas tabs
            setChannels(withTabs.filter(ch => ch.canvasTabs.length > 0));
        } catch (e) {
            console.warn('[NotesPanel] useCanvasByChannel fetch failed:', e?.message);
        }
    }, [workspaceId]);
    useEffect(() => { load(); }, [load]);
    return { channels };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPreview(content) {
    if (!content) return "";
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed))
            return parsed
                .filter(b => b.type === "text" || b.type === "heading")
                .map(b => (b.content || "").replace(/<[^>]*>/g, ""))
                .filter(Boolean).join(" ").slice(0, 60);
    } catch { }
    return content.replace(/<[^>]*>/g, "").slice(0, 60);
}

// ─── Bottom accordion (VS Code style) ────────────────────────────────────────
function BottomPanel({ label, icon: Icon, count, isOpen, onToggle, children }) {
    return (
        <div className="border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors
                    ${isOpen ? "bg-gray-50 dark:bg-gray-800/50" : "hover:bg-gray-50 dark:hover:bg-gray-800/30"}`}
            >
                {isOpen
                    ? <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
                    : <ChevronRight size={11} className="text-gray-400 flex-shrink-0" />
                }
                {Icon && <Icon size={12} className="text-gray-400 flex-shrink-0" />}
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex-1">{label}</span>
                {count > 0 && (
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded tabular-nums">{count}</span>
                )}
            </button>
            {isOpen && (
                <div className="max-h-64 overflow-y-auto">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────
function DeleteDialog({ note, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-80 p-6 mx-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <Trash2 size={18} className="text-red-500" />
                </div>
                <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">Delete Note?</h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">
                    "{note?.title || "Untitled"}" will be permanently deleted. This cannot be undone.
                </p>
                <div className="flex gap-2">
                    <button onClick={onCancel}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Move-to picker (inline submenu) ─────────────────────────────────────────
function MovePicker({ groups, noteGroup, onMove, onClose }) {
    return (
        <div className="absolute right-full top-0 mr-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-[70]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 py-1.5">Move to group</p>
            <button
                onClick={() => onMove(null)}
                className={`w-full text-left px-3 py-1.5 text-[12.5px] flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${!noteGroup ? "text-blue-600 font-semibold" : "text-gray-700 dark:text-gray-200"}`}
            >
                No group {!noteGroup && <Check size={12} />}
            </button>
            {groups.map(g => (
                <button key={g}
                    onClick={() => onMove(g)}
                    className={`w-full text-left px-3 py-1.5 text-[12.5px] flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${noteGroup === g ? "text-blue-600 font-semibold" : "text-gray-700 dark:text-gray-200"}`}
                >
                    <span className="flex items-center gap-1.5"><FolderOpen size={11} className="text-gray-400" />{g}</span>
                    {noteGroup === g && <Check size={12} />}
                </button>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const NotesPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const {
        allNotes, activeNotes, archivedNotes,
        addNote, updateNote, deleteNote,
        searchQuery, setSearchQuery,
        togglePin, toggleArchive,
    } = useNotes();

    const { channels: canvasChannels } = useCanvasByChannel(workspaceId);

    // ── Tabs: "workspace" | "canvas" ─────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("workspace");

    // ── Workspace sub-filter: "all" | "favorites" ────────────────────────────
    const [wsFilter, setWsFilter] = useState("all");

    // ── Groups ─ persisted in localStorage so empty groups survive refresh ──────────
    const GROUPS_KEY = `chttrix_note_groups_${workspaceId}`;
    const [groups, setGroups] = useState(() => {
        try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
    });

    // Keep groups in sync: any tag used on a note that isn't in groups list gets added
    useEffect(() => {
        const tagGroups = [...new Set(activeNotes.flatMap(n => n.tags || []).filter(Boolean))];
        setGroups(prev => {
            const merged = [...new Set([...prev, ...tagGroups])];
            if (merged.length !== prev.length) {
                localStorage.setItem(GROUPS_KEY, JSON.stringify(merged));
                return merged;
            }
            return prev;
        });
    }, [activeNotes, GROUPS_KEY]); // eslint-disable-line react-hooks/exhaustive-deps

    const [activeGroup, setActiveGroup] = useState(null); // null = show all
    const [showGroupInput, setShowGroupInput] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    // ── Sort ─────────────────────────────────────────────────────────────────
    const [sortOrder, setSortOrder] = useState("newest");
    const [showSortMenu, setShowSortMenu] = useState(false);

    // ── Modals / menus ────────────────────────────────────────────────────────
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [noteMenu, setNoteMenu] = useState(null); // { noteId, x, y }
    const [showMovePicker, setShowMovePicker] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // note to delete

    // ── Bottom panels ─────────────────────────────────────────────────────────
    const [byTypeOpen, setByTypeOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [activeTypeId, setActiveTypeId] = useState(null);
    const [openChannelId, setOpenChannelId] = useState(null);

    const sortMenuRef = useRef(null);
    const noteMenuRef = useRef(null);
    const groupInputRef = useRef(null);

    const activeId = location.pathname.split("/").pop();

    // Close menus on outside click
    useEffect(() => {
        const h = (e) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false);
            if (noteMenuRef.current && !noteMenuRef.current.contains(e.target)) {
                setNoteMenu(null);
                setShowMovePicker(false);
            }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Focus group input when shown
    useEffect(() => {
        if (showGroupInput) setTimeout(() => groupInputRef.current?.focus(), 50);
    }, [showGroupInput]);

    // ── Derived note list ─────────────────────────────────────────────────────
    const displayNotes = (() => {
        let base = [...activeNotes];
        // Workspace sub-filter
        if (wsFilter === "favorites") base = base.filter(n => n.isPinned);
        // Group filter
        if (activeGroup) base = base.filter(n => (n.tags || []).includes(activeGroup));
        // Search
        if (searchQuery)
            base = base.filter(n =>
                n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.content?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        // Sort
        return base.sort((a, b) => {
            if (sortOrder === "newest") return new Date(b.updatedAt) - new Date(a.updatedAt);
            if (sortOrder === "oldest") return new Date(a.updatedAt) - new Date(b.updatedAt);
            if (sortOrder === "a-z") return (a.title || "").localeCompare(b.title || "");
            if (sortOrder === "z-a") return (b.title || "").localeCompare(a.title || "");
            return 0;
        });
    })();

    const notesByType = (typeId) =>
        activeNotes
            .filter(n => n.type === typeId && (!searchQuery || n.title?.toLowerCase().includes(searchQuery.toLowerCase())))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const displayArchived = searchQuery
        ? archivedNotes.filter(n => n.title?.toLowerCase().includes(searchQuery.toLowerCase()))
        : archivedNotes;

    const totalCanvas = canvasChannels.reduce((s, ch) => s + ch.canvasTabs.length, 0);

    // ── Group create ───────────────────────────────────────────────────
    const handleCreateGroup = () => {
        const name = newGroupName.trim();
        if (!name) { setShowGroupInput(false); return; }
        // Persist group even before any notes are added to it
        setGroups(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
            return next;
        });
        setActiveGroup(name);
        setNewGroupName("");
        setShowGroupInput(false);
    };

    // ── Move note to group ────────────────────────────────────────────────────
    const handleMove = async (groupName) => {
        if (!noteMenu) return;
        const note = allNotes.find(n => n.id === noteMenu.noteId);
        if (!note) return;
        const newTags = groupName
            ? [groupName, ...(note.tags || []).filter(t => !groups.includes(t) || t === groupName)]
            : (note.tags || []).filter(t => !groups.includes(t));
        await updateNote(note.id, { tags: newTags });
        setShowMovePicker(false);
        setNoteMenu(null);
    };

    // ── Template handler ──────────────────────────────────────────────────────
    const handleTemplateSelect = async (template) => {
        setShowTemplateModal(false);
        const noteType = template.id === "blank" ? "note" : (template.id || "note");
        const newNote = await addNote(template.title, noteType);
        if (!newNote) return;
        if (template.blocks?.length > 0) {
            const blocks = template.blocks.map(b => ({ ...b, id: Date.now() + Math.random() }));
            await updateNote(newNote.id, { title: template.title, content: JSON.stringify(blocks), type: noteType });
        }
    };

    // ── Delete note ───────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteNote(deleteTarget.id);
        setDeleteTarget(null);
    };

    // ── Note three-dot menu helper ────────────────────────────────────────────
    const ctxNote = noteMenu ? allNotes.find(n => n.id === noteMenu.noteId) : null;
    const openNoteMenu = (e, noteId) => {
        e.preventDefault();
        e.stopPropagation();
        setNoteMenu({ noteId, x: e.clientX, y: e.clientY });
        setShowMovePicker(false);
    };

    // ── Shared note row renderer ──────────────────────────────────────────────
    const renderNoteRow = (note) => {
        const typeConf = NOTE_TYPES.find(t => t.id === note.type) || NOTE_TYPES[0];
        const isActive = activeId === note.id;
        const preview = getPreview(note.content);
        const noteGroup_ = (note.tags || []).find(t => groups.includes(t)) || null;

        return (
            <div
                key={note.id}
                onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}
                className={`group relative cursor-pointer rounded-xl transition-all select-none
                    ${isActive
                        ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-800/50"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
            >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-full" />}
                <div className={`flex items-start gap-2.5 px-3 py-2.5 ${isActive ? "pl-4" : ""}`}>
                    <typeConf.Icon size={14} className={`mt-1 flex-shrink-0 ${typeConf.color}`} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                            <span className={`text-[12.5px] font-semibold leading-snug line-clamp-1
                                ${isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-100"}`}>
                                {note.title || "Untitled"}
                            </span>
                            <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0 mt-0.5">{formatDate(note.updatedAt)}</span>
                        </div>
                        {preview && <p className="text-[11px] text-gray-400 truncate mt-0.5">{preview}</p>}
                        <div className="flex items-center gap-2 mt-0.5">
                            {note.isPinned && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-medium">
                                    <Star size={8} className="fill-current" /> Starred
                                </span>
                            )}
                            {noteGroup_ && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-500 font-medium">
                                    <FolderOpen size={8} /> {noteGroup_}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* ⋯ three-dot button */}
                    <button
                        onClick={e => openNoteMenu(e, note.id)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 mt-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all"
                        title="Options"
                    >
                        <MoreHorizontal size={13} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

                {/* ── Header ── */}
                <div className="h-13 px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <BookOpen size={15} className="text-gray-500 dark:text-gray-400" />
                        <span className="font-bold text-[14.5px] text-gray-900 dark:text-white tracking-tight">Notes</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="relative" ref={sortMenuRef}>
                            <button onClick={() => setShowSortMenu(v => !v)}
                                className={`p-1.5 rounded-lg transition-colors ${showSortMenu ? "bg-gray-100 dark:bg-gray-800 text-gray-700" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                                <ArrowUpDown size={13} />
                            </button>
                            {showSortMenu && (
                                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-30">
                                    {[["newest", "Newest"], ["oldest", "Oldest"], ["a-z", "A–Z"], ["z-a", "Z–A"]].map(([v, l]) => (
                                        <button key={v} onClick={() => { setSortOrder(v); setShowSortMenu(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors
                                            ${sortOrder === v ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowTemplateModal(true)}
                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95">
                            <Plus size={12} strokeWidth={2.5} /> New
                        </button>
                    </div>
                </div>

                {/* ── Tab strip: Workspace | Channel Canvas ── */}
                <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
                    {[
                        { id: "workspace", label: "Workspace", count: activeNotes.length },
                        { id: "canvas", label: "Channel Canvas", count: totalCanvas },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition-all relative
                            ${activeTab === tab.id
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
                        >
                            {tab.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums
                            ${activeTab === tab.id ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                                {tab.count}
                            </span>
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Search ── */}
                <div className="px-3 pt-2.5 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
                        <input type="text" placeholder="Search…" value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12px] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={11} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════
                TAB CONTENT
                ══════════════════════════════════════ */}

                {activeTab === "workspace" ? (
                    <>
                        {/* ── Filter bar: All | Favorites | + Group ── */}
                        {/* ── Filter bar: All | Starred | group pills | + ── */}
                        <div className="px-3 pb-2.5 flex items-center gap-2 shrink-0">
                            {/* Scrollable pill strip */}
                            <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 no-scrollbar">
                                {/* All pill */}
                                <button
                                    onClick={() => { setWsFilter("all"); setActiveGroup(null); }}
                                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all border
                        ${wsFilter === "all" && !activeGroup
                                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                                >
                                    All
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums
                        ${wsFilter === "all" && !activeGroup ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>
                                        {activeNotes.length}
                                    </span>
                                </button>

                                {/* Starred pill */}
                                <button
                                    onClick={() => { setWsFilter("favorites"); setActiveGroup(null); }}
                                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all border
                        ${wsFilter === "favorites" && !activeGroup
                                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                                >
                                    <Star size={11} className={wsFilter === "favorites" && !activeGroup ? "fill-current" : ""} />
                                    Starred
                                </button>

                                {/* Group pills — inline, same weight as All/Starred */}
                                {groups.map(g => (
                                    <button key={g}
                                        onClick={() => setActiveGroup(activeGroup === g ? null : g)}
                                        className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all border
                            ${activeGroup === g
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                : "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400"}`}
                                    >
                                        <FolderOpen size={11} /> {g}
                                    </button>
                                ))}
                            </div>

                            {/* + create group — pinned right */}
                            <button
                                onClick={() => setShowGroupInput(v => !v)}
                                className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition-colors
                    ${showGroupInput
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:border-gray-300 hover:text-gray-700"}`}
                                title="Create group"
                            >
                                <Plus size={13} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Group name input */}
                        {showGroupInput && (
                            <div className="px-3 pb-2 shrink-0">
                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5">
                                    <FolderPlus size={12} className="text-gray-400 flex-shrink-0" />
                                    <input
                                        ref={groupInputRef}
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") handleCreateGroup(); if (e.key === "Escape") setShowGroupInput(false); }}
                                        placeholder="Group name…"
                                        className="flex-1 bg-transparent text-[12px] text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
                                    />
                                    <button onClick={handleCreateGroup}
                                        className="text-blue-600 text-[11px] font-semibold hover:text-blue-700 flex-shrink-0">
                                        Create
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Scrollable note list ── */}
                        <div className="flex-1 overflow-y-auto px-3 pb-2">
                            {activeGroup && (
                                <p className="text-[9.5px] font-bold uppercase tracking-widest text-indigo-400 px-1 pt-1 pb-1.5 flex items-center gap-1">
                                    <FolderOpen size={10} /> {activeGroup}
                                </p>
                            )}
                            {!activeGroup && (
                                <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-1 pt-1 pb-1.5">
                                    Workspace Notes
                                </p>
                            )}

                            {displayNotes.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2 text-center">
                                    <StickyNote size={22} className="text-gray-200 dark:text-gray-700" />
                                    <p className="text-[11.5px] text-gray-400 dark:text-gray-500">
                                        {wsFilter === "favorites" ? "No starred notes" :
                                            activeGroup ? `No notes in "${activeGroup}"` :
                                                searchQuery ? `No results for "${searchQuery}"` : "No notes yet"}
                                    </p>
                                    {!searchQuery && wsFilter === "all" && !activeGroup && (
                                        <button onClick={() => setShowTemplateModal(true)}
                                            className="text-[11px] text-blue-600 font-semibold hover:underline">
                                            + Create first note
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {displayNotes.map(renderNoteRow)}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* ── CANVAS TAB ── */
                    <div className="flex-1 overflow-y-auto px-3 pb-2">
                        <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-1 pt-1 pb-1.5">
                            Channel Canvases
                        </p>

                        {canvasChannels.length === 0 ? (
                            <div className="py-10 flex flex-col items-center gap-2 text-center">
                                <StickyNote size={22} className="text-gray-200 dark:text-gray-700" />
                                <p className="text-[11.5px] text-gray-400">No canvas documents yet</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {canvasChannels.map(ch => {
                                    const isOpen = openChannelId === ch._id;
                                    const chName = (ch.name || "channel").replace(/^#/, "");
                                    const filtered = searchQuery
                                        ? ch.canvasTabs.filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                        : ch.canvasTabs;
                                    if (searchQuery && filtered.length === 0) return null;

                                    return (
                                        <div key={ch._id}>
                                            <button
                                                onClick={() => setOpenChannelId(isOpen ? null : ch._id)}
                                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all
                                                ${isOpen ? "bg-gray-50 dark:bg-gray-800/60" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}`}
                                            >
                                                {isOpen ? <ChevronDown size={10} className="text-gray-400" /> : <ChevronRight size={10} className="text-gray-400" />}
                                                <Hash size={11} className="text-gray-400 flex-shrink-0" />
                                                <span className="flex-1 text-[12.5px] font-semibold text-gray-700 dark:text-gray-200 truncate">{chName}</span>
                                                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 tabular-nums">{ch.canvasTabs.length}</span>
                                            </button>

                                            {isOpen && (
                                                <div className="pl-5 space-y-0.5 pt-0.5 pb-1">
                                                    {filtered.map(tab => {
                                                        const isTabActive = activeId === tab._id;
                                                        return (
                                                            <button key={tab._id}
                                                                onClick={() => navigate(`/workspace/${workspaceId}/channel/${ch._id}`, { state: { openTabId: tab._id } })}
                                                                className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg transition-all relative
                                                                ${isTabActive
                                                                        ? "bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-200 dark:ring-indigo-800/50"
                                                                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"}`}
                                                            >
                                                                {isTabActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-indigo-500 rounded-full" />}
                                                                <span className="text-[12px] flex-shrink-0 mt-0.5">{tab.emoji || "📄"}</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className={`text-[12px] font-medium truncate leading-tight
                                                                    ${isTabActive ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-200"}`}>
                                                                        {tab.name || "Untitled Canvas"}
                                                                    </p>
                                                                    {tab.lastEditedAt && (
                                                                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(tab.lastEditedAt)}</p>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════════════════════════════════
                BOTTOM FIXED PANELS
                ════════════════════════════════════════ */}
                <div className="shrink-0">

                    {/* ── BY TYPE ── */}
                    <BottomPanel
                        label="By Type" icon={Layers}
                        count={activeNotes.length}
                        isOpen={byTypeOpen}
                        onToggle={() => { setByTypeOpen(v => !v); if (!byTypeOpen) setArchiveOpen(false); }}
                    >
                        <div className="px-2 pb-2 space-y-0.5">
                            {NOTE_TYPES.map(t => {
                                const cnt = activeNotes.filter(n => n.type === t.id).length;
                                const isOpen = activeTypeId === t.id;
                                const tNotes = notesByType(t.id);
                                return (
                                    <div key={t.id}>
                                        <button
                                            onClick={() => setActiveTypeId(isOpen ? null : t.id)}
                                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all
                                            ${isOpen ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60"}`}
                                        >
                                            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                            <t.Icon size={13} className={`flex-shrink-0 ${isOpen ? "text-blue-500" : t.color}`} />
                                            <span className={`flex-1 text-[12px] font-medium ${isOpen ? "text-blue-700 dark:text-blue-400" : ""}`}>{t.label}</span>
                                            {cnt > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded tabular-nums font-semibold
                                                ${isOpen ? "bg-blue-100 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>{cnt}</span>
                                            )}
                                        </button>

                                        {isOpen && (
                                            <div className="pl-4 space-y-0.5 pt-0.5 max-h-40 overflow-y-auto">
                                                {tNotes.length === 0 ? (
                                                    <p className="text-[11px] text-gray-400 px-2 py-2 italic">No {t.label} notes</p>
                                                ) : tNotes.map(renderNoteRow)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </BottomPanel>

                    {/* ── ARCHIVE ── */}
                    <BottomPanel
                        label="Archive" icon={Archive}
                        count={archivedNotes.length}
                        isOpen={archiveOpen}
                        onToggle={() => { setArchiveOpen(v => !v); if (!archiveOpen) setByTypeOpen(false); }}
                    >
                        <div className="px-2 pb-2 space-y-0.5">
                            {displayArchived.length === 0 ? (
                                <p className="text-[11.5px] text-center text-gray-400 py-4 italic">Archive is empty</p>
                            ) : (
                                displayArchived.map(note => {
                                    const typeConf = NOTE_TYPES.find(t => t.id === note.type) || NOTE_TYPES[0];
                                    return (
                                        <div key={note.id}
                                            className="group flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                                            onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}>
                                            <typeConf.Icon size={13} className={`flex-shrink-0 opacity-50 ${typeConf.color}`} />
                                            <span className="flex-1 text-[12px] text-gray-400 truncate">{note.title || "Untitled"}</span>
                                            <button onClick={e => { e.stopPropagation(); toggleArchive(note.id); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-all" title="Restore">
                                                <ArchiveRestore size={12} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </BottomPanel>
                </div>
            </div>

            {/* ── Three-dot context menu (horizontal ⋯) ── */}
            {noteMenu && ctxNote && (
                <div
                    ref={noteMenuRef}
                    className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 py-1 w-48"
                    style={{
                        left: Math.min(noteMenu.x, window.innerWidth - 200),
                        top: Math.min(noteMenu.y, window.innerHeight - 200),
                    }}
                >
                    <button onClick={() => { navigate(`/workspace/${workspaceId}/notes/${ctxNote.id}`); setNoteMenu(null); }}
                        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors">
                        <FileText size={13} className="text-gray-400" /> Open
                    </button>
                    <button onClick={() => { togglePin(ctxNote.id); setNoteMenu(null); }}
                        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors">
                        <Star size={13} className={ctxNote.isPinned ? "text-amber-500 fill-current" : "text-gray-400"} />
                        {ctxNote.isPinned ? "Unstar" : "Star"}
                    </button>

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

                    {/* Move to ▶ */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMovePicker(v => !v)}
                            className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                        >
                            <Move size={13} className="text-gray-400" /> Move to…
                            <ChevronRight size={11} className="ml-auto text-gray-400" />
                        </button>
                        {showMovePicker && (
                            <MovePicker
                                groups={groups}
                                noteGroup={(ctxNote.tags || []).find(t => groups.includes(t)) || null}
                                onMove={handleMove}
                                onClose={() => setShowMovePicker(false)}
                            />
                        )}
                    </div>

                    {/* Archive */}
                    <button onClick={() => { toggleArchive(ctxNote.id); setNoteMenu(null); }}
                        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors">
                        {ctxNote.isArchived
                            ? <><ArchiveRestore size={13} className="text-gray-400" /> Restore</>
                            : <><Archive size={13} className="text-gray-400" /> Archive</>
                        }
                    </button>

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

                    {/* Delete */}
                    <button
                        onClick={() => { setDeleteTarget(ctxNote); setNoteMenu(null); }}
                        className="w-full text-left px-3 py-2 text-[12.5px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition-colors"
                    >
                        <Trash2 size={13} /> Delete
                    </button>
                </div>
            )}

            {/* ── Delete confirmation dialog ── */}
            {deleteTarget && (
                <DeleteDialog
                    note={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {/* ── Template modal ── */}
            {showTemplateModal && (
                <NoteTemplateModal onSelect={handleTemplateSelect} onClose={() => setShowTemplateModal(false)} />
            )}
        </>
    );
};

export default NotesPanel;
