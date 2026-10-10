// Oruinwan AI: a chat with the workspace assistant. Answers stream in; sources and
// actions it took (e.g. "Created task") are shown under each answer.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Sparkles, History, SquarePen, ArrowUp, Square, Copy, RotateCcw, Check, X, SquareCheckBig, Hash, FileText, MessageCircle, ListTodo, Megaphone, Sun,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { prefs } from '../../native/storage.js';
import { useKeyboard } from '../../native/keyboard.js';
import { tap } from '../../native/index.js';
import { IconButton } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { uid } from '../../lib/id.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { BrandMark } from '../../app/BrandMark.jsx';
import { useAiUi } from './aiUi.js';
import { openConversation } from '../chats/chatsUi.js';

const SUGGESTIONS = [
  { icon: Sun, text: "What's on my plate this week?" },
  { icon: Megaphone, text: 'Catch me up on unread channels' },
  { icon: MessageCircle, text: 'Draft a message announcing the release' },
  { icon: ListTodo, text: 'Create a task to review the onboarding copy' },
];

const SOURCE_ICON = { task: SquareCheckBig, channel: Hash, note: FileText, dm: MessageCircle };

function historyKey(ws) {
  return `ai.threads.${ws}`;
}

function loadThreads(ws) {
  return prefs.get(historyKey(ws), []);
}

function saveThread(ws, thread) {
  if (!thread.messages.length) return;
  const all = loadThreads(ws).filter((t) => t.id !== thread.id);
  // Keep the 30 most recent conversations on this device.
  prefs.set(historyKey(ws), [{ ...thread, updatedAt: Date.now() }, ...all].slice(0, 30));
}

function openSource(s) {
  if (s.kind === 'task') nav.push('task', { id: s.id });
  else if (s.kind === 'note') nav.push('note', { id: s.id });
  else if (s.kind === 'channel' || s.kind === 'dm') openConversation(s.kind, s.id);
}

function AssistantMessage({ m, onRetry }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-on-accent">
        <Icon as={Sparkles} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        {m.error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm">
            <p className="text-danger">{m.error}</p>
            <button type="button" onClick={onRetry} className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-text">
              <Icon as={RotateCcw} size={14} /> Try again
            </button>
          </div>
        ) : m.text ? (
          <Markdown text={m.text} className="text-text" />
        ) : (
          <span className="flex items-center gap-2 pt-1 text-sm text-text-2">
            <Spinner /> {m.tool ? m.tool : 'Thinking'}
          </span>
        )}
        {m.actions?.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {m.actions.map((a, i) => (
              <span key={i} className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs', a.ok ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger')}>
                <Icon as={a.ok ? Check : X} size={12} /> {a.label}
              </span>
            ))}
          </div>
        )}
        {m.sources?.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {m.sources.map((s) => (
              <button
                key={`${s.kind}-${s.id}`}
                type="button"
                onClick={() => openSource(s)}
                className="pressable inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-text-2"
              >
                <Icon as={SOURCE_ICON[s.kind] || FileText} size={12} className="shrink-0 text-accent-ink" />
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        )}
        {m.done && m.text && (
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              aria-label="Copy answer"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(m.text);
                  toast('Copied');
                } catch {
                  toast("Couldn't copy on this device", 'danger');
                }
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-text-3 active:bg-surface-2"
            >
              <Icon as={Copy} size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AiScreen() {
  const ws = useSession((s) => s.workspaceId);
  const mode = useSession((s) => s.mode);
  const keyboardOpen = useKeyboard((s) => s.open);
  const [thread, setThread] = useState(() => ({ id: uid('ai'), messages: [] }));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const pending = useAiUi((s) => s.pending);

  // New workspace → new conversation.
  useEffect(() => {
    abortRef.current?.abort();
    setThread({ id: uid('ai'), messages: [] });
  }, [ws]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const patchLast = (fn) =>
    setThread((t) => {
      const messages = [...t.messages];
      messages[messages.length - 1] = fn(messages[messages.length - 1]);
      return { ...t, messages };
    });

  const ask = async (text, base = thread) => {
    const question = text.trim();
    if (!question || busy) return;
    tap('light');
    const userMsg = { id: uid('u'), role: 'user', content: question, at: Date.now() };
    const answer = { id: uid('a'), role: 'assistant', text: '', at: Date.now() };
    const next = { ...base, title: base.title || question.slice(0, 60), messages: [...base.messages, userMsg, answer] };
    setThread(next);
    setInput('');
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const history = next.messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text))
        .map((m) => ({ role: m.role, content: m.role === 'user' ? m.content : m.text }));
      const result = await api().aiAsk(ws, history, {
        signal: ctrl.signal,
        onToken: (partial) => patchLast((m) => ({ ...m, text: partial })),
        onTool: (label) => patchLast((m) => ({ ...m, tool: label })),
      });
      patchLast((m) => ({ ...m, text: result.text || m.text, sources: result.sources, actions: result.actions, done: true }));
    } catch (err) {
      if (ctrl.signal.aborted) patchLast((m) => ({ ...m, done: true, text: m.text || '_Stopped._' }));
      else patchLast((m) => ({ ...m, error: err.message || 'Oruinwan AI could not answer right now.', done: true }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // Save the conversation to this device once an answer finishes.
  useEffect(() => {
    if (!busy) saveThread(ws, thread);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // A prompt handed over from another screen ("Break it down with AI").
  useEffect(() => {
    if (!pending) return;
    const p = useAiUi.getState().take();
    if (p?.prompt) ask(p.prompt, { id: uid('ai'), messages: [] });
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    const lastUser = [...thread.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const idx = thread.messages.lastIndexOf(lastUser);
    ask(lastUser.content, { ...thread, messages: thread.messages.slice(0, idx) });
  };

  const empty = thread.messages.length === 0;
  const threads = historyOpen ? loadThreads(ws) : [];

  return (
    <div className="flex h-full flex-col bg-bg">
      <TabHeader
        title="Oruinwan AI"
        actions={
          <>
            <IconButton icon={History} label="Past conversations" onClick={() => setHistoryOpen(true)} />
            <IconButton
              icon={SquarePen}
              label="New conversation"
              onClick={() => {
                abortRef.current?.abort();
                setThread({ id: uid('ai'), messages: [] });
              }}
            />
          </>
        }
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {empty ? (
          <div className="flex min-h-full flex-col justify-end px-4 pb-4">
            <div className="flex flex-col items-center pt-6 pb-8 text-center">
              <BrandMark size={64} glow />
              <h2 className="mt-5 text-[22px] font-bold tracking-tight">How can I help?</h2>
              <p className="mt-1.5 max-w-xs text-sm text-text-2">
                Ask about your channels, tasks and notes. I can summarise, draft and create tasks for you.
              </p>
              {mode === 'demo' && <p className="mt-2 text-xs text-accent-ink">Demo: answers are simulated from the sample workspace.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => ask(s.text)}
                  className="pressable flex min-h-24 flex-col justify-between rounded-card border border-line-soft bg-surface p-3.5 text-left"
                  style={{ backgroundImage: 'var(--glass)' }}
                >
                  <Icon as={s.icon} size="sm" className="text-accent-ink" />
                  <span className="mt-3 text-[13px] leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-3">
            {thread.messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end px-4 py-2">
                  <p className="selectable max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-surface-3 px-3.5 py-2.5 text-[15px]">{m.content}</p>
                </div>
              ) : (
                <AssistantMessage key={m.id} m={m} onRetry={retry} />
              ),
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 px-3 pt-2 pb-2">
        <div className="flex items-end gap-2 rounded-[22px] border border-line bg-input py-1.5 pr-1.5 pl-4 focus-within:border-accent/70">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Oruinwan AI…"
            className="block max-h-[132px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-text-3"
          />
          {busy ? (
            <button
              type="button"
              aria-label="Stop"
              onClick={() => abortRef.current?.abort()}
              className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full bg-text text-bg"
            >
              <Icon as={Square} size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              disabled={!input.trim()}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => ask(input)}
              className={cx('pressable grid h-9 w-9 shrink-0 place-items-center rounded-full', input.trim() ? 'bg-gold text-on-accent' : 'bg-surface-3 text-text-3')}
            >
              <Icon as={ArrowUp} size={18} />
            </button>
          )}
        </div>
        <p className="pt-1.5 text-center text-[11px] text-text-3">AI can make mistakes. Check important answers.</p>
      </div>
      <div aria-hidden style={{ height: keyboardOpen ? 0 : 'calc(72px + var(--sab))' }} className="shrink-0" />
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Past conversations">
        <div className="px-2 pb-3">
          {threads.length ? (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setThread(t);
                  setHistoryOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2"
              >
                <Icon as={Sparkles} size="sm" className="shrink-0 text-accent-ink" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{t.title || 'Conversation'}</span>
                <span className="shrink-0 text-xs text-text-3">{shortAgo(t.updatedAt)}</span>
              </button>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-text-2">Your conversations are kept on this device.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}
