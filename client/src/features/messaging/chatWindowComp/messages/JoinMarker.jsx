import React from 'react';

export default function JoinMarker({ date, memberInfo, currentUserId }) {
    const formatJoinDate = (timestamp) => {
        const d = new Date(timestamp);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const isCurrentUser = memberInfo && String(memberInfo.userId) === String(currentUserId);
    const message = isCurrentUser
        ? `You joined on ${formatJoinDate(date)}`
        : `${memberInfo?.username || 'Someone'} joined on ${formatJoinDate(date)}`;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', margin: '4px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {message}
            </div>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>
    );
}
