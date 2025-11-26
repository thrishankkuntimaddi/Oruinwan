import React, { useRef, useEffect } from "react";
import { Bold, Italic, Link, List, Smile, Mic, Send, Paperclip } from "lucide-react";
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
  const emojiRef = useRef(null);
  const attachRef = useRef(null);

  /* ---------------------------------------------------------
      OUTSIDE CLICK HANDLER
  --------------------------------------------------------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiRef.current &&
        !emojiRef.current.contains(event.target) &&
        showEmoji
      ) {
        setShowEmoji(false);
      }
      if (
        attachRef.current &&
        !attachRef.current.contains(event.target) &&
        showAttach
      ) {
        setShowAttach(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmoji, showAttach, setShowEmoji, setShowAttach]);

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <div className="border border-gray-300 rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all bg-white relative">

        {/* Text Area */}
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
          className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none bg-transparent max-h-32 min-h-[44px]"
          disabled={blocked}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 pb-2 pt-1 bg-white rounded-b-lg">

          {/* Left: Formatting Tools */}
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Bold">
              <Bold size={16} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Italic">
              <Italic size={16} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Link">
              <Link size={16} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="List">
              <List size={16} />
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">

            {/* Emoji */}
            <div className="relative" ref={emojiRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmoji(!showEmoji);
                  setShowAttach(false);
                }}
                className={`p-1.5 rounded transition-colors ${showEmoji ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                title="Emoji"
              >
                <Smile size={18} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <EmojiPicker onPick={onPickEmoji} />
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="relative" ref={attachRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAttach(!showAttach);
                  setShowEmoji(false);
                }}
                className={`p-1.5 rounded transition-colors ${showAttach ? "bg-gray-100 text-gray-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
              {showAttach && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <AttachMenu onAttach={onAttach} />
                </div>
              )}
            </div>

            {/* Voice Recording */}
            <button
              onClick={() => {
                if (!blocked) setRecording(!recording);
              }}
              className={`p-1.5 rounded transition-colors ${recording ? "bg-red-100 text-red-500" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
              title="Voice message"
            >
              <Mic size={18} />
            </button>

            {/* Send Button */}
            <button
              onClick={onSend}
              disabled={!newMessage.trim() || blocked}
              className={`ml-1 p-1.5 rounded-md transition-all flex items-center justify-center ${newMessage.trim() && !blocked
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
