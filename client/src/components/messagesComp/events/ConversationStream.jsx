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
    conversationId = null, // ← used to detect channel switch and reset scroll
    showThreadsOnly = false, // ← filter to only show messages with threads
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

            {/* Join Marker (for channels) - only show if no channel_created system event exists */}
            {conversationType === 'channel' && userJoinedAt && !systemEvents.some(e => e.type === 'channel_created') && (
                <div style={{ padding: '0 1rem' }}>
                    <JoinMarker date={userJoinedAt} memberInfo={{ userId: currentUserId }} currentUserId={currentUserId} />
                </div>
            )}


            {/* Channel Created System Event - show at the top, before any date dividers */}
            {systemEvents.filter(e => e.type === 'channel_created').map(event => (
                <div key={`channel-created-${event._id || event.timestamp}`} style={{ padding: '0 1rem', marginTop: '1rem' }}>
                    <SystemEventItem
                        event={event}
                        currentUserId={currentUserId}
                        creatorName={creatorName}
                    />
                </div>
            ))}

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
            {/* Initial load skeleton - shows while first messages fetch */}
            {events.length === 0 && loading && (
                <div className="flex-1 px-4 py-6 animate-pulse space-y-5">
                    {[
                        { w: 55, lines: 1, right: false },
                        { w: 70, lines: 2, right: true },
                        { w: 45, lines: 1, right: false },
                        { w: 80, lines: 2, right: false },
                        { w: 60, lines: 1, right: true },
                        { w: 65, lines: 2, right: false },
                        { w: 40, lines: 1, right: true },
                    ].map((row, i) => (
                        <div key={i} className={`flex items-start gap-3 ${row.right ? 'flex-row-reverse' : ''}`}>
                            {!row.right && <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />}
                            <div className={`space-y-2 ${row.right ? 'items-end flex flex-col' : ''}`} style={{ maxWidth: '60%' }}>
                                {!row.right && (
                                    <div className="flex gap-2">
                                        <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                                        <div className="h-2.5 w-12 bg-gray-100 dark:bg-gray-700/50 rounded" />
                                    </div>
                                )}
                                <div
                                    className={`h-9 rounded-2xl ${row.right ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700/50'}`}
                                    style={{ width: `${row.w * 3}px`, maxWidth: '100%' }}
                                />
                                {row.lines > 1 && (
                                    <div
                                        className="h-6 rounded-xl bg-gray-100 dark:bg-gray-700/40"
                                        style={{ width: `${row.w * 2}px`, maxWidth: '100%' }}
                                    />
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
