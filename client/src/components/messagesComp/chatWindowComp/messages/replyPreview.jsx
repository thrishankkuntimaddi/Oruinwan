// src/components/messageComp/chatWindow/messages/replyPreview.jsx
import React from "react";

export default function ReplyPreview({ replyingTo, onCancel }) {
  if (!replyingTo) return null;
  return (
    <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">Replying to</div>
        <div className="font-medium text-sm">{replyingTo.text}</div>
      </div>
      <button onClick={onCancel} className="text-gray-500">✖</button>
    </div>
  );
}
