// src/components/messageComp/chatWindow/messages/messageMenu.jsx
// Phase 1 — Enhanced with Bookmark, Remind Me, and Edit History actions

import React, { useState } from "react";
import IntegrationActionModal from "../../../../components/apps/modals/IntegrationActionModal";
import api from "../../../../services/api";

const EMOJI_SHORTCUTS = ["👍", "❤️", "😂", "😊", "🔥", "🙏"];

export default function MessageMenu({
  msg,
  addReaction,
  pinMessage,
  replyToMessage,
  forwardMessage,
  copyMessage,
  deleteMessage,
  infoMessage,
  // Phase 1 additions
  onBookmark,
  onRemind,
  onShowHistory,
  isBookmarked = false,
}) {
  const [integrationModal, setIntegrationModal] = useState(null);
  const [bookmarkPending, setBookmarkPending] = useState(false);

  const openIntegration = (config) => setIntegrationModal(config);

  const handleBookmark = async () => {
    if (bookmarkPending) return;
    setBookmarkPending(true);
    try {
      await api.post(`/api/messages/${msg.id}/bookmark`);
      onBookmark?.(msg.id);
    } catch { /* silent */ } finally {
      setBookmarkPending(false);
    }
  };

  return (
    <>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-40 p-1 text-sm overflow-hidden">
        {/* Emoji reactions */}
        <div className="flex items-center gap-1 p-1">
          {EMOJI_SHORTCUTS.map((r) => (
            <button key={r} onClick={() => addReaction(msg.id, r)} className="p-1 text-lg rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{r}</button>
          ))}
        </div>
        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

        {/* Standard actions */}
        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors" onClick={() => pinMessage(msg.id)}>📌 Pin</button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors" onClick={() => replyToMessage(msg.id)}>↩️ Reply</button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors" onClick={() => forwardMessage(msg.id)}>➡️ Forward</button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors" onClick={() => copyMessage(msg.id)}>📋 Copy</button>

        {/* Phase 1: Bookmark */}
        <button
          className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors ${isBookmarked
            ? "text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          onClick={handleBookmark}
          disabled={bookmarkPending}
        >
          {isBookmarked ? "🔖 Remove Bookmark" : "🔖 Save / Bookmark"}
        </button>

        {/* Phase 1: Remind Me */}
        {onRemind && (
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
            onClick={() => onRemind(msg.id)}
          >
            🔔 Remind Me
          </button>
        )}

        {/* Phase 1: Edit History */}
        {onShowHistory && msg?.editHistory?.length > 0 && (
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
            onClick={() => onShowHistory(msg)}
          >
            📜 Edit History
          </button>
        )}

        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors" onClick={() => deleteMessage(msg.id)}>🗑️ Delete</button>
        <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors" onClick={() => infoMessage(msg.id)}>ℹ️ Info</button>

        {/* Integrations divider */}
        <div className="mt-1 mb-1 flex items-center gap-2 px-2">
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Integrations</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
        </div>

        {/* Integration actions */}
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
          onClick={() => openIntegration({ title: "Create Jira Issue", integration: "Jira", emoji: "🎫", description: "Create a Jira issue based on this message. The message content will be used as the issue summary.", confirmLabel: "Create Issue" })}
        >
          🎫 Create Jira Issue
        </button>
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
          onClick={() => openIntegration({ title: "Add to Linear", integration: "Linear", emoji: "⚡", description: "Add this message as a new issue in your Linear workspace.", confirmLabel: "Add to Linear" })}
        >
          ⚡ Add to Linear
        </button>
        <button
          className="w-full text-left px-3 py-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
          onClick={() => openIntegration({ title: "Share to Google Drive", integration: "Google Drive", emoji: "📁", description: "Save this message as a document in your Google Drive for future reference.", confirmLabel: "Save to Drive" })}
        >
          📁 Share to Google Drive
        </button>
      </div>

      {/* Integration action modal */}
      {integrationModal && (
        <IntegrationActionModal
          {...integrationModal}
          onClose={() => setIntegrationModal(null)}
        />
      )}
    </>
  );
}
