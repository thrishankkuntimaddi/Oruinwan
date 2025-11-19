// src/components/messageComp/chatWindow/footer/footerInput.jsx
import React from "react";
import EmojiPicker from "./emojiPicker";
import AttachMenu from "./attachMenu";

export default function FooterInput({
  newMessage,
  onChange,
  onSend,
  onAttach,
  showAttach,
  setShowAttach,
  showEmoji,
  setShowEmoji,
  onPickEmoji,
  recording,
  setRecording,
  blocked,
}) {
  return (
    <div className="border-t p-2 flex items-end gap-2 bg-white">
      <div className="relative">
        <button onClick={(e) => { e.stopPropagation(); setShowAttach((s) => !s); setShowEmoji(false); }} className="p-2 rounded hover:bg-gray-100">＋</button>
        {showAttach && <AttachMenu onAttach={onAttach} />}
      </div>

      <div className="flex-1">
        <textarea
          rows={1}
          value={newMessage}
          onChange={onChange}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={blocked ? "Cannot send messages" : "Type a message..."}
          className="w-full resize-none overflow-hidden px-4 py-2 border rounded-lg text-sm focus:outline-none"
        />
      </div>

      <div className="relative">
        <button onClick={(e) => { e.stopPropagation(); setShowEmoji((s) => !s); setShowAttach(false); }} className="p-2 rounded hover:bg-gray-100">😊</button>
        {showEmoji && <EmojiPicker onPick={onPickEmoji} />}
      </div>

      <button onClick={() => { if (!blocked) { setRecording((r) => { const nr = !r; if (r) { /* stop */ } return nr; }); } }} className={`p-2 rounded ${recording ? "bg-red-100" : "hover:bg-gray-100"}`} title="Voice">🎤</button>

      <button onClick={onSend} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">➤</button>
    </div>
  );
}
