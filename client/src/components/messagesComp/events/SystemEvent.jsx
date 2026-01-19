// client/src/components/messagesComp/events/SystemEvent.jsx
// Renders system events (user joined, left, etc.)

import React from 'react';
import { UserPlus, UserMinus, Settings, Info } from 'lucide-react';

/**
 * Renders a system event
 * @param {object} event - System event
 */
function SystemEvent({ event }) {
    const { payload } = event;
    const { action, username, timestamp } = payload;

    // Determine icon based on action
    const getIcon = () => {
        switch (action) {
            case 'user-joined':
                return <UserPlus size={16} />;
            case 'user-left':
                return <UserMinus size={16} />;
            case 'channel-updated':
                return <Settings size={16} />;
            default:
                return <Info size={16} />;
        }
    };

    // Format message based on action
    const getMessage = () => {
        switch (action) {
            case 'user-joined':
                return `${username} joined the channel`;
            case 'user-left':
                return `${username} left the channel`;
            case 'channel-updated':
                return `Channel settings were updated`;
            case 'channel-created':
                return `Channel was created`;
            default:
                return payload.message || 'System event';
        }
    };

    return (
        <div
            className="system-event"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem',
                margin: '0.5rem 0',
                background: 'var(--bg-tertiary)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                gap: '0.5rem'
            }}
        >
            {getIcon()}
            <span>{getMessage()}</span>
            {timestamp && (
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {new Date(timestamp).toLocaleTimeString()}
                </span>
            )}
        </div>
    );
}

export default SystemEvent;
