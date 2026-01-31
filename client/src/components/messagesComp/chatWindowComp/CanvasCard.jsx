// client/src/components/messagesComp/chatWindowComp/CanvasCard.jsx

// ⚠️ UI-ONLY COMPONENT
// Do NOT add sockets, context, or API calls here.
// This component must remain props-only.

import { useState, useEffect, useRef } from 'react';
import { FileText, MoreVertical, Edit2, Share2, Trash2 } from 'lucide-react';

/**
 * CanvasCard - Display component for canvas tabs
 * @param {object} tab - Canvas tab data { _id, name, type, content }
 * @param {string} view - Display mode: 'list' | 'grid'
 * @param {function} onClick - Click handler for card
 * @param {function} onDelete - Delete handler (tabId)
 * @param {function} onRename - Rename handler (tabId, newName)
 * @param {function} onShare - Share handler (tabId)
 */
function CanvasCard({ tab, view, onClick, onDelete, onRename, onShare }) {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(tab.name);
    const menuRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isRenaming]);

    const handleSaveRename = (e) => {
        e.stopPropagation();
        if (renameValue.trim()) {
            onRename(tab._id, renameValue.trim());
        } else {
            setRenameValue(tab.name); // Revert if empty
        }
        setIsRenaming(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSaveRename(e);
        if (e.key === 'Escape') {
            setIsRenaming(false);
            setRenameValue(tab.name);
        }
    };

    if (view === 'list') {
        return (
            <div
                onClick={onClick}
                className="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <FileText size={20} />
                    </div>
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-gray-100 font-medium w-64"
                        />
                    ) : (
                        <div>
                            <h3 className="text-gray-900 dark:text-gray-100 font-medium">{tab.name}</h3>
                            <p className="text-xs text-gray-500">Edited recently</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2" ref={menuRef}>
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(!showMenu);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <MoreVertical size={18} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-[60] overflow-hidden py-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onShare(tab._id);
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                    <Share2 size={14} /> Share
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsRenaming(true);
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                    <Edit2 size={14} /> Rename
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(tab._id);
                                        setShowMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Grid View
    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer min-h-[240px]"
        >
            {/* Top Bar */}
            <div className="flex items-start justify-between mb-6 z-10">
                <div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/10 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-sm">
                    <FileText size={28} />
                </div>

                <div className="relative" ref={menuRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                        <MoreVertical size={20} />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-[60] overflow-hidden py-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onShare(tab._id);
                                    setShowMenu(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                                <Share2 size={14} /> Share
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsRenaming(true);
                                    setShowMenu(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                                <Edit2 size={14} /> Rename
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(tab._id);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Visual Preview Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/5 dark:to-black/20 pointer-events-none rounded-2xl" />

            {/* Bottom Content */}
            <div className="mt-auto relative z-10">
                {isRenaming ? (
                    <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 dark:text-gray-100 font-bold text-xl w-full mb-1"
                    />
                ) : (
                    <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-2 truncate tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {tab.name}
                    </h3>
                )}

                <div className="flex items-center justify-between text-xs font-medium text-gray-400 dark:text-gray-500">
                    <span className="uppercase tracking-wider">Canvas</span>
                    <span>Just now</span>
                </div>
            </div>
        </div>
    );
}

export default CanvasCard;
