// client/src/components/messageComp/chatWindow/footer/footerInput.jsx
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

      {/* Attach menu */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAttach((s) => !s);
            setShowEmoji(false);
          }}
          className="p-2 rounded hover:bg-gray-100"
        >
          ＋
        </button>

        {showAttach && <AttachMenu onAttach={onAttach} />}
      </div>

      {/* Text Input */}
      <div className="flex-1">
        <textarea
          rows={1}
          value={newMessage}
          onChange={onChange}
          placeholder={blocked ? "Cannot send messages" : "Type a message..."}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="w-full resize-none overflow-hidden px-4 py-2 border rounded-lg text-sm focus:outline-none"
        />
      </div>

      {/* Emoji */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEmoji((s) => !s);
            setShowAttach(false);
          }}
          className="p-2 rounded hover:bg-gray-100"
        >
          😊
        </button>

        {showEmoji && <EmojiPicker onPick={onPickEmoji} />}
      </div>

      {/* Voice recording */}
      <button
        onClick={() => {
          if (!blocked) {
            setRecording((prev) => {
              const next = !prev;
              // future: implement start/stop recording
              return next;
            });
          }
        }}
        className={`p-2 rounded ${recording ? "bg-red-100" : "hover:bg-gray-100"}`}
        title="Voice"
      >
        🎤
      </button>

      {/* Send */}
      <button
        onClick={onSend}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
      >
        ➤
      </button>
    </div>
  );
}
