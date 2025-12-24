import React from 'react';

export default function JoinMarker({ date }) {
    const formatJoinDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="flex items-center gap-3 px-5 py-4 my-2">
            <div className="flex-1 h-px bg-gray-200"></div>
            <div className="text-xs font-medium text-gray-500">
                You joined on {formatJoinDate(date)}
            </div>
            <div className="flex-1 h-px bg-gray-200"></div>
        </div>
    );
}
