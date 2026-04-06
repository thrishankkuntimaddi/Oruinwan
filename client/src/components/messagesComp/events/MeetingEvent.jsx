// client/src/components/messagesComp/events/MeetingEvent.jsx
// Renders a meeting type event in the conversation stream

import React from 'react';
import { Video, Calendar, Users, ExternalLink } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

/**
 * Renders a meeting event from the conversation stream.
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
            style={{
                backgroundColor: 'var(--bg-active)',
                border: '1px solid var(--border-accent)',
                borderRadius: '2px',
                padding: '14px 16px',
                margin: '6px 0',
                maxWidth: '480px',
                fontFamily: FONT,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{
                    width: '28px', height: '28px', borderRadius: '2px',
                    backgroundColor: 'rgba(184,149,106,0.12)',
                    border: '1px solid var(--border-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Video size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: FONT }}>
                    {title}
                </h4>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
                {startTime && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: FONT }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span>
                            {new Date(startTime).toLocaleString()} &bull; {duration} min
                        </span>
                    </div>
                )}

                {attendees.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: FONT }}>
                        <Users size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    backgroundColor: joinUrl ? 'var(--accent)' : 'var(--bg-hover)',
                    color: joinUrl ? '#0c0c0c' : 'var(--text-muted)',
                    border: 'none', outline: 'none',
                    borderRadius: '2px',
                    padding: '6px 14px',
                    fontSize: '12px', fontWeight: 600,
                    cursor: joinUrl ? 'pointer' : 'not-allowed',
                    transition: '150ms ease', fontFamily: FONT,
                }}
                onMouseEnter={e => { if (joinUrl) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                onMouseLeave={e => { if (joinUrl) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
            >
                {joinUrl ? <><ExternalLink size={12} /> Join Meeting</> : 'Meeting Link Unavailable'}
            </button>

            {isCreator && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: FONT }}>
                    You created this meeting
                </div>
            )}
        </div>
    );
}

export default MeetingEvent;
