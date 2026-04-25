import React, { useEffect, useState, useCallback } from "react";
import { X, Bookmark, Hash, MessageCircle, Loader2, ExternalLink } from "lucide-react";
import api from '@services/api';
import ReactMarkdown from "react-markdown";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

function fmtDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

export default function BookmarksPanel({ open, onClose, onJumpToMessage, inline = false }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/api/messages/bookmarks");
            setMessages(res.data.messages || []);
        } catch (err) {
            setError("Failed to load bookmarks");
        } finally {
            setLoading(false);
        }
    }, [open]);

    useEffect(() => { load(); }, [load]);

    const handleRemoveBookmark = useCallback(async (messageId) => {
        try {
            await api.post(`/api/messages/${messageId}/bookmark`);
            setMessages(prev => prev.filter(m => m._id !== messageId));
        } catch {  }
    }, []);

    if (!open) return null;

    
    if (inline) {
        return (
            <div style={{
                width: '280px', flexShrink: 0,
                backgroundColor: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border-accent)',
                display: 'flex', flexDirection: 'column',
                fontFamily: FONT,
                height: '100%', overflow: 'hidden',
                animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)',
            }}>
                {}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-default)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bookmark size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', fontFamily: FONT }}>Saved Messages</span>
                        {messages.length > 0 && (
                            <span style={{
                                fontSize: '10px', fontWeight: 600,
                                backgroundColor: 'rgba(184,149,106,0.10)',
                                color: 'var(--accent)',
                                border: '1px solid var(--border-accent)',
                                borderRadius: '99px', padding: '1px 7px',
                                fontFamily: FONT,
                            }}>{messages.length}</span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '4px', background: 'none', border: 'none', outline: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px',
                            display: 'flex', transition: '100ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={14} />
                    </button>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: FONT }}>
                            <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                            <span>Loading...</span>
                        </div>
                    )}
                    {error && (<div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--state-danger)', fontFamily: FONT }}>{error}</div>)}
                    {!loading && !error && messages.length === 0 && (
                        <div style={{ padding: '32px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Bookmark size={18} style={{ color: 'var(--text-muted)' }} />
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: FONT }}>No saved messages</p>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>Bookmark messages to find them here</p>
                        </div>
                    )}
                    {!loading && messages.map(msg => (
                        <BookmarkCard key={msg._id} msg={msg} onJumpToMessage={onJumpToMessage} onRemove={handleRemoveBookmark} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            {}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(1px)' }}
                onClick={onClose}
            />

            {}
            <div style={{
                position: 'fixed', right: 0, top: 0, height: '100%', width: '320px',
                zIndex: 50, backgroundColor: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border-accent)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column',
                fontFamily: FONT,
                animation: 'slideInRight 220ms cubic-bezier(0.16,1,0.3,1)',
            }}>
                {}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border-default)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bookmark size={16} style={{ color: 'var(--accent)' }} />
                        <h2 style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', fontFamily: FONT }}>
                            Saved Messages
                        </h2>
                        {messages.length > 0 && (
                            <span style={{
                                fontSize: '10px', fontWeight: 600,
                                backgroundColor: 'rgba(184,149,106,0.10)',
                                color: 'var(--accent)',
                                border: '1px solid var(--border-accent)',
                                borderRadius: '99px', padding: '1px 7px',
                                fontFamily: FONT,
                            }}>
                                {messages.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '5px', background: 'none', border: 'none', outline: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px',
                            display: 'flex', transition: '100ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={16} />
                    </button>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '96px', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: FONT }}>
                            <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
                            <span>Loading...</span>
                        </div>
                    )}
                    {error && (
                        <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--state-danger)', fontFamily: FONT }}>{error}</div>
                    )}
                    {!loading && !error && messages.length === 0 && (
                        <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '2px',
                                backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Bookmark size={20} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: FONT }}>No saved messages</p>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>Bookmark messages to find them here</p>
                        </div>
                    )}
                    {!loading && messages.map(msg => (
                        <BookmarkCard
                            key={msg._id}
                            msg={msg}
                            onJumpToMessage={onJumpToMessage}
                            onRemove={handleRemoveBookmark}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}

function BookmarkCard({ msg, onJumpToMessage, onRemove }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
                transition: 'background-color 100ms ease',
                cursor: 'default',
            }}
        >
            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                {msg.sender?.profilePicture ? (
                    <img
                        src={msg.sender.profilePicture}
                        alt=""
                        style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                ) : (
                    <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                        backgroundColor: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#0c0c0c' }}>
                            {(msg.sender?.username || "U")[0].toUpperCase()}
                        </span>
                    </div>
                )}
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {msg.sender?.username || "Unknown"}
                </span>
                {msg.channel && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <Hash size={9} />
                        {msg.channel.name || "Channel"}
                    </span>
                )}
                {msg.dm && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        <MessageCircle size={9} />
                        DM
                    </span>
                )}
            </div>

            {}
            <div style={{
                fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
                <ReactMarkdown>{msg.text || "(attachment)"}</ReactMarkdown>
            </div>

            {}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>{fmtDate(msg.createdAt)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: hovered ? 1 : 0, transition: 'opacity 150ms ease' }}>
                    {onJumpToMessage && (
                        <ActionButton
                            onClick={() => onJumpToMessage(msg._id)}
                            title="Jump to message"
                            icon={<ExternalLink size={12} />}
                        />
                    )}
                    <ActionButton
                        onClick={() => onRemove(msg._id)}
                        title="Remove bookmark"
                        icon={<Bookmark size={12} style={{ fill: 'currentColor' }} />}
                        danger
                    />
                </div>
            </div>
        </div>
    );
}

function ActionButton({ onClick, title, icon, danger }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            title={title}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '4px', border: 'none', outline: 'none', cursor: 'pointer',
                borderRadius: '2px', display: 'flex', transition: '100ms ease', background: 'none',
                color: danger
                    ? (hovered ? 'var(--state-danger)' : 'var(--text-muted)')
                    : (hovered ? 'var(--text-primary)' : 'var(--text-muted)'),
                backgroundColor: danger && hovered ? 'rgba(255,80,80,0.08)' : hovered ? 'var(--bg-hover)' : 'transparent',
            }}
        >
            {icon}
        </button>
    );
}
