// client/src/components/messagesComp/chatWindowComp/CanvasCard.jsx

import { useState, useEffect, useRef } from 'react';
import { MoreVertical, Edit2, Share2, Trash2, Clock, FileText } from 'lucide-react';

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
        <div ref={ref} style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
            width: '168px', backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-accent)', borderRadius: '2px',
            zIndex: 70, overflow: 'hidden', padding: '4px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
            <CtxBtn icon={<Share2 size={13} />} label="Copy link" onClick={(e) => { e.stopPropagation(); onShare(); onClose(); }} />
            <CtxBtn icon={<Edit2 size={13} />} label="Rename" onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }} />
            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
            <CtxBtn icon={<Trash2 size={13} />} label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }} danger />
        </div>
    );
}

function CtxBtn({ icon, label, onClick, danger = false }) {
    const [h, setH] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setH(true)}
            onMouseLeave={() => setH(false)}
            style={{
                width: '100%', textAlign: 'left', padding: '7px 14px',
                display: 'flex', alignItems: 'center', gap: '10px',
                backgroundColor: h ? 'var(--bg-hover)' : 'transparent',
                color: danger ? 'var(--state-danger)' : (h ? 'var(--text-primary)' : 'var(--text-secondary)'),
                border: 'none', cursor: 'pointer', fontSize: '13px',
                transition: 'background-color 150ms ease, color 150ms ease',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
        >{icon}{label}</button>
    );
}

function CanvasCard({ tab, view, onClick, onDelete, onRename, onShare }) {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(tab.name);
    const inputRef = useRef(null);
    const menuRef = useRef(null);
    const [hovered, setHovered] = useState(false);

    useEffect(() => { setRenameValue(tab.name); }, [tab.name]);
    useEffect(() => { if (isRenaming && inputRef.current) inputRef.current.focus(); }, [isRenaming]);

    const handleSaveRename = (e) => {
        e?.stopPropagation();
        const val = renameValue.trim();
        if (val && val !== tab.name) onRename(tab._id, val);
        else setRenameValue(tab.name);
        setIsRenaming(false);
    };

    const color = tab.coverColor || '#b8956a';
    const emoji = tab.emoji || '📄';
    const editorName = tab.lastEditedBy?.username || null;
    const wordCount = tab.wordCount || 0;
    const readTime = wordCount > 0 ? `${Math.max(1, Math.round(wordCount / 200))} min read` : null;

    const inputStyle = {
        background: 'transparent',
        borderBottom: '1px solid var(--accent)',
        outline: 'none',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        fontWeight: 500,
        width: '100%',
    };

    if (view === 'list') {
        return (
            <div
                onClick={onClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
                    border: `1px solid ${hovered ? 'var(--border-accent)' : 'var(--border-default)'}`,
                    borderRadius: '2px', cursor: 'pointer', gap: '12px',
                    transition: 'background-color 150ms ease, border-color 150ms ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: '2px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                        backgroundColor: `${color}18`, border: `1px solid ${color}30`,
                    }}>{emoji}</div>
                    <div style={{ minWidth: 0 }}>
                        {isRenaming ? (
                            <input ref={inputRef} value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={handleSaveRename}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(e); if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(tab.name); } }}
                                onClick={e => e.stopPropagation()} style={inputStyle} />
                        ) : (
                            <p style={{
                                fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}>{tab.name}</p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <Clock size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                                {timeAgo(tab.lastEditedAt)}
                            </span>
                            {editorName && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>· by {editorName}</span>}
                            {readTime && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>· {readTime}</span>}
                        </div>
                    </div>
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
                    <button
                        onClick={e => { e.stopPropagation(); setShowMenu(s => !s); }}
                        style={{
                            padding: '5px', borderRadius: '2px', background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)',
                            opacity: hovered ? 1 : 0,
                            transition: 'opacity 150ms ease, color 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    ><MoreVertical size={15} /></button>
                    {showMenu && <ContextMenu onRename={() => setIsRenaming(true)} onShare={() => onShare(tab._id)} onDelete={() => onDelete(tab._id)} onClose={() => setShowMenu(false)} />}
                </div>
            </div>
        );
    }

    // Grid View
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative', display: 'flex', flexDirection: 'column',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
                border: `1px solid ${hovered ? 'var(--border-accent)' : 'var(--border-default)'}`,
                borderRadius: '2px', cursor: 'pointer', overflow: 'hidden',
                transition: 'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
                transform: hovered ? 'translateY(-1px)' : 'none',
            }}
        >
            {/* Accent bar */}
            <div style={{ height: '2px', width: '100%', backgroundColor: color, flexShrink: 0 }} />

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '18px' }}>
                {/* Top: emoji + menu */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '2px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                        backgroundColor: `${color}18`, border: `1px solid ${color}25`,
                    }}>{emoji}</div>
                    <div style={{ position: 'relative' }} ref={menuRef}>
                        <button
                            onClick={e => { e.stopPropagation(); setShowMenu(s => !s); }}
                            style={{
                                padding: '4px', borderRadius: '2px', background: 'none', border: 'none',
                                cursor: 'pointer', color: 'var(--text-muted)',
                                opacity: hovered ? 1 : 0, transition: 'opacity 150ms ease',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        ><MoreVertical size={15} /></button>
                        {showMenu && <ContextMenu onRename={() => setIsRenaming(true)} onShare={() => onShare(tab._id)} onDelete={() => onDelete(tab._id)} onClose={() => setShowMenu(false)} />}
                    </div>
                </div>

                {/* Title */}
                <div style={{ flex: 1 }}>
                    {isRenaming ? (
                        <input ref={inputRef} value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(e); if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(tab.name); } }}
                            onClick={e => e.stopPropagation()}
                            style={{ ...inputStyle, fontSize: '14px', fontWeight: 600 }} />
                    ) : (
                        <h3 style={{
                            fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)',
                            marginBottom: '4px', lineHeight: 1.3,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>{tab.name}</h3>
                    )}
                    {wordCount > 0 && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                            {wordCount} words · {readTime}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px',
                    paddingTop: '12px', borderTop: '1px solid var(--border-subtle)',
                }}>
                    <FileText size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{
                        fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        {editorName ? `${editorName} · ` : ''}{timeAgo(tab.lastEditedAt)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default CanvasCard;
