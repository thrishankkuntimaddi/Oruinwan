import React from 'react';
import { Clock, Sparkles, Share2, Check, Trash2, MoreHorizontal, Copy, Download, Info } from 'lucide-react';

const NotesToolbar = ({
    formattedDate,
    showShareTooltip,
    showMenu,
    setShowMenu,
    handleAI,
    handleShare,
    handleDuplicate,
    handleDownloadPDF,
    setIsDeleteModalOpen,
    setShowInfoModal,
    menuRef
}) => {
    return (
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
    );
};

export default NotesToolbar;
