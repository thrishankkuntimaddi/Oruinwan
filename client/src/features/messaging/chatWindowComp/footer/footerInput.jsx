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
import { INTEGRATION_COMMANDS, runIntegrationCommand } from "../../../../features/integrations/slashActions";
import { useToast } from "../../../../contexts/ToastContext";
import SlashCommandPreview from "../../../../components/chat/slash/SlashCommandPreview";
import SmartReplySuggestions from "./SmartReplySuggestions";
import { useAIContext } from "../../../../contexts/AIContext";
import ScreenRecorder from "./ScreenRecorder";
import VideoNoteRecorder from "./VideoNoteRecorder";
import UploadTray from "./UploadTray";
import useUploadQueue from "./useUploadQueue";
import { COMPOSER_MENTION_EVENT } from "../../../profileCard/composerBridge";

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
  // Set while a follow-up with Oruinwan AI is active: { onStop }.
  aiFollowUp = null,
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
  const { flags } = useFeatureFlags();
  const { showToast } = useToast();
  // Workspace admins can switch off uploads and AI; hide their controls.
  const uploadsOn = features?.fileUploads !== false;
  const showAIControl = showAI && features?.ai !== false;
  const showVoiceControl = showVoice && uploadsOn;
  const showScreenRecordControl = showScreenRecord && uploadsOn;

  // ── Files: picked, pasted or dropped files upload here with progress/cancel/retry,
  // and each one is sent as its own message when its upload finishes.
  const canUpload = uploadsOn && !!onSendAttachment && !blocked;
  const rootRef = useRef(null);
  const [showVideoNote, setShowVideoNote] = useState(false);
  const [dropZone, setDropZone] = useState(null); // DOMRect of the chat column while files are dragged over it
  const uploads = useUploadQueue({
    conversationId,
    conversationType,
    onUploaded: (attachment) => onSendAttachment?.(attachment),
  });
  const addFiles = uploads.add;
  const queueRecording = useCallback(({ file, duration, width, height, variant }) => {
    addFiles([file], { attachment: { duration, ...(width ? { width } : {}), ...(height ? { height } : {}), ...(variant ? { variant } : {}) } });
  }, [addFiles]);
  const handlePaste = useCallback((e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (!files.length || !canUpload || disabled) return;
    e.preventDefault();
    // Screenshots arrive as "image.png"; give them a readable, unique name.
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    files.forEach((f, i) => {
      const generic = /^image\.(png|jpe?g|gif|webp)$/i.test(f.name || '');
      addFiles([f], generic ? { filename: `pasted-image-${stamp}${files.length > 1 ? `-${i + 1}` : ''}.${f.name.split('.').pop()}` } : undefined);
    });
  }, [canUpload, disabled, addFiles]);
  // Dropping files anywhere on the conversation (message list + composer) shares them.
  useEffect(() => {
    const zone = rootRef.current?.parentElement;
    if (!zone || !canUpload || disabled) return undefined;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    let depth = 0;
    const onEnter = (e) => { if (!hasFiles(e)) return; depth += 1; setDropZone(zone.getBoundingClientRect()); };
    const onOver = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const onLeave = (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setDropZone(null); };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDropZone(null);
      addFiles(e.dataTransfer.files);
    };
    zone.addEventListener('dragenter', onEnter);
    zone.addEventListener('dragover', onOver);
    zone.addEventListener('dragleave', onLeave);
    zone.addEventListener('drop', onDrop);
    return () => {
      zone.removeEventListener('dragenter', onEnter);
      zone.removeEventListener('dragover', onOver);
      zone.removeEventListener('dragleave', onLeave);
      zone.removeEventListener('drop', onDrop);
    };
  }, [canUpload, disabled, addFiles]);

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
  // Register once per mount with a stable handle, so the AI context keeps
  // composers in mount order (an open thread's composer sits on top). Inserts
  // are routed by the AI context to the top composer only.
  const insertTextRef = useRef(insertText);
  insertTextRef.current = insertText;
  const registerComposer = aiCtx?.registerComposer;
  useEffect(() => {
    const handle = { insert: (text) => insertTextRef.current(text) };
    if (registerComposer) return registerComposer(handle);
    // Outside the AI provider: listen for insert events directly.
    const onInsert = (e) => handle.insert(e?.detail?.text);
    document.addEventListener('chttrix:composer:insert', onInsert);
    return () => document.removeEventListener('chttrix:composer:insert', onInsert);
  }, [registerComposer]);

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

  // Put an "@Oruinwan" mention chip at the start of the message unless one is there.
  const insertAIMention = () => {
    const el = editableRef.current;
    if (!el) return;
    el.focus();
    let chip = el.querySelector('[data-mention="Oruinwan"]');
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'mention-chip inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 cursor-default select-none';
      chip.contentEditable = 'false';
      chip.dataset.mention = 'Oruinwan';
      chip.textContent = '@Oruinwan';
      const space = document.createTextNode('\u00a0');
      el.insertBefore(space, el.firstChild);
      el.insertBefore(chip, space);
    }
    // Caret right after the chip (and its trailing space).
    const sel = window.getSelection();
    const range = document.createRange();
    const after = chip.nextSibling;
    if (after && after.nodeType === Node.TEXT_NODE) range.setStart(after, Math.min(1, after.textContent.length));
    else range.setStartAfter(chip);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    const html = el.innerHTML || '';
    setHasText(true);
    onChange({ target: { value: html } });
  };

  // "Mention" from a profile popover: an @username chip at the caret (or at the
  // end when the caret is elsewhere), followed by a space, caret after it.
  const insertMentionChipRef = useRef(null);
  insertMentionChipRef.current = (username) => {
    const el = editableRef.current;
    if (!el || !username || blocked || disabled) return;
    if (/^oruinwan$/i.test(username)) { insertAIMention(); return; }
    el.focus();
    const sel = window.getSelection();
    let range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range || !el.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    const chip = document.createElement('span');
    chip.className = 'mention-chip inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 cursor-default select-none';
    chip.contentEditable = 'false';
    chip.dataset.mention = username;
    chip.textContent = `@${username}`;
    const space = document.createTextNode(' ');
    // Keep "@name" apart from a word typed right before it.
    const before = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.textContent.slice(0, range.startOffset)
      : (el.textContent || '');
    const frag = document.createDocumentFragment();
    if (before && !/\s$/.test(before)) frag.appendChild(document.createTextNode(' '));
    frag.appendChild(chip);
    frag.appendChild(space);
    range.insertNode(frag);
    const caret = document.createRange();
    caret.setStartAfter(space);
    caret.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(caret);
    setHasText(true);
    onChange({ target: { value: el.innerHTML || '' } });
  };
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const onMention = (e) => insertMentionChipRef.current?.(e?.detail?.username);
    root.addEventListener(COMPOSER_MENTION_EVENT, onMention);
    return () => root.removeEventListener(COMPOSER_MENTION_EVENT, onMention);
  }, []);

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
        // Address the message to Oruinwan AI: an @Oruinwan chip at the start of
        // the message (once), caret after it. Sending it gets an answer here.
        insertAIMention();
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
      // /github, /jira, /zoom, /review, /task: run here, post the result as a
      // message; on failure explain why and give the command back to edit.
      if (INTEGRATION_COMMANDS.has(command.name)) {
        const typed = el.innerText.trim();
        clear();
        const wsId = workspaceId || window.location.pathname.match(/\/workspace\/([^/]+)/)?.[1] || null;
        runIntegrationCommand(command.name, command.args, {
          workspaceId: wsId,
          conversationId,
          conversationType,
          send: (text) => onSend(text, { mentionText: '' }),
          notify: (msg, tone) => showToast?.(msg, tone),
        }).catch((err) => {
          showToast?.(err?.message || 'That command failed.', 'error', 6000);
          if (editableRef.current && !editableRef.current.textContent.trim()) insertText(typed);
        });
        return;
      }
      // Only a view that handles slash commands may consume one; without a
      // handler the text is sent as typed instead of silently disappearing.
      if (onSlashCommand && onSlashCommand(command.name, command.args) !== false) {
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
  }, [blocked, disabled, onSend, setNewMessage, closeSuggestions, extractMentionText, flags, onSlashCommand, workspaceId, conversationId, conversationType, showToast, insertText]);

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
    <div ref={rootRef} data-composer-root="" style={{
      padding: '12px 16px',
      backgroundColor: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-default)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {dropZone && (
        <div data-testid="drop-overlay" aria-hidden
          style={{
            position: 'fixed', left: dropZone.left, top: dropZone.top, width: dropZone.width, height: dropZone.height,
            zIndex: 70, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--bg-surface) 82%, transparent)', border: '2px dashed var(--accent)',
            color: 'var(--text-primary)', fontSize: 15, fontWeight: 600,
          }}>
          Drop files to share them here
        </div>
      )}

      <UploadTray items={uploads.items} onCancel={uploads.cancel} onRetry={uploads.retry} onDismiss={uploads.dismiss} />

      {recording && showVoiceControl && canUpload && (
        <div style={{ marginBottom: 6 }}>
          <VoiceRecorder
            onRecorded={(rec) => { queueRecording(rec); setRecording(false); }}
            onCancel={() => setRecording(false)}
          />
        </div>
      )}

      {showVideoNote && canUpload && (
        <VideoNoteRecorder
          onRecorded={(rec) => { queueRecording({ ...rec, variant: 'video_note' }); setShowVideoNote(false); }}
          onCancel={() => setShowVideoNote(false)}
        />
      )}

      {}
      {replyingTo && (
        <ReplyPreview replyingTo={replyingTo} onCancel={onCancelReply} />
      )}

      {aiFollowUp && !replyingTo && (
        <div role="status" data-testid="ai-follow-up"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px', padding: '6px 10px', borderLeft: '2px solid var(--accent)', background: 'var(--accent-dim)', fontSize: '12px', color: 'var(--text-secondary)', borderRadius: '0 2px 2px 0' }}>
          <img src="/icons/oruinwan-128.png" alt="" style={{ width: 16, height: 16, borderRadius: 2 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Continuing with Oruinwan AI</strong> · your next message goes to the AI, no mention needed
          </span>
          <button type="button" onClick={aiFollowUp.onStop}
            style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Stop
          </button>
        </div>
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
            onPaste={handlePaste}
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
                  title="Ask Oruinwan AI (adds @Oruinwan to your message)"
                  aria-label="Ask Oruinwan AI"
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <img src="/icons/oruinwan-128.png" alt="" style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: 2 }} />
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
            {(onAttach || onCreatePoll || onCreateChecklist || onSendAttachment) && (
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
                    onPickFiles={canUpload ? addFiles : undefined}
                    onCreatePoll={onCreatePoll}
                    onCreateChecklist={onCreateChecklist}
                    onOpenVoiceRecorder={showVoiceControl && canUpload ? (() => { setShowVideoNote(false); setRecording(true); }) : undefined}
                    onOpenVideoNote={showVoiceControl && canUpload ? (() => { setRecording(false); setShowVideoNote(true); }) : undefined}
                    allowUploads={uploadsOn}
                    onInsertText={insertText}
                    onClose={() => setShowAttach(false)}
                  />
                </div>
              )}
            </div>
            )}

            {}
            {showVoiceControl && canUpload && (
              <ToolBtn
                icon={<Mic size={16} />}
                title="Voice note"
                active={recording}
                onClick={() => { if (!blocked && !disabled) { setShowVideoNote(false); setRecording(!recording); } }}
              />
            )}

            {}
            {showScreenRecordControl && (
              <ScreenRecorder
                disabled={blocked || disabled || !canUpload}
                onRecorded={queueRecording}
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
