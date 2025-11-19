// src/components/messageComp/chatWindow/messages/messageItem.jsx
import React from "react";
import MessageMenu from "./messageMenu";
import ReactionBadges from "./reactionBadges";

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
}) {
  const me = msg.sender === "you";
  const checked = selectedIds.has(msg.id);

  return (
    <div className="flex items-start">
      <div style={{ width: 50 }} className="flex items-start justify-center">
        {selectMode ? (
          <input type="checkbox" checked={checked} onChange={() => toggleSelect(msg.id)} className="mt-2" />
        ) : (
          <div style={{ width: 18 }} />
        )}
      </div>

      <div
        className={`relative msg-max-w px-3 py-2 rounded-lg break-words ${me ? "ml-auto bg-blue-100 text-black" : "mr-auto bg-gray-100 text-black"} group`}
        onClick={() => selectMode && toggleSelect(msg.id)}
      >
        <div className="absolute -right-8 -top-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={(e) => toggleMsgMenu(e, msg.id)} className="p-1 rounded hover:bg-gray-200">▾</button>
        </div>

        {msg.repliedToId && (() => {
          const refText = "Referenced message"; // simplified; you can pass full message data later
          return <div className="mb-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">{refText}</div>;
        })()}

        <div className="whitespace-pre-wrap">{msg.text}</div>

        {reactions[msg.id] && <ReactionBadges reactions={reactions[msg.id]} />}

        <div className="text-xs text-gray-400 mt-1 text-right">{formatTime(msg.ts)}</div>

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
