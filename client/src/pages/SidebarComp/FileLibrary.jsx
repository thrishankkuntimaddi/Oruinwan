// client/src/pages/SidebarComp/FileLibrary.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Grid3X3, List, Search, Tag, X, RefreshCw, Folder, Image, FileText, Video, Music, File as FileIcon, Download, Trash2, Share2, Eye, Plus, MoreVertical } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';
import { useToast } from '../../contexts/ToastContext';

// ── File type helpers ──────────────────────────────────────────────────────────
function getMimeEmoji(mimeType = '') {
    if (mimeType.startsWith('image/')) return { emoji: '🖼️', color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20' };
    if (mimeType.startsWith('video/')) return { emoji: '🎬', color: 'bg-red-50 text-red-600 dark:bg-red-900/20' };
    if (mimeType.startsWith('audio/')) return { emoji: '🎵', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' };
    if (mimeType.includes('pdf')) return { emoji: '📄', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' };
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { emoji: '📊', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' };
    return { emoji: '📎', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' };
}

function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ── Dropzone ──────────────────────────────────────────────────────────────────
function DropZone({ onFiles }) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef();

    const handleDrop = useCallback(e => {
        e.preventDefault();
        setDragging(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
    }, [onFiles]);

    return (
        <div
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
        >
            <Upload size={28} className={`mx-auto mb-2 ${dragging ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-600'}`} />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Drop files here or <span className="text-indigo-600 dark:text-indigo-400 font-semibold">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Images, PDFs, docs, videos — up to 50 MB</p>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={e => onFiles([...e.target.files])} />
        </div>
    );
}

// ── File card (grid view) ──────────────────────────────────────────────────────
function FileCard({ file, onClick, onDelete }) {
    const { emoji, color } = getMimeEmoji(file.mimeType);
    const [showMenu, setShowMenu] = useState(false);
    const isImage = file.mimeType?.startsWith('image/');

    return (
        <div
            onClick={() => onClick(file)}
            className="relative group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all cursor-pointer overflow-hidden"
        >
            {/* Thumbnail */}
            <div className={`h-32 flex items-center justify-center ${isImage ? 'bg-gray-50 dark:bg-gray-900' : color}`}>
                {isImage ? (
                    <img
                        src={file.url}
                        alt={file.name}
                        className="max-h-full max-w-full object-cover"
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                ) : (
                    <span className="text-4xl">{emoji}</span>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatSize(file.size)} · {timeAgo(file.createdAt)}</p>
                {file.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {file.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Hover actions */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                    onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                    className="p-1 bg-white dark:bg-gray-700 rounded-md shadow-sm text-gray-500 hover:text-gray-700"
                ><MoreVertical size={13} /></button>
            </div>

            {showMenu && (
                <div className="absolute top-8 right-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden w-36">
                    <button
                        onClick={e => { e.stopPropagation(); window.open(file.url, '_blank'); setShowMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    ><Download size={11} /> Download</button>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(file._id); setShowMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"
                    ><Trash2 size={11} /> Delete</button>
                </div>
            )}
        </div>
    );
}

// ── File row (list view) ───────────────────────────────────────────────────────
function FileRow({ file, onClick, onDelete }) {
    const { emoji } = getMimeEmoji(file.mimeType);
    return (
        <div
            onClick={() => onClick(file)}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group transition-colors"
        >
            <span className="text-lg shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                {file.tags?.length > 0 && (
                    <p className="text-[10px] text-gray-400">{file.tags.map(t => `#${t}`).join(' ')}</p>
                )}
            </div>
            <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{formatSize(file.size)}</span>
            <span className="text-xs text-gray-400 shrink-0 hidden md:block">{timeAgo(file.createdAt)}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); window.open(file.url, '_blank'); }} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><Download size={13} /></button>
                <button onClick={e => { e.stopPropagation(); onDelete(file._id); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
const FileLibrary = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { files, loading, listFiles, uploadFile, deleteFile } = useFiles();
    const [view, setView] = useState('grid'); // 'grid' | 'list'
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        if (workspaceId) listFiles(workspaceId, { folderId: 'root' });
    }, [workspaceId, listFiles]);

    // If a specific file id is in URL, open preview
    useEffect(() => {
        if (id && files.length) {
            const f = files.find(f => f._id === id);
            if (f) setSelectedFile(f);
        }
    }, [id, files]);

    const handleUpload = async (fileList) => {
        setUploading(true);
        let successCount = 0;
        for (const file of fileList) {
            try {
                await uploadFile(workspaceId, file, { tags: [] });
                successCount++;
            } catch (err) {
                showToast(`Failed to upload ${file.name}`, 'error');
            }
        }
        setUploading(false);
        if (successCount > 0) showToast(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`, 'success');
    };

    const handleDelete = async (fileId) => {
        try {
            await deleteFile(fileId);
            showToast('File deleted', 'success');
            if (selectedFile?._id === fileId) setSelectedFile(null);
        } catch {
            showToast('Failed to delete', 'error');
        }
    };

    const handleFileClick = (file) => {
        setSelectedFile(file);
        navigate(`/workspace/${workspaceId}/files/${file._id}`, { replace: true });
    };

    const allTags = [...new Set(files.flatMap(f => f.tags || []))];

    const filtered = files.filter(f => {
        const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
        const matchesTag = !tagFilter || (f.tags || []).includes(tagFilter);
        return matchesSearch && matchesTag;
    });

    return (
        <div className="flex h-full bg-white dark:bg-gray-900">
            {/* Main content */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                {/* Top bar */}
                <div className="h-14 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-lg">📁</span> File Library
                    </h1>
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search files..."
                                className="pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border-none outline-none w-44 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        {/* View toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                            <button onClick={() => setView('grid')} className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><Grid3X3 size={14} /></button>
                            <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}><List size={14} /></button>
                        </div>
                    </div>
                </div>

                {/* Tag filter bar */}
                {allTags.length > 0 && (
                    <div className="px-6 py-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 flex-wrap">
                        <Tag size={12} className="text-gray-400 shrink-0" />
                        <button
                            onClick={() => setTagFilter('')}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${!tagFilter ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
                        >All</button>
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${tagFilter === tag ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
                            >#{tag}</button>
                        ))}
                    </div>
                )}

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Drop zone */}
                    <div className="mb-6">
                        {uploading ? (
                            <div className="border-2 border-dashed border-indigo-400 dark:border-indigo-600 rounded-xl p-8 text-center bg-indigo-50 dark:bg-indigo-900/10">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Uploading…</p>
                            </div>
                        ) : (
                            <DropZone onFiles={handleUpload} />
                        )}
                    </div>

                    {/* File grid or list */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-5xl">📂</span>
                            <p className="text-gray-400 mt-3 text-sm">No files found</p>
                        </div>
                    ) : view === 'grid' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {filtered.map(file => (
                                <FileCard key={file._id} file={file} onClick={handleFileClick} onDelete={handleDelete} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 grid grid-cols-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                <span className="col-span-2">Name</span>
                                <span className="hidden sm:block">Size</span>
                                <span className="hidden md:block">Uploaded</span>
                            </div>
                            {filtered.map(file => (
                                <FileRow key={file._id} file={file} onClick={handleFileClick} onDelete={handleDelete} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* File detail / preview panel */}
            {selectedFile && (
                <FilePreviewPanel
                    file={selectedFile}
                    onClose={() => {
                        setSelectedFile(null);
                        navigate(`/workspace/${workspaceId}/files`, { replace: true });
                    }}
                    workspaceId={workspaceId}
                />
            )}
        </div>
    );
};

// ── Inline preview panel ───────────────────────────────────────────────────────
function FilePreviewPanel({ file, onClose, workspaceId }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [activeTab, setActiveTab] = useState('preview'); // preview | comments | versions
    const { getComments, addComment, getVersions } = useFiles();
    const [versions, setVersions] = useState([]);
    const { showToast } = useToast();

    const { emoji } = getMimeEmoji(file.mimeType);
    const isImage = file.mimeType?.startsWith('image/');
    const isVideo = file.mimeType?.startsWith('video/');
    const isAudio = file.mimeType?.startsWith('audio/');
    const isPDF = file.mimeType?.includes('pdf');

    useEffect(() => {
        if (activeTab === 'comments') getComments(file._id).then(setComments).catch(() => { });
        if (activeTab === 'versions') getVersions(file._id).then(d => setVersions(d.versions || [])).catch(() => { });
    }, [activeTab, file._id, getComments, getVersions]);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            const c = await addComment(file._id, newComment.trim());
            setComments(prev => [...prev, c]);
            setNewComment('');
        } catch {
            showToast('Failed to add comment', 'error');
        }
    };

    return (
        <div className="w-[380px] border-l border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 shrink-0">
            {/* Header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{emoji}</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
                </div>
                <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors shrink-0">
                    <X size={16} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800">
                {['preview', 'comments', 'versions'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 ${activeTab === tab ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >{tab}</button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Preview Tab */}
                {activeTab === 'preview' && (
                    <div className="p-4 space-y-4">
                        {/* Media preview */}
                        <div className="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            {isImage && <img src={file.url} alt={file.name} className="w-full object-contain max-h-72" />}
                            {isVideo && <video src={file.url} controls className="w-full max-h-72" />}
                            {isAudio && <audio src={file.url} controls className="w-full p-4" />}
                            {isPDF && <iframe src={file.url} className="w-full h-72 border-none" title={file.name} />}
                            {!isImage && !isVideo && !isAudio && !isPDF && (
                                <div className="flex flex-col items-center py-10">
                                    <span className="text-5xl mb-3">{emoji}</span>
                                    <p className="text-xs text-gray-400">{file.mimeType || 'Unknown type'}</p>
                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1">
                                        <Download size={12} /> Download file
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Metadata */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                    <p className="text-gray-400 mb-0.5">Size</p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{formatSize(file.size)}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                    <p className="text-gray-400 mb-0.5">Version</p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">v{file.currentVersion}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                    <p className="text-gray-400 mb-0.5">Uploaded</p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{timeAgo(file.createdAt)}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                    <p className="text-gray-400 mb-0.5">Type</p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{(file.mimeType || '').split('/')[1] || '—'}</p>
                                </div>
                            </div>
                            {/* Tags */}
                            {file.tags?.length > 0 && (
                                <div>
                                    <p className="text-xs text-gray-400 mb-1.5 font-medium">Tags</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {file.tags.map(tag => (
                                            <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                <Download size={14} /> Download
                            </a>
                        </div>
                    </div>
                )}

                {/* Comments Tab */}
                {activeTab === 'comments' && (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {comments.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-xs text-gray-400">No comments yet</p>
                                </div>
                            )}
                            {comments.map(c => (
                                <div key={c._id} className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                        {(c.author?.username || 'U')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-gray-400 mb-0.5">{c.author?.username} · {timeAgo(c.createdAt)}</p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                            <input
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                placeholder="Add a comment…"
                                className="flex-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleAddComment}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-semibold transition-colors"
                            >Post</button>
                        </div>
                    </div>
                )}

                {/* Versions Tab */}
                {activeTab === 'versions' && (
                    <div className="p-4 space-y-2">
                        {/* Current version */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                v{file.currentVersion}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Current version</p>
                                <p className="text-[10px] text-indigo-500">{timeAgo(file.updatedAt || file.createdAt)}</p>
                            </div>
                        </div>
                        {/* Previous versions */}
                        {versions.map(v => (
                            <div key={v._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400">
                                    v{v.versionNumber}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{v.changeNote || `Version ${v.versionNumber}`}</p>
                                    <p className="text-[10px] text-gray-400">{timeAgo(v.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                        {versions.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No previous versions</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FileLibrary;
