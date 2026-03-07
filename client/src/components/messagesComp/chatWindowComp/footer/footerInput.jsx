import React, { useRef, useEffect, useState, useCallback } from "react";
import { Bold, Italic, Link, List, Smile, Mic, SendHorizontal, Paperclip } from "lucide-react";
import EmojiPicker from "./emojiPicker";
import AttachMenu from "./attachMenu";
import TurndownService from "turndown";
import { Button } from "../../../../shared/components/ui";
import ReplyPreview from "../messages/replyPreview";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

/**
 * Pre-process contentEditable HTML → Markdown-friendly HTML.
 * Chrome wraps every line in a <div>; the opening <div> marks a new line.
 * Closing </div> carries no extra meaning once the opener is handled.
 *
 *   "DF<div>ASDF</div><div>ASD</div>"
 *   after: "DF<br>ASDF<br>ASD"
 */
const normaliseEditorHtml = (html) =>
  html
    // Empty-line placeholder first: <div><br></div> → <br>
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '<br>')
    // Opening block tag → newline (the block START = new line)
    .replace(/<(div|p)[^>]*>/gi, '<br>')
    // Closing block tags → empty (newline already added by opener)
    .replace(/<\/(div|p)>/gi, '');

// Helper to strip HTML tags
const stripTags = (html) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

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
  showAI = true,
  showVoice = true,
  disabled = false,
  replyingTo = null,
  onCancelReply,
}) {
  const emojiRef = useRef(null);
  const attachRef = useRef(null);
  const editableRef = useRef(null);

  // Track whether the input has content for the Send button
  const [hasText, setHasText] = useState(false);

  // ─── KEY FIX: track content in a ref, NOT in state ───────────────────────────
  // We NEVER set editableRef.current.innerHTML from parent state while the user
  // is typing. We only reset the DOM when the parent clears the message (send).
  const prevMessageRef = useRef(newMessage);

  useEffect(() => {
    // Only push value into the DOM when the parent explicitly clears the message
    // (i.e. newMessage goes from something → ""). This handles post-send clear.
    if (newMessage === "" && prevMessageRef.current !== "") {
      if (editableRef.current) {
        editableRef.current.innerHTML = "";
        setHasText(false);
      }
    }
    prevMessageRef.current = newMessage;
  }, [newMessage]);
  // ─────────────────────────────────────────────────────────────────────────────

  /* ---------------------------------------------------------
      OUTSIDE CLICK HANDLER
  --------------------------------------------------------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target) && showEmoji) {
        setShowEmoji(false);
      }
      if (attachRef.current && !attachRef.current.contains(event.target) && showAttach) {
        setShowAttach(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmoji, showAttach, setShowEmoji, setShowAttach]);

  /* ---------------------------------------------------------
      LINK HANDLING
  --------------------------------------------------------- */
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const applyLink = () => {
    if (linkUrl) {
      document.execCommand("createLink", false, linkUrl);
      setShowLinkInput(false);
      setLinkUrl("");
      editableRef.current?.focus();
    }
  };

  /* ---------------------------------------------------------
      WYSIWYG FORMATTING
  --------------------------------------------------------- */
  const execFormat = (command, value = null) => {
    editableRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const insertFormat = (type) => {
    if (blocked || disabled) return;
    editableRef.current?.focus();
    switch (type) {
      case "bold": execFormat("bold"); break;
      case "italic": execFormat("italic"); break;
      case "link":
        setShowLinkInput(!showLinkInput);
        setTimeout(() => document.getElementById("link-url-input")?.focus(), 100);
        break;
      case "list": execFormat("insertUnorderedList"); break;
      case "ai": execFormat("insertText", "@CI "); break;
      default: break;
    }
  };

  /* ---------------------------------------------------------
      INPUT HANDLER — reads directly from DOM, no state loop
  --------------------------------------------------------- */
  const handleInput = useCallback((e) => {
    const html = e.currentTarget.innerHTML;
    const text = stripTags(html).trim();
    setHasText(text.length > 0);
    // Sync upward for parent state (used for send button, not for re-rendering input)
    onChange({ target: { value: html } });
  }, [onChange]);

  /* ---------------------------------------------------------
      SEND
  --------------------------------------------------------- */
  const handleSend = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const html = el.innerHTML || '';
    const textContent = stripTags(html).trim();
    if (!textContent || blocked || disabled) return;

    let markdown;
    const hasFormatting = /<(ul|ol|b|strong|i|em|a )/.test(html);
    if (!hasFormatting) {
      // Fast path: innerText natively preserves every newline the user sees.
      // This is the only 100% reliable way for plain multiline text.
      markdown = el.innerText.trim();
    } else {
      // Has lists / bold / italic — convert via Turndown
      markdown = turndownService.turndown(normaliseEditorHtml(html)).trim();
    }

    if (!markdown) return;

    onSend(markdown);

    // Clear DOM directly (do NOT rely on React to re-render the input)
    if (editableRef.current) {
      editableRef.current.innerHTML = "";
    }
    setHasText(false);
    setNewMessage("");
  }, [blocked, disabled, onSend, setNewMessage]);

  /* ---------------------------------------------------------
      KEYBOARD — Enter to send, Shift+Enter for newline
  --------------------------------------------------------- */
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /* ---------------------------------------------------------
      EMOJI PICK — insert at cursor position
  --------------------------------------------------------- */
  const handlePickEmoji = useCallback((emoji) => {
    editableRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    const html = editableRef.current?.innerHTML || "";
    setHasText(stripTags(html).trim().length > 0);
    onChange({ target: { value: html } });
    if (onPickEmoji) onPickEmoji(emoji);
  }, [onChange, onPickEmoji]);

  return (
    <div className="px-4 py-4 bg-white dark:bg-gray-900 relative">
      {/* WhatsApp-style reply preview bar */}
      {replyingTo && (
        <ReplyPreview replyingTo={replyingTo} onCancel={onCancelReply} />
      )}

      <div className={`
        border rounded-2xl transition-all transition-colors duration-200 relative shadow-sm
        bg-white dark:bg-secondary-800 
        border-secondary-200 dark:border-secondary-700
        focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500
        ${replyingTo ? 'rounded-tl-none rounded-tr-none border-t-0' : ''}
      `}>

        {/* Rich Text Input — uncontrolled div, no html= binding */}
        <div className="w-full px-3 py-2 text-sm max-h-[30vh] overflow-y-auto custom-scrollbar min-h-[4rem] relative">
          <div
            ref={editableRef}
            contentEditable={!blocked && !disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className={`focus:outline-none min-h-[40px] break-words text-gray-800 dark:text-gray-100 message-editor ${(blocked || disabled) ? "cursor-not-allowed opacity-50" : ""}`}
          />
          {!hasText && !blocked && (
            <div className="absolute top-2 left-3 text-gray-400 dark:text-gray-500 pointer-events-none text-sm select-none">
              {disabled ? "Channel encryption unavailable" : "Message..."}
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
              onKeyDown={(e) => { if (e.key === "Enter") applyLink(); }}
            />
            <button onClick={applyLink} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Link size={14} />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 pb-1 bg-white dark:bg-gray-800 rounded-b-2xl">

          {/* Left: Formatting Tools */}
          <div className="flex items-center gap-1">
            {showAI && (
              <>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat("ai")} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors group" title="AI">
                  <img src="/assets/ChttrixAI-logo.png" alt="AI" className="w-4 h-4 object-contain opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                </button>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
              </>
            )}
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat("bold")} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="Bold"><Bold size={15} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat("italic")} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="Italic"><Italic size={15} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat("link")} className={`p-1.5 rounded-lg transition-all ${showLinkInput ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`} title="Link"><Link size={15} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertFormat("list")} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all" title="List"><List size={15} /></button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">

            {/* Emoji */}
            <div className="relative" ref={emojiRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowAttach(false); }}
                className={`p-1.5 rounded-lg transition-all ${showEmoji ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                title="Emoji"
              >
                <Smile size={18} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full right-0 mb-2 z-50">
                  <EmojiPicker onPick={handlePickEmoji} />
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="relative" ref={attachRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); setShowEmoji(false); }}
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
            {showVoice && (
              <button
                onClick={() => { if (!blocked) setRecording(!recording); }}
                className={`p-1.5 rounded-lg transition-all ${recording ? "text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                title="Voice"
              >
                <Mic size={18} />
              </button>
            )}

            {/* Send */}
            <Button
              onClick={handleSend}
              disabled={!hasText || blocked || disabled}
              variant="primary"
              size="icon"
              className={`ml-2 rounded-full h-9 w-9 shadow-sm ${(!hasText || blocked || disabled) ? "opacity-50" : ""}`}
              title={disabled ? "Cannot send - channel encryption unavailable" : "Send message"}
            >
              <SendHorizontal size={18} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
