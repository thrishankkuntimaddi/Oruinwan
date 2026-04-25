import React, { useEffect, useState, useCallback } from 'react';
import { X, Clock, RotateCcw, Upload, ChevronRight, Check } from 'lucide-react';
import { useFiles } from '../../hooks/useFiles';

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileVersionHistory({ fileId, onClose }) {
    const { getVersions, uploadVersion, restoreVersion } = useFiles();

    const [versions, setVersions]       = useState([]);
    const [current, setCurrent]         = useState(null);
    const [loading, setLoading]         = useState(true);
    const [restoring, setRestoring]     = useState(null); 
    const [uploading, setUploading]     = useState(false);
    const [changeNote, setChangeNote]   = useState('');
    const [successId, setSuccessId]     = useState(null);

    
    useEffect(() => {
        if (!fileId) return;
        (async () => {
            setLoading(true);
            const data = await getVersions(fileId).catch(() => ({}));
            setVersions(data.versions || []);
            setCurrent(data.current || null);
            setLoading(false);
        })();
    }, [fileId, getVersions]);

    
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);

    const handleRestore = useCallback(async (versionId) => {
        setRestoring(versionId);
        try {
            await restoreVersion(fileId, versionId);
            setSuccessId(versionId);
            setTimeout(() => setSuccessId(null), 2000);
            
            const data = await getVersions(fileId).catch(() => ({}));
            setVersions(data.versions || []);
            setCurrent(data.current || null);
        } catch {
            
        } finally {
            setRestoring(null);
        }
    }, [fileId, restoreVersion, getVersions]);

    const handleUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            await uploadVersion(fileId, file, changeNote);
            setChangeNote('');
            
            const data = await getVersions(fileId).catch(() => ({}));
            setVersions(data.versions || []);
            setCurrent(data.current || null);
        } catch {
            
        } finally {
            setUploading(false);
        }
    }, [fileId, changeNote, uploadVersion, getVersions]);

    return (
        
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {}
            <div className="bg-white dark:bg-gray-900 w-full max-w-md h-full flex flex-col shadow-2xl animate-slide-in-right">

                {}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <Clock size={18} className="text-gray-400" />
                    <h2 className="font-semibold text-gray-900 dark:text-white flex-1 text-sm">Version History</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Upload new version</p>
                    <input
                        type="text"
                        value={changeNote}
                        onChange={e => setChangeNote(e.target.value)}
                        placeholder="Change note (optional)"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${uploading
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                        <Upload size={14} />
                        {uploading ? 'Uploading…' : 'Choose file'}
                        <input
                            type="file"
                            className="hidden"
                            disabled={uploading}
                            onChange={handleUpload}
                        />
                    </label>
                </div>

                {}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32 text-gray-400 text-sm animate-pulse">
                            Loading history…
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
                            <Clock size={32} className="opacity-30" />
                            <p className="text-sm">No previous versions</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                            {}
                            {current && (
                                <li className="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-xs font-bold shrink-0">
                                        v{(versions.length + 1)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Current</span>
                                            <span className="text-xs text-gray-400">{formatSize(current.size)}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(current.createdAt)}</p>
                                    </div>
                                </li>
                            )}

                            {}
                            {[...versions].reverse().map((v, idx) => (
                                <li key={v._id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
                                        v{versions.length - idx}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">{formatSize(v.size)}</span>
                                        </div>
                                        {v.changeNote && (
                                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 italic">"{v.changeNote}"</p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(v.createdAt)} · {v.createdBy?.username || 'Unknown'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRestore(v._id)}
                                        disabled={restoring === v._id}
                                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                                            ${successId === v._id
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-700 opacity-0 group-hover:opacity-100'
                                            }`}
                                        title="Restore this version"
                                    >
                                        {successId === v._id
                                            ? <><Check size={12} /> Restored</>
                                            : restoring === v._id
                                                ? 'Restoring…'
                                                : <><RotateCcw size={12} /> Restore</>
                                        }
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
