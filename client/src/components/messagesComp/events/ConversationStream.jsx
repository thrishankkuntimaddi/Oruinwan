import React, { useRef, useEffect, useMemo, useState } from 'react';
import MessageEvent from './MessageEvent';
import PollEvent from './PollEvent';
import SystemEvent from './SystemEvent';
import SystemEventItem from '../SystemEventItem';
import MeetingEvent from './MeetingEvent';
import JoinMarker from '../chatWindowComp/messages/JoinMarker';
import { Loader2, Lock, Hash } from 'lucide-react';
import logger from '../../../utils/logger';

function ConversationStream({
    events = [],
    systemEvents = [],
    creatorName = null,
    channelCreatedAt = null,
    channelName = null,
    channelCreatedById = null,
    isPrivate = false,
    loading = false,
    onLoadMore,
    hasMore = false,
    actions = {},
    conversationType = 'channel',
    channelMembers = [],
    userJoinedAt = null,
    onThreadOpen,
    onReply,
    replyingTo = null,
    onCancelReply,
    currentUserId,
    threadCounts = {},
    conversationId = null,
    showThreadsOnly = false,
}) {
    const streamRef = useRef(null);
    const bottomRef = useRef(null);
    const prevScrollHeight = useRef(0);
    const prevEventsLengthRef = useRef(0); 
    const [openMsgMenuId, setOpenMsgMenuId] = useState(null);

    const toggleMsgMenu = (e, id) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setOpenMsgMenuId(prev => prev === id ? null : id);
    };

    
    useEffect(() => {
        const handleClickOutside = () => setOpenMsgMenuId(null);
        if (openMsgMenuId) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [openMsgMenuId]);

    
    useEffect(() => {
        prevEventsLengthRef.current = 0;
        
        if (bottomRef.current) {
            requestAnimationFrame(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'instant' });
            });
        }
    }, [conversationId]);

    
    useEffect(() => {
        if (!bottomRef.current) return;

        const currentLen = events.length;
        const isInitialLoad = prevEventsLengthRef.current === 0 && currentLen > 0;
        const isNewMessage = currentLen > prevEventsLengthRef.current;

        if (isInitialLoad) {
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
                });
            });
        } else if (isNewMessage) {
            
            const el = streamRef.current;
            const isNearBottom = el
                ? el.scrollHeight - el.scrollTop - el.clientHeight < 200
                : true;
            if (isNearBottom) {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }

        prevEventsLengthRef.current = currentLen;
    }, [events]);

    
    useEffect(() => {
        if (streamRef.current && loading && hasMore) {
            prevScrollHeight.current = streamRef.current.scrollHeight;
        }
    }, [loading, hasMore]);

    useEffect(() => {
        if (streamRef.current && !loading && prevScrollHeight.current > 0) {
            const newScrollHeight = streamRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - prevScrollHeight.current;
            streamRef.current.scrollTop = scrollDiff;
            prevScrollHeight.current = 0;
        }
    }, [loading]);

    
    const handleScroll = () => {
        if (!streamRef.current || loading || !hasMore) return;

        if (streamRef.current.scrollTop < 100) {
            onLoadMore?.();
        }
    };

    
    const mainStreamEvents = events.filter(event => !event.parentId);

    
    const mergedEvents = useMemo(() => {
        
        const transformedSystemEvents = systemEvents.map(sysEvent => ({
            id: `system-${sysEvent._id || sysEvent.timestamp}`,
            type: 'system_timeline',
            createdAt: sysEvent.timestamp,
            payload: {
                type: sysEvent.type,  
                userId: sysEvent.userId,
                timestamp: sysEvent.timestamp,
                userName: sysEvent.userName
            }
        }));

        
        const merged = [...mainStreamEvents, ...transformedSystemEvents];
        const sorted = merged.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateA - dateB;
        });

        
        
        
        
        if (showThreadsOnly) {
            const SYSTEM_TYPES = new Set(['system', 'channel-update', 'pin', 'member-joined', 'member-left', 'meeting']);
            return sorted.filter(e => {
                
                if (SYSTEM_TYPES.has(e.type)) return true;
                
                
                const count = (threadCounts[e.id] ?? 0) || (e.replyCount ?? 0);
                return count > 0;
            });
        }
        return sorted;
    }, [mainStreamEvents, systemEvents, showThreadsOnly, threadCounts]);

    
    const groupedEvents = useMemo(() => {
        const grouped = {};
        mergedEvents.forEach(event => {
            const raw = event.createdAt || event.payload?.createdAt;
            const date = new Date(raw);
            
            if (!raw || isNaN(date.getTime())) return;
            const dateKey = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(event);
        });
        return grouped;
    }, [mergedEvents]);

    
    const renderEvent = (event) => {
        switch (event.type) {
            case 'message':
            
            
            case 'image':
            case 'video':
            case 'file':
            case 'voice':
            
            case 'contact':
                return conversationType === 'channel' ? (
                    <MessageEvent
                        key={event.id}
                        event={event}
                        actions={actions}
                        onThreadOpen={onThreadOpen}
                        onReply={onReply}
                        replyingTo={replyingTo}
                        onCancelReply={onCancelReply}
                        currentUserId={currentUserId}
                        openMsgMenuId={openMsgMenuId}
                        toggleMsgMenu={toggleMsgMenu}
                        setOpenMsgMenuId={setOpenMsgMenuId}
                        threadCounts={threadCounts} 
                    />
                ) : (
                    <MessageEvent
                        key={event.id}
                        event={event}
                        actions={actions}
                        isDM={true}
                        onReply={onReply}
                        currentUserId={currentUserId}
                        openMsgMenuId={openMsgMenuId}
                        toggleMsgMenu={toggleMsgMenu}
                        setOpenMsgMenuId={setOpenMsgMenuId}
                        threadCounts={threadCounts} 
                    />
                );

            case 'poll':
                return (
                    <PollEvent
                        key={event.id}
                        event={event}
                        actions={actions}
                        currentUserId={currentUserId}
                    />
                );

            case 'meeting':
                return (
                    <MeetingEvent
                        key={event.id}
                        event={event}
                        currentUserId={currentUserId}
                    />
                );

            case 'system':
                return (
                    <SystemEvent
                        key={event.id}
                        event={event}
                        currentUserId={currentUserId}
                    />
                );

            case 'system_timeline':
                return (
                    <SystemEventItem
                        key={event.id}
                        event={event.payload}
                        currentUserId={currentUserId}
                        creatorName={creatorName}
                    />
                );

            default:
                logger.warn('[ConversationStream] Unknown event type:', event.type);
                return null;
        }
    };

    return (
        <div
            ref={streamRef}
            className="conversation-stream"
            onScroll={handleScroll}
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-primary)'
            }}
        >
            {}
            {showThreadsOnly && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '6px', padding: '6px 12px',
                    backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-accent)',
                    fontSize: '12px', color: 'var(--accent)', fontWeight: 500,
                }}>
                    <span>🧵</span>
                    <span>Showing only threaded messages — click the thread icon to see all messages</span>
                </div>
            )}

            {}
            {hasMore && (
                <div style={{ padding: '8px 16px', textAlign: 'center' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
                            {[65, 80, 50].map((w, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <div style={{ height: '10px', width: '80px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px' }} />
                                            <div style={{ height: '10px', width: '40px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', opacity: 0.6 }} />
                                        </div>
                                        <div style={{ height: '12px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${w}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <button
                            onClick={() => onLoadMore?.()}
                            style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', padding: '4px 16px', fontFamily: 'var(--font)', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        >
                            Load older messages
                        </button>
                    )}
                </div>
            )}

            {}
            {conversationType === 'channel' && channelCreatedAt && (() => {
                const cleanName = (channelName || 'this channel').replace(/^#+/, '');
                return (
                    <div style={{ padding: '2rem 1.5rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        {}
                        <div style={{
                            width: 48, height: 48, borderRadius: '2px',
                            backgroundColor: isPrivate ? 'rgba(184,149,106,0.08)' : 'var(--bg-active)',
                            border: '1px solid var(--border-accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '12px',
                        }}>
                            {isPrivate
                                ? <Lock size={22} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                                : <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>#</span>
                            }
                        </div>

                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                            Welcome to {isPrivate ? '' : '#'}{cleanName}!
                        </h2>

                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.65 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{isPrivate ? '' : '#'}{cleanName}</span>
                            {' '}was created by{' '}
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {String(currentUserId) === String(channelCreatedById)
                                    ? 'You'
                                    : (creatorName || 'Unknown')
                                }
                            </span>
                            {' '}on{' '}
                            {new Date(channelCreatedAt).toLocaleDateString('en-US', {
                                month: 'long', day: 'numeric', year: 'numeric'
                            })}.
                            {' '}This is the very beginning of the{' '}
                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{isPrivate ? '' : '#'}{cleanName}</span>
                            {' '}channel.
                        </p>
                    </div>
                );
            })()}

            {}
            {conversationType === 'channel' && userJoinedAt &&
                String(currentUserId) !== String(channelCreatedById) && (
                    <div style={{ padding: '0 1rem' }}>
                        <JoinMarker date={userJoinedAt} memberInfo={{ userId: currentUserId }} currentUserId={currentUserId} />
                    </div>
                )}

            {}
            <div style={{ padding: '0 1rem' }}>
                {Object.keys(groupedEvents).map(dateKey => {
                    
                    const eventsForDate = groupedEvents[dateKey].filter(
                        event => !(event.type === 'system_timeline' && event.payload.type === 'channel_created')
                    );

                    
                    if (eventsForDate.length === 0) return null;

                    return (
                        <div key={dateKey}>
                            {}
                            <div
                                className="date-divider"
                                style={{
                                    textAlign: 'center',
                                    margin: '1.5rem 0',
                                    position: 'relative'
                                }}
                            >
                                <span
                                    style={{
                                        background: 'var(--bg-active)',
                                        padding: '0.25rem 1rem',
                                        borderRadius: '1rem',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        position: 'relative',
                                        zIndex: 1
                                    }}
                                >
                                    {dateKey}
                                </span>
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: 0,
                                        right: 0,
                                        height: '1px',
                                        background: 'var(--border-default)',
                                        zIndex: 0
                                    }}
                                />
                            </div>

                            {}
                            {eventsForDate.map((event, idx) => (
                                <div key={event.id || `event-${dateKey}-${idx}`}>
                                    {renderEvent(event)}
                                </div>
                            ))}

                            {}
                            {conversationType === 'channel' && channelMembers.map(member => {
                                const memberJoinDate = new Date(member.joinedAt).toLocaleDateString();
                                if (memberJoinDate === dateKey) {
                                    return (
                                        <div
                                            key={`join-${member.userId}`}
                                            style={{
                                                textAlign: 'center',
                                                padding: '0.5rem',
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)'
                                            }}
                                        >
                                            <strong>{member.username}</strong> joined the channel
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )
                })}
            </div>

            {}
            {events.length === 0 && loading && !channelCreatedAt && (
                <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {[{ name: 22, line1: 68, line2: 0 }, { name: 18, line1: 50, line2: 35 }, { name: 24, line1: 80, line2: 55 }, { name: 20, line1: 45, line2: 0 }, { name: 22, line1: 72, line2: 40 }, { name: 16, line1: 58, line2: 0 }].map((row, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-hover)', flexShrink: 0 }} />
                            <div style={{ flex: 1, maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    <div style={{ height: '10px', width: `${row.name * 4}px`, backgroundColor: 'var(--bg-hover)', borderRadius: '2px' }} />
                                    <div style={{ height: '8px', width: '40px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', opacity: 0.6 }} />
                                </div>
                                <div style={{ height: '14px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${row.line1}%` }} />
                                {row.line2 > 0 && <div style={{ height: '14px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', width: `${row.line2}%`, opacity: 0.7 }} />}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {}
            {events.length === 0 && !loading && !channelCreatedAt && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', userSelect: 'none' }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: '2px',
                        backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '16px',
                    }}>
                        {conversationType === 'channel'
                            ? <Hash size={24} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                            : <span style={{ fontSize: 24 }}>💬</span>
                        }
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                        {conversationType === 'channel'
                            ? (channelName ? `Start of #${channelName.replace(/^#+/, '')}` : 'No messages yet')
                            : 'No messages yet'
                        }
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.65, fontFamily: 'var(--font)' }}>
                        {conversationType === 'channel'
                            ? 'Be the first to say something!'
                            : 'Send a message to start the conversation.'
                        }
                    </p>
                </div>
            )}

            {}
            <div ref={bottomRef} />
        </div>
    );
}

export default ConversationStream;
