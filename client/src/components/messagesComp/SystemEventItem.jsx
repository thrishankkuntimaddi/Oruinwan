import React from 'react';

/**
 * SystemEventItem Component
 * 
 * Timeline marker for system events (not chat messages).
 * Displayed as a centered pill, distinct from chat bubbles.
 * Examples: "You joined on Wednesday, January 29, 2026"
 */
export default function SystemEventItem({ event, currentUserId, creatorName }) {
    // Validate timestamp - skip render if invalid
    if (!event.timestamp || isNaN(new Date(event.timestamp))) {
        console.warn('[SYSTEM_EVENT][WARN] Skipping render — invalid timestamp', event);
        return null;
    }

    if (process.env.NODE_ENV === 'development') {
    }

    // Format date to match ConversationStream separators
    const formatEventDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Determine event text based on type with first/third-person logic
    const getEventText = () => {
        const isCurrentUser = event.userId?.toString() === currentUserId?.toString();
        const formattedDate = formatEventDate(event.timestamp);

        switch (event.type) {
            case 'user_joined':
                if (isCurrentUser) {
                    return `You joined on ${formattedDate}`;
                }
                return `${event.userName || 'Someone'} joined on ${formattedDate}`;

            case 'channel_created':
                if (isCurrentUser) {
                    return `You created this channel on ${formattedDate}`;
                }
                return `${creatorName || event.userName || 'Someone'} created this channel on ${formattedDate}`;

            case 'user_left':
                if (isCurrentUser) {
                    return `You left on ${formattedDate}`;
                }
                return `${event.userName || 'Someone'} left on ${formattedDate}`;

            default:
                return `System event on ${formattedDate}`;
        }
    };

    return (
        <div className="flex justify-center my-6 px-4">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {getEventText()}
                </span>
            </div>
        </div>
    );
}
