import React, { useMemo } from 'react';
import { Calendar, Clock, Users, Video, ExternalLink } from 'lucide-react';

export default function MeetingMessage({ meeting }) {
    if (!meeting?.title) return null;

    const { title, startTime, duration, meetingLink, participants = [] } = meeting;

    
    const formattedDate = useMemo(() => {
        if (!startTime) return null;
        try {
            const d = new Date(startTime);
            return {
                date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
                time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
                isPast: d < new Date(),
            };
        } catch { return null; }
    }, [startTime]);

    const isJoinable = meetingLink && !formattedDate?.isPast;

    return (
        <div style={{
            marginTop: '6px', maxWidth: '280px',
            border: '1px solid var(--border-accent)',
            backgroundColor: 'var(--bg-active)',
            borderRadius: '2px', overflow: 'hidden',
        }}>
            {}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 12px',
                backgroundColor: 'rgba(184,149,106,0.12)',
                borderBottom: '1px solid var(--border-accent)',
            }}>
                <Video size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{
                    fontSize: '9px', fontWeight: 700,
                    color: 'var(--accent)',
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    Meeting
                </span>
            </div>

            {}
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {}
                <div style={{
                    fontSize: '13px', fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    {title}
                </div>

                {}
                {formattedDate && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        fontSize: '11px', color: 'var(--text-secondary)',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} />
                            {formattedDate.date}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            {formattedDate.time}
                            {duration ? ` · ${duration} min` : ''}
                        </span>
                    </div>
                )}

                {}
                {participants.length > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', color: 'var(--text-muted)',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        <Users size={11} />
                        <span>{participants.length} invited</span>
                    </div>
                )}

                {}
                {formattedDate?.isPast && (
                    <div style={{
                        fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        This meeting has ended.
                    </div>
                )}
            </div>

            {}
            {meetingLink && (
                <div style={{ padding: '0 12px 10px' }}>
                    <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            width: '100%', padding: '7px 0',
                            backgroundColor: isJoinable ? 'var(--accent)' : 'var(--bg-hover)',
                            color: isJoinable ? '#0c0c0c' : 'var(--text-muted)',
                            border: isJoinable ? 'none' : '1px solid var(--border-default)',
                            borderRadius: '2px',
                            fontSize: '12px', fontWeight: 600,
                            textDecoration: 'none',
                            cursor: isJoinable ? 'pointer' : 'not-allowed',
                            pointerEvents: isJoinable ? 'auto' : 'none',
                            transition: 'background-color 150ms ease',
                            boxSizing: 'border-box',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}
                        onMouseEnter={e => { if (isJoinable) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                        onMouseLeave={e => { if (isJoinable) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                    >
                        <ExternalLink size={12} />
                        {isJoinable ? 'Join Meeting' : 'Meeting Ended'}
                    </a>
                </div>
            )}
        </div>
    );
}
