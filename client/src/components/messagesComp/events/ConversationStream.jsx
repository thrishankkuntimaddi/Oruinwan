// client/src/components/messagesComp/events/ConversationStream.jsx
// Unified event stream renderer - replaces messagesContainer.jsx

import React, { useRef, useEffect, useMemo } from 'react';
import MessageEvent from './MessageEvent';
import PollEvent from './PollEvent';
import SystemEvent from './SystemEvent';
import MeetingEvent from './MeetingEvent';
import JoinMarker from '../chatWindowComp/messages/JoinMarker';
import { Loader2 } from 'lucide-react';

/**
 * Renders a unified stream of conversation events
 * @param {array} events - Array of conversation events
 * @param {boolean} loading - Loading state
 * @param {function} onLoadMore - Callback for pagination
 * @param {boolean} hasMore - Whether more messages exist
 * @param {object} actions - Message actions from useMessageActions
 * @param {string} conversationType - "channel" | "dm"
 * @param {array} channelMembers - Channel members with join dates (for markers)
 * @param {date} userJoinedAt - When current user joined (for marker)
 * @param {function} onThreadOpen - Callback when thread is opened
 */
function ConversationStream({
    events = [],
    loading = false,
    onLoadMore,
    hasMore = false,
    actions = {},
    conversationType = 'channel',
    channelMembers = [],
    userJoinedAt = null,
    onThreadOpen,
    replyingTo = null,
    onCancelReply,
    currentUserId
}) {
    const streamRef = useRef(null);
    const bottomRef = useRef(null);
    const prevScrollHeight = useRef(0);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (bottomRef.current && events.length > 0) {
            const isNearBottom = streamRef.current
                ? streamRef.current.scrollHeight - streamRef.current.scrollTop - streamRef.current.clientHeight < 200
                : true;

            if (isNearBottom) {
                bottomRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }
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

    // Group by date - create our own implementation to ensure arrays
    const groupedEvents = useMemo(() => {
        const grouped = {};
        mainStreamEvents.forEach(event => {
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
    }, [mainStreamEvents]);

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
                        replyingTo={replyingTo}
                        onCancelReply={onCancelReply}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <MessageEvent
                        key={event.id}
                        event={event}
                        actions={actions}
                        isDM={true}
                        currentUserId={currentUserId}
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
            {/* Load More Indicator */}
            {hasMore && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                    {loading ? (
                        <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                    ) : (
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
                    )}
                </div>
            )}

            {/* Join Marker (for channels) */}
            {conversationType === 'channel' && userJoinedAt && (
                <div style={{ padding: '0 1rem' }}>
                    <JoinMarker joinedAt={userJoinedAt} />
                </div>
            )}

            {/* Grouped Events by Date */}
            <div style={{ padding: '0 1rem' }}>
                {Object.keys(groupedEvents).map(dateKey => (
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
                        {groupedEvents[dateKey].map(event => renderEvent(event))}

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
                ))}
            </div>

            {/* Empty State */}
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
