import React from 'react';

export default function SystemEventItem({ event, currentUserId, creatorName }) {
    
    if (!event.timestamp || isNaN(new Date(event.timestamp))) {
        console.warn('[SYSTEM_EVENT][WARN] Skipping render — invalid timestamp', event);
        return null;
    }

    
    const formatEventDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    
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
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', padding: '0 16px' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '3px 14px',
                backgroundColor: 'var(--bg-active)',
                border: '1px solid var(--border-default)',
                borderRadius: '99px',
            }}>
                <span style={{
                    fontSize: '11px', fontWeight: 500,
                    color: 'var(--text-muted)',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    whiteSpace: 'nowrap',
                }}>
                    {getEventText()}
                </span>
            </div>
        </div>
    );
}
