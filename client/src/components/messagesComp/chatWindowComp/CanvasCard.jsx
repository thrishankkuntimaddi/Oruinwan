// client/src/components/messagesComp/chatWindowComp/CanvasCard.jsx
// ⚠️ UI-ONLY COMPONENT — No sockets, context, or API calls here.

import { useState, useEffect, useRef } from 'react';
import { MoreVertical, Edit2, Share2, Trash2, Clock, FileText } from 'lucide-react';

const COVER_COLORS = [
    '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
    '#10B981', '#06B6D4', '#3B82F6', '#84CC16', '#F97316'
];

const EMOJIS = ['📄', '📝', '✍️', '📊', '🗒️', '💡', '🎨', '📐', '🔖', '⚡', '🚀', '🎯', '📌', '💬', '🔥', '✅', '📅', '🧩', '💎', '🌟'];

function timeAgo(date) {
    if (!date) return 'Never edited';
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
}

function ContextMenu({ onRename, onShare, onDelete, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={ref} className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-2xl border border-gray-100 z-[70] overflow-hidden py-1"
            style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            <button onClick={(e) => { e.stopPropagation(); onShare(); onClose(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                <Share2 size={14} className="text-gray-400" /> Copy link
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                <Edit2 size={14} className="text-gray-400" /> Rename
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors">
                <Trash2 size={14} /> Delete
            </button>
        </div>
    );
}

function CanvasCard({ tab, view, onClick, onDelete, onRename, onShare }) {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(tab.name);
    const inputRef = useRef(null);
    const menuRef = useRef(null);

    useEffect(() => { setRenameValue(tab.name); }, [tab.name]);
    useEffect(() => { if (isRenaming && inputRef.current) inputRef.current.focus(); }, [isRenaming]);

    const handleSaveRename = (e) => {
        e?.stopPropagation();
        const val = renameValue.trim();
        if (val && val !== tab.name) onRename(tab._id, val);
        else setRenameValue(tab.name);
        setIsRenaming(false);
    };

    const color = tab.coverColor || '#6366F1';
    const emoji = tab.emoji || '📄';
    const editorName = tab.lastEditedBy?.username || null;
    const wordCount = tab.wordCount || 0;
    const readTime = wordCount > 0 ? `${Math.max(1, Math.round(wordCount / 200))} min read` : null;

    if (view === 'list') {
        return (
            <div onClick={onClick}
                className="group flex items-center justify-between px-4 py-3.5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: `${color}18`, border: `1.5px solid ${color}30` }}>
                        {emoji}
                    </div>
                    <div className="min-w-0">
                        {isRenaming ? (
                            <input ref={inputRef} value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={handleSaveRename}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(e); if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(tab.name); } }}
                                onClick={e => e.stopPropagation()}
                                className="bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 font-semibold w-48 text-sm" />
                        ) : (
                            <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">{tab.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                            <Clock size={11} className="text-gray-300 flex-shrink-0" />
                            <span className="text-xs text-gray-400">{timeAgo(tab.lastEditedAt)}</span>
                            {editorName && <span className="text-xs text-gray-300">· by {editorName}</span>}
                            {readTime && <><span className="text-gray-200">·</span><span className="text-xs text-gray-400">{readTime}</span></>}
                        </div>
                    </div>
                </div>
                <div className="relative flex-shrink-0" ref={menuRef}>
                    <button onClick={e => { e.stopPropagation(); setShowMenu(s => !s); }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <MoreVertical size={16} />
                    </button>
                    {showMenu && <ContextMenu
                        onRename={() => setIsRenaming(true)}
                        onShare={() => onShare(tab._id)}
                        onDelete={() => onDelete(tab._id)}
                        onClose={() => setShowMenu(false)} />}
                </div>
            </div>
        );
    }

    // Grid View
    return (
        <div onClick={onClick}
            className="group relative flex flex-col bg-white rounded-2xl border border-gray-200 hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer overflow-hidden">
            {/* Cover accent bar */}
            <div className="h-1.5 w-full flex-shrink-0" style={{ background: color }} />

            {/* Card body */}
            <div className="flex flex-col flex-1 p-5">
                {/* Top: emoji + menu */}
                <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: `${color}15`, border: `1.5px solid ${color}25` }}>
                        {emoji}
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button onClick={e => { e.stopPropagation(); setShowMenu(s => !s); }}
                            className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <MoreVertical size={16} />
                        </button>
                        {showMenu && <ContextMenu
                            onRename={() => setIsRenaming(true)}
                            onShare={() => onShare(tab._id)}
                            onDelete={() => onDelete(tab._id)}
                            onClose={() => setShowMenu(false)} />}
                    </div>
                </div>

                {/* Title */}
                <div className="flex-1">
                    {isRenaming ? (
                        <input ref={inputRef} value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(e); if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(tab.name); } }}
                            onClick={e => e.stopPropagation()}
                            className="bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 font-bold text-base w-full mb-1" />
                    ) : (
                        <h3 className="font-bold text-base text-gray-900 mb-1 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {tab.name}
                        </h3>
                    )}
                    {wordCount > 0 && (
                        <p className="text-xs text-gray-400">{wordCount} words · {readTime}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-100">
                    <FileText size={11} className="text-gray-300 flex-shrink-0" />
                    <span className="text-xs text-gray-400 truncate flex-1">
                        {editorName ? `${editorName} · ` : ''}{timeAgo(tab.lastEditedAt)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default CanvasCard;
