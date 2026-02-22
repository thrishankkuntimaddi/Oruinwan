import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Plus, Search, FileText, Clock, ArrowUpDown, Tag, X } from "lucide-react";
import { useNotes } from "../../../contexts/NotesContext";
import NoteTemplateModal from "../../../pages/SidebarComp/notesComponents/ui/NoteTemplateModal";

const NOTE_TYPE_CONFIG = {
    note: { emoji: '📄', label: 'Document' },
    brainstorm: { emoji: '🧠', label: 'Brainstorm' },
    meeting: { emoji: '📋', label: 'Meeting' },
    sop: { emoji: '📋', label: 'SOP' },
    projectspec: { emoji: '🗂', label: 'Project Spec' },
    techdesign: { emoji: '🛠', label: 'Tech Design' },
    announcement: { emoji: '📢', label: 'Announcement' },
};

const NotesPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const {
        allNotes,
        notes,
        addNote,
        updateNote,
        searchQuery,
        setSearchQuery,
        activeTagFilter,
        setActiveTagFilter,
    } = useNotes();

    const [sortOrder, setSortOrder] = useState("newest");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const sortMenuRef = useRef(null);

    const activeId = location.pathname.split("/").pop();

    // Close sort menu when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Collect all unique tags from allNotes
    const allTags = [...new Set((allNotes || []).flatMap(n => n.tags || []))].sort();

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const sortedNotes = [...notes].sort((a, b) => {
        if (sortOrder === "newest") return new Date(b.updatedAt) - new Date(a.updatedAt);
        if (sortOrder === "oldest") return new Date(a.updatedAt) - new Date(b.updatedAt);
        if (sortOrder === "a-z") return (a.title || "").localeCompare(b.title || "");
        if (sortOrder === "z-a") return (b.title || "").localeCompare(a.title || "");
        return 0;
    });

    const getPreviewText = (content) => {
        if (!content) return "No content";
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                const text = parsed
                    .filter(b => b.type === 'text' || b.type === 'heading')
                    .map(b => (b.content || '').replace(/<[^>]*>/g, ''))
                    .filter(Boolean)
                    .join(' ');
                return text || "No text content";
            }
        } catch { }
        return content.slice(0, 80) || "No content";
    };

    const handleTemplateSelect = async (template) => {
        setShowTemplateModal(false);
        const newNote = await addNote(template.title, 'note');
        if (!newNote) return;
        if (template.blocks && template.blocks.length > 0) {
            const blocksWithIds = template.blocks.map(b => ({ ...b, id: Date.now() + Math.random() }));
            await updateNote(newNote.id, {
                title: template.title,
                content: JSON.stringify(blocksWithIds),
                type: template.id === 'blank' ? 'note' : (template.id || 'note'),
            });
        }
    };

    const typeConf = (type) => NOTE_TYPE_CONFIG[type] || NOTE_TYPE_CONFIG.note;

    return (
        <>
            <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-5 bg-white dark:bg-gray-900 shrink-0">
                    <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">Notes</h2>
                    <div className="flex items-center gap-1">
                        {/* Sort */}
                        <div className="relative" ref={sortMenuRef}>
                            <button
                                onClick={() => setShowSortMenu(v => !v)}
                                className={`p-2 rounded-lg transition-colors ${showSortMenu ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                                title="Sort"
                            >
                                <ArrowUpDown size={18} />
                            </button>
                            {showSortMenu && (
                                <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                    {[['newest', 'Newest First'], ['oldest', 'Oldest First'], ['a-z', 'A–Z'], ['z-a', 'Z–A']].map(([val, label]) => (
                                        <button key={val} onClick={() => { setSortOrder(val); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortOrder === val ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" : "text-gray-700 dark:text-gray-300"}`}>{label}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* New Note */}
                        <button
                            onClick={() => setShowTemplateModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 ml-1"
                            title="Create New Note"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 pt-4 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            placeholder="Search notes..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Tag filter chips */}
                {allTags.length > 0 && (
                    <div className="px-4 pb-3 shrink-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => setActiveTagFilter(null)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${!activeTagFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >
                                All
                            </button>
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${activeTagFilter === tag ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                >
                                    <Tag size={9} /> #{tag}
                                    {activeTagFilter === tag && <X size={9} />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Notes list */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-2">
                    {sortedNotes.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                            <FileText size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">{activeTagFilter ? `No notes tagged #${activeTagFilter}` : 'No notes found'}</p>
                            {activeTagFilter && (
                                <button onClick={() => setActiveTagFilter(null)} className="mt-2 text-xs text-blue-500 hover:underline">Clear filter</button>
                            )}
                        </div>
                    ) : (
                        sortedNotes.map(note => {
                            const tc = typeConf(note.type);
                            const isActive = activeId === note.id;
                            return (
                                <div
                                    key={note.id}
                                    onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}
                                    className={`group cursor-pointer border rounded-xl transition-all duration-200 relative overflow-hidden ${isActive
                                        ? "bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700/50 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/20 pb-2"
                                        : "bg-white dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm"
                                        }`}
                                >
                                    {/* Active indicator bar */}
                                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />}

                                    {/* Always-visible row: type badge + title */}
                                    <div className="flex items-center gap-2 px-3.5 py-2.5">
                                        <span className="text-base leading-none flex-shrink-0">{tc.emoji}</span>
                                        <h3 className={`text-sm font-semibold truncate flex-1 leading-tight ${isActive ? "text-blue-700 dark:text-blue-400" : "text-gray-800 dark:text-gray-100"}`}>
                                            {note.title || "Untitled Note"}
                                        </h3>
                                    </div>

                                    {/* Hover / active expand: preview + tags + date */}
                                    <div className={`overflow-hidden transition-all duration-200 ease-out ${isActive ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 group-hover:max-h-40 group-hover:opacity-100'}`}>
                                        <div className="px-3.5 pb-2.5">
                                            {/* Preview */}
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-1.5">
                                                {getPreviewText(note.content)}
                                            </p>

                                            {/* Tags */}
                                            {note.tags && note.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-1.5">
                                                    {note.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-full text-[10px] font-medium">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                    {note.tags.length > 3 && (
                                                        <span className="text-[10px] text-gray-400">+{note.tags.length - 3}</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Date */}
                                            <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                                <Clock size={9} />
                                                {formatDate(note.updatedAt)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Template picker modal */}
            {showTemplateModal && (
                <NoteTemplateModal
                    onSelect={handleTemplateSelect}
                    onClose={() => setShowTemplateModal(false)}
                />
            )}
        </>
    );
};

export default NotesPanel;
