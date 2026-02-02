import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Plus, Search, FileText, Clock, ArrowUpDown } from "lucide-react";
import { useNotes } from "../../../contexts/NotesContext";

const NotesPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const { notes, addNote, searchQuery, setSearchQuery } = useNotes();
    const [sortOrder, setSortOrder] = useState("newest");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const sortMenuRef = useRef(null);

    // Get active note ID from URL path
    const activeId = location.pathname.split("/").pop();

    // Close sort menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
                setShowSortMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const sortedNotes = [...notes].sort((a, b) => {
        if (sortOrder === "newest") return new Date(b.updatedAt) - new Date(a.updatedAt); // ✅ Fixed: b - a for descending
        if (sortOrder === "oldest") return new Date(a.updatedAt) - new Date(b.updatedAt); // ✅ Fixed: a - b for ascending
        if (sortOrder === "a-z") return (a.title || "").localeCompare(b.title || "");
        if (sortOrder === "z-a") return (b.title || "").localeCompare(a.title || "");
        return 0;
    });

    const getPreviewText = (content) => {
        if (!content) return "No additional text";
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                const textContent = parsed
                    .filter(block => block.type === 'text')
                    .map(block => block.content)
                    .join(' ');
                return textContent || "No text content";
            }
            return content;
        } catch (e) {
            return content;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-5 bg-white dark:bg-gray-900 shrink-0">
                <h2 className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">Notes</h2>
                <div className="flex items-center gap-1">


                    {/* Sort Dropdown */}
                    <div className="relative" ref={sortMenuRef}>
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className={`p-2 rounded-lg transition-colors ${showSortMenu ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                            title="Sort"
                        >
                            <ArrowUpDown size={20} />
                        </button>

                        {showSortMenu && (
                            <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <button onClick={() => { setSortOrder("newest"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortOrder === "newest" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" : "text-gray-700 dark:text-gray-300"}`}>Newest First</button>
                                <button onClick={() => { setSortOrder("oldest"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortOrder === "oldest" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" : "text-gray-700 dark:text-gray-300"}`}>Oldest First</button>
                                <button onClick={() => { setSortOrder("a-z"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortOrder === "a-z" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" : "text-gray-700 dark:text-gray-300"}`}>A-Z</button>
                                <button onClick={() => { setSortOrder("z-a"); setShowSortMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${sortOrder === "z-a" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" : "text-gray-700 dark:text-gray-300"}`}>Z-A</button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={addNote}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 ml-2"
                        title="Create New Note"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="p-4 shrink-0 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-2">
                {sortedNotes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No notes found</p>
                    </div>
                ) : (
                    sortedNotes.map((note) => (
                        <div
                            key={note.id}
                            onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}
                            className={`group p-4 rounded-xl cursor-pointer border transition-all duration-200 relative overflow-hidden
                                ${activeId === note.id
                                    ? "bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700/50 shadow-md shadow-blue-500/5 dark:shadow-blue-900/20 ring-1 ring-blue-500/20 dark:ring-blue-700/30"
                                    : "bg-white dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm"
                                }
                            `}
                        >
                            {activeId === note.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                            )}

                            <h3 className={`text-sm font-bold mb-1 truncate ${activeId === note.id ? "text-blue-700 dark:text-blue-400" : "text-gray-800 dark:text-gray-100"}`}>
                                {note.title || "Untitled Note"}
                            </h3>

                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2.5 h-8 leading-relaxed">
                                {getPreviewText(note.content)}
                            </p>

                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                <Clock size={10} />
                                {formatDate(note.updatedAt)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotesPanel;
