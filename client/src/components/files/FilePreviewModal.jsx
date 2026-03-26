// client/src/components/files/FilePreviewModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, MessageCircle, Tag, Clock, User, ChevronRight, Send, ExternalLink, FileText, Film, Image as ImageIcon, File } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function mimeCategory(mime = '') {
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'other';
}

function formatSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function MimeIcon({ mime, size = 28 }) {
    const cat = mimeCategory(mime);
    if (cat === 'image') return <ImageIcon size={size} className="text-purple-500" />;
    if (cat === 'pdf')   return <FileText size={size} className="text-red-500" />;
    if (cat === 'video') return <Film size={size} className="text-blue-500" />;
    return <File size={size} className="text-gray-400" />;
}

/* ─── main component ──────────────────────────────────────────────────────── */
export default function FilePreviewModal({ fileId, onClose }) {
    const { getFile, getComments, addComment } = useFiles();

    const [file, setFile] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [tab, setTab] = useState('preview'); // 'preview' | 'comments' | 'meta'
    const [loading, setLoading] = useState(true);

    /* load file + comments */
    useEffect(() => {
        if (!fileId) return;
        let active = true;
        (async () => {
            setLoading(true);
            const [f, c] = await Promise.all([
                getFile(fileId).catch(() => null),
                getComments(fileId).catch(() => []),
            ]);
            if (!active) return;
            setFile(f);
            setComments(c);
            setLoading(false);
        })();
        return () => { active = false; };
    }, [fileId, getFile, getComments]);

    /* close on Escape */
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const submitComment = useCallback(async () => {
        if (!newComment.trim()) return;
        const c = await addComment(fileId, newComment.trim());
        if (c) setComments(prev => [...prev, c]);
        setNewComment('');
    }, [fileId, newComment, addComment]);

    /* ── preview renderer ── */
    const renderPreview = () => {
        if (!file) return null;
        const cat = mimeCategory(file.mimeType);

        if (cat === 'image') {
            return (
                <div className="flex h-full items-center justify-center bg-gray-900 rounded-xl overflow-hidden">
                    <img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />
                </div>
            );
        }

        if (cat === 'pdf') {
            return (
                <iframe
                    src={`${file.url}#navpanes=0`}
                    title={file.name}
                    className="w-full h-full rounded-xl border border-gray-200 dark:border-gray-700"
                />
            );
        }

        if (cat === 'video') {
            return (
                <div className="flex h-full items-center justify-center bg-black rounded-xl">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video controls src={file.url} className="max-h-full max-w-full" />
                </div>
            );
        }

        if (cat === 'audio') {
            return (
                <div className="flex h-full items-center justify-center">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={file.url} className="w-full" />
                </div>
            );
        }

        /* fallback */
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4 text-center">
                <MimeIcon mime={file.mimeType} size={56} />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No preview available for this file type.</p>
                <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <ExternalLink size={14} /> Open file
                </a>
            </div>
        );
    };

    /* ── skeleton while loading ── */
    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex items-center justify-center">
                    <div className="animate-pulse text-gray-400">Loading…</div>
                </div>
            </div>
        );
    }

    if (!file) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 text-center">
                    <p className="text-red-500">File not found.</p>
                    <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-sm">Close</button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'preview',  label: 'Preview',  icon: <MimeIcon mime={file.mimeType} size={14} /> },
        { id: 'comments', label: `Comments (${comments.length})`, icon: <MessageCircle size={14} /> },
        { id: 'meta',     label: 'Details',  icon: <Tag size={14} /> },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col w-[92vw] max-w-5xl h-[88vh] overflow-hidden animate-scale-in">

                {/* ── header ── */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <MimeIcon mime={file.mimeType} size={20} />
                    <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{file.name}</h2>
                        <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                    </div>
                    <a
                        href={file.url}
                        download={file.name}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Download"
                    >
                        <Download size={16} />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── tabs ── */}
                <div className="flex gap-1 px-5 pt-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors
                                ${tab === t.id
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ── body ── */}
                <div className="flex-1 overflow-hidden p-4">

                    {/* PREVIEW tab */}
                    {tab === 'preview' && (
                        <div className="h-full">{renderPreview()}</div>
                    )}

                    {/* COMMENTS tab */}
                    {tab === 'comments' && (
                        <div className="flex flex-col h-full gap-3">
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {comments.length === 0
                                    ? <p className="text-gray-400 text-sm text-center pt-8">No comments yet.</p>
                                    : comments.map(c => (
                                        <div key={c._id} className="flex gap-2">
                                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 shrink-0">
                                                {(c.author?.username || '?')[0].toUpperCase()}
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 flex-1">
                                                <span className="font-medium text-xs text-gray-500 dark:text-gray-400">{c.author?.username || 'Unknown'}</span>
                                                <p className="mt-0.5">{c.content}</p>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <input
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                                    placeholder="Add a comment…"
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={submitComment}
                                    disabled={!newComment.trim()}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* DETAILS tab */}
                    {tab === 'meta' && (
                        <div className="overflow-y-auto h-full">
                            <dl className="space-y-4 text-sm">
                                {[
                                    { label: 'File name', value: file.name, icon: <File size={14} /> },
                                    { label: 'MIME type', value: file.mimeType || '—', icon: <Tag size={14} /> },
                                    { label: 'Size', value: formatSize(file.size), icon: <Clock size={14} /> },
                                    { label: 'Uploaded by', value: file.createdBy?.username || '—', icon: <User size={14} /> },
                                    { label: 'Uploaded at', value: formatDate(file.createdAt), icon: <Clock size={14} /> },
                                    { label: 'Tags', value: (file.tags || []).join(', ') || '—', icon: <Tag size={14} /> },
                                    { label: 'Description', value: file.description || '—', icon: <FileText size={14} /> },
                                ].map(row => (
                                    <div key={row.label} className="flex gap-3">
                                        <span className="text-gray-400 shrink-0 mt-0.5">{row.icon}</span>
                                        <div>
                                            <dt className="text-xs text-gray-400 dark:text-gray-500">{row.label}</dt>
                                            <dd className="font-medium text-gray-800 dark:text-gray-200 break-all">{row.value}</dd>
                                        </div>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
