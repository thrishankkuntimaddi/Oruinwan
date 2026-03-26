// client/src/components/layout/panels/FilesPanel.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, File, Upload, Search, ChevronRight, Tag, RefreshCw } from 'lucide-react';
import { useFiles } from '../../../hooks/useFiles';

const FilesPanel = ({ title }) => {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { files, loading, listFiles } = useFiles();
    const [search, setSearch] = useState('');
    const [activeTag, setActiveTag] = useState(null);

    useEffect(() => {
        if (workspaceId) listFiles(workspaceId, { folderId: 'root' });
    }, [workspaceId, listFiles]);

    // Collect all unique tags from loaded files
    const allTags = [...new Set(files.flatMap(f => f.tags || []))];

    const filtered = files.filter(f => {
        const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
        const matchesTag = !activeTag || (f.tags || []).includes(activeTag);
        return matchesSearch && matchesTag;
    });

    const handleFileClick = (file) => {
        navigate(`/workspace/${workspaceId}/files/${file._id}`);
    };

    const getMimeIcon = (mimeType = '') => {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎬';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
        if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
        return '📎';
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FolderOpen size={13} /> Files
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => listFiles(workspaceId, { folderId: 'root' })}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={13} />
                        </button>
                        <button
                            onClick={() => navigate(`/workspace/${workspaceId}/files`)}
                            className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                            title="Upload"
                        >
                            <Upload size={13} />
                        </button>
                    </div>
                </div>
                {/* Search */}
                <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search files..."
                        className="w-full pl-6 pr-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Tag filters */}
            {allTags.length > 0 && (
                <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => setActiveTag(null)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${!activeTag ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        All
                    </button>
                    {allTags.slice(0, 8).map(tag => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${activeTag === tag ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'}`}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {/* File list */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                {!loading && filtered.length === 0 && (
                    <div className="flex flex-col items-center py-10 px-4 text-center">
                        <FolderOpen size={32} className="text-gray-200 dark:text-gray-700 mb-2" />
                        <p className="text-xs text-gray-400">No files yet</p>
                        <button
                            onClick={() => navigate(`/workspace/${workspaceId}/files`)}
                            className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                            Upload a file
                        </button>
                    </div>
                )}
                {filtered.map(file => (
                    <button
                        key={file._id}
                        onClick={() => handleFileClick(file)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                    >
                        <span className="text-base shrink-0">{getMimeIcon(file.mimeType)}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                            {file.tags?.length > 0 && (
                                <p className="text-[10px] text-gray-400 truncate">
                                    {file.tags.map(t => `#${t}`).join(' ')}
                                </p>
                            )}
                        </div>
                        <ChevronRight size={11} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FilesPanel;
