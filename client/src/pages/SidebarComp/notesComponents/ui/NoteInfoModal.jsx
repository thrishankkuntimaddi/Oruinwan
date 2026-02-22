import React from 'react';
import { X, FileText, Clock, Tag, Hash, AlignLeft } from 'lucide-react';

const NoteInfoModal = ({ note, blocks, showInfoModal, setShowInfoModal }) => {
    if (!showInfoModal || !note) return null;

    // Word count — strip HTML tags from text/heading blocks, parse checklist
    const wordCount = blocks.reduce((acc, b) => {
        if (b.type === 'text' || b.type === 'heading') {
            const plain = (b.content || '').replace(/<[^>]*>/g, '').trim();
            return acc + (plain ? plain.split(/\s+/).length : 0);
        }
        if (b.type === 'checklist') {
            try {
                const items = JSON.parse(b.content);
                if (Array.isArray(items)) {
                    return acc + items.reduce((s, it) => s + (it.text?.split(/\s+/).length || 0), 0);
                }
            } catch { }
        }
        return acc;
    }, 0);

    const blockCounts = blocks.reduce((acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
    }, {});

    const blockSummary = Object.entries(blockCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([type, count]) => ({ type, count }));

    const sizeKb = (JSON.stringify(blocks).length / 1024).toFixed(2);

    const createdFull = new Date(note.createdAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const editedFull = new Date(note.updatedAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowInfoModal(false)}
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-96 overflow-hidden border border-gray-200 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Note Info</h3>
                            <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{note.title || 'Untitled Note'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowInfoModal(false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Stats grid */}
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{wordCount}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">Words</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{blocks.length}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">Blocks</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{sizeKb}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">KB</p>
                        </div>
                    </div>

                    {/* Block breakdown */}
                    {blockSummary.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Block breakdown</p>
                            <div className="space-y-1.5">
                                {blockSummary.map(({ type, count }) => (
                                    <div key={type} className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">{type}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden w-20">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${Math.round((count / blocks.length) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-4 text-right">{count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                                {note.tags.map(tag => (
                                    <span key={tag} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-[11px] font-medium">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dates */}
                    <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                <Clock size={11} /> Created
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{createdFull}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                <Clock size={11} /> Last edited
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{editedFull}</span>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-5">
                    <button
                        onClick={() => setShowInfoModal(false)}
                        className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NoteInfoModal;
