// Message list, message rows and the composer. Rows are left-aligned with avatar and name,
// the same layout as the web client, so conversations read the same on every device.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, BarChart3, BellRing, Bookmark, Camera, Check, CheckCheck, CheckCircle2, Clock3, Copy, CornerDownRight, CornerUpLeft, Ellipsis, EyeOff, History, ImageIcon, Languages, Link2, ListChecks, ListTodo, Lock, Pencil, Pin, Plus, SendHorizontal, Share2, SmilePlus, Sparkles, Trash2, TriangleAlert, Paperclip, X,
} from 'lucide-react';
import { finePointer } from '../../app/layout.js';
import { QUICK_REACTIONS } from '../../data/constants.js';
import { clock, dayLabel, isSameDay, shortAgo } from '../../lib/time.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { nav } from '../../app/nav.js';
import { StandingTag } from '../../ui/StandingTag.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { Sheet, Dialog } from '../../ui/Overlay.jsx';
import { cx } from '../../ui/cx.js';
import { copyText, tap } from '../../native/index.js';
import { toast } from '../../lib/bus.js';
import { Spinner } from '../../ui/Feedback.jsx';
import { DEFAULT_ASSISTANT, assistantMentionAt } from '../../lib/aiMention.js';
import { Attachments } from '../media/Attachments.jsx';
import { applyMention, mentionAt, mentionSuggestions } from '../../lib/mentions.js';
import { ChecklistCard, PollCard, TranslationNote } from './rich.jsx';
import { MentionSuggestions, MicButton, RecordingBar, SmartReplies, canRecordVoice, useVoiceRecorder } from './composerExtras.jsx';
import { useTranslations } from './translate.js';
import { Info } from 'lucide-react';
import { Smile, Type } from 'lucide-react';
import { applyFormat, insertAt, insertLink } from './composerFormat.js';
import { EmojiSheet, FormatToolbar } from './composerToolbar.jsx';
import { SWIPE_TRIGGER, useRowGestures } from './messageGestures.js';
import { ScheduleSheet } from './ScheduleSheet.jsx';
import { clearDraft, draftFor, saveDraft } from './drafts.js';
import { hasFormatting, highlightSegments } from './composerHighlight.js';
import { useSession } from '../../data/session.js';
import { motion, useArrivals, useBump, useReducedMotion } from '../../lib/motion.js';
import { SlashBar, SlashList, filterCommands, helpLines, prepareCommand, runPrepared, runsWithoutArgs, typingHint } from './slash.jsx';

const GROUP_GAP = 5 * 60_000;

// How each kind of segment looks under the text box. Nothing here changes a character's width.
const SEGMENT_CLASS = {
  mark: 'text-text-3/45',
  bold: '[-webkit-text-stroke:0.45px_currentColor]',
  italic: '[font-style:oblique_9deg]',
  strike: 'line-through decoration-text-2',
  code: 'rounded-[4px] bg-surface-3 text-accent-ink',
  mention: 'rounded-[4px] bg-accent/12 text-accent-ink',
  quote: 'text-text-2',
};
const segmentClass = (kind) => (kind ? kind.split(' ').map((k) => SEGMENT_CLASS[k] || '').join(' ') : '');

/** The formatted copy of the composer's text, drawn under the (transparent) text box. */
function ComposerHighlight({ text, scrollRef }) {
  return (
    <div
      ref={scrollRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden py-2 text-[15px] leading-6 break-words whitespace-pre-wrap text-text"
      data-testid="composer-highlight"
    >
      {highlightSegments(text).map((seg, i) => (
        <span key={i} className={segmentClass(seg.kind)}>
          {seg.text}
        </span>
      ))}
      {/* A trailing newline needs a character after it to take up its line. */}
      {text.endsWith('\n') ? ' ' : null}
    </div>
  );
}

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

function MessageBody({ m, onCancelUpload, me, directory }) {
  if (m.state !== 'deleted' && m.poll) return <PollCard m={m} me={me} directory={directory} />;
  if (m.state !== 'deleted' && m.type === 'checklist' && (m.state === 'ok' || m.checklist?.length)) return <ChecklistCard m={m} />;
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

/** Someone who reacted, for the "who reacted" sheet: me as "You", others from the directory. */
export function reactorOf(id, { me, directory, names }) {
  if (id === me) return { id, name: 'You', avatarUrl: directory?.[id]?.avatarUrl };
  const u = directory?.[id];
  return { id, name: u?.name || names?.[id] || 'Someone', avatarUrl: u?.avatarUrl };
}

/** "Asha and you", "Asha, Ravi and 3 others": who reacted, for screen readers. */
export function reactorsLabel(people) {
  const n = people.map((p) => (p.name === 'You' ? 'you' : p.name));
  if (n.length <= 1) return n[0] || '';
  if (n.length <= 3) return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
  return `${n.slice(0, 2).join(', ')} and ${n.length - 2} others`;
}

/** One reaction: pops in when it's new, bumps when its count goes up. */
function ReactionChip({ emoji, count, mine, fresh, onClick, label }) {
  const reduced = useReducedMotion();
  const bump = useBump(count);
  return (
    <button
      key={bump.key}
      type="button"
      data-testid="reaction-chip"
      onClick={onClick}
      aria-pressed={mine}
      aria-label={label}
      className={cx(
        'pressable inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[13px]',
        mine ? 'border-accent/60 bg-accent/15 text-accent-ink' : 'border-line bg-surface-2 text-text-2',
        bump.className || (fresh && motion('animate-pop-in', reduced)),
      )}
    >
      <span>{emoji}</span>
      <span className="tabular-nums text-xs font-medium">{count}</span>
    </button>
  );
}

function Reactions({ m, me, directory, onReact }) {
  const [who, setWho] = useState(null); // 'all' or an emoji: the "who reacted" sheet, or null
  const [picking, setPicking] = useState(false);
  const lastTap = useRef({ emoji: null, at: 0 });
  const timer = useRef(null);
  const entries = Object.entries(m.reactions || {}).filter(([, users]) => users.length);
  // Reactions shown when the message appeared stay still; ones added later pop in.
  const shownAtFirst = useRef(null);
  if (!shownAtFirst.current) shownAtFirst.current = new Set(entries.map(([emoji]) => emoji));
  if (!entries.length) return null;
  const people = (users) => users.map((id) => reactorOf(id, { me, directory, names: m.reactorNames }));
  const total = entries.reduce((n, [, users]) => n + users.length, 0);
  // Everyone who reacted, with all their emojis ("All" filter).
  const everyone = [];
  for (const [emoji, users] of entries) for (const id of users) {
    const found = everyone.find((x) => x.id === id);
    if (found) found.emojis.push(emoji);
    else everyone.push({ ...reactorOf(id, { me, directory, names: m.reactorNames }), emojis: [emoji] });
  }
  const listed = who === 'all' ? everyone : people(m.reactions?.[who] || []).map((p) => ({ ...p, emojis: [who] }));
  // Tap: who reacted. Double tap: add (or take back) that reaction.
  const tapChip = (emoji) => {
    const now = Date.now();
    if (lastTap.current.emoji === emoji && now - lastTap.current.at < 280) {
      clearTimeout(timer.current);
      lastTap.current = { emoji: null, at: 0 };
      tap('light');
      onReact(m.id, emoji);
      return;
    }
    lastTap.current = { emoji, at: now };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWho(emoji), 280);
  };
  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-no-tap onPointerDown={(e) => e.stopPropagation()}>
        {entries.map(([emoji, users]) => {
          const mine = users.includes(me);
          return (
            <ReactionChip
              key={emoji}
              emoji={emoji}
              count={users.length}
              mine={mine}
              fresh={!shownAtFirst.current.has(emoji)}
              onClick={() => tapChip(emoji)}
              label={`${emoji} ${users.length}: ${reactorsLabel(people(users))}. Tap to see who reacted, double tap to ${mine ? 'take back yours' : 'add yours'}.`}
            />
          );
        })}
        <button
          type="button"
          aria-label="Add a reaction"
          data-testid="reaction-add"
          onClick={() => setPicking(true)}
          className="pressable grid h-7 w-8 place-items-center rounded-full border border-dashed border-line-strong text-text-2"
        >
          <Icon as={SmilePlus} size={14} />
        </button>
      </div>
      <Sheet open={Boolean(who)} onClose={() => setWho(null)} title={`Reactions · ${total}`}>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2" role="tablist">
          {[['all', everyone.length], ...entries.map(([e, u]) => [e, u.length])].map(([key, n]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={who === key}
              onClick={() => setWho(key)}
              className={cx(
                'pressable inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[14px]',
                who === key ? 'border-accent/60 bg-accent/15 text-accent-ink' : 'border-line bg-surface-2 text-text-2',
              )}
            >
              {key === 'all' ? 'All' : key} <span className="tabular-nums text-xs font-medium">{n}</span>
            </button>
          ))}
        </div>
        <ul className="px-4 pb-2" data-testid="reaction-people">
          {listed.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar name={p.name === 'You' ? directory?.[me]?.name || 'You' : p.name} src={p.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{p.name}</span>
              <span className="text-lg" aria-hidden>
                {p.emojis.join(' ')}
              </span>
            </li>
          ))}
        </ul>
        {who && who !== 'all' && (
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => {
                onReact(m.id, who);
                setWho(null);
              }}
              className="pressable w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] font-medium"
            >
              {(m.reactions?.[who] || []).includes(me) ? `Take back your ${who}` : `React ${who} too`}
            </button>
          </div>
        )}
      </Sheet>
      <EmojiSheet
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false);
          onReact(m.id, e);
        }}
      />
    </>
  );
}

/** The message a reply quotes: its author and a line of it; tapping shows the original. */
export function QuoteBlock({ quoted, directory, me, onJump, compact = false }) {
  if (!quoted) return null;
  const name = quoted.authorId === me ? 'You' : quoted.authorName || directory?.[quoted.authorId]?.name || 'Someone';
  const text = quoted.state === 'missing' || quoted.state === 'deleted' ? 'Original message not available' : quoted.text || (quoted.state === 'attachment' ? 'Attachment' : 'Message');
  return (
    <button
      type="button"
      data-no-tap
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onJump?.(quoted.id)}
      className={cx('mb-1 block w-full max-w-md rounded-lg border-l-[3px] border-accent bg-surface-2/80 px-2.5 text-left', compact ? 'py-1' : 'py-1.5')}
      data-testid="quote-block"
    >
      <span className="block truncate text-[12px] font-semibold text-accent-ink">{name}</span>
      <span className="line-clamp-2 block text-[13px] text-text-2">{plainLine(text)}</span>
    </button>
  );
}

const plainLine = (t) => String(t || '').replace(/[*_~`>#]/g, '').replace(/\s+/g, ' ').trim();

/** ✓ sent, ✓✓ read (DMs; the server hides reads of people with read receipts off). */
function Ticks({ state }) {
  if (!state) return null;
  if (state === 'sending') return <Icon as={Clock3} size={12} className="text-text-3" aria-label="Sending" />;
  if (state === 'read') return <Icon as={CheckCheck} size={14} className="text-accent-ink" aria-label="Read" />;
  return <Icon as={Check} size={14} className="text-text-3" aria-label="Sent" />;
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
      {m.resolved && (
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <Icon as={CheckCircle2} size={12} /> Resolved
        </span>
      )}
      {m.lastReplyAt && <span className="text-xs text-text-3">Last {shortAgo(m.lastReplyAt)}</span>}
    </button>
  );
}

export function MessageItem({
  m, grouped, directory, me, onReact, onLongPress, onOpenThread, onRetry, onCancelUpload, highlight, hideThread, onSwipeReply, onTapMessage, onDoubleTap, receipt, onJumpTo, arrived = false,
}) {
  const reduced = useReducedMotion();
  const author = m.author || directory[m.authorId] || { name: 'Unknown' };
  const ready = !m.pending && m.state !== 'deleted';
  const { dx, handlers } = useRowGestures({
    onLongPress: () => onLongPress(m),
    onSwipe: ready && onSwipeReply ? () => onSwipeReply(m) : null,
    onTap: ready && onTapMessage ? () => onTapMessage(m) : null,
    onDoubleTap: ready && onDoubleTap ? () => onDoubleTap(m) : null,
  });
  if (m.state === 'system') {
    return <p className="px-4 py-2 text-center text-xs text-text-3">{m.text}</p>;
  }
  const tick = receipt ? receipt(m) : null;
  return (
    <div
      {...handlers}
      data-mid={m.id}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 180ms ease-out', touchAction: 'pan-y' }}
      className={cx(
        'group relative flex gap-3 px-4 transition-colors select-none hover:bg-surface-2/40',
        grouped ? 'pt-0.5 pb-0.5' : 'pt-2.5 pb-0.5',
        highlight && 'bg-accent/10',
        m.pending && !m.upload && 'opacity-60',
        arrived && motion('animate-msg-in', reduced),
      )}
    >
      {dx > 0 && (
        <span
          className="pointer-events-none absolute top-1/2 -left-9 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-accent/15 text-accent-ink"
          style={{ opacity: Math.min(dx / SWIPE_TRIGGER, 1), transform: `translateY(-50%) scale(${dx >= SWIPE_TRIGGER ? 1.1 : 0.85})` }}
          aria-hidden
        >
          <Icon as={CornerUpLeft} size={16} />
        </span>
      )}
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
            <StandingTag person={directory[m.authorId] || author} />
            <span className="shrink-0 text-[11px] text-text-3">{clock(m.at)}</span>
            {tick && <span className="flex shrink-0 items-center self-center"><Ticks state={tick} /></span>}
            {m.pinned && <Icon as={Pin} size={12} className="shrink-0 text-accent-ink" aria-label="Pinned" />}
            {m.saved && <Icon as={Bookmark} size={12} className="shrink-0 text-accent-ink" aria-label="Saved for later" />}
          </div>
        )}
        {m.quoted && m.state !== 'deleted' && <QuoteBlock quoted={m.quoted} directory={directory} me={me} onJump={onJumpTo} />}
        {/* Follow-up messages carry their tick at the bottom right of the body: the same spot
            for text, photos and files. */}
        <div className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <MessageBody m={m} onCancelUpload={onCancelUpload} me={me} directory={directory} />
          </div>
          {grouped && tick && (
            <span className="mb-0.5 flex h-4 shrink-0 items-center" data-testid="message-tick">
              <Ticks state={tick} />
            </span>
          )}
        </div>
        <TranslationNote m={m} />
        {m.fromTaskId != null && <span data-testid="message-from-task" className="mr-1 text-[11px] text-text-3">From the task's discussion</span>}
        {m.edited &&
          (m.editCount > 0 && m.state === 'ok' ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onLongPress(m, 'history')}
              className="text-[11px] text-text-3 underline-offset-2 active:underline"
              aria-label="Edited. Show edit history"
            >
              (edited)
            </button>
          ) : (
            <span className="text-[11px] text-text-3">(edited)</span>
          ))}
        {m.failed && (
          <button type="button" onClick={() => onRetry(m)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger">
            <Icon as={TriangleAlert} size={13} /> {m.upload && m.error ? `Not sent: ${m.error.replace(/\.$/, '')}. Tap to retry.` : 'Not sent. Tap to retry.'}
          </button>
        )}
        {m.pending && !m.upload && <span className="text-[11px] text-text-3">{m.queued ? 'Queued · sends when you’re back online' : 'Sending…'}</span>}
        <Reactions m={m} me={me} directory={directory} onReact={onReact} />
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

/** Messages split into days: [{ at, items }], in order. */
export function dayBlocks(items) {
  const out = [];
  for (const m of items || []) {
    const last = out[out.length - 1];
    if (last && isSameDay(last.at, m.at)) last.items.push(m);
    else out.push({ at: m.at, items: [m] });
  }
  return out;
}

export function MessageList({
  items, directory, me, onReact, onLongPress, onOpenThread, onRetry, onCancelUpload, header, footer, loading, highlightId, onSwipeReply, onTapMessage, onDoubleTap, receipt, onDayTap, onJumpTo, onReachTop,
  topInset = 0,
}) {
  const ref = useRef(null);
  const content = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const live = Array.isArray(footer) ? footer.length : footer ? 1 : 0;
  const count = items.length + live;
  const first = useRef(true);
  const loadingTop = useRef(false);
  // Messages that arrive while it's open fade and rise in; the history it opened with doesn't.
  const arrived = useArrivals(items);

  // "Translate automatically": other people's recent messages, into the chosen language.
  const autoLang = useTranslations((s) => s.autoLang);
  useEffect(() => {
    if (!autoLang) return;
    const { byId, translate } = useTranslations.getState();
    for (const m of items.slice(-30)) {
      if (m.authorId === me || m.state !== 'ok' || !m.text?.trim() || m.pending || m.type === 'checklist' || byId[m.id]) continue;
      translate(m.id, m.text, autoLang, { auto: true });
    }
  }, [autoLang, items, me]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current || atBottom) {
      el.scrollTop = el.scrollHeight;
      if (count) first.current = false;
    }
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  // A message to show (search result, pinned, saved or a notification): scroll it into view.
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!highlightId || !hasItems) return;
    const el = ref.current?.querySelector(`[data-mid="${String(highlightId).replace(/"/g, '')}"]`);
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }, [highlightId, hasItems]);

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
          // Near the top: load older history, keeping what's on screen in place.
          if (onReachTop && el.scrollTop < 120 && !loadingTop.current) {
            loadingTop.current = true;
            const before = el.scrollHeight;
            Promise.resolve(onReachTop())
              .then((n) => {
                if (n) requestAnimationFrame(() => (el.scrollTop += el.scrollHeight - before));
              })
              .finally(() => setTimeout(() => (loadingTop.current = false), 400));
          }
        }}
        className="h-full overflow-y-auto overscroll-contain pb-3"
      >
        <div ref={content} style={topInset ? { paddingTop: topInset } : undefined}>
          {header}
          {loading && (
            <div className="grid place-items-center py-10 text-text-2">
              <Spinner />
            </div>
          )}
          {/* One block per day: its date chip sticks to the top only while that day is on screen
              (in one shared block the chips of earlier days stayed stuck and piled up). */}
          {dayBlocks(items).map((day) => (
            <section key={`day-${day.items[0].id}`} data-testid="day-block">
              <div className="pointer-events-none sticky z-[1] flex justify-center py-1.5" style={{ top: 6 + topInset }}>
                {/* Tap the date to jump to another day. */}
                <button
                  type="button"
                  onClick={onDayTap ? () => onDayTap(day.at) : undefined}
                  aria-label={onDayTap ? `${dayLabel(day.at)}. Jump to a date` : dayLabel(day.at)}
                  className={cx('rounded-full border border-line bg-surface-2 px-3 py-0.5 text-[11px] font-medium text-text-2 shadow-sm', onDayTap && 'pointer-events-auto pressable')}
                  data-testid="day-chip"
                >
                  {dayLabel(day.at)}
                </button>
              </div>
              {day.items.map((m, i) => {
                const prev = day.items[i - 1];
                const grouped =
                  prev &&
                  prev.authorId === m.authorId &&
                  !prev.replyCount &&
                  prev.state !== 'system' &&
                  new Date(m.at) - new Date(prev.at) < GROUP_GAP;
                return (
                  <MessageItem
                    key={m.id}
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
                    onSwipeReply={onSwipeReply}
                    onTapMessage={onTapMessage}
                    onDoubleTap={onDoubleTap}
                    receipt={receipt}
                    onJumpTo={onJumpTo}
                    arrived={arrived.has(String(m.id))}
                  />
                );
              })}
            </section>
          ))}
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

export function MessageActions({
  message, me, open, onClose, onReact, onReply, onQuote, onDelete, onEdit, onPin, onSave, onTask, onRemind, onTranslate, onHistory, onInfo, onCopyLink, onShare, canThread = true,
}) {
  const [confirm, setConfirm] = useState(null); // 'everyone' | 'me'
  const [picking, setPicking] = useState(false);
  if (!message) return null;
  const mine = message.authorId === me;
  const readable = !message.state || message.state === 'ok';
  const items = [
    onQuote && !message.pending && { icon: CornerUpLeft, label: 'Reply', run: onQuote },
    canThread && !message.parentId && { icon: CornerDownRight, label: 'Reply in thread', run: onReply },
    readable && message.type !== 'checklist' && {
      icon: Copy,
      label: 'Copy text',
      run: async () => {
        if (await copyText(message.text)) toast('Copied');
        else toast("Couldn't copy on this device", 'danger');
      },
    },
    onCopyLink && !message.pending && { icon: Link2, label: 'Copy link', run: onCopyLink },
    onShare && !message.pending && { icon: Share2, label: 'Share…', run: onShare },
    onPin && { icon: Pin, label: message.pinned ? 'Unpin from conversation' : 'Pin to conversation', run: onPin },
    onSave && { icon: Bookmark, label: message.saved ? 'Remove from saved' : 'Save for later', run: onSave },
    onRemind && { icon: BellRing, label: 'Remind me about this', run: onRemind },
    readable && message.text && message.type !== 'checklist' && onTranslate && { icon: Languages, label: 'Translate', run: onTranslate },
    readable && onTask && !message.linkedTaskId && { icon: ListTodo, label: 'Convert to task', run: onTask },
    // Already a task: open it with its details.
    message.linkedTaskId && { icon: ListTodo, label: 'Open task', run: () => nav.push('task', { id: message.linkedTaskId }, { tab: 'tasks' }) },
    mine && readable && onEdit && message.type !== 'checklist' && message.fromTaskId == null && { icon: Pencil, label: 'Edit message', run: onEdit },
    // A reply that came from a task's discussion: open that task.
    message.fromTaskId && { icon: ListTodo, label: 'Open task', run: () => nav.push('task', { id: message.fromTaskId }, { tab: 'tasks' }) },
    readable && message.editCount > 0 && onHistory && { icon: History, label: 'Edit history', run: onHistory },
    mine && onInfo && !message.pending && { icon: Info, label: 'Message info', run: onInfo },
    onDelete && !message.pending && { icon: EyeOff, label: 'Delete for me', danger: true, run: () => setConfirm('me'), keepOpen: true },
    mine && onDelete && { icon: Trash2, label: 'Delete for everyone', danger: true, run: () => setConfirm('everyone'), keepOpen: true },
  ].filter(Boolean);

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div className="flex justify-between gap-1 px-4 pb-3">
          {QUICK_REACTIONS.slice(0, 6).map((e) => (
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
          <button
            type="button"
            aria-label="More reactions"
            onClick={() => setPicking(true)}
            className="pressable grid h-11 w-11 place-items-center rounded-full border border-dashed border-line-strong text-text-2"
          >
            <Icon as={SmilePlus} size={20} />
          </button>
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
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === 'me' ? 'Delete this message for you?' : 'Delete this message for everyone?'}
        body={confirm === 'me' ? 'It disappears from this conversation on your devices. Everyone else still sees it.' : "It will be removed for everyone in this conversation. This can't be undone."}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const scope = confirm;
          setConfirm(null);
          onClose();
          onDelete(scope);
        }}
      />
      <EmojiSheet
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false);
          onReact(message.id, e);
          onClose();
        }}
      />
    </>
  );
}

export function Composer({
  placeholder, onSend, onPlus, disabled, disabledReason, initial = '', autoFocus, editing, editText = '', onCancelEdit, aiMentions = false, assistants,
  mentions = null, recent = null, onVoice = null, quote = null, onCancelQuote = null, onSchedule = null, directory = null, me = null, scheduleRef = null, draftConv = null,
  // Slash commands: the actions here (see slash.jsx, phoneCommands). Null turns them off.
  commands = null,
}) {
  // Unsent text is kept per conversation on this device (Drafts & sent lists it).
  const draftWs = useSession((s) => s.workspaceId);
  const [text, setText] = useState(() => initial || (draftConv ? draftFor(draftWs, draftConv) : ''));
  const [caret, setCaret] = useState(initial.length);
  const ref = useRef(null);
  // Where the caret goes after the next render (set when a mention is completed), so typing continues after it.
  const pendingCaret = useRef(null);
  useLayoutEffect(() => {
    if (pendingCaret.current == null || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);
  // "@a…", "@cl…" being typed: offer the assistants it could be (Oruinwan AI, Claude…).
  const aiAt = aiMentions && !editing ? assistantMentionAt(text, caret, assistants?.length ? assistants : [DEFAULT_ASSISTANT]) : null;
  // People, @channel/@here and #channels.
  const at = mentions && !editing ? mentionAt(text, caret, mentions.people) : null;
  const people = at ? mentionSuggestions(at, mentions) : [];
  const completeAi = (a) => {
    const tag = `@${a.mention} `;
    const next = `${text.slice(0, aiAt.start)}${tag}${text.slice(aiAt.end)}`;
    const pos = aiAt.start + tag.length;
    pendingCaret.current = pos;
    setText(next);
    setCaret(pos);
    tap('select');
  };
  const completeMention = (s) => {
    const next = applyMention(text, at, s);
    pendingCaret.current = next.caret;
    setText(next.text);
    setCaret(next.caret);
    tap('select');
  };
  const voice = useVoiceRecorder((file) => onVoice?.(file));

  // ── Slash commands: "/na" lists them, "/name args" shows how to use it, Send runs it.
  const [slashNote, setSlashNote] = useState(null); // { kind: 'error' | 'unknown' | 'help', … }
  const [slashActive, setSlashActive] = useState(0);
  const slashOn = Boolean(commands) && !editing;
  const slashCtx = slashOn
    ? {
        ...commands,
        insert: (value) => fill(value),
        showHelp: () => setSlashNote({ kind: 'help', lines: helpLines(slashCtxRef.current) }),
      }
    : null;
  const slashCtxRef = useRef(slashCtx);
  slashCtxRef.current = slashCtx;
  const slashMenu = slashOn && /^\/[a-z0-9_-]*$/i.test(text) ? filterCommands(text, slashCtx) : null;
  const slashHint = slashOn && !slashMenu && text.startsWith('/') ? typingHint(text, slashCtx) : null;
  useEffect(() => setSlashActive(0), [text]);
  const clearText = () => {
    setText('');
    setCaret(0);
    if (draftConv) clearDraft(draftWs, draftConv);
  };
  // True when `value` was a command (run, or help shown instead of sending it).
  const runSlash = (value) => {
    const prepared = prepareCommand(value, slashCtx);
    if (prepared.status === 'none') return false;
    if (prepared.status === 'unknown') setSlashNote({ kind: 'unknown', name: prepared.name });
    else if (prepared.status !== 'ready') setSlashNote({ kind: 'error', message: prepared.message });
    else {
      setSlashNote(null);
      clearText();
      tap('light');
      runPrepared(prepared, slashCtx).catch((err) => {
        setText((t) => t || value);
        setSlashNote({ kind: 'error', message: err?.message || `/${prepared.command.name} didn't work.` });
      });
    }
    return true;
  };
  const pickCommand = (c) => {
    tap('select');
    if (runsWithoutArgs(c)) {
      runSlash(`/${c.name}`);
      return;
    }
    fill(`/${c.name} `);
  };
  // Formatting row (shown on demand, so the composer stays one line) and the emoji sheet.
  const [formatting, setFormatting] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const sendPress = useRef(null);
  const overlayRef = useRef(null);
  const styled = hasFormatting(text);
  // The selection when focus left the box (for a link typed in its own field, or an emoji).
  const savedSel = useRef(null);
  const selection = () => {
    const el = ref.current;
    if (savedSel.current) return savedSel.current;
    return el ? [el.selectionStart ?? text.length, el.selectionEnd ?? text.length] : [text.length, text.length];
  };
  const rememberSelection = () => {
    const el = ref.current;
    savedSel.current = el ? [el.selectionStart ?? text.length, el.selectionEnd ?? text.length] : null;
  };
  const applyEdit = (next) => {
    savedSel.current = null;
    setText(next.text);
    setCaret(next.end);
    // Restore the selection once the new value is rendered.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };
  const format = (kind) => {
    const [s, e] = selection();
    applyEdit(applyFormat(text, s, e, kind));
    tap('select');
  };

  // `initial` is a prefilled draft (a notification's quick reply): applied when it changes, never
  // again after it is sent. Editing a message swaps the composer to that message's text and puts
  // back what was being typed before when the edit ends (saved or cancelled) — not the draft.
  useEffect(() => {
    if (!initial && draftConv) return; // keep the saved draft
    setText(initial);
    if (initial) setTimeout(() => ref.current?.focus(), 50);
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftConv || editing) return undefined;
    const t = setTimeout(() => saveDraft(draftWs, draftConv, text), 400);
    return () => clearTimeout(t);
  }, [text, draftWs, draftConv?.kind, draftConv?.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const beforeEdit = useRef(null);
  const latest = useRef(text);
  latest.current = text;
  // Leaving the conversation (or the app) right after typing: save what's there now, not 400 ms
  // later, so nothing typed is lost.
  const editingRef = useRef(editing);
  editingRef.current = editing;
  useEffect(() => {
    if (!draftConv) return undefined;
    const flush = () => {
      if (!editingRef.current) saveDraft(draftWs, draftConv, latest.current);
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [draftWs, draftConv?.kind, draftConv?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editing) {
      if (beforeEdit.current == null) beforeEdit.current = latest.current;
      setText(editText || '');
      setCaret((editText || '').length);
      setTimeout(() => ref.current?.focus(), 50);
    } else if (beforeEdit.current != null) {
      const restore = beforeEdit.current;
      beforeEdit.current = null;
      setText(restore);
      setCaret(restore.length);
    }
  }, [editing, editText]);

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

  const send = (asText = false) => {
    const value = text.trim();
    if (!value) return;
    if (slashOn && !asText && runSlash(value)) return;
    setSlashNote(null);
    onSend(value);
    setText('');
    setCaret(0);
    if (draftConv) clearDraft(draftWs, draftConv);
    tap('light');
  };
  // Send later: the text goes out at the picked time (long-press Send, or + → Send later).
  const openSchedule = () => {
    if (!onSchedule) return;
    if (!text.trim()) {
      toast('Type the message first, then choose Send later');
      return;
    }
    setScheduling(true);
  };
  if (scheduleRef) scheduleRef.current = openSchedule;
  // With a physical keyboard, Enter sends (or completes a mention) and Shift+Enter starts a new line.
  const onKeyDown = (e) => {
    if (slashMenu?.length) {
      const n = slashMenu.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashActive((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        fill(`/${slashMenu[Math.min(slashActive, n - 1)].name} `);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        pickCommand(slashMenu[Math.min(slashActive, n - 1)]);
        return;
      }
    }
    if (e.key === 'Escape' && slashNote) {
      setSlashNote(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && finePointer()) {
      e.preventDefault();
      if (people.length && !people[0].disabled) completeMention(people[0]);
      else send();
    }
  };
  const fill = (value) => {
    setText(value);
    setCaret(value.length);
    pendingCaret.current = value.length;
  };
  const showMic = Boolean(onVoice) && !editing && !text.trim() && canRecordVoice();

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
      <MentionSuggestions items={people} onPick={completeMention} />
      {slashMenu && <SlashList items={slashMenu} active={slashActive} onPick={pickCommand} />}
      {slashNote ? (
        <SlashBar
          notice={slashNote}
          onClose={() => setSlashNote(null)}
          onEdit={() => {
            setSlashNote(null);
            ref.current?.focus();
          }}
          onSendAsText={() => send(true)}
        />
      ) : (
        slashHint && <SlashBar notice={{ kind: 'hint', ...slashHint }} />
      )}
      {recent && !editing && !text && !voice.recording && <SmartReplies recent={recent} onPick={fill} />}
      {quote && !editing && (
        <div className="flex items-start gap-2 px-3 pt-2" data-testid="composer-quote">
          <div className="min-w-0 flex-1">
            <QuoteBlock quoted={{ id: quote.id, authorId: quote.authorId, authorName: quote.author?.name, text: quote.text, state: quote.state }} directory={directory} me={me} compact />
          </div>
          <button type="button" aria-label="Cancel reply" onClick={onCancelQuote} className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2">
            <Icon as={X} size={14} />
          </button>
        </div>
      )}
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
      {formatting && !voice.recording && (
        <FormatToolbar
          onFormat={format}
          onLinkOpen={rememberSelection}
          onLink={(url) => {
            const [s, e] = selection();
            applyEdit(insertLink(text, s, e, url));
          }}
        />
      )}
      {voice.recording ? (
        <RecordingBar seconds={voice.seconds} onCancel={voice.cancel} onSend={voice.send} />
      ) : (
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
          <button
            type="button"
            aria-label={formatting ? 'Hide formatting' : 'Show formatting'}
            aria-pressed={formatting}
            title="Formatting"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setFormatting((f) => !f)}
            className={cx('pressable grid h-10 w-8 shrink-0 place-items-center rounded-full', formatting ? 'text-accent-ink' : 'text-text-2')}
          >
            <Icon as={Type} size={18} />
          </button>
          <div className="flex min-h-10 flex-1 items-center rounded-[20px] border border-line bg-input pr-1 pl-4 focus-within:border-accent/70">
            <div className="relative min-w-0 flex-1">
              {styled && <ComposerHighlight text={text} scrollRef={overlayRef} />}
              <textarea
                ref={ref}
                rows={1}
                value={text}
                autoFocus={autoFocus}
                onChange={(e) => {
                  setText(e.target.value);
                  setCaret(e.target.selectionStart ?? e.target.value.length);
                  if (slashNote && slashNote.kind !== 'help') setSlashNote(null);
                }}
                onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? text.length)}
                onScroll={(e) => {
                  if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                enterKeyHint="enter"
                className={cx(
                  'relative block max-h-[140px] w-full resize-none bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:text-text-3',
                  // Formatted text shows through from underneath; the caret and selection stay.
                  styled && 'text-transparent caret-[rgb(var(--c-text))] selection:bg-accent/25',
                )}
              />
            </div>
            <button
              type="button"
              aria-label="Emoji"
              title="Emoji"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                rememberSelection();
                setEmoji(true);
              }}
              className="pressable mb-1 grid h-8 w-8 shrink-0 place-items-center self-end rounded-full text-text-2"
            >
              <Icon as={Smile} size={18} />
            </button>
          </div>
          {showMic ? (
            <MicButton onClick={voice.start} />
          ) : (
            <button
              type="button"
              aria-label="Send"
              title={onSchedule ? 'Send (press and hold to send later)' : 'Send'}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!onSchedule || !text.trim()) return;
                clearTimeout(sendPress.current);
                sendPress.current = setTimeout(() => {
                  sendPress.current = 'fired';
                  tap('medium');
                  openSchedule();
                }, 450);
              }}
              onPointerUp={() => {
                if (sendPress.current !== 'fired') clearTimeout(sendPress.current);
              }}
              onPointerLeave={() => sendPress.current !== 'fired' && clearTimeout(sendPress.current)}
              onContextMenu={(e) => {
                e.preventDefault();
                openSchedule();
              }}
              onClick={() => {
                if (sendPress.current === 'fired') {
                  sendPress.current = null;
                  return;
                }
                send();
              }}
              disabled={!text.trim()}
              className={cx(
                'pressable grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors',
                text.trim() ? 'bg-gold text-on-accent' : 'bg-surface-2 text-text-3',
              )}
            >
              <Icon as={SendHorizontal} size={19} />
            </button>
          )}
        </div>
      )}
      <ScheduleSheet
        open={scheduling}
        onClose={() => setScheduling(false)}
        preview={text.trim()}
        onPick={async (when) => {
          const value = text.trim();
          setScheduling(false);
          if (!value) return;
          const ok = await onSchedule(value, when);
          if (ok !== false) {
            setText('');
            setCaret(0);
            if (draftConv) clearDraft(draftWs, draftConv);
          }
        }}
      />
      <EmojiSheet
        open={emoji}
        onClose={() => {
          savedSel.current = null;
          setEmoji(false);
        }}
        onPick={(e) => {
          const [s, end] = selection();
          setEmoji(false);
          applyEdit(insertAt(text, s, end, e));
        }}
      />
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

export function ComposerPlusSheet({ open, onClose, onAskAi, onTask, onPick, onPoll, onChecklist, onSchedule, title = 'Add to message' }) {
  // A computer has no camera to point: its file picker covers photos.
  const camera = onPick && !finePointer();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-2 pb-3">
        {[
          onPick && { icon: ImageIcon, label: 'Photo or video', hint: 'Choose from your gallery', run: () => onPick('media') },
          camera && { icon: Camera, label: 'Take a photo', hint: 'Use the camera', run: () => onPick('camera') },
          onPick && { icon: Paperclip, label: 'File', hint: 'Documents, PDFs and anything else up to 100 MB', run: () => onPick('file') },
          onPoll && { icon: BarChart3, label: 'Poll', hint: 'Ask everyone to vote', run: onPoll },
          onChecklist && { icon: ListChecks, label: 'Checklist', hint: 'A list anyone here can tick off', run: onChecklist },
          onAskAi && { icon: Sparkles, label: 'Summarize with AI', hint: 'Catch up on this conversation, or list its action items', run: onAskAi },
          onTask && { icon: ListTodo, label: 'Create a task', hint: 'Track something from this conversation', run: onTask },
          onSchedule && { icon: Clock3, label: 'Send later', hint: 'Schedule what you typed (or press and hold Send)', run: onSchedule },
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
