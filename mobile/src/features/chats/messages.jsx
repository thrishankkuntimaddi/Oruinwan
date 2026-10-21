// Message list, message rows and the composer. Rows are left-aligned with avatar and name,
// the same layout as the web client, so conversations read the same on every device.
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, Bookmark, Camera, Copy, CornerDownRight, Ellipsis, ImageIcon, ListTodo, Lock, Pencil, Pin, Plus, SendHorizontal, Sparkles, Trash2, TriangleAlert, Paperclip,
} from 'lucide-react';
import { finePointer } from '../../app/layout.js';
import { QUICK_REACTIONS } from '../../data/constants.js';
import { clock, dayLabel, isSameDay, shortAgo } from '../../lib/time.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { Sheet, Dialog } from '../../ui/Overlay.jsx';
import { cx } from '../../ui/cx.js';
import { tap } from '../../native/index.js';
import { toast } from '../../lib/bus.js';
import { Spinner } from '../../ui/Feedback.jsx';
import { DEFAULT_ASSISTANT, assistantMentionAt } from '../../lib/aiMention.js';
import { Attachments } from '../media/Attachments.jsx';

const GROUP_GAP = 5 * 60_000;

/** Long press (touch), or right-click with a mouse. */
export function useLongPress(callback, ms = 420) {
  const timer = useRef(null);
  const origin = useRef(null);
  const pointer = useRef(null);
  const clear = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e) => {
      origin.current = { x: e.clientX, y: e.clientY };
      pointer.current = e.pointerType;
      clear();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      timer.current = setTimeout(() => {
        tap('medium');
        callback();
      }, ms);
    },
    onPointerMove: (e) => {
      if (!origin.current) return;
      if (Math.abs(e.clientX - origin.current.x) > 8 || Math.abs(e.clientY - origin.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e) => {
      e.preventDefault();
      if (pointer.current === 'mouse') {
        clear();
        callback();
      }
    },
  };
}

function MessageBody({ m, onCancelUpload }) {
  const files = m.state !== 'deleted' ? m.attachments || [] : [];
  if (files.length) {
    // Files aren't end-to-end encrypted (as on the web), so they show even before the keys
    // unlock. A thread reply's caption is the file's name, which the card already shows.
    const caption = m.state === 'ok' && m.text && m.text !== files[0]?.name ? m.text : '';
    return (
      <>
        {caption && <Markdown text={caption} className="text-text" />}
        <Attachments files={files} upload={m.upload} onCancel={m.upload && onCancelUpload ? () => onCancelUpload(m.id) : null} />
      </>
    );
  }
  switch (m.state) {
    case 'locked':
      return (
        <p className="flex items-center gap-1.5 text-[14px] italic text-text-2">
          <Icon as={Lock} size={14} /> Encrypted. Unlock with your password to read.
        </p>
      );
    case 'nokey':
      return <p className="text-[14px] italic text-text-2">Waiting for this conversation's encryption key.</p>;
    case 'failed':
      return <p className="text-[14px] italic text-text-2">This message couldn't be decrypted on this device.</p>;
    case 'deleted':
      return <p className="text-[14px] italic text-text-3">This message was deleted.</p>;
    case 'attachment':
      return (
        <p className="flex items-center gap-1.5 text-[14px] text-text-2">
          <Icon as={Paperclip} size={14} /> {m.text || 'Attachment'} <span className="text-text-3">· open on the web</span>
        </p>
      );
    default:
      return <Markdown text={m.text} className="text-text" />;
  }
}

function Reactions({ m, me, onReact }) {
  const entries = Object.entries(m.reactions || {}).filter(([, users]) => users.length);
  if (!entries.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(me);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(m.id, emoji)}
            aria-pressed={mine}
            aria-label={`${emoji} ${users.length}${mine ? ', including you' : ''}`}
            className={cx(
              'pressable inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[13px]',
              mine ? 'border-accent/60 bg-accent/15 text-accent-ink' : 'border-line bg-surface-2 text-text-2',
            )}
          >
            <span>{emoji}</span>
            <span className="tabular-nums text-xs font-medium">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThreadSummary({ m, directory, onOpen }) {
  if (!m.replyCount) return null;
  const people = (m.replyUserIds || []).map((id) => directory[id]).filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable mt-1.5 flex items-center gap-2 rounded-lg border border-line-soft bg-surface px-2 py-1.5 text-left"
    >
      <span className="flex -space-x-1.5">
        {people.slice(0, 3).map((u) => (
          <span key={u.id} className="rounded-full ring-2 ring-surface">
            <Avatar name={u.name} src={u.avatarUrl} size="xs" />
          </span>
        ))}
      </span>
      <span className="text-[13px] font-medium text-accent-ink">
        {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
      </span>
      {m.lastReplyAt && <span className="text-xs text-text-3">Last {shortAgo(m.lastReplyAt)}</span>}
    </button>
  );
}

export function MessageItem({ m, grouped, directory, me, onReact, onLongPress, onOpenThread, onRetry, onCancelUpload, highlight, hideThread }) {
  const author = m.author || directory[m.authorId] || { name: 'Unknown' };
  const press = useLongPress(() => onLongPress(m));
  if (m.state === 'system') {
    return <p className="px-4 py-2 text-center text-xs text-text-3">{m.text}</p>;
  }
  return (
    <div
      {...press}
      className={cx(
        'group relative flex gap-3 px-4 transition-colors select-none hover:bg-surface-2/40',
        grouped ? 'pt-0.5 pb-0.5' : 'pt-2.5 pb-0.5',
        highlight && 'bg-accent/10',
        m.pending && !m.upload && 'opacity-60',
      )}
    >
      <div className="w-9 shrink-0">
        {!grouped && (
          <button type="button" onClick={() => author.id && author.id !== me && onLongPress(m, 'profile')} aria-label={author.name}>
            <Avatar name={author.name} src={author.avatarUrl} size="sm" className={cx('mt-0.5', author.id === me && 'ring-1 ring-accent/60 rounded-full')} />
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1" style={{ fontSize: 'var(--msg-size)' }}>
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold">{author.name}</span>
            <span className="shrink-0 text-[11px] text-text-3">{clock(m.at)}</span>
            {m.pinned && <Icon as={Pin} size={12} className="shrink-0 text-accent-ink" aria-label="Pinned" />}
          </div>
        )}
        <MessageBody m={m} onCancelUpload={onCancelUpload} />
        {m.edited && <span className="text-[11px] text-text-3">(edited)</span>}
        {m.failed && (
          <button type="button" onClick={() => onRetry(m)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger">
            <Icon as={TriangleAlert} size={13} /> {m.upload && m.error ? `Not sent: ${m.error.replace(/\.$/, '')}. Tap to retry.` : 'Not sent. Tap to retry.'}
          </button>
        )}
        {m.pending && !m.upload && <span className="text-[11px] text-text-3">{m.queued ? 'Queued · sends when you’re back online' : 'Sending…'}</span>}
        <Reactions m={m} me={me} onReact={onReact} />
        {!hideThread && <ThreadSummary m={m} directory={directory} onOpen={() => onOpenThread(m)} />}
      </div>
      {/* Mouse users get the actions on hover; touch keeps the long press. */}
      <button
        type="button"
        aria-label="Message actions"
        title="More actions"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onLongPress(m)}
        className="absolute top-1 right-3 hidden h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-text-2 hover:text-text group-hover:grid"
      >
        <Icon as={Ellipsis} size={16} />
      </button>
    </div>
  );
}

/** Day dividers + grouping of consecutive messages by the same author. */
/** Oruinwan AI answering right now: its words appear as they're written. */
export function AiLiveReply({ reply }) {
  return (
    <div className="flex gap-3 px-4 pt-3" role="status" aria-live="polite" data-testid="ai-live-reply">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent-ink">
        <Icon as={Sparkles} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          {reply.name || 'Oruinwan AI'} <span className="ml-1 text-[12px] font-normal text-text-3">{reply.error ? 'could not answer' : 'is answering…'}</span>
        </p>
        {reply.error ? (
          <p className="text-[15px] text-danger">{reply.error}</p>
        ) : reply.text ? (
          <div className="text-[15px] leading-6">
            <Markdown text={reply.text} />
          </div>
        ) : (
          <p className="flex items-center gap-1 py-1.5 text-[14px] text-text-2" aria-label={reply.status || 'Thinking'}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-text-2" style={{ animation: `dot-pulse 1.2s ${i * 0.15}s infinite` }} />
            ))}
            <span className="ml-1.5">{reply.status}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function MessageList({ items, directory, me, onReact, onLongPress, onOpenThread, onRetry, onCancelUpload, header, footer, loading, highlightId }) {
  const ref = useRef(null);
  const content = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const live = Array.isArray(footer) ? footer.length : footer ? 1 : 0;
  const count = items.length + live;
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current || atBottom) {
      el.scrollTop = el.scrollHeight;
      if (count) first.current = false;
    }
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the newest message visible when the keyboard resizes the view, or when content grows
  // without new messages (a photo or file that finished sending, a reply streaming in).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (atBottom) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    if (content.current) ro.observe(content.current);
    return () => ro.disconnect();
  }, [atBottom]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        className="h-full overflow-y-auto overscroll-contain pb-3"
      >
        <div ref={content}>
          {header}
          {loading && (
            <div className="grid place-items-center py-10 text-text-2">
              <Spinner />
            </div>
          )}
          {items.map((m, i) => {
            const prev = items[i - 1];
            const newDay = !prev || !isSameDay(prev.at, m.at);
            const grouped =
              !newDay &&
              prev &&
              prev.authorId === m.authorId &&
              !prev.replyCount &&
              prev.state !== 'system' &&
              new Date(m.at) - new Date(prev.at) < GROUP_GAP;
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="pointer-events-none sticky top-1.5 z-[1] flex justify-center py-1.5">
                    <span className="rounded-full border border-line bg-surface-2 px-3 py-0.5 text-[11px] font-medium text-text-2 shadow-sm">{dayLabel(m.at)}</span>
                  </div>
                )}
                <MessageItem
                  m={m}
                  grouped={grouped}
                  directory={directory}
                  me={me}
                  onReact={onReact}
                  onLongPress={onLongPress}
                  onOpenThread={onOpenThread}
                  onRetry={onRetry}
                  onCancelUpload={onCancelUpload}
                  highlight={m.id === highlightId}
                />
              </Fragment>
            );
          })}
          {footer}
        </div>
      </div>
      {!atBottom && (
        <button
          type="button"
          onClick={() => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })}
          className="glass pressable absolute right-4 bottom-3 flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium"
        >
          <Icon as={ArrowDown} size="sm" /> Latest
        </button>
      )}
    </div>
  );
}

export function MessageActions({ message, me, open, onClose, onReact, onReply, onDelete, onEdit, onPin, onSave, onTask, canThread = true }) {
  const [confirm, setConfirm] = useState(false);
  if (!message) return null;
  const mine = message.authorId === me;
  const readable = !message.state || message.state === 'ok';
  const items = [
    canThread && !message.parentId && { icon: CornerDownRight, label: 'Reply in thread', run: onReply },
    readable && {
      icon: Copy,
      label: 'Copy text',
      run: async () => {
        try {
          await navigator.clipboard.writeText(message.text);
          toast('Copied');
        } catch {
          toast("Couldn't copy on this device", 'danger');
        }
      },
    },
    onPin && { icon: Pin, label: message.pinned ? 'Unpin from conversation' : 'Pin to conversation', run: onPin },
    onSave && { icon: Bookmark, label: message.saved ? 'Remove from saved' : 'Save for later', run: onSave },
    readable && onTask && { icon: ListTodo, label: 'Create task from message', run: onTask },
    mine && readable && onEdit && { icon: Pencil, label: 'Edit message', run: onEdit },
    mine && onDelete && { icon: Trash2, label: 'Delete message', danger: true, run: () => setConfirm(true), keepOpen: true },
  ].filter(Boolean);

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div className="flex justify-between gap-1 px-4 pb-3">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`React ${e}`}
              onClick={() => {
                onReact(message.id, e);
                onClose();
              }}
              className="pressable grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-[22px]"
            >
              {e}
            </button>
          ))}
        </div>
        <div className="border-t border-line-soft px-2 py-2">
          {items.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                if (!a.keepOpen) onClose();
                a.run();
              }}
              className={cx('flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2', a.danger ? 'text-danger' : 'text-text')}
            >
              <Icon as={a.icon} className={a.danger ? '' : 'text-text-2'} />
              <span className="text-[15px]">{a.label}</span>
            </button>
          ))}
        </div>
      </Sheet>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this message?"
        body="It will be removed for everyone in this conversation. This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setConfirm(false);
          onClose();
          onDelete();
        }}
      />
    </>
  );
}

export function Composer({ placeholder, onSend, onPlus, disabled, disabledReason, initial = '', autoFocus, editing, onCancelEdit, aiMentions = false, assistants }) {
  const [text, setText] = useState(initial);
  const [caret, setCaret] = useState(initial.length);
  const ref = useRef(null);
  // Where the caret goes after the next render (set when @ai is completed), so typing continues after it.
  const pendingCaret = useRef(null);
  useLayoutEffect(() => {
    if (pendingCaret.current == null || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);
  // "@a…", "@cl…" being typed: offer the assistants it could be (Oruinwan AI, Claude…).
  const aiAt = aiMentions && !editing ? assistantMentionAt(text, caret, assistants?.length ? assistants : [DEFAULT_ASSISTANT]) : null;
  const completeAi = (a) => {
    const tag = `@${a.mention} `;
    const next = `${text.slice(0, aiAt.start)}${tag}${text.slice(aiAt.end)}`;
    const pos = aiAt.start + tag.length;
    pendingCaret.current = pos;
    setText(next);
    setCaret(pos);
    tap('select');
  };

  useEffect(() => {
    setText(initial);
    if (initial) setTimeout(() => ref.current?.focus(), 50);
  }, [initial]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  if (disabled) {
    return (
      <div className="shrink-0 border-t border-line-soft bg-bg px-4 py-3 pb-safe">
        <p className="py-2 text-center text-[13px] text-text-2">{disabledReason}</p>
      </div>
    );
  }

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    setCaret(0);
    tap('light');
  };
  // With a physical keyboard, Enter sends and Shift+Enter starts a new line.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && finePointer()) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="glass-header shrink-0 border-t border-line-soft pb-safe">
      {aiAt &&
        aiAt.matches.map((a) => (
          <button
            key={a.id}
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => completeAi(a)}
            className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-2.5 text-left active:bg-surface-2"
            data-testid="ai-mention-suggestion"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent-ink">
              <Icon as={Sparkles} size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{a.name}</span>
              <span className="block text-[12px] text-text-2">@{a.mention} · answers here, for everyone in the conversation</span>
            </span>
          </button>
        ))}
      {editing && (
        <div className="flex items-center justify-between px-4 pt-2 text-xs text-accent-ink">
          <span className="flex items-center gap-1.5">
            <Icon as={Pencil} size={13} /> Editing message
          </span>
          <button type="button" className="font-medium" onClick={onCancelEdit}>
            Cancel
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 py-2.5">
        {onPlus && (
          <button
            type="button"
            aria-label="More actions"
            onClick={onPlus}
            className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2"
          >
            <Icon as={Plus} />
          </button>
        )}
        <div className="flex min-h-10 flex-1 items-center rounded-[20px] border border-line bg-input px-4 focus-within:border-accent/70">
          <textarea
            ref={ref}
            rows={1}
            value={text}
            autoFocus={autoFocus}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? text.length)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            enterKeyHint="enter"
            className="block max-h-[140px] w-full resize-none bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:text-text-3"
          />
        </div>
        <button
          type="button"
          aria-label="Send"
          onPointerDown={(e) => e.preventDefault()}
          onClick={send}
          disabled={!text.trim()}
          className={cx(
            'pressable grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors',
            text.trim() ? 'bg-gold text-on-accent' : 'bg-surface-2 text-text-3',
          )}
        >
          <Icon as={SendHorizontal} size={19} />
        </button>
      </div>
    </div>
  );
}

/**
 * Hidden file inputs for the composer. They work in the app's WebView on Android and iOS
 * (the system offers the gallery, the camera and files) and in browsers. `pick(kind)` must be
 * called straight from a tap, or the system won't open the picker.
 */
export function useFilePickers(onFiles) {
  const media = useRef(null);
  const camera = useRef(null);
  const file = useRef(null);
  const change = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) onFiles(files);
  };
  const inputs = (
    <>
      <input ref={media} type="file" accept="image/*,video/*" multiple hidden onChange={change} data-testid="pick-media" />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={change} data-testid="pick-camera" />
      <input ref={file} type="file" multiple hidden onChange={change} data-testid="pick-file" />
    </>
  );
  const pick = (kind) => ({ media, camera, file })[kind]?.current?.click();
  return { inputs, pick };
}

export function ComposerPlusSheet({ open, onClose, onAskAi, onTask, onPick, title = 'Add to message' }) {
  // A computer has no camera to point: its file picker covers photos.
  const camera = onPick && !finePointer();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-2 pb-3">
        {[
          onPick && { icon: ImageIcon, label: 'Photo or video', hint: 'Choose from your gallery', run: () => onPick('media') },
          camera && { icon: Camera, label: 'Take a photo', hint: 'Use the camera', run: () => onPick('camera') },
          onPick && { icon: Paperclip, label: 'File', hint: 'Documents, PDFs and anything else up to 100 MB', run: () => onPick('file') },
          onAskAi && { icon: Sparkles, label: 'Ask Oruinwan AI', hint: 'Get a summary or a draft for this conversation', run: onAskAi },
          onTask && { icon: ListTodo, label: 'Create a task', hint: 'Track something from this conversation', run: onTask },
        ]
          .filter(Boolean)
          .map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              onClick={() => {
                // Run first: a file picker only opens from the tap itself.
                a.run?.();
                onClose();
              }}
              className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2 disabled:opacity-45"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent-ink">
                <Icon as={a.icon} size="sm" />
              </span>
              <span>
                <span className="block text-[15px]">{a.label}</span>
                <span className="block text-[13px] text-text-2">{a.hint}</span>
              </span>
            </button>
          ))}
      </div>
    </Sheet>
  );
}
