import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
    Clock, MoreHorizontal, Trash2, Share2, Star, Sparkles,
    Copy, Download, Printer, Info, Check
} from "lucide-react";
import { useNotes } from "../../contexts/NotesContext";
import ConfirmationModal from "../../components/ui/ConfirmationModal";

const Notes = () => {
    const { id } = useParams();
    const { notes, updateNote, deleteNote, addNote } = useNotes();

    // Find active note
    const note = notes.find(n => n.id === id);

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const [showShareTooltip, setShowShareTooltip] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const menuRef = useRef(null);

    // Sync local state with note data when ID changes
    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content);
        }
    }, [note, id]);

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-save handlers
    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        updateNote(id, { title: newTitle });
    };

    const handleContentChange = (e) => {
        const newContent = e.target.value;
        setContent(newContent);
        updateNote(id, { content: newContent });
    };

    const handleShare = () => {
        // Mock copy link
        navigator.clipboard.writeText(window.location.href);
        setShowShareTooltip(true);
        setTimeout(() => setShowShareTooltip(false), 2000);
    };

    const handleAI = () => {
        alert("✨ Chttrix AI is analyzing your note context to generate a summary draft... (Demo)");
    };

    const handleDuplicate = () => {
        const newNote = addNote();
        updateNote(newNote.id, {
            title: `${title} (Copy)`,
            content: content
        });
        setShowMenu(false);
    };

    const handleDeleteConfirm = () => {
        deleteNote(id);
        setIsDeleteModalOpen(false);
    };

    if (!id || !note) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white text-gray-400">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                    <Star size={40} className="text-gray-300" />
                </div>
                <h2 className="text-xl font-semibold text-gray-600 mb-2">Select a Note</h2>
                <p className="text-sm max-w-xs text-center">Choose a note from the sidebar or create a new one to get started.</p>
            </div>
        );
    }

    const formattedDate = new Date(note.updatedAt).toLocaleString("en-US", {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Toolbar / Header */}
            <div className="h-16 px-8 flex items-center justify-between border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <Clock size={14} />
                    <span>Last edited {formattedDate}</span>
                </div>

                <div className="flex items-center gap-3">

                    {/* AI Button */}
                    <button
                        onClick={handleAI}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-105 transition-all active:scale-95 text-xs font-semibold tracking-wide"
                    >
                        <Sparkles size={14} />
                        <span>AI Draft</span>
                    </button>

                    <div className="h-6 w-px bg-gray-200 mx-1" />

                    {/* Share Button */}
                    <div className="relative">
                        <button
                            onClick={handleShare}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Copy Link"
                        >
                            {showShareTooltip ? <Check size={18} className="text-green-600" /> : <Share2 size={18} />}
                        </button>
                        {showShareTooltip && (
                            <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-20">
                                Link Copied!
                            </div>
                        )}
                    </div>

                    {/* Delete Button */}
                    <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Note"
                    >
                        <Trash2 size={18} />
                    </button>

                    {/* More Menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className={`p-2 rounded-lg transition-colors ${showMenu ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                        >
                            <MoreHorizontal size={18} />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <button
                                    onClick={handleDuplicate}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                >
                                    <Copy size={14} className="text-gray-400" /> Duplicate
                                </button>
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Download size={14} className="text-gray-400" /> Export PDF
                                </button>
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Printer size={14} className="text-gray-400" /> Print
                                </button>
                                <div className="h-px bg-gray-100 my-1" />
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Info size={14} className="text-gray-400" /> Note Info
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto px-8 py-10 min-h-full flex flex-col">

                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        className="text-4xl font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 p-0 mb-6 w-full bg-transparent outline-none"
                        placeholder="Untitled Note"
                    />

                    <textarea
                        value={content}
                        onChange={handleContentChange}
                        className="flex-1 w-full resize-none border-none focus:ring-0 text-gray-700 text-lg leading-relaxed p-0 placeholder-gray-300 bg-transparent outline-none"
                        placeholder="Start typing..."
                        spellCheck={false}
                    />
                </div>
            </div>

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
