import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Type, Image as ImageIcon, Video, Mic } from "lucide-react";
import { useNotes } from "../../contexts/NotesContext";
import { useToast } from "../../contexts/ToastContext";
import ConfirmationModal from "../../shared/components/ui/ConfirmationModal";

// Import extracted components
import TextBlock from "./notesComponents/blocks/TextBlock";
import ImageBlock from "./notesComponents/blocks/ImageBlock";
import VideoBlock from "./notesComponents/blocks/VideoBlock";
import AudioBlock from "./notesComponents/blocks/AudioBlock";
import EmptyState from "./notesComponents/ui/EmptyState";
import NoteInfoModal from "./notesComponents/ui/NoteInfoModal";
import NotesToolbar from "./notesComponents/ui/NotesToolbar";

const Notes = () => {
    // ✅ CORRECT: Extract both workspaceId and note id from params
    // Note identity = workspace + noteId
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { notes, updateNote, deleteNote, addNote, loading } = useNotes();
    const { showToast } = useToast();

    // Handle query parameter navigation from universal search
    useEffect(() => {
        const noteIdParam = searchParams.get('noteId');
        if (noteIdParam && noteIdParam !== id) {

            navigate(`/workspace/${workspaceId}/notes/${noteIdParam}`, { replace: true });
        }
    }, [searchParams, id, workspaceId, navigate]);

    // Find active note
    const note = notes.find(n => n.id === id);

    const [title, setTitle] = useState("");
    const [blocks, setBlocks] = useState([]); // [{ id, type, content }]
    const [showMenu, setShowMenu] = useState(false);
    const [showShareTooltip, setShowShareTooltip] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({}); // Track upload progress per block
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
        // ✅ CORRECT: Use workspace-scoped share link
        const shareUrl = `${window.location.origin}/workspace/${workspaceId}/notes/${id}`;
        navigator.clipboard.writeText(shareUrl);
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
        return <EmptyState loading={loading} />;
    }

    const formattedDate = new Date(note.updatedAt).toLocaleString("en-US", {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
            {/* Toolbar / Header */}
            <NotesToolbar
                formattedDate={formattedDate}
                showShareTooltip={showShareTooltip}
                showMenu={showMenu}
                setShowMenu={setShowMenu}
                handleAI={handleAI}
                handleShare={handleShare}
                handleDuplicate={handleDuplicate}
                handleDownloadPDF={handleDownloadPDF}
                setIsDeleteModalOpen={setIsDeleteModalOpen}
                setShowInfoModal={setShowInfoModal}
                menuRef={menuRef}
            />

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto px-8 py-10 min-h-full flex flex-col">
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        className="text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 border-none focus:ring-0 p-0 mb-6 w-full bg-transparent outline-none"
                        placeholder="Untitled Note"
                    />

                    <div className="space-y-4">
                        {blocks.map((block) => {
                            if (block.type === "text") {
                                return (
                                    <TextBlock
                                        key={block.id}
                                        block={block}
                                        onBlockChange={handleBlockChange}
                                        onRemoveBlock={removeBlock}
                                    />
                                );
                            }

                            if (block.type === "image") {
                                return (
                                    <ImageBlock
                                        key={block.id}
                                        block={block}
                                        onBlockChange={handleBlockChange}
                                        onRemoveBlock={removeBlock}
                                        workspaceId={workspaceId}
                                        noteId={id}
                                        uploadProgress={uploadProgress}
                                        setUploadProgress={setUploadProgress}
                                        showToast={showToast}
                                    />
                                );
                            }

                            if (block.type === "video") {
                                return (
                                    <VideoBlock
                                        key={block.id}
                                        block={block}
                                        onBlockChange={handleBlockChange}
                                        onRemoveBlock={removeBlock}
                                        workspaceId={workspaceId}
                                        noteId={id}
                                        uploadProgress={uploadProgress}
                                        setUploadProgress={setUploadProgress}
                                        showToast={showToast}
                                    />
                                );
                            }

                            if (block.type === "audio") {
                                return (
                                    <AudioBlock
                                        key={block.id}
                                        block={block}
                                        onBlockChange={handleBlockChange}
                                        onRemoveBlock={removeBlock}
                                        workspaceId={workspaceId}
                                        noteId={id}
                                        uploadProgress={uploadProgress}
                                        setUploadProgress={setUploadProgress}
                                        showToast={showToast}
                                    />
                                );
                            }

                            return null;
                        })}
                    </div>

                    {/* Add Block Menu */}
                    <div className="mt-6 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button onClick={() => addBlock("text")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm"><Type size={16} /> Text</button>
                        <button onClick={() => addBlock("image")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm"><ImageIcon size={16} /> Image</button>
                        <button onClick={() => addBlock("video")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm"><Video size={16} /> Video</button>
                        <button onClick={() => addBlock("audio")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-2 text-sm"><Mic size={16} /> Audio</button>
                    </div>
                </div>
            </div>

            {/* Note Info Modal */}
            <NoteInfoModal
                note={note}
                blocks={blocks}
                showInfoModal={showInfoModal}
                setShowInfoModal={setShowInfoModal}
            />

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
