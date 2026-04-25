import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowRight, Search, ListFilter } from 'lucide-react';
import ThreadPanel from '../ThreadPanel';
import api from '@services/api';
import { formatTime } from '../helpers/helpers';
import { batchDecryptMessages } from '../../../../services/messageEncryptionService';
import { getAvatarUrl } from '../../../../utils/avatarUtils';

export default function ThreadsTab({ channelId, currentUserId, socket }) {
    const [threads, setThreads] = useState([]);
    const [selectedThread, setSelectedThread] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/threads/channels/${channelId}/threads`);
            const activeThreads = res.data.threads || [];
            let decryptedThreads = activeThreads;
            if (activeThreads.length > 0) {
                try {
                    decryptedThreads = await batchDecryptMessages(activeThreads, channelId, 'channel', null);
                } catch (err) {
                    console.error('[THREADS_TAB][DECRYPT] Failed to decrypt threads:', err);
                    decryptedThreads = activeThreads;
                }
            }
            setThreads(decryptedThreads);
        } catch (err) {
            console.error('[THREADS_TAB][ERROR] Failed to fetch threads:', err);
            setThreads([]);
        } finally {
            setLoading(false);
        }
    }, [channelId]);

    useEffect(() => { fetchThreads(); }, [fetchThreads]);

    useEffect(() => {
        if (!socket) return;

        const handleThreadCreated = async (data) => {
            if (data.channelId && data.channelId !== channelId) return;
            if (data.parentMessage) {
                try {
                    const decrypted = await batchDecryptMessages([data.parentMessage], channelId, 'channel', null);
                    const decryptedParent = decrypted[0] || data.parentMessage;
                    setThreads(prev => [decryptedParent, ...prev]);
                } catch (err) {
                    setThreads(prev => [data.parentMessage, ...prev]);
                }
            }
        };

        const handleMessageUpdated = (data) => {
            const { messageId, updates } = data;
            if (updates?.replyCount !== undefined) {
                setThreads(prev => prev.map(thread =>
                    thread._id === messageId ? { ...thread, replyCount: updates.replyCount } : thread
                ));
            }
        };

        const handleThreadReply = (data) => {
            const { parentId, reply } = data;
            setThreads(prev => {
                const thread = prev.find(t => t._id === parentId);
                if (!thread) return prev;
                const updated = { ...thread, lastReplyAt: reply.createdAt, lastReplyUser: reply.sender };
                const others = prev.filter(t => t._id !== parentId);
                return [updated, ...others];
            });
        };

        socket.on('thread:created', handleThreadCreated);
        socket.on('message-updated', handleMessageUpdated);
        socket.on('thread-reply', handleThreadReply);

        return () => {
            socket.off('thread:created', handleThreadCreated);
            socket.off('message-updated', handleMessageUpdated);
            socket.off('thread-reply', handleThreadReply);
        };
    }, [socket, channelId]);

    const filteredThreads = threads.filter(t => {
        const text = t.decryptedContent || t.payload?.text || t.text || '';
        return text.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: 'var(--bg-base)' }}>
            {}
            <div style={{
                flexShrink: 0, width: '280px', display: 'flex', flexDirection: 'column',
                borderRight: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
            }}>
                {}
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 style={{
                        fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)',
                        marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        <MessageSquare size={16} style={{ color: 'var(--text-muted)' }} />
                        Active Threads
                        <span style={{
                            fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-active)', padding: '1px 8px', borderRadius: '2px',
                            marginLeft: 'auto',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>
                            {threads.length}
                        </span>
                    </h2>

                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={13} />
                        <input
                            type="text"
                            placeholder="Search threads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', paddingLeft: '32px', paddingRight: '12px',
                                paddingTop: '7px', paddingBottom: '7px',
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '2px',
                                color: 'var(--text-primary)', fontSize: '13px',
                                outline: 'none', boxSizing: 'border-box',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                transition: 'border-color 150ms ease',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {loading ? (
                        <div style={{ padding: '8px' }}>
                            {[75, 55, 90, 60, 80].map((w, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', marginBottom: '4px',
                                    backgroundColor: 'var(--bg-active)', borderRadius: '2px',
                                }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--bg-hover)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ height: '10px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', marginBottom: '6px', width: '60%' }} />
                                        <div style={{ height: '10px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${w}%` }} />
                                    </div>
                                    <div style={{ width: 28, height: 18, backgroundColor: 'var(--bg-hover)', borderRadius: '2px', flexShrink: 0 }} />
                                </div>
                            ))}
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.4 }}>
                            <ListFilter size={40} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>No threads found</p>
                        </div>
                    ) : (
                        filteredThreads.map(thread => {
                            const isSelected = selectedThread?._id === thread._id;
                            return (
                                <div
                                    key={thread._id}
                                    onClick={() => setSelectedThread(thread)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 12px', marginBottom: '2px',
                                        borderRadius: '2px', cursor: 'pointer',
                                        border: `1px solid ${isSelected ? 'var(--border-accent)' : 'transparent'}`,
                                        backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                                        transition: 'background-color 150ms ease, border-color 150ms ease',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; } }}
                                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                >
                                    {}
                                    <img
                                        src={getAvatarUrl(thread.sender || { username: thread.senderName || '?' })}
                                        alt={thread.sender?.username || thread.senderName || 'User'}
                                        style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            objectFit: 'cover', flexShrink: 0,
                                            border: '1px solid var(--border-subtle)',
                                        }}
                                        onError={(e) => {
                                            const name = thread.sender?.username || thread.senderName || '?';
                                            e.target.style.display = 'none';
                                            const div = document.createElement('div');
                                            div.style.cssText = 'width:28px;height:28px;border-radius:50%;background:var(--bg-active);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text-secondary);flex-shrink:0';
                                            div.textContent = name.charAt(0).toUpperCase();
                                            e.target.parentNode.insertBefore(div, e.target);
                                        }}
                                    />

                                    {}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <span style={{
                                                fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                            }}>
                                                {thread.sender?.username || thread.senderName || 'Unknown'}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                                                {formatTime(thread.createdAt)}
                                            </span>
                                        </div>
                                        <p style={{
                                            fontSize: '12px', color: 'var(--text-secondary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            lineHeight: 1.4, margin: 0,
                                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                        }}>
                                            {thread.decryptedContent || thread.payload?.text || thread.text || '— Encrypted message'}
                                        </p>
                                    </div>

                                    {}
                                    <span style={{
                                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '2px 6px', borderRadius: '2px',
                                        backgroundColor: 'var(--bg-active)',
                                        fontSize: '11px', fontWeight: 500, color: 'var(--accent)',
                                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                    }}>
                                        <MessageSquare size={9} />
                                        {thread.replyCount}
                                    </span>

                                    <ArrowRight
                                        size={12}
                                        style={{
                                            flexShrink: 0,
                                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                                            opacity: isSelected ? 1 : 0,
                                            transform: isSelected ? 'translateX(0)' : 'translateX(-4px)',
                                            transition: 'opacity 150ms ease, transform 150ms ease, color 150ms ease',
                                        }}
                                    />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                backgroundColor: 'var(--bg-base)', overflow: 'hidden',
            }}>
                {selectedThread ? (
                    <ThreadPanel
                        parentMessage={selectedThread}
                        channelId={channelId}
                        conversationType="channel"
                        onClose={() => setSelectedThread(null)}
                        socket={socket}
                        currentUserId={currentUserId}
                        showHeader={true}
                        style={{
                            width: '100%',
                            flex: 1,
                            borderLeft: 'none',
                            boxShadow: 'none',
                        }}
                    />
                ) : (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '32px', textAlign: 'center',
                        animation: 'fadeIn 260ms cubic-bezier(0.16,1,0.3,1)',
                    }}>
                        <div style={{
                            width: '72px', height: '72px', backgroundColor: 'var(--bg-active)',
                            borderRadius: '2px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', marginBottom: '20px',
                        }}>
                            <MessageSquare size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                        </div>
                        <h3 style={{
                            fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)',
                            marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>Select a Thread</h3>
                        <p style={{
                            maxWidth: '240px', margin: '0 auto', fontSize: '13px',
                            color: 'var(--text-secondary)', lineHeight: 1.65,
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>
                            Click on any conversation from the list to view the full thread and reply.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
