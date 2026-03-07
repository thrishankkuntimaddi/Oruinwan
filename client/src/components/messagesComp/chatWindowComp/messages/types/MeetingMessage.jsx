/**
 * MeetingMessage.jsx — Phase 7.6
 *
 * Renders a meeting card inside chat.
 * msg.meeting = { title, startTime, duration, meetingLink, participants }
 */
import React, { useMemo } from 'react';
import { Calendar, Clock, Users, Video, ExternalLink } from 'lucide-react';

export default function MeetingMessage({ meeting }) {
    if (!meeting?.title) return null;

    const { title, startTime, duration, meetingLink, participants = [] } = meeting;

    // Format date/time
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
        <div className="mt-1.5 max-w-sm rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 overflow-hidden shadow-sm">
            {/* Header stripe */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 dark:bg-blue-700">
                <Video size={14} className="text-white flex-shrink-0" />
                <span className="text-xs font-semibold text-white uppercase tracking-wide">Meeting</span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2">
                {/* Title */}
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                    {title}
                </h4>

                {/* Date / Time */}
                {formattedDate && (
                    <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {formattedDate.date}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formattedDate.time}
                            {duration ? ` · ${duration} min` : ''}
                        </span>
                    </div>
                )}

                {/* Participants count */}
                {participants.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Users size={11} />
                        <span>{participants.length} invited</span>
                    </div>
                )}

                {/* Past label */}
                {formattedDate?.isPast && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">This meeting has ended.</p>
                )}
            </div>

            {/* Join button */}
            {meetingLink && (
                <div className="px-4 pb-3">
                    <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all
                            ${isJoinable
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed pointer-events-none'
                            }`}
                    >
                        <ExternalLink size={12} />
                        {isJoinable ? 'Join Meeting' : 'Meeting Ended'}
                    </a>
                </div>
            )}
        </div>
    );
}
