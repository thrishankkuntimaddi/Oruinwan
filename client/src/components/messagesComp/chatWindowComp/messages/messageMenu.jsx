// src/components/messageComp/chatWindow/messages/messageMenu.jsx
import React from "react";

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
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-2 w-44 bg-white border rounded shadow-md z-40 p-1 text-sm">
      <div className="flex items-center gap-1 p-1">
        {EMOJI_SHORTCUTS.map((r) => (
          <button key={r} onClick={() => addReaction(msg.id, r)} className="p-1 text-lg rounded hover:bg-gray-100">{r}</button>
        ))}
      </div>
      <div className="border-t my-1" />
      <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => pinMessage(msg.id)}>Pin</button>
      <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => replyToMessage(msg.id)}>Reply</button>
      <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => forwardMessage(msg.id)}>Forward</button>
      <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => copyMessage(msg.id)}>Copy</button>
      <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => deleteMessage(msg.id)}>Delete</button>
      <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => infoMessage(msg.id)}>Info</button>
    </div>
  );
}
