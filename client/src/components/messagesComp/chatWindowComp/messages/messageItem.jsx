import React from "react";
import MessageMenu from "./messageMenu";
import ReactionBadges from "./reactionBadges";

/* ---------------------------------------------------------
   🔵 Slack-style Read Receipts (✔✔ icons)
--------------------------------------------------------- */
function ReadReceipts({ msg, currentUserId }) {
  if (!msg.backend) return null;

  const readBy = Array.isArray(msg.backend.readBy)
    ? msg.backend.readBy.map(String)
    : [];

  // remove self
  const others = readBy.filter((id) => id !== String(currentUserId));

  if (others.length === 0) return null;

  const display = others.slice(0, 3);
  const overflow = others.length - display.length;

  return (
    <div className="flex items-center gap-1 mt-1">
      {display.map((uid) => (
        <div
          key={uid}
          className="h-5 w-5 rounded-full bg-gray-300 text-xs flex items-center justify-center"
        >
          ✔✔
        </div>
      ))}

      {overflow > 0 && (
        <div className="h-5 w-5 rounded-full bg-gray-200 text-xs px-1 flex items-center justify-center">
          +{overflow}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   MAIN MessageItem Component
--------------------------------------------------------- */
export default function MessageItem({
  msg,
  selectMode,
  selectedIds,
  toggleSelect,
  openMsgMenuId,
  toggleMsgMenu,
  reactions,
  formatTime,
  addReaction,
  pinMessage,
  replyToMessage,
  forwardMessage,
  copyMessage,
  deleteMessage,
  infoMessage,
  currentUserId, // needed for read receipts
  onOpenThread, // NEW: callback to open thread panel
  threadCounts, // NEW: object mapping message IDs to reply counts
}) {
  const isMe = msg.sender === "you";
  const isSelected = selectedIds.has(msg.id);

  return (
    <div className="flex items-start w-full my-1">
      {/* ------------------------------ */}
      {/* Selection Checkbox */}
      {/* ------------------------------ */}
      <div className="w-8 flex items-start justify-center">
        {selectMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(msg.id)}
            className="mt-2"
          />
        ) : null}
      </div>

      {/* ------------------------------ */}
      {/* Message Bubble */}
      {/* ------------------------------ */}
      <div
        className={`relative px-3 py-2 rounded-xl max-w-[75%] whitespace-pre-wrap break-words shadow-sm
          ${isMe ? "ml-auto bg-blue-100" : "mr-auto bg-gray-100"}
        `}
        onClick={() => selectMode && toggleSelect(msg.id)}
      >
        {/* ------------------------------ */}
        {/* Message Menu Button */}
        {/* ------------------------------ */}
        <div className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => toggleMsgMenu(e, msg.id)}
            className="p-1 rounded hover:bg-gray-200"
          >
            ⋮
          </button>
        </div>

        {/* ------------------------------ */}
        {/* Reply reference */}
        {/* ------------------------------ */}
        {msg.repliedToId && (
          <div className="mb-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            Replying to a message…
          </div>
        )}

        {/* ------------------------------ */}
        {/* SENDING / FAILED STATES */}
        {/* ------------------------------ */}
        {msg.sending && (
          <div className="text-xs text-gray-500">Sending…</div>
        )}

        {msg.failed && (
          <div className="text-xs text-red-600">Failed to send</div>
        )}

        {/* ------------------------------ */}
        {/* MESSAGE TEXT */}
        {/* ------------------------------ */}
        <div className="whitespace-pre-wrap">{msg.text}</div>

        {/* ------------------------------ */}
        {/* REACTIONS */}
        {/* ------------------------------ */}
        {reactions[msg.id] && (
          <ReactionBadges reactions={reactions[msg.id]} />
        )}

        {/* ------------------------------ */}
        {/* TIMESTAMP */}
        {/* ------------------------------ */}
        <div className="text-xs text-gray-400 mt-1 text-right">
          {formatTime(msg.ts)}
        </div>

        {/* ------------------------------ */}
        {/* READ RECEIPTS (only for my messages) */}
        {/* ------------------------------ */}
        {isMe && (
          <ReadReceipts msg={msg} currentUserId={currentUserId} />
        )}

        {/* ------------------------------ */}
        {/* THREAD REPLIES COUNT */}
        {/* ------------------------------ */}
        {threadCounts && threadCounts[msg.id] > 0 && onOpenThread && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenThread(msg.id);
            }}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            💬 {threadCounts[msg.id]} {threadCounts[msg.id] === 1 ? "reply" : "replies"}
          </button>
        )}

        {/* ------------------------------ */}
        {/* MESSAGE MENU POPUP */}
        {/* ------------------------------ */}
        {openMsgMenuId === msg.id && (
          <MessageMenu
            msg={msg}
            addReaction={addReaction}
            pinMessage={pinMessage}
            replyToMessage={replyToMessage}
            forwardMessage={forwardMessage}
            copyMessage={copyMessage}
            deleteMessage={deleteMessage}
            infoMessage={infoMessage}
          />
        )}
      </div>
    </div>
  );
}
