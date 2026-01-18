import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
    Clock, MoreHorizontal, Trash2, Share2, Star, Sparkles,
    Copy, Download, Info, Check, Type, Image as ImageIcon, Video, Mic
} from "lucide-react";
import { useNotes } from "../../contexts/NotesContext";
import { useToast } from "../../contexts/ToastContext";
import ConfirmationModal from "../../components/ui/ConfirmationModal";
import { uploadNoteAttachment } from "../../utils/uploadHelpers";

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
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">
                    <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                        <Clock size={40} className="text-gray-300 dark:text-gray-600 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Loading Notes...</h2>
                    <p className="text-sm max-w-xs text-center text-gray-500 dark:text-gray-400">Please wait while we fetch your notes.</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">
                <div className="w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                    <Star size={40} className="text-gray-300 dark:text-gray-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Select a Note</h2>
                <p className="text-sm max-w-xs text-center text-gray-500 dark:text-gray-400">Choose a note from the sidebar or create a new one to get started.</p>
            </div>
        );
    }

    const formattedDate = new Date(note.updatedAt).toLocaleString("en-US", {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
            {/* Toolbar / Header */}
            <div className="h-16 px-8 flex items-center justify-between shadow-sm bg-white dark:bg-gray-900 shrink-0 z-10 relative">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-gray-500">
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
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Copy Link"
                        >
                            {showShareTooltip ? <Check size={18} className="text-green-600 dark:text-green-400" /> : <Share2 size={18} />}
                        </button>
                    </div>

                    {/* Delete Button */}
                    <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Note"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className={`p-2 rounded-lg transition-colors ${showMenu ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                        >
                            <MoreHorizontal size={18} />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <button onClick={handleDuplicate} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors">
                                    <Copy size={14} className="text-gray-400" /> Duplicate
                                </button>
                                <button onClick={handleDownloadPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors">
                                    <Download size={14} className="text-gray-400" /> Download PDF
                                </button>
                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                                <button onClick={() => { setShowInfoModal(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors">
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
                        className="text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 border-none focus:ring-0 p-0 mb-6 w-full bg-transparent outline-none"
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
                                            className="w-full resize-none border-none focus:ring-0 text-gray-700 dark:text-gray-200 text-lg leading-relaxed p-0 placeholder-gray-300 dark:placeholder-gray-600 bg-transparent outline-none min-h-[1.5em] overflow-hidden pr-8"
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
                                    <div className="w-full max-w-2xl rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 relative group-hover:shadow-sm transition-all">
                                        <div className="min-h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 relative">
                                            {block.content ? (
                                                <img src={block.content} alt="Note" className="w-full h-full object-contain max-h-96" />
                                            ) : (
                                                <div className="flex flex-col items-center p-8">
                                                    <ImageIcon size={48} className="mb-4 text-gray-300" />
                                                    <p className="text-sm font-medium text-gray-600 mb-4">Add an image</p>
                                                    <div className="flex flex-col gap-3 w-full max-w-md">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files[0];
                                                                if (file) {
                                                                    try {
                                                                        // Show upload progress
                                                                        setUploadProgress(prev => ({ ...prev, [block.id]: 0 }));

                                                                        // Upload file
                                                                        const result = await uploadNoteAttachment(
                                                                            file,
                                                                            workspaceId,
                                                                            id,
                                                                            (progress) => {
                                                                                setUploadProgress(prev => ({ ...prev, [block.id]: progress }));
                                                                            }
                                                                        );

                                                                        // Update block with file URL
                                                                        handleBlockChange(block.id, result.url);

                                                                        // Clear upload progress
                                                                        setUploadProgress(prev => {
                                                                            const newProgress = { ...prev };
                                                                            delete newProgress[block.id];
                                                                            return newProgress;
                                                                        });

                                                                        showToast('Image uploaded successfully', 'success');
                                                                    } catch (error) {
                                                                        console.error('Upload error:', error);
                                                                        showToast('Failed to upload image', 'error');
                                                                        setUploadProgress(prev => {
                                                                            const newProgress = { ...prev };
                                                                            delete newProgress[block.id];
                                                                            return newProgress;
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                            className="hidden"
                                                            id={`img-upload-${block.id}`}
                                                        />
                                                        <label
                                                            htmlFor={`img-upload-${block.id}`}
                                                            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center"
                                                        >
                                                            Upload from device
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Or paste image URL..."
                                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm theme-input outline-none"
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                                                        handleBlockChange(block.id, e.target.value.trim());
                                                                        e.target.value = '';
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeBlock(block.id)}
                                                className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                title="Delete image"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {block.content && !block.content.startsWith('data:') && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            // Extract filename from URL
                                                            const filename = block.content.split('/').pop();
                                                            const link = document.createElement('a');
                                                            link.href = block.content;
                                                            link.download = filename;
                                                            link.target = '_blank';
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            showToast('Download started', 'success');
                                                        } catch (error) {
                                                            console.error('Download error:', error);
                                                            showToast('Failed to download image', 'error');
                                                        }
                                                    }}
                                                    className="absolute top-2 right-12 p-1.5 bg-white/80 hover:bg-green-50 text-gray-500 hover:text-green-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                    title="Download image"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            )}
                                            {block.content && (
                                                <button
                                                    onClick={() => handleBlockChange(block.id, '')}
                                                    className="absolute top-2 left-2 p-1.5 bg-white/80 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                    title="Change image"
                                                >
                                                    <ImageIcon size={16} />
                                                </button>
                                            )}
                                            {uploadProgress[block.id] !== undefined && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                                    <div className="text-white text-center">
                                                        <div className="mb-2">Uploading...</div>
                                                        <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all duration-300"
                                                                style={{ width: `${uploadProgress[block.id]}%` }}
                                                            />
                                                        </div>
                                                        <div className="mt-2 text-sm">{uploadProgress[block.id]}%</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {block.type === "video" && (
                                    <div className="w-full max-w-2xl rounded-xl overflow-hidden bg-gray-900 border border-gray-200 relative group">
                                        <div className="min-h-64 flex items-center justify-center text-gray-500 relative">
                                            {block.content ? (
                                                <div className="w-full">
                                                    {block.content.includes('youtube.com') || block.content.includes('youtu.be') ? (
                                                        <iframe
                                                            className="w-full aspect-video"
                                                            src={block.content.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                                            title="YouTube video"
                                                            frameBorder="0"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                        ></iframe>
                                                    ) : block.content.includes('vimeo.com') ? (
                                                        <iframe
                                                            className="w-full aspect-video"
                                                            src={`https://player.vimeo.com/video/${block.content.split('/').pop()}`}
                                                            title="Vimeo video"
                                                            frameBorder="0"
                                                            allow="autoplay; fullscreen; picture-in-picture"
                                                            allowFullScreen
                                                        ></iframe>
                                                    ) : (
                                                        <video className="w-full max-h-96" controls>
                                                            <source src={block.content} />
                                                            Your browser does not support the video tag.
                                                        </video>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center p-8">
                                                    <Video size={48} className="mb-4 text-gray-400" />
                                                    <p className="text-sm font-medium text-gray-300 mb-4">Add a video</p>
                                                    <div className="flex flex-col gap-3 w-full max-w-md">
                                                        <input
                                                            type="text"
                                                            placeholder="Paste YouTube, Vimeo, or video URL..."
                                                            className="w-full px-4 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                            onKeyPress={(e) => {
                                                                if (e.key === 'Enter' && e.target.value.trim()) {
                                                                    handleBlockChange(block.id, e.target.value.trim());
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                        />
                                                        <input
                                                            type="file"
                                                            accept="video/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files[0];
                                                                if (file) {
                                                                    try {
                                                                        setUploadProgress(prev => ({ ...prev, [block.id]: 0 }));

                                                                        const result = await uploadNoteAttachment(
                                                                            file,
                                                                            workspaceId,
                                                                            id,
                                                                            (progress) => {
                                                                                setUploadProgress(prev => ({ ...prev, [block.id]: progress }));
                                                                            }
                                                                        );

                                                                        handleBlockChange(block.id, result.url);

                                                                        setUploadProgress(prev => {
                                                                            const newProgress = { ...prev };
                                                                            delete newProgress[block.id];
                                                                            return newProgress;
                                                                        });

                                                                        showToast('Video uploaded successfully', 'success');
                                                                    } catch (error) {
                                                                        console.error('Upload error:', error);
                                                                        showToast('Failed to upload video', 'error');
                                                                        setUploadProgress(prev => {
                                                                            const newProgress = { ...prev };
                                                                            delete newProgress[block.id];
                                                                            return newProgress;
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                            className="hidden"
                                                            id={`video-upload-${block.id}`}
                                                        />
                                                        <label
                                                            htmlFor={`video-upload-${block.id}`}
                                                            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center"
                                                        >
                                                            Upload video file
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeBlock(block.id)}
                                                className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                title="Delete video"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            {block.content && !block.content.includes('youtube.com') && !block.content.includes('youtu.be') && !block.content.includes('vimeo.com') && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const filename = block.content.split('/').pop();
                                                            const link = document.createElement('a');
                                                            link.href = block.content;
                                                            link.download = filename;
                                                            link.target = '_blank';
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            showToast('Download started', 'success');
                                                        } catch (error) {
                                                            console.error('Download error:', error);
                                                            showToast('Failed to download video', 'error');
                                                        }
                                                    }}
                                                    className="absolute top-2 right-12 p-1.5 bg-white/10 hover:bg-green-500/20 text-white/70 hover:text-green-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                    title="Download video"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            )}
                                            {block.content && (
                                                <button
                                                    onClick={() => handleBlockChange(block.id, '')}
                                                    className="absolute top-2 left-2 p-1.5 bg-white/10 hover:bg-blue-500/20 text-white/70 hover:text-blue-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                    title="Change video"
                                                >
                                                    <Video size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {block.type === "audio" && (
                                    <div className="w-full max-w-2xl rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 relative group">
                                        {block.content ? (
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                                                    <Mic size={24} />
                                                </div>
                                                <audio
                                                    src={block.content}
                                                    controls
                                                    className="flex-1"
                                                    style={{ height: '40px' }}
                                                />
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const filename = block.content.split('/').pop();
                                                            const link = document.createElement('a');
                                                            link.href = block.content;
                                                            link.download = filename;
                                                            link.target = '_blank';
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            showToast('Download started', 'success');
                                                        } catch (error) {
                                                            console.error('Download error:', error);
                                                            showToast('Failed to download audio', 'error');
                                                        }
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                    title="Download audio"
                                                >
                                                    <Download size={18} />
                                                </button>
                                                <button
                                                    onClick={() => removeBlock(block.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete audio"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleBlockChange(block.id, '')}
                                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="Change audio"
                                                >
                                                    <Mic size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-4">
                                                <Mic size={48} className="text-gray-400" />
                                                <p className="text-sm font-medium text-gray-600">Add audio</p>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                                                const mediaRecorder = new MediaRecorder(stream);
                                                                const audioChunks = [];

                                                                mediaRecorder.addEventListener("dataavailable", event => {
                                                                    audioChunks.push(event.data);
                                                                });

                                                                mediaRecorder.addEventListener("stop", () => {
                                                                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                                                                    const reader = new FileReader();
                                                                    reader.onload = () => {
                                                                        handleBlockChange(block.id, reader.result);
                                                                    };
                                                                    reader.readAsDataURL(audioBlob);
                                                                    stream.getTracks().forEach(track => track.stop());
                                                                });

                                                                // Start recording
                                                                mediaRecorder.start();

                                                                // Stop after 60 seconds or on user action
                                                                showToast("Recording... Click again to stop", "info");

                                                                // Store the recorder on the button for stopping
                                                                const stopRecording = () => {
                                                                    mediaRecorder.stop();
                                                                };

                                                                // Auto-stop after 60 seconds
                                                                setTimeout(stopRecording, 60000);

                                                            } catch (err) {
                                                                showToast("Microphone access denied", "error");
                                                            }
                                                        }}
                                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                                    >
                                                        <Mic size={16} />
                                                        Record Audio
                                                    </button>
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                try {
                                                                    setUploadProgress(prev => ({ ...prev, [block.id]: 0 }));

                                                                    const result = await uploadNoteAttachment(
                                                                        file,
                                                                        workspaceId,
                                                                        id,
                                                                        (progress) => {
                                                                            setUploadProgress(prev => ({ ...prev, [block.id]: progress }));
                                                                        }
                                                                    );

                                                                    handleBlockChange(block.id, result.url);

                                                                    setUploadProgress(prev => {
                                                                        const newProgress = { ...prev };
                                                                        delete newProgress[block.id];
                                                                        return newProgress;
                                                                    });

                                                                    showToast('Audio uploaded successfully', 'success');
                                                                } catch (error) {
                                                                    console.error('Upload error:', error);
                                                                    showToast('Failed to upload audio', 'error');
                                                                    setUploadProgress(prev => {
                                                                        const newProgress = { ...prev };
                                                                        delete newProgress[block.id];
                                                                        return newProgress;
                                                                    });
                                                                }
                                                            }
                                                        }}
                                                        className="hidden"
                                                        id={`audio-upload-${block.id}`}
                                                    />
                                                    <label
                                                        htmlFor={`audio-upload-${block.id}`}
                                                        className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Upload Audio
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
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
            {showInfoModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-80 animate-scale-in text-gray-900 dark:text-gray-100">
                        <h3 className="text-lg font-bold mb-4">Note Info</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Created</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(note.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Last Edited</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(note.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Size</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{(JSON.stringify(blocks).length / 1024).toFixed(2)} KB</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Words</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{blocks.filter(b => b.type === 'text').reduce((acc, b) => acc + (b.content?.split(/\s+/).length || 0), 0)}</span>
                            </div>
                        </div>
                        <button onClick={() => setShowInfoModal(false)} className="mt-6 w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 rounded-xl transition-colors">Close</button>
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
