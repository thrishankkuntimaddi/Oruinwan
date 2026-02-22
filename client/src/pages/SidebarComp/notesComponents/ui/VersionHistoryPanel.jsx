import React from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';

const VersionHistoryPanel = ({ versions, currentContent, currentTitle, onRestore, onClose }) => {
    const formatTime = (ts) => {
        const d = new Date(ts);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}h ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getPreview = (content) => {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.filter(b => b.type === 'text' || b.type === 'heading').map(b => b.content?.replace(/<[^>]*>/g, '')).filter(Boolean).join(' ').slice(0, 80) || 'No text content';
            }
        } catch { }
        return (content || '').slice(0, 80) || 'No content';
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 w-72 flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <Clock size={14} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Version History</h3>
                        <p className="text-[10px] text-gray-400">{versions.length} saved versions</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Current version */}
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Current version</p>
                </div>
                <p className="text-[11px] text-blue-500 dark:text-blue-500 mt-1 truncate ml-4">{getPreview(currentContent) || 'No content yet'}</p>
            </div>

            {/* Version list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-800">
                {versions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Clock size={32} className="text-gray-200 dark:text-gray-700 mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No saved versions yet</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Versions are saved automatically as you edit</p>
                    </div>
                ) : (
                    [...versions].reverse().map((v, idx) => (
                        <div key={v.timestamp} className="group p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full flex-shrink-0" />
                                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{v.title || 'Untitled'}</p>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mb-1.5 ml-3">{formatTime(v.timestamp)}</p>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 ml-3 line-clamp-2 leading-relaxed">
                                        {getPreview(v.content)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onRestore(v)}
                                    className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    title="Restore this version"
                                >
                                    <RotateCcw size={11} /> Restore
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-gray-400 text-center">Last 20 auto-saves preserved</p>
            </div>
        </div>
    );
};

export default VersionHistoryPanel;
