// src/components/messageComp/chatWindow/messages/replyPreview.jsx
import React from "react";
import { X, MessageSquare } from "lucide-react";

export default function ReplyPreview({ replyingTo, onCancel }) {
  if (!replyingTo) return null;

  const senderName = replyingTo.senderName || replyingTo.sender?.username || "Someone";
  const previewText =
    replyingTo.text ||
    replyingTo.decryptedContent ||
    replyingTo.payload?.text ||
    "🔒 Encrypted message";

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/80 border-l-4 border-blue-500 rounded-t-xl mx-2 mb-0 animate-in fade-in slide-in-from-bottom-1">
      {/* Icon */}
      <MessageSquare size={14} className="text-blue-500 flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 leading-tight">
          {senderName}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
          {previewText}
        </div>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
        title="Cancel reply"
      >
        <X size={14} />
      </button>
    </div>
  );
}
