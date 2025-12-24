// src/components/messageComp/chatWindow/messages/reactionBadges.jsx
import React from "react";

export default function ReactionBadges({ reactions }) {
  if (!reactions) return null;

  // If reactions is an array (e.g. from backend), group them by emoji
  const groupedReactions = Array.isArray(reactions)
    ? reactions.reduce((acc, r) => {
      const emoji = typeof r === 'string' ? r : r.emoji;
      acc[emoji] = (acc[emoji] || 0) + 1;
      return acc;
    }, {})
    : reactions;

  const entries = Object.entries(groupedReactions);
  if (entries.length === 0) return null;

  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {entries.map(([emoji, count]) => (
        <div key={emoji} className="text-[10px] bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1 text-gray-600">
          <span>{emoji}</span>
          {count > 1 && <span className="font-medium">{count}</span>}
        </div>
      ))}
    </div>
  );
}
