// client/src/components/messagesComp/events/ConversationStream.jsx
// Unified event stream renderer - replaces messagesContainer.jsx

import React, { useRef, useEffect, useMemo, useState } from 'react';
import MessageEvent from './MessageEvent';
import PollEvent from './PollEvent';
import SystemEvent from './SystemEvent';
import SystemEventItem from '../SystemEventItem';
import MeetingEvent from './MeetingEvent';
import JoinMarker from '../chatWindowComp/messages/JoinMarker';
import { Loader2 } from 'lucide-react';

// ⚠️ PURE RENDERING COMPONENT
// This component receives ALL business logic as props (actions, callbacks).
// DO NOT add API calls, socket emissions, encryption logic, or state mutations here.
// Business orchestration lives in ChatWindowV2.jsx + useMessageActions.js
// This component ONLY: renders messages, handles scroll, groups by date.


/**
 * ConversationStream - Pure Message Rendering Layer
 * 
 * ARCHITECTURE: This component is a PURE RENDERER that receives all business logic as props.
 * It delegates actions to child components (MessageEvent, PollEvent) without executing them.
 * 
 * RESPONSIBILITIES:
 * ✅ Render message stream with infinite scroll
 * ✅ Group messages by date
 * ✅ Merge system events into timeline
 * ✅ Handle scroll position maintenance
 * ✅ Display loading states and empty states
 * 
 * DOES NOT (Business logic in parent):
 * ❌ Make API calls
 * ❌ Emit socket events
 * ❌ Perform encryption/decryption
 * ❌ Mutate message state
 * ❌ Contain business handlers
 * 
 * @param {array} events - Array of conversation events (messages, polls, meetings)
 * @param {array} systemEvents - System events (joins, leaves, channel created)
 * @param {string} creatorName - Channel creator name (for system events)
 * @param {boolean} loading - Loading state for pagination
 * @param {function} onLoadMore - Callback for pagination (handled by useConversation)
 * @param {boolean} hasMore - Whether more messages exist
 * @param {object} actions - Message actions from useMessageActions (delegated to children)
 * @param {string} conversationType - "channel" | "dm"  
 * @param {array} channelMembers - Channel members with join dates (for markers)
 * @param {date} userJoinedAt - When current user joined (for join marker)
 * @param {function} onThreadOpen - Callback when thread is opened (handled by ChatWindowV2)
 * @param {object} replyingTo - Current reply state
 * @param {function} onCancelReply - Callback to cancel reply
 * @param {string} currentUserId - Current user ID
 * @param {object} threadCounts - Thread reply counts by message ID
 */
function ConversationStream({
    events = [],
    systemEvents = [],
    creatorName = null,
    channelCreatedAt = null,
    channelName = null,
    channelCreatedById = null,
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
    const prevEventsLengthRef = useRef(0); // track initial load
    const [openMsgMenuId, setOpenMsgMenuId] = useState(null);

    const toggleMsgMenu = (e, id) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setOpenMsgMenuId(prev => prev === id ? null : id);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMsgMenuId(null);
        if (openMsgMenuId) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [openMsgMenuId]);

    // Reset scroll tracking when switching channels/DMs
    useEffect(() => {
        prevEventsLengthRef.current = 0;
        // Also jump to bottom immediately if content already loaded
        if (bottomRef.current) {
            requestAnimationFrame(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'instant' });
            });
        }
    }, [conversationId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (!bottomRef.current) return;

        const currentLen = events.length;
        const isInitialLoad = prevEventsLengthRef.current === 0 && currentLen > 0;
        const isNewMessage = currentLen > prevEventsLengthRef.current;

        if (isInitialLoad) {
            // On first load: jump instantly to bottom (DOM not yet scrolled)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
                });
            });
        } else if (isNewMessage) {
            // On new message: only scroll if user is near bottom
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

    // Maintain scroll position when loading more
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

    // Detect scroll to top for pagination
    const handleScroll = () => {
        if (!streamRef.current || loading || !hasMore) return;

        if (streamRef.current.scrollTop < 100) {
            onLoadMore?.();
        }
    };

    // Filter out thread messages (they render in ThreadPanel)
    const mainStreamEvents = events.filter(event => !event.parentId);

    // Merge systemEvents into the event stream
    const mergedEvents = useMemo(() => {
        // Transform systemEvents to match event stream format
        const transformedSystemEvents = systemEvents.map(sysEvent => ({
            id: `system-${sysEvent._id || sysEvent.timestamp}`,
            type: 'system_timeline',
            createdAt: sysEvent.timestamp,
            payload: {
                type: sysEvent.type,  // Use 'type' not 'eventType' for SystemEventItem
                userId: sysEvent.userId,
                timestamp: sysEvent.timestamp,
                userName: sysEvent.userName
            }
        }));

        // Merge and sort by timestamp
        const merged = [...mainStreamEvents, ...transformedSystemEvents];
        const sorted = merged.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateA - dateB;
        });

        // When showThreadsOnly is on, keep only message events with threads
        if (showThreadsOnly) {
            return sorted.filter(e => {
                if (e.type !== 'message') return true; // keep system events
                // Check the live threadCounts map first (real-time), fall back to event's own replyCount
                const count = (threadCounts[e.id] ?? 0) || (e.replyCount ?? 0);
                return count > 0;
            });
        }
        return sorted;
    }, [mainStreamEvents, systemEvents, showThreadsOnly, threadCounts]);

    // Group by date - create our own implementation to ensure arrays
    const groupedEvents = useMemo(() => {
        const grouped = {};
        mergedEvents.forEach(event => {
            const date = new Date(event.createdAt || event.payload?.createdAt);
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

    // Render event based on type
    const renderEvent = (event) => {
        switch (event.type) {
            case 'message':
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
                        threadCounts={threadCounts} // ✅ Forward threadCounts
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
                        threadCounts={threadCounts} // ✅ Forward threadCounts
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
                console.warn('Unknown event type:', event.type);
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
            {/* Threads-only filter banner */}
            {showThreadsOnly && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#EFF6FF',
                    borderBottom: '1px solid #BFDBFE',
                    fontSize: '12px',
                    color: '#2563EB',
                    fontWeight: 500,
                }}>
                    <span>🧵</span>
                    <span>Showing only threaded messages — click the thread icon to see all messages</span>
                </div>
            )}

            {/* Load More / Pagination Skeleton */}
            {hasMore && (
                <div style={{ padding: '0.5rem 1rem' }}>
                    {loading ? (
                        <div className="animate-pulse space-y-3 py-2">
                            {[65, 80, 50].map((w, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 space-y-2">
                                        <div className="flex gap-2">
                                            <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                                            <div className="h-2.5 w-10 bg-gray-100 dark:bg-gray-700/50 rounded" />
                                        </div>
                                        <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded" style={{ width: `${w}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                            <button
                                onClick={onLoadMore}
                                className="text-blue-500 hover:underline"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Load older messages
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Channel Creation Banner ──────────────────────────────── */}
            {conversationType === 'channel' && channelCreatedAt && (
                <div style={{ padding: '2rem 1.5rem 1rem', borderBottom: '1px solid #e5e7eb' }}
                    className="dark:border-gray-800"
                >
                    {/* Big hash icon */}
                    <div style={{
                        width: 56, height: 56, borderRadius: 12,
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '0.75rem', fontSize: 28, color: '#fff', fontWeight: 900,
                    }}>#</div>

                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'inherit' }}>
                        Welcome to #{channelName || 'this channel'}!
                    </h2>

                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                        <span style={{ fontWeight: 600 }}>#{channelName || 'this channel'}</span>
                        {' '}was created by{' '}
                        <span style={{ fontWeight: 600 }}>
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
                        <span style={{ fontWeight: 600 }}>#{channelName}</span>
                        {' '}channel.
                    </p>
                </div>
            )}

            {/* Join Marker — only for non-creators */}
            {conversationType === 'channel' && userJoinedAt &&
                String(currentUserId) !== String(channelCreatedById) && (
                    <div style={{ padding: '0 1rem' }}>
                        <JoinMarker date={userJoinedAt} memberInfo={{ userId: currentUserId }} currentUserId={currentUserId} />
                    </div>
                )}



            {/* Grouped Events by Date - only show if there are actual messages */}
            <div style={{ padding: '0 1rem' }}>
                {Object.keys(groupedEvents).map(dateKey => {
                    // Filter out channel_created events since they're shown above
                    const eventsForDate = groupedEvents[dateKey].filter(
                        event => !(event.type === 'system_timeline' && event.payload.type === 'channel_created')
                    );

                    // Don't show date divider if no events for this date (after filtering)
                    if (eventsForDate.length === 0) return null;

                    return (
                        <div key={dateKey}>
                            {/* Date Divider */}
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
                                        background: 'var(--bg-secondary)',
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
                                        background: 'var(--border-color)',
                                        zIndex: 0
                                    }}
                                />
                            </div>

                            {/* Events for this date */}
                            {eventsForDate.map((event, idx) => (
                                <div key={event.id || `event-${dateKey}-${idx}`}>
                                    {renderEvent(event)}
                                </div>
                            ))}

                            {/* Member Join Markers (for channels) */}
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

            {/* Empty State */}
            {/* Initial load skeleton - Slack-style: all left-aligned with avatar + name + message */}
            {events.length === 0 && loading && (
                <div className="flex-1 px-4 py-6 animate-pulse space-y-6">
                    {[
                        { name: 22, line1: 68, line2: 0 },
                        { name: 18, line1: 50, line2: 35 },
                        { name: 24, line1: 80, line2: 55 },
                        { name: 20, line1: 45, line2: 0 },
                        { name: 22, line1: 72, line2: 40 },
                        { name: 16, line1: 58, line2: 0 },
                        { name: 26, line1: 85, line2: 60 },
                    ].map((row, i) => (
                        <div key={i} className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                            {/* Content */}
                            <div className="flex-1 space-y-2" style={{ maxWidth: '70%' }}>
                                {/* Name + timestamp */}
                                <div className="flex items-baseline gap-2">
                                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded" style={{ width: `${row.name * 4}px` }} />
                                    <div className="h-2.5 w-10 bg-gray-100 dark:bg-gray-700/50 rounded" />
                                </div>
                                {/* Message line 1 */}
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg" style={{ width: `${row.line1}%` }} />
                                {/* Message line 2 (optional) */}
                                {row.line2 > 0 && (
                                    <div className="h-4 bg-gray-100 dark:bg-gray-700/60 rounded-lg" style={{ width: `${row.line2}%` }} />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state when no messages and not loading */}
            {events.length === 0 && !loading && (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '3rem',
                        color: 'var(--text-muted)'
                    }}
                >
                    <p>No messages yet. Start the conversation!</p>
                </div>
            )}

            {/* Auto-scroll anchor */}
            <div ref={bottomRef} />
        </div>
    );
}

export default ConversationStream;
