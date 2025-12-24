import React from 'react';

export default function JoinMarker({ date, memberInfo, currentUserId }) {
    const formatJoinDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Determine if the current user is the one who joined
    const isCurrentUser = memberInfo && String(memberInfo.userId) === String(currentUserId);

    // Create the appropriate message
    const message = isCurrentUser
        ? `You joined on ${formatJoinDate(date)}`
        : `${memberInfo?.username || 'Someone'} joined on ${formatJoinDate(date)}`;

    return (
        <div className="flex items-center gap-3 px-5 py-4 my-2">
            <div className="flex-1 h-px bg-gray-200"></div>
            <div className="text-xs font-medium text-gray-500">
                {message}
            </div>
            <div className="flex-1 h-px bg-gray-200"></div>
        </div>
    );
}
