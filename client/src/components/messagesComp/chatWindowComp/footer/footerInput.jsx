import React, { useRef, useEffect, useState } from "react";
import { Bold, Italic, Link, List, Smile, Mic, SendHorizontal, Paperclip } from "lucide-react";
import EmojiPicker from "./emojiPicker";
import AttachMenu from "./attachMenu";
import ContentEditable from "react-contenteditable";
import TurndownService from "turndown";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

// Configure turndown to avoid escaping
// turndownService.keep(['div', 'br']); // Removed to fix raw HTML tags in output

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
  const editableRef = useRef(null);

  // We need local state to handle the HTML content sync properly
  // newMessage from props will be HTML now

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

  /* ---------------------------------------------------------
      LINK HANDLING
  --------------------------------------------------------- */
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const applyLink = () => {
    if (linkUrl) {
      // If text is selected, apply link to it. 
      // If no text selected, we might want to insert the url as text? 
      // standard execCommand 'createLink' works on selection.
      execFormat('createLink', linkUrl);
      setShowLinkInput(false);
      setLinkUrl("");
    }
  };

  /* ---------------------------------------------------------
      WYSIWYG FORMATTING
  --------------------------------------------------------- */
  const execFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    // Force focus back to ensure changes stick
    if (editableRef.current) {
      editableRef.current.focus();
    }
  };

  const insertFormat = (type) => {
    if (blocked) return;

    // Ensure focus before executing
    if (editableRef.current) editableRef.current.focus();

    switch (type) {
      case 'bold':
        execFormat('bold');
        break;
      case 'italic':
        execFormat('italic');
        break;
      case 'link':
        // Toggle Link Input visibility
        // If we have a selection, we want to keep it while showing the input?
        // Actually, clicking the button usually loses focus or selection if not careful.
        // We might need to save selection range? 
        // For now, let's just toggle the input UI.
        setShowLinkInput(!showLinkInput);
        setTimeout(() => document.getElementById('link-url-input')?.focus(), 100);
        break;
      case 'list':
        execFormat('insertUnorderedList');
        break;
      case 'ai':
        execFormat('insertText', '@ChttrixAI ');
        break;
      default:
        return;
    }
  };

  /* ---------------------------------------------------------
      HANDLING SEND
  --------------------------------------------------------- */
  const handleSend = React.useCallback(() => {
    // Use stripTags to check if there's actual text content (not just HTML tags)
    const textContent = stripTags(newMessage).trim();
    if (!textContent || blocked) return;

    // Convert HTML to Markdown
    let markdown = turndownService.turndown(newMessage);

    // Clean up excessive newlines if any
    markdown = markdown.trim();

    // Call parent onSend with the Markdown
    onSend(markdown);

    // Clear the input immediately after sending
    setNewMessage("");
  }, [newMessage, blocked, onSend, setNewMessage]);

  // CRITICAL FIX: react-contenteditable doesn't properly support onKeyDown prop
  // We need to use a native event listener instead
  useEffect(() => {
    const editable = editableRef.current;
    if (!editable) return;

    const handleNativeKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    editable.addEventListener('keydown', handleNativeKeyDown);
    return () => {
      editable.removeEventListener('keydown', handleNativeKeyDown);
    };
  }, [newMessage, blocked, handleSend]); // Re-attach when message changes to capture latest state

  // Helper to strip tags for "is empty" check
  const stripTags = (html) => {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const hasText = stripTags(newMessage).trim().length > 0;

  return (
    <div className="px-4 py-4 bg-white dark:bg-gray-900 relative">
      <div className="border border-gray-100 dark:border-gray-700 rounded-2xl transition-all bg-white dark:bg-gray-800 relative shadow-md hover:shadow-lg focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30">

        {/* Rich Text Input */}
        <div className="w-full px-3 py-2 text-sm max-h-[60vh] overflow-y-auto custom-scrollbar resize-y min-h-[4rem]">
          <ContentEditable
            innerRef={editableRef}
            html={newMessage} // innerHTML of the editable div
            disabled={blocked}       // use true to disable editing
            onChange={(evt) => {
              // react-contenteditable provides the new HTML in evt.target.value
              onChange({ target: { value: evt.target.value } });
            }}
            className={`focus:outline-none min-h-[40px] whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${blocked ? "cursor-not-allowed opacity-50" : ""}`}
            placeholder="Message..."
          />
          {!newMessage && !blocked && (
            <div className="absolute top-2 left-3 text-gray-400 pointer-events-none text-sm">
              Message...
            </div>
          )}
        </div>

        {/* Link Input Popover */}
        {showLinkInput && (
          <div className="absolute bottom-12 left-20 z-50 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-xl p-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <input
              id="link-url-input"
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="paste link here..."
              className="text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-blue-500 w-64"
              onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }}
            />
            <button
              onClick={applyLink}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Link size={14} />
            </button>
          </div>
        )}

        {/* Toolbar (Slim) */}
        <div className="flex items-center justify-between px-2 pb-1 bg-white dark:bg-gray-800 rounded-b-2xl">

          {/* Left: Formatting Tools */}
          <div className="flex items-center gap-1">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('ai')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors group" title="AI">
              <img src="/assets/ChttrixAI-logo.png" alt="AI" className="w-4 h-4 object-contain opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('bold')} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="Bold">
              <Bold size={15} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('italic')} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="Italic">
              <Italic size={15} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertFormat('link')}
              className={`p-1.5 rounded-lg transition-all ${showLinkInput ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              title="Link"
            >
              <Link size={15} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat('list')} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="List">
              <List size={15} />
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
                className={`p-1.5 rounded-lg transition-all ${showEmoji ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
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
                className={`p-1.5 rounded-lg transition-all ${showAttach ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                title="Attach"
              >
                <Paperclip size={18} />
              </button>
              {showAttach && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <AttachMenu onAttach={onAttach} />
                </div>
              )}
            </div>

            {/* Voice */}
            <button
              onClick={() => {
                if (!blocked) setRecording(!recording);
              }}
              className={`p-1.5 rounded-lg transition-all ${recording ? "text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              title="Voice"
            >
              <Mic size={18} />
            </button>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!hasText || blocked}
              className={`ml-2 p-2 rounded-full transition-all duration-200 flex items-center justify-center ${hasText && !blocked
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
              title="Send message"
            >
              <SendHorizontal size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
