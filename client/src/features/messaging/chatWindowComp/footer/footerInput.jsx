import React, { useRef, useEffect, useState, useCallback } from "react";
import { Code, Bold, Italic, Link, List, Smile, Mic, SendHorizontal, Paperclip } from "lucide-react";
import EmojiPicker from "./emojiPicker";
import AttachMenu from "./attachMenu";
import VoiceRecorder from "./VoiceRecorder";
import TurndownService from "turndown";
import { Button } from "../../../../shared/components/ui";
import ReplyPreview from "../messages/replyPreview";
import MentionAutocomplete from "./MentionAutocomplete";
import { useMentionAutocomplete } from "../../../../hooks/useMentionAutocomplete";
import SlashCommandMenu from "../../../../components/chat/slash/SlashCommandMenu";
import { parseSlashCommand } from "../../../../components/chat/slash/slashCommands";
import { useFeatureFlags } from "../../../../contexts/FeatureFlagsContext";
import CreateGitHubIssueModal from "../../../../components/apps/modals/CreateGitHubIssueModal";
import CreateJiraTicketModal from "../../../../components/apps/modals/CreateJiraTicketModal";
import SlashCommandPreview from "../../../../components/chat/slash/SlashCommandPreview";
import SmartReplySuggestions from "./SmartReplySuggestions";
import { useAIContext } from "../../../../contexts/AIContext";
import ScreenRecorder from "./ScreenRecorder";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});
// Text the user typed is already markdown (```, *, [ ]...); don't backslash-escape it.
turndownService.escape = (text) => text;

const normaliseEditorHtml = (html) =>
  html
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '<br>')
    .replace(/<(div|p)[^>]*>/gi, '<br>')
    .replace(/<\/(div|p)>/gi, '');

const stripTags = (html) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const toolbarBtnStyle = (active = false) => ({
  padding: '6px',
  borderRadius: '2px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  transition: 'color 150ms ease',
});

export default function FooterInput({
  newMessage,
  onChange,
  onSend,
  onAttach,
  onSendAttachment,
  onCreatePoll,
  onCreateChecklist,
  onSlashCommand,
  features = null,
  linkPreview = null,
  linkPreviewLoading = false,
  onDismissPreview,
  conversationId,
  conversationType,
  showAttach,
  setShowAttach,
  showEmoji,
  setShowEmoji,
  onPickEmoji,
  recording,
  setRecording,
  blocked,
  blockedNotice = null,
  setNewMessage,
  showAI = true,
  showVoice = true,
  disabled = false,
  replyingTo = null,
  onCancelReply,
  members = [],
  recentMessages = [],
  showSmartReply = false,
  workspaceId = null,
  showScreenRecord = false,
}) {
  const emojiRef = useRef(null);
  const attachRef = useRef(null);
  const editableRef = useRef(null);
  const [hasText, setHasText] = useState(false);

  const {
    showSuggestions,
    suggestions,
    selectedIndex,
    handleMentionInput,
    handleMentionKeyDown,
    selectSuggestion,
    extractMentionText,
    closeSuggestions,
  } = useMentionAutocomplete(members, { includeBroadcast: conversationType === 'channel' });

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [previewCommand, setPreviewCommand] = useState(null);
  const [appModal, setAppModal] = useState(null); // 'github' | 'jira' (from slash commands)
  const { flags } = useFeatureFlags();
  // Workspace admins can switch off uploads and AI; hide their controls.
  const uploadsOn = features?.fileUploads !== false;
  const showAIControl = showAI && features?.ai !== false;
  const showVoiceControl = showVoice && uploadsOn;
  const showScreenRecordControl = showScreenRecord && uploadsOn;

  const insertSlashCommand = useCallback((cmd) => {
    if (!editableRef.current) return;
    editableRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = editableRef.current.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, 0);
        range.setEnd(textNode, textNode.length);
        range.deleteContents();
      } else {
        editableRef.current.innerHTML = "";
      }
    }
    document.execCommand("insertText", false, `${cmd.command} `);
    const html = editableRef.current.innerHTML || "";
    setHasText(true);
    onChange({ target: { value: html } });
    setShowSlashMenu(false);
    setSlashQuery("");
    setPreviewCommand(cmd);
  }, [onChange]);

  // Oruinwan AI (assistant panel, smart replies, drafts) inserts text here.
  const aiCtx = useAIContext();
  const insertText = useCallback((text) => {
    if (!editableRef.current || !text) return;
    editableRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) { const r = sel.getRangeAt(0); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
    document.execCommand('insertText', false, text);
    const html = editableRef.current.innerHTML || '';
    setHasText(!!editableRef.current.textContent?.trim());
    onChange({ target: { value: html } });
  }, [onChange]);
  useEffect(() => {
    const onInsert = (e) => insertText(e?.detail?.text);
    document.addEventListener('chttrix:composer:insert', onInsert);
    const unregister = aiCtx?.registerComposer?.({ insert: insertText });
    return () => { document.removeEventListener('chttrix:composer:insert', onInsert); unregister?.(); };
  }, [aiCtx, insertText]);

  const prevMessageRef = useRef(newMessage);

  useEffect(() => {
    if (newMessage === "" && prevMessageRef.current !== "") {
      if (editableRef.current) {
        editableRef.current.innerHTML = "";
        setHasText(false);
      }
    }
    prevMessageRef.current = newMessage;
  }, [newMessage]);

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
      case "code": {
        // Inline code around a selection, otherwise an empty code block.
        const sel = String(window.getSelection?.() || '');
        document.execCommand("insertText", false, sel ? `\`${sel}\`` : "```\n\n```");
        const html = editableRef.current?.innerHTML || "";
        setHasText(stripTags(html).trim().length > 0);
        onChange({ target: { value: html } });
        break;
      }
      case "ai":
        // Open the Oruinwan AI panel; it already knows which conversation is open.
        window.dispatchEvent(new CustomEvent('chttrix-ai:open', { detail: {} }));
        break;
      default: break;
    }
  };

  const handleInput = useCallback((e) => {
    const html = e.currentTarget.innerHTML;
    const text = stripTags(html).trim();
    setHasText(text.length > 0);
    onChange({ target: { value: html } });
    handleMentionInput();
    if (text.startsWith("/")) {
      setSlashQuery(text);
      setShowSlashMenu(true);
      setPreviewCommand(null);
    } else {
      setShowSlashMenu(false);
      setSlashQuery("");
      if (!text) setPreviewCommand(null);
    }
  }, [onChange, handleMentionInput]);

  const handleSend = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const html = el.innerHTML || '';
    const textContent = stripTags(html).trim();
    if (!textContent || blocked || disabled) return;
    closeSuggestions();

    // Slash commands run instead of being sent as text.
    const command = parseSlashCommand(el.innerText, flags);
    if (command) {
      const clear = () => {
        if (editableRef.current) editableRef.current.innerHTML = "";
        setHasText(false); setNewMessage(""); setShowSlashMenu(false); setPreviewCommand(null);
      };
      if (command.name === 'shrug') {
        clear();
        onSend(`${command.args ? `${command.args} ` : ''}¯\\\\\\_(ツ)\\_/¯`, { mentionText: '' }); // markdown-escaped shrug
        return;
      }
      if (command.name === 'code') {
        el.innerText = '';
        el.focus();
        document.execCommand('insertText', false, '```' + (command.args || '') + '\n\n```');
        setHasText(true);
        setShowSlashMenu(false); setPreviewCommand(null);
        return;
      }
      if (command.name === 'github' || command.name === 'jira') {
        clear();
        setAppModal(command.name);
        return;
      }
      if (onSlashCommand?.(command.name, command.args) !== false) {
        clear();
        return;
      }
    }
    const mentionText = extractMentionText(editableRef);
    let markdown;
    // Real formatting tags only: `<br>` (a plain line break) used to match `<b` and send
    // every multi-line message through turndown, which escaped markdown the user typed.
    const hasFormatting = /<(ul|ol|b|strong|i|em|a)[\s>]/i.test(html);
    if (!hasFormatting) {
      markdown = el.innerText.trim().replace(/\n{2,}/g, '\n');
    } else {
      markdown = turndownService.turndown(normaliseEditorHtml(html)).trim();
    }
    if (!markdown) return;
    onSend(markdown, { mentionText });
    if (editableRef.current) editableRef.current.innerHTML = "";
    setHasText(false);
    setNewMessage("");
    setShowSlashMenu(false);
    setPreviewCommand(null);
  }, [blocked, disabled, onSend, setNewMessage, closeSuggestions, extractMentionText, flags, onSlashCommand]);

  const handleKeyDown = useCallback((e) => {
    if (showSlashMenu) {
      const consumed = SlashCommandMenu.handleKey?.(e);
      if (consumed) return;
    }
    if (e.key === 'Escape') {
      if (showSlashMenu) { setShowSlashMenu(false); return; }
      if (previewCommand) { setPreviewCommand(null); return; }
    }
    if (showSuggestions) {
      const consumed = handleMentionKeyDown(e);
      if (consumed) {
        e.preventDefault();
        if ((e.key === 'Enter' || e.key === 'Tab') && suggestions.length > 0) {
          selectSuggestion(suggestions[selectedIndex] || suggestions[0], editableRef);
        }
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, showSuggestions, handleMentionKeyDown, suggestions, selectedIndex, selectSuggestion, showSlashMenu, previewCommand]);

  const handlePickEmoji = useCallback((emoji) => {
    editableRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    const html = editableRef.current?.innerHTML || "";
    setHasText(stripTags(html).trim().length > 0);
    onChange({ target: { value: html } });
    if (onPickEmoji) onPickEmoji(emoji);
  }, [onChange, onPickEmoji]);

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-default)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {}
      {replyingTo && (
        <ReplyPreview replyingTo={replyingTo} onCancel={onCancelReply} />
      )}

      {}
      {showSmartReply && recentMessages.length > 0 && (
        <SmartReplySuggestions
          recentMessages={recentMessages}
          workspaceId={workspaceId}
          enabled={showSmartReply}
          onSelect={(text) => {
            if (!editableRef.current) return;
            editableRef.current.focus();
            document.execCommand('insertText', false, text);
            const html = editableRef.current.innerHTML || '';
            setHasText(true);
            onChange({ target: { value: html } });
          }}
        />
      )}

      {}
      {previewCommand && !showSlashMenu && (
        <SlashCommandPreview
          command={previewCommand}
          onClose={() => setPreviewCommand(null)}
        />
      )}

      <div style={{
        border: '1px solid var(--border-default)',
        borderRadius: '2px',
        backgroundColor: 'var(--bg-input)',
        position: 'relative',
        transition: 'border-color 150ms ease',
      }}
        onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
        onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
      >
        {}
        {(linkPreview || linkPreviewLoading) && (
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            backgroundColor: 'rgba(184,149,106,0.04)',
          }}>
            {linkPreviewLoading && !linkPreview && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <svg style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Fetching preview…
              </div>
            )}
            {linkPreview && (
              <>
                {linkPreview.image && (
                  <img
                    src={linkPreview.image}
                    alt=""
                    style={{ width: 36, height: 36, borderRadius: '2px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-default)' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                    {linkPreview.title || linkPreview.url}
                  </p>
                  {linkPreview.site && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {linkPreview.site}
                    </p>
                  )}
                </div>
                <button
                  onClick={onDismissPreview}
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                  title="Dismiss preview"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {}
        <div style={{ width: '100%', padding: '8px 12px', maxHeight: '30vh', overflowY: 'auto', overflowX: 'hidden', minHeight: '4rem', position: 'relative' }}>
          <div
            ref={editableRef}
            contentEditable={!blocked && !disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            style={{
              outline: 'none',
              minHeight: '40px',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              color: (blocked || disabled) ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: '14px',
              lineHeight: '1.5',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              cursor: (blocked || disabled) ? 'not-allowed' : 'text',
              opacity: (blocked || disabled) ? 0.5 : 1,
            }}
          />
          {blocked && blockedNotice && (
            <div data-testid="blocked-notice" style={{
              position: 'absolute', top: '8px', left: '12px', right: '12px',
              color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '13px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>
              {blockedNotice}
            </div>
          )}
          {!hasText && !blocked && (
            <div style={{
              position: 'absolute', top: '8px', left: '12px',
              color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '14px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              userSelect: 'none',
            }}>
              {disabled ? "Connecting securely…" : "Message..."}
            </div>
          )}
        </div>

        {}
        {showSuggestions && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 60, marginBottom: '4px' }}>
            <MentionAutocomplete
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelect={(member) => selectSuggestion(member, editableRef)}
              onClose={closeSuggestions}
            />
          </div>
        )}

        {}
        {showSlashMenu && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 60, marginBottom: '4px' }}>
            <SlashCommandMenu
              query={slashQuery}
              onSelect={insertSlashCommand}
              onClose={() => { setShowSlashMenu(false); setPreviewCommand(null); }}
              onPreviewChange={setPreviewCommand}
            />
          </div>
        )}

        {}
        {showLinkInput && (
          <div style={{
            position: 'absolute', bottom: '48px', left: '80px', zIndex: 50,
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)',
            borderRadius: '2px', padding: '8px', display: 'flex', alignItems: 'center', gap: '8px',
            animation: 'fadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            <input
              id="link-url-input"
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="paste link here..."
              style={{
                fontSize: '13px', padding: '4px 8px',
                border: '1px solid var(--border-default)',
                borderRadius: '2px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                outline: 'none', width: '220px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              }}
              onKeyDown={(e) => { if (e.key === "Enter") applyLink(); }}
            />
            <button
              onClick={applyLink}
              style={{
                padding: '4px 8px', backgroundColor: 'var(--accent)',
                color: '#0c0c0c', border: 'none', borderRadius: '2px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
            >
              <Link size={14} />
            </button>
          </div>
        )}

        {}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px 6px',
          backgroundColor: 'var(--bg-input)',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          {}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {showAIControl && (
              <>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertFormat("ai")}
                  style={{ ...toolbarBtnStyle(), padding: '5px' }}
                  title="AI"
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <img src="/assets/OruinwanAI-logo.png" alt="AI" style={{ width: 16, height: 16, objectFit: 'contain', opacity: 0.7 }} />
                </button>
                <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-default)', margin: '0 4px' }} />
              </>
            )}
            <ToolBtn icon={<Bold size={14} />} title="Bold" onClick={() => insertFormat("bold")} />
            <ToolBtn icon={<Italic size={14} />} title="Italic" onClick={() => insertFormat("italic")} />
            <ToolBtn
              icon={<Link size={14} />}
              title="Link"
              active={showLinkInput}
              onClick={() => insertFormat("link")}
            />
            <ToolBtn icon={<List size={14} />} title="List" onClick={() => insertFormat("list")} />
            <ToolBtn icon={<Code size={14} />} title="Code" onClick={() => insertFormat("code")} />
          </div>

          {}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {}
            <div style={{ position: 'relative' }} ref={emojiRef}>
              <ToolBtn
                icon={<Smile size={16} />}
                title="Emoji"
                active={showEmoji}
                onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowAttach(false); }}
              />
              {showEmoji && (
                <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', zIndex: 50 }}>
                  <EmojiPicker onPick={handlePickEmoji} />
                </div>
              )}
            </div>

            {}
            <div style={{ position: 'relative' }} ref={attachRef}>
              <ToolBtn
                icon={<Paperclip size={16} />}
                title="Attach"
                active={showAttach}
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); setShowEmoji(false); }}
              />
              {showAttach && (
                <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', zIndex: 50 }}>
                  <AttachMenu
                    onAttach={onAttach}
                    onSendAttachment={onSendAttachment}
                    onCreatePoll={onCreatePoll}
                    onCreateChecklist={onCreateChecklist}
                    onOpenVoiceRecorder={showVoiceControl ? (() => setRecording(true)) : undefined}
                    allowUploads={uploadsOn}
                    onInsertText={insertText}
                    conversationId={conversationId}
                    conversationType={conversationType}
                    onClose={() => setShowAttach(false)}
                  />
                </div>
              )}
            </div>

            {}
            {showVoiceControl && (
              <>
                <ToolBtn
                  icon={<Mic size={16} />}
                  title="Voice note"
                  onClick={() => { if (!blocked && !disabled) setRecording(true); }}
                />
                {recording && (
                  <VoiceRecorder
                    onSend={(attachment) => { onSendAttachment?.(attachment); setRecording(false); }}
                    onCancel={() => setRecording(false)}
                  />
                )}
              </>
            )}

            {}
            {showScreenRecordControl && (
              <ScreenRecorder
                disabled={blocked || disabled}
                onSend={(attachment) => onSendAttachment?.(attachment)}
              />
            )}

            {}
            <button
              onClick={handleSend}
              disabled={!hasText || blocked || disabled}
              title={disabled ? "Setting up encryption… please wait" : "Send message"}
              style={{
                marginLeft: '6px',
                width: '32px', height: '32px',
                borderRadius: '2px',
                backgroundColor: (!hasText || blocked || disabled) ? 'var(--bg-active)' : 'var(--accent)',
                color: (!hasText || blocked || disabled) ? 'var(--text-muted)' : '#0c0c0c',
                border: 'none', cursor: (!hasText || blocked || disabled) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 150ms ease',
                opacity: (!hasText || blocked || disabled) ? 0.5 : 1,
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (hasText && !blocked && !disabled) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
              onMouseLeave={e => { if (hasText && !blocked && !disabled) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
            >
              <SendHorizontal size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      {appModal === 'github' && <CreateGitHubIssueModal onClose={() => setAppModal(null)} onInsertText={insertText} />}
      {appModal === 'jira' && <CreateJiraTicketModal onClose={() => setAppModal(null)} onInsertText={insertText} />}
      </div>
    </div>
  );
}

function ToolBtn({ icon, title, onClick, active = false }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px', borderRadius: '2px', background: 'none',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        color: active ? 'var(--accent)' : (hovered ? 'var(--text-primary)' : 'var(--text-muted)'),
        transition: 'color 150ms ease',
      }}
    >
      {icon}
    </button>
  );
}
