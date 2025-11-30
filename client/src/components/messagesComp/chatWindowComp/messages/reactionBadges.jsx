// src/components/messageComp/chatWindow/messages/reactionBadges.jsx
import React from "react";

export default function ReactionBadges({ reactions }) {
  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {Object.entries(reactions).map(([emoji, count]) => (
        <div key={emoji} className="text-xs bg-white border px-2 py-0.5 rounded-full">
          {emoji}
        </div>
      ))}
    </div>
  );
}
