import React from "react";

export default function ReactionBadges({ reactions, currentUserId, onReactionClick, channelMembers = [] }) {
  if (!reactions || reactions.length === 0) return null;

  const getUsername = (userId) => {
    if (String(userId) === String(currentUserId)) return "You";
    if (channelMembers && Array.isArray(channelMembers)) {
      const member = channelMembers.find(m => String(m.userId) === String(userId));
      if (member && member.username) return member.username;
    }
    return "User";
  };

  const groups = reactions.reduce((acc, r) => {
    const emoji = typeof r === 'string' ? r : r.emoji;
    const userId = typeof r === 'string' ? null : r.userId;
    if (!acc[emoji]) acc[emoji] = { count: 0, users: [], hasReacted: false };
    acc[emoji].count++;
    if (userId) {
      acc[emoji].users.push(getUsername(userId));
      if (String(userId) === String(currentUserId)) acc[emoji].hasReacted = true;
    }
    return acc;
  }, {});

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
      {entries.map(([emoji, group]) => (
        <button
          key={emoji}
          title={`${group.users.join(", ")} reacted`}
          onClick={(e) => {
            e.stopPropagation();
            if (onReactionClick) onReactionClick(group.hasReacted ? null : emoji);
          }}
          disabled={!onReactionClick}
          style={{
            padding: '1px 7px',
            borderRadius: '99px',
            fontSize: '12px',
            fontFamily: 'var(--font)',
            display: 'flex', alignItems: 'center', gap: '4px',
            border: `1px solid ${group.hasReacted ? 'var(--accent)' : 'var(--border-default)'}`,
            backgroundColor: group.hasReacted ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)',
            color: group.hasReacted ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: onReactionClick ? 'pointer' : 'default',
            outline: 'none',
            transition: '100ms ease',
          }}
          onMouseEnter={e => { if (onReactionClick && !group.hasReacted) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
          onMouseLeave={e => { if (onReactionClick && !group.hasReacted) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
        >
          <span>{emoji}</span>
          {group.count > 1 && <span style={{ fontWeight: 600, fontSize: '11px' }}>{group.count}</span>}
        </button>
      ))}
    </div>
  );
}
