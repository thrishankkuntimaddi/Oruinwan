import React from 'react';

/**
 * SystemEventItem Component
 * 
 * Timeline marker for system events (not chat messages).
 * Displayed as a centered pill, distinct from chat bubbles.
 * Examples: "You joined", "Alice joined", "Channel created"
 */
export default function SystemEventItem({ event, currentUserId }) {
    // Determine event text based on type
    const getEventText = () => {
        const isCurrentUser = event.userId?.toString() === currentUserId?.toString();

        switch (event.type) {
            case 'user_joined':
                if (isCurrentUser) {
                    return 'You joined this channel';
                }
                return `${event.userName || 'A user'} joined this channel`;

            case 'channel_created':
                return 'Channel created';

            case 'user_left':
                if (isCurrentUser) {
                    return 'You left this channel';
                }
                return `${event.userName || 'A user'} left this channel`;

            default:
                return 'System event';
        }
    };

    // Format timestamp
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'today';
        } else if (diffDays === 1) {
            return 'yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    return (
        <div className="flex justify-center my-6 px-4">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {getEventText()}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    •
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                    {formatDate(event.timestamp)}
                </span>
            </div>
        </div>
    );
}
