// src/components/messageComp/chatWindow/messages/reactionBadges.jsx
import React from "react";

export default function ReactionBadges({ reactions, currentUserId, onReactionClick, channelMembers = [] }) {
  if (!reactions || reactions.length === 0) return null;

  // Helper to get username
  const getUsername = (userId) => {
    if (String(userId) === String(currentUserId)) return "You";

    // channelMembers might be null in DMs, so check existence
    if (channelMembers && Array.isArray(channelMembers)) {
      const member = channelMembers.find(m => String(m.userId) === String(userId));
      if (member && member.username) return member.username;
    }

    return "User"; // Fallback if name not found
  };

  // Group reactions by emoji
  const groups = reactions.reduce((acc, r) => {
    const emoji = typeof r === 'string' ? r : r.emoji;
    const userId = typeof r === 'string' ? null : r.userId; // Legacy handle string reactions if any

    if (!acc[emoji]) {
      acc[emoji] = {
        count: 0,
        users: [],
        hasReacted: false
      };
    }

    acc[emoji].count++;

    if (userId) {
      acc[emoji].users.push(getUsername(userId));
      if (String(userId) === String(currentUserId)) {
        acc[emoji].hasReacted = true;
      }
    }

    return acc;
  }, {});

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {entries.map(([emoji, group]) => (
        <button
          key={emoji}
          // Tooltip: "You, Nani, Lily reacted"
          title={`${group.users.join(", ")} reacted`}
          onClick={(e) => {
            e.stopPropagation();
            if (onReactionClick) {
              // If I already reacted with this emoji, toggle it OFF (pass null? or handle logic in parent?)
              // Parent handleAddReaction(emoji) -> adds/updates.
              // Parent handleAddReaction(null) -> removes.
              // To remove SPECIFIC emoji, I should verify logic but "remove-reaction" removes ALL my reactions.
              // So passing NULL removes my reaction.
              onReactionClick(group.hasReacted ? null : emoji);
            }
          }}
          disabled={!onReactionClick} // Non-interactive if no handler
          className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border transition-all
            ${group.hasReacted
              ? "bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300"
              : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
            }
            ${!onReactionClick ? "cursor-default" : "cursor-pointer"}
          `}
        >
          <span>{emoji}</span>
          {group.count > 1 && <span className="font-medium">{group.count}</span>}
        </button>
      ))}
    </div>
  );
}
