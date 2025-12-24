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
  setNewMessage,
}) {
  const emojiRef = useRef(null);
  const attachRef = useRef(null);
  const textareaRef = useRef(null);

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

  const insertFormat = (type) => {
    if (!textareaRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = newMessage;
    const selected = text.substring(start, end);
    let newText = text;
    let newCursorPos = end;

    switch (type) {
      case 'bold':
        newText = text.substring(0, start) + `**${selected}**` + text.substring(end);
        newCursorPos = end + 4; // ** + **
        break;
      case 'italic':
        newText = text.substring(0, start) + `_${selected}_` + text.substring(end);
        newCursorPos = end + 2; // _ + _
        break;
      case 'link':
        newText = text.substring(0, start) + `[${selected}](url)` + text.substring(end);
        newCursorPos = end + 3; // []()
        break;
      case 'list':
        newText = text.substring(0, start) + `\n- ${selected}` + text.substring(end);
        newCursorPos = end + 3; // \n- 
        break;
      case 'ai':
        newText = text.substring(0, start) + `@ChttrixAI ` + text.substring(end);
        newCursorPos = start + 11;
        break;
      default:
        return;
    }

    setNewMessage(newText);

    // Restore focus and cursor
    setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="px-3 py-2 bg-white border-t border-gray-100">
      <div className="border border-gray-200 rounded-md transition-all bg-white relative">

        {/* Text Area (Compact) */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={newMessage}
          onChange={onChange}
          placeholder={blocked ? "Blocked" : "Message..."}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="w-full px-2 py-1.5 text-sm resize-none focus:outline-none bg-transparent max-h-32 min-h-[36px]"
          disabled={blocked}
        />

        {/* Toolbar (Slim) */}
        <div className="flex items-center justify-between px-1.5 pb-1 bg-white rounded-b-lg">

          {/* Left: Formatting Tools */}
          <div className="flex items-center gap-0.5">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('ai')} className="p-1 hover:bg-gray-100 rounded transition-colors" title="AI">
              <img src="/assets/ChttrixAI-logo.png" alt="AI" className="w-4 h-4 object-contain opacity-70" />
            </button>
            <div className="h-3 w-px bg-gray-200 mx-1"></div>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('bold')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Bold">
              <Bold size={14} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('italic')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Italic">
              <Italic size={14} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('link')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Link">
              <Link size={14} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('list')} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="List">
              <List size={14} />
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-0.5">

            {/* Emoji */}
            <div className="relative" ref={emojiRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmoji(!showEmoji);
                  setShowAttach(false);
                }}
                className={`p-1 rounded ${showEmoji ? "text-blue-600 bg-gray-100" : "text-gray-400 hover:text-gray-600"}`}
                title="Emoji"
              >
                <Smile size={16} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full right-0 mb-1 z-50">
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
                className={`p-1 rounded ${showAttach ? "text-blue-600 bg-gray-100" : "text-gray-400 hover:text-gray-600"}`}
                title="Attach"
              >
                <Paperclip size={16} />
              </button>
              {showAttach && (
                <div className="absolute bottom-full right-0 mb-1 z-50">
                  <AttachMenu onAttach={onAttach} />
                </div>
              )}
            </div>

            {/* Voice */}
            <button
              onClick={() => {
                if (!blocked) setRecording(!recording);
              }}
              className={`p-1 rounded ${recording ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-gray-600"}`}
              title="Voice"
            >
              <Mic size={16} />
            </button>

            {/* Send */}
            <button
              onClick={onSend}
              disabled={!newMessage.trim() || blocked}
              className={`ml-1 px-2 py-0.5 rounded transition-all flex items-center justify-center font-medium text-xs ${newMessage.trim() && !blocked
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              title="Send"
            >
              <Send size={12} className="mr-1" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
