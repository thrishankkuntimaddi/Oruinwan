import React, { useState, useMemo } from "react";
import { X, MessageSquare } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

/**
 * ThreadsViewModal - Shows only messages that have thread replies
 */
export default function ThreadsViewModal({
    isOpen,
    onClose,
    messages = [],
    threadCounts = {},
    onOpenThread,
    formatTime,
}) {
    const [searchQuery, setSearchQuery] = useState("");

    const threadedMessages = useMemo(() => {
        return messages
            .filter(msg => {
                const count = threadCounts[msg.id] || msg.replyCount || 0;
                return count > 0 && !msg.isDeletedUniversally;
            })
            .sort((a, b) => {
                const aTime = new Date(a.lastReplyAt || a.ts).getTime();
                const bTime = new Date(b.lastReplyAt || b.ts).getTime();
                return bTime - aTime;
            });
    }, [messages, threadCounts]);

    const filteredThreads = useMemo(() => {
        if (!searchQuery.trim()) return threadedMessages;
        const query = searchQuery.toLowerCase();
        return threadedMessages.filter(
            msg => msg.text?.toLowerCase().includes(query) ||
                   msg.senderName?.toLowerCase().includes(query)
        );
    }, [threadedMessages, searchQuery]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 50 }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
                <div
                    style={{
                        width: '100%', maxWidth: '640px', maxHeight: '80vh',
                        display: 'flex', flexDirection: 'column',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '4px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        pointerEvents: 'auto',
                        animation: 'fadeIn 180ms ease',
                        fontFamily: FONT,
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '2px', flexShrink: 0,
                                backgroundColor: 'rgba(184,149,106,0.10)', border: '1px solid var(--border-accent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
                            }}>
                                <MessageSquare size={16} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', fontFamily: FONT }}>Threads</h2>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                                    {threadedMessages.length} active {threadedMessages.length === 1 ? 'thread' : 'threads'}
                                </p>
                            </div>
                        </div>
                        <CloseBtn onClick={onClose} />
                    </div>

                    {/* Search */}
                    <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <input
                            type="text"
                            placeholder="Search threads…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '7px 12px',
                                backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                borderRadius: '2px', outline: 'none', color: 'var(--text-primary)',
                                fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 100ms ease',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                    </div>

                    {/* Thread List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredThreads.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '2px',
                                    backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <MessageSquare size={20} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: FONT }}>
                                    {searchQuery ? 'No threads found' : 'No threads yet'}
                                </p>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                                    {searchQuery
                                        ? 'Try a different search term'
                                        : 'Start a thread by replying to a message'}
                                </p>
                            </div>
                        ) : (
                            filteredThreads.map(msg => {
                                const count = threadCounts[msg.id] || msg.replyCount || 0;
                                return <ThreadRow key={msg.id} msg={msg} count={count} onOpenThread={onOpenThread} onClose={onClose} formatTime={formatTime} />;
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-default)', backgroundColor: 'var(--bg-active)', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: FONT }}>
                            Click on any thread to view the full conversation
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

function ThreadRow({ msg, count, onOpenThread, onClose, formatTime }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => { onOpenThread?.(msg.id); onClose(); }}
            style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
                cursor: 'pointer', transition: '100ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* Avatar */}
                {msg.senderAvatar ? (
                    <img src={msg.senderAvatar} alt={msg.senderName}
                        style={{ width: '36px', height: '36px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '2px',
                        backgroundColor: 'var(--accent)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ color: '#0c0c0c', fontWeight: 700, fontSize: '13px' }}>
                            {(msg.senderName || '?').charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', fontFamily: FONT }}>
                            {msg.senderName || 'Unknown'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: FONT }}>
                            {formatTime?.(msg.ts) || new Date(msg.ts).toLocaleTimeString()}
                        </span>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontFamily: FONT }}>
                        {msg.text}
                    </p>

                    {/* Thread info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                        {/* Reply avatars */}
                        {msg.replyAvatars && msg.replyAvatars.length > 0 && (
                            <div style={{ display: 'flex' }}>
                                {msg.replyAvatars.slice(0, 3).map((avatar, i) => (
                                    <img key={i} src={avatar} alt="Replier"
                                        style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--bg-surface)', objectFit: 'cover', marginLeft: i > 0 ? '-6px' : 0 }} />
                                ))}
                            </div>
                        )}
                        <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: FONT }}>
                            {count} {count === 1 ? 'reply' : 'replies'}
                        </span>
                        {msg.lastReplyAt && (
                            <span style={{ color: 'var(--text-muted)', fontFamily: FONT }}>
                                Last reply {formatTime?.(msg.lastReplyAt) || 'recently'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '6px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={18} />
        </button>
    );
}
