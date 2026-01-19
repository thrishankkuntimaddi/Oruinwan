// client/src/components/messagesComp/events/MeetingEvent.jsx
// Placeholder for meeting type events (future feature)

import React from 'react';
import { Video, Calendar, Users } from 'lucide-react';

/**
 * Renders a meeting event (future feature)
 * @param {object} event - Meeting event
 * @param {string} currentUserId - Current user's ID
 */
function MeetingEvent({ event, currentUserId }) {
    const { payload } = event;
    const {
        title = 'Meeting',
        startTime,
        duration = 60,
        joinUrl,
        createdBy,
        attendees = []
    } = payload;

    const isCreator = createdBy?._id === currentUserId || createdBy === currentUserId;

    const handleJoin = () => {
        if (joinUrl) {
            window.open(joinUrl, '_blank');
        }
    };

    return (
        <div
            className="meeting-event"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.75rem',
                padding: '1rem',
                margin: '0.5rem 0',
                maxWidth: '600px'
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Video size={20} style={{ color: 'var(--primary-color)' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    {title}
                </h4>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {startTime && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                        <span>
                            {new Date(startTime).toLocaleString()} • {duration} min
                        </span>
                    </div>
                )}

                {attendees.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <Users size={16} style={{ color: 'var(--text-muted)' }} />
                        <span>
                            {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
                        </span>
                    </div>
                )}
            </div>

            {/* Action Button */}
            <button
                onClick={handleJoin}
                disabled={!joinUrl}
                style={{
                    background: joinUrl ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                    color: joinUrl ? 'white' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: joinUrl ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                }}
            >
                {joinUrl ? 'Join Meeting' : 'Meeting Link Unavailable'}
            </button>

            {isCreator && (
                <div
                    style={{
                        marginTop: '0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                    }}
                >
                    You created this meeting
                </div>
            )}
        </div>
    );
}

export default MeetingEvent;
