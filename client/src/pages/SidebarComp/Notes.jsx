import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
    Clock, MoreHorizontal, Trash2, Share2, Star, Sparkles,
    Copy, Download, Info, Check, Type, Image as ImageIcon, Video, Mic
} from "lucide-react";
import { useNotes } from "../../contexts/NotesContext";
import { useToast } from "../../contexts/ToastContext";
import ConfirmationModal from "../../components/ui/ConfirmationModal";

const Notes = () => {
    const { id } = useParams();
    const { notes, updateNote, deleteNote, addNote } = useNotes();
    const { showToast } = useToast();

    // Find active note
    const note = notes.find(n => n.id === id);

    const [title, setTitle] = useState("");
    const [blocks, setBlocks] = useState([]); // [{ id, type, content }]
    const [showMenu, setShowMenu] = useState(false);
    const [showShareTooltip, setShowShareTooltip] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const menuRef = useRef(null);

    // Sync local state with note data when ID changes
    useEffect(() => {
        if (note) {
            setTitle(note.title);
            try {
                // Try to parse content as JSON blocks, otherwise treat as single text block
                const parsed = JSON.parse(note.content);
                if (Array.isArray(parsed)) {
                    setBlocks(parsed);
                } else {
                    setBlocks([{ id: Date.now(), type: "text", content: note.content }]);
                }
            } catch (e) {
                setBlocks([{ id: Date.now(), type: "text", content: note.content || "" }]);
            }
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

    const updateBlocks = (newBlocks) => {
        setBlocks(newBlocks);
        // Persist as JSON string
        updateNote(id, { content: JSON.stringify(newBlocks) });
    };

    const handleBlockChange = (blockId, newContent) => {
        const newBlocks = blocks.map(b => b.id === blockId ? { ...b, content: newContent } : b);
        updateBlocks(newBlocks);
    };

    const addBlock = (type) => {
        const newBlock = { id: Date.now(), type, content: "" };
        updateBlocks([...blocks, newBlock]);
    };

    const removeBlock = (blockId) => {
        const newBlocks = blocks.filter(b => b.id !== blockId);
        updateBlocks(newBlocks);
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setShowShareTooltip(true);
        setTimeout(() => setShowShareTooltip(false), 2000);
        showToast("Link copied to clipboard", "success");
    };

    const handleAI = () => {
        showToast("AI Draft generation coming soon!", "info");
    };

    const handleDuplicate = () => {
        const newNote = addNote();
        updateNote(newNote.id, {
            title: `${title} (Copy)`,
            content: JSON.stringify(blocks)
        });
        setShowMenu(false);
        showToast("Note duplicated", "success");
    };

    const handleDownloadPDF = () => {
        showToast("Downloading PDF...", "success");
        // Mock download
        setTimeout(() => showToast("Download complete", "success"), 1000);
        setShowMenu(false);
    };

    const handleDeleteConfirm = () => {
        deleteNote(id);
        setIsDeleteModalOpen(false);
        showToast("Note deleted", "success");
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
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="flex flex-col h-full bg-white relative">
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
                                <button onClick={handleDuplicate} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Copy size={14} className="text-gray-400" /> Duplicate
                                </button>
                                <button onClick={handleDownloadPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <Download size={14} className="text-gray-400" /> Download PDF
                                </button>
                                <div className="h-px bg-gray-100 my-1" />
                                <button onClick={() => { setShowInfoModal(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 transition-colors">
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

                    <div className="space-y-4">
                        {blocks.map((block) => (
                            <div key={block.id} className="group relative mb-4">
                                {block.type === "text" && (
                                    <div className="relative">
                                        <textarea
                                            value={block.content}
                                            onChange={(e) => handleBlockChange(block.id, e.target.value)}
                                            className="w-full resize-none border-none focus:ring-0 text-gray-700 text-lg leading-relaxed p-0 placeholder-gray-300 bg-transparent outline-none min-h-[1.5em] overflow-hidden pr-8"
                                            placeholder="Type something..."
                                            onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                        />
                                        <button
                                            onClick={() => removeBlock(block.id)}
                                            className="absolute top-0 right-0 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete text block"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                                {block.type === "image" && (
                                    <div className="w-1/2 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative group-hover:shadow-sm transition-all">
                                        <div className="h-64 flex items-center justify-center text-gray-400 relative">
                                            {block.content ? (
                                                <img src={block.content} alt="Note" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    <ImageIcon size={32} />
                                                    <span className="text-sm mt-2">Image Placeholder</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeBlock(block.id)}
                                                className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                title="Delete image"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {block.type === "video" && (
                                    <div className="w-1/2 rounded-xl overflow-hidden bg-gray-900 border border-gray-200 relative group">
                                        <div className="h-64 flex items-center justify-center text-gray-500 relative">
                                            <div className="flex flex-col items-center">
                                                <Video size={32} />
                                                <span className="text-sm mt-2">Video Placeholder</span>
                                            </div>
                                            <button
                                                onClick={() => removeBlock(block.id)}
                                                className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                title="Delete video"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {block.type === "audio" && (
                                    <div className="w-1/2 rounded-xl bg-gray-50 border border-gray-200 p-4 flex items-center gap-3 group">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                            <Mic size={20} />
                                        </div>
                                        <div className="h-1 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                            <div className="w-1/3 h-full bg-blue-500"></div>
                                        </div>
                                        <span className="text-xs font-mono text-gray-500">00:00 / 02:30</span>
                                        <button
                                            onClick={() => removeBlock(block.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete audio"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Block Menu */}
                    <div className="mt-6 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button onClick={() => addBlock("text")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center gap-2 text-sm"><Type size={16} /> Text</button>
                        <button onClick={() => addBlock("image")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center gap-2 text-sm"><ImageIcon size={16} /> Image</button>
                        <button onClick={() => addBlock("video")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center gap-2 text-sm"><Video size={16} /> Video</button>
                        <button onClick={() => addBlock("audio")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center gap-2 text-sm"><Mic size={16} /> Audio</button>
                    </div>
                </div>
            </div>

            {/* Note Info Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 animate-scale-in">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Note Info</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Created</span>
                                <span className="font-medium text-gray-900">{new Date(note.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Last Edited</span>
                                <span className="font-medium text-gray-900">{new Date(note.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Size</span>
                                <span className="font-medium text-gray-900">{(JSON.stringify(blocks).length / 1024).toFixed(2)} KB</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Words</span>
                                <span className="font-medium text-gray-900">{blocks.filter(b => b.type === 'text').reduce((acc, b) => acc + (b.content?.split(/\s+/).length || 0), 0)}</span>
                            </div>
                        </div>
                        <button onClick={() => setShowInfoModal(false)} className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 rounded-xl transition-colors">Close</button>
                    </div>
                </div>
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
