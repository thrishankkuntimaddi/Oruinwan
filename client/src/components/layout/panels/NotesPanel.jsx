import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Search, FileText, Clock } from "lucide-react";
import { useNotes } from "../../../contexts/NotesContext";

const NotesPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { notes, addNote, searchQuery, setSearchQuery } = useNotes();
    const [sortOrder, setSortOrder] = useState("newest");

    // Get active note ID from URL path
    const activeId = location.pathname.split("/").pop();

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

    return (
        <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-5 bg-white shrink-0">
                <h2 className="font-bold text-xl text-gray-800 tracking-tight">Notes</h2>
                <button
                    onClick={addNote}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                    title="Create New Note"
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* Search & Sort */}
            <div className="p-4 shrink-0 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search notes..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 focus:outline-none focus:border-blue-500"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="a-z">A-Z</option>
                        <option value="z-a">Z-A</option>
                    </select>
                </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-2">
                {sortedNotes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No notes found</p>
                    </div>
                ) : (
                    sortedNotes.map((note) => (
                        <div
                            key={note.id}
                            onClick={() => navigate(`/notes/${note.id}`)}
                            className={`group p-4 rounded-xl cursor-pointer border transition-all duration-200 relative overflow-hidden
                                ${activeId === note.id
                                    ? "bg-white border-blue-200 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/20"
                                    : "bg-white border-transparent hover:border-gray-200 hover:shadow-sm"
                                }
                            `}
                        >
                            {activeId === note.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                            )}

                            <h3 className={`text-sm font-bold mb-1 truncate ${activeId === note.id ? "text-blue-700" : "text-gray-800"}`}>
                                {note.title || "Untitled Note"}
                            </h3>

                            <p className="text-xs text-gray-500 line-clamp-2 mb-2.5 h-8 leading-relaxed">
                                {note.content || "No additional text"}
                            </p>

                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
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
