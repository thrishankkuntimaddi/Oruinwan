import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Grid3X3, List, Search, Tag, X, RefreshCw, Folder, Image, FileText, Video, Music, File as FileIcon, Download, Trash2, Share2, Eye, Plus, MoreVertical } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';
import { useToast } from '../../contexts/ToastContext';

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

function DropZone({ onFiles }) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef();
    const handleDrop = useCallback(e => {
        e.preventDefault(); setDragging(false);
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
            style={{ border: `2px dashed ${dragging ? '#b8956a' : 'rgba(255,255,255,0.1)'}`, padding: '28px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(184,149,106,0.06)' : 'rgba(255,255,255,0.02)', transition: 'all 150ms ease' }}
        >
            <Upload size={26} style={{ margin: '0 auto 8px', color: dragging ? '#b8956a' : 'rgba(228,228,228,0.2)' }} />
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Drop files here or <span style={{ color: '#b8956a', fontWeight: 700 }}>browse</span>
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}>Images, PDFs, docs, videos — up to 50 MB</p>
            <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={e => onFiles([...e.target.files])} />
        </div>
    );
}

function FileCard({ file, onClick, onDelete }) {
    const { emoji } = getMimeEmoji(file.mimeType);
    const [showMenu, setShowMenu] = useState(false);
    const isImage = file.mimeType?.startsWith('image/');
    return (
        <div onClick={() => onClick(file)}
            style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.07)', background: '#111', cursor: 'pointer', transition: 'border-color 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
        >
            <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                {isImage
                    ? <img src={file.url} alt={file.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                    : <span style={{ fontSize: '32px' }}>{emoji}</span>
                }
            </div>
            <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>{file.name}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'Inter, system-ui, sans-serif' }}>{formatSize(file.size)} · {timeAgo(file.createdAt)}</p>
            </div>
            <div style={{ position: 'absolute', top: '6px', right: '6px', opacity: 0, transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
            >
                <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                    style={{ padding: '4px', background: 'rgba(12,12,12,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <MoreVertical size={12} />
                </button>
            </div>
            {showMenu && (
                <div style={{ position: 'absolute', top: '30px', right: '6px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', zIndex: 20, width: '130px' }}>
                    <button onClick={e => { e.stopPropagation(); window.open(file.url, '_blank'); setShowMenu(false); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <Download size={11} /> Download
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDelete(file._id); setShowMenu(false); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <Trash2 size={11} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}

function FileRow({ file, onClick, onDelete }) {
    const { emoji } = getMimeEmoji(file.mimeType);
    return (
        <div onClick={() => onClick(file)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>{file.name}</p>
                {file.tags?.length > 0 && <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{file.tags.map(t => `#${t}`).join(' ')}</p>}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{formatSize(file.size)}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(file.createdAt)}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={e => { e.stopPropagation(); window.open(file.url, '_blank'); }} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Download size={13} /></button>
                <button onClick={e => { e.stopPropagation(); onDelete(file._id); }} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={13} /></button>
            </div>
        </div>
    );
}

const FileLibrary = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { files, loading, listFiles, uploadFile, deleteFile } = useFiles();
    const [view, setView] = useState('grid'); 
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        if (workspaceId) listFiles(workspaceId, { folderId: 'root' });
    }, [workspaceId, listFiles]);

    
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
        <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)' }}>
            {}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {}
                <div style={{ height: '52px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif', margin: 0 }}>
                        <span>📁</span> File Library
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..."
                                style={{ paddingLeft: '28px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', width: '160px', fontFamily: 'Inter, system-ui, sans-serif' }} />
                        </div>
                        <div style={{ display: 'flex', background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.07)', padding: '2px' }}>
                            <button onClick={() => setView('grid')} style={{ padding: '4px 6px', background: view === 'grid' ? 'rgba(184,149,106,0.2)' : 'transparent', border: 'none', color: view === 'grid' ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}><Grid3X3 size={13} /></button>
                            <button onClick={() => setView('list')} style={{ padding: '4px 6px', background: view === 'list' ? 'rgba(184,149,106,0.2)' : 'transparent', border: 'none', color: view === 'list' ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}><List size={13} /></button>
                        </div>
                    </div>
                </div>

                {}
                {allTags.length > 0 && (
                    <div style={{ padding: '6px 24px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', flexShrink: 0 }}>
                        <Tag size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        {[null, ...allTags].map((tag, i) => (
                            <button key={i} onClick={() => setTagFilter(tag === tagFilter ? '' : (tag || ''))}
                                style={{ fontSize: '11px', padding: '2px 10px', background: (!tag && !tagFilter) || tagFilter === tag ? 'rgba(184,149,106,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${(!tag && !tagFilter) || tagFilter === tag ? 'rgba(184,149,106,0.3)' : 'rgba(255,255,255,0.07)'}`, color: (!tag && !tagFilter) || tagFilter === tag ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                {tag ? `#${tag}` : 'All'}
                            </button>
                        ))}
                    </div>
                )}

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', scrollbarWidth: 'thin' }}>
                    {}
                    <div style={{ marginBottom: '20px' }}>
                        {uploading ? (
                            <div style={{ border: '2px dashed rgba(184,149,106,0.4)', padding: '28px', textAlign: 'center', background: 'rgba(184,149,106,0.05)' }}>
                                <div style={{ width: '24px', height: '24px', border: '2px solid #b8956a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                                <p style={{ fontSize: '13px', color: '#b8956a', fontFamily: 'Inter, system-ui, sans-serif' }}>Uploading…</p>
                            </div>
                        ) : (
                            <DropZone onFiles={handleUpload} />
                        )}
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                            <div style={{ width: '24px', height: '24px', border: '2px solid #b8956a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <span style={{ fontSize: '48px' }}>📂</span>
                            <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif' }}>No files found</p>
                        </div>
                    ) : view === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                            {filtered.map(file => <FileCard key={file._id} file={file} onClick={handleFileClick} onDelete={handleDelete} />)}
                        </div>
                    ) : (
                        <div style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ padding: '6px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '10px' }}>
                                {['Name', 'Size', 'Uploaded', ''].map((h, i) => <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Inter, system-ui, sans-serif' }}>{h}</span>)}
                            </div>
                            {filtered.map(file => <FileRow key={file._id} file={file} onClick={handleFileClick} onDelete={handleDelete} />)}
                        </div>
                    )}
                </div>
            </div>

            {selectedFile && (
                <FilePreviewPanel
                    file={selectedFile}
                    onClose={() => { setSelectedFile(null); navigate(`/workspace/${workspaceId}/files`, { replace: true }); }}
                    workspaceId={workspaceId}
                />
            )}
        </div>
    );
};

function FilePreviewPanel({ file, onClose, workspaceId }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [activeTab, setActiveTab] = useState('preview'); 
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
        <div style={{ width: '380px', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: '#111', flexShrink: 0 }}>
            {}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{emoji}</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
                </div>
                <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors shrink-0">
                    <X size={16} />
                </button>
            </div>

            {}
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
                {}
                {activeTab === 'preview' && (
                    <div className="p-4 space-y-4">
                        {}
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

                        {}
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
                            {}
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

                {}
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

                {}
                {activeTab === 'versions' && (
                    <div className="p-4 space-y-2">
                        {}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                v{file.currentVersion}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Current version</p>
                                <p className="text-[10px] text-indigo-500">{timeAgo(file.updatedAt || file.createdAt)}</p>
                            </div>
                        </div>
                        {}
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
