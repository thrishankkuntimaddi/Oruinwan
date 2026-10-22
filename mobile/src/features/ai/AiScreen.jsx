// Oruinwan AI: a chat with the workspace assistant. Answers stream in; sources and
// actions it took (e.g. "Created task") are shown under each answer.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Sparkles, History, SquarePen, ArrowUp, Square, Copy, RotateCcw, Check, X, SquareCheckBig, Hash, FileText, MessageCircle, ListTodo, Megaphone, Sun,
  BookOpen, CalendarDays, Compass, LifeBuoy, MoreHorizontal, Pencil, Trash2,
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
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { SkeletonRows, Spinner } from '../../ui/Feedback.jsx';
import { Field } from '../../ui/Controls.jsx';
import { cx } from '../../ui/cx.js';
import { uid } from '../../lib/id.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { BrandMark } from '../../app/BrandMark.jsx';
import { finePointer } from '../../app/layout.js';
import { useAiUi } from './aiUi.js';
import { useAssistants } from '../../data/hooks.js';
import { Chips, Segmented } from '../../ui/Controls.jsx';
import { openConversation } from '../chats/chatsUi.js';
import { AiQuotaLine } from '../plan/AiQuotaLine.jsx';
import { refreshAiQuota } from '../plan/plan.js';
import { deleteConversation, listConversations, openConversation as openSaved, renameConversation, saveConversation } from './aiHistory.js';

const SUGGESTIONS = [
  { icon: Sun, text: "What's on my plate this week?" },
  { icon: Megaphone, text: 'Catch me up on unread channels' },
  { icon: MessageCircle, text: 'Draft a message announcing the release' },
  { icon: ListTodo, text: 'Create a task to review the onboarding copy' },
];

// Questions for "Company knowledge": answered from knowledge pages and meeting notes.
const KNOWLEDGE_SUGGESTIONS = [
  { icon: Compass, text: 'How do we onboard a new teammate?' },
  { icon: LifeBuoy, text: 'What is our process for a production incident?' },
  { icon: CalendarDays, text: 'What was decided in the last planning meeting?' },
  { icon: BookOpen, text: 'Where is the release checklist?' },
];

const SOURCE_ICON = { task: SquareCheckBig, channel: Hash, note: FileText, dm: MessageCircle, page: BookOpen, meeting: CalendarDays };

function openSource(s) {
  if (s.kind === 'task') nav.push('task', { id: s.id });
  else if (s.kind === 'note') nav.push('note', { id: s.id });
  else if (s.kind === 'channel' || s.kind === 'dm') openConversation(s.kind, s.id);
  else if (s.kind === 'page') nav.push('page', { id: s.id }, { tab: 'notes' });
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
  const keyboardOpen = useKeyboard((s) => s.open);
  const [thread, setThread] = useState(() => ({ id: uid('ai'), messages: [] }));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const pending = useAiUi((s) => s.pending);
  // 'chat': the assistant. 'knowledge': questions answered from the company's pages and meeting notes.
  const [mode, setMode] = useState('chat');
  const knowledge = mode === 'knowledge';

  // Who answers: Oruinwan AI, or a model the workspace connected. Remembered per workspace.
  const { data: assistants } = useAssistants();
  const [assistant, setAssistant] = useState(() => prefs.get(`ai.assistant.${ws}`) || 'default');
  useEffect(() => {
    setAssistant(prefs.get(`ai.assistant.${ws}`) || 'default');
  }, [ws]);
  const list = assistants?.length ? assistants : [{ id: 'default', name: 'Oruinwan AI' }];
  const current = list.find((a) => a.id === assistant) || list[0];
  const choose = (id) => {
    setAssistant(id);
    prefs.set(`ai.assistant.${ws}`, id);
    tap('select');
  };

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
      if (knowledge && api().askKnowledge) {
        const r = await api().askKnowledge(ws, question);
        if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const text = r.answer || "I couldn't find that in your company's knowledge pages.";
        const note = r.fallback ? '\n\n_Answered without an AI model. A workspace admin can connect one under Settings → Oruinwan AI on the web._' : '';
        patchLast((m) => ({ ...m, text: `${text}${note}`, sources: r.references, done: true }));
        return;
      }
      const history = next.messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text))
        .map((m) => ({ role: m.role, content: m.role === 'user' ? m.content : m.text }));
      const result = await api().aiAsk(ws, history, {
        assistant: current.id,
        signal: ctrl.signal,
        onToken: (partial) => patchLast((m) => ({ ...m, text: partial })),
        onTool: (label) => patchLast((m) => ({ ...m, tool: label })),
      });
      patchLast((m) => ({ ...m, text: result.text || m.text, sources: result.sources, actions: result.actions, done: true }));
    } catch (err) {
      if (ctrl.signal.aborted) patchLast((m) => ({ ...m, done: true, text: m.text || '_Stopped._' }));
      else patchLast((m) => ({ ...m, error: err.message || `${current.name} could not answer right now.`, done: true }));
    } finally {
      setBusy(false);
      abortRef.current = null;
      // The free plan's daily AI count ("12 of 50 AI requests left today").
      refreshAiQuota(ws);
    }
  };

  // Save the conversation (this device and the server) once an answer finishes.
  useEffect(() => {
    if (!busy) saveConversation(ws, { ...thread, assistant: current.id });
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Past conversations, loaded when the list opens.
  const [history, setHistory] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  useEffect(() => {
    if (!historyOpen) return undefined;
    let alive = true;
    setHistory(null);
    listConversations(ws).then((list) => alive && setHistory(list)).catch(() => alive && setHistory([]));
    return () => { alive = false; };
  }, [historyOpen, ws]);

  const openPast = async (item) => {
    setHistoryOpen(false);
    abortRef.current?.abort();
    const saved = await openSaved(ws, item.id);
    if (saved) setThread(saved);
    else toast("That conversation couldn't be opened.");
  };

  const saveTitle = async () => {
    const { id, title } = renaming;
    setRenaming(null);
    await renameConversation(ws, id, title);
    setHistory((list) => (list || []).map((c) => (c.id === id ? { ...c, title } : c)));
    if (thread.id === id) setThread((t) => ({ ...t, title }));
  };

  const removePast = async () => {
    const item = deleting;
    setDeleting(null);
    try {
      await deleteConversation(ws, item.id);
      setHistory((list) => (list || []).filter((c) => c.id !== item.id));
      if (thread.id === item.id) setThread({ id: uid('ai'), messages: [] });
    } catch {
      toast("Couldn't delete it. Check your connection and try again.");
    }
  };

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

  return (
    <div className="flex h-full flex-col bg-bg">
      <TabHeader
        title={knowledge ? 'Company knowledge' : current.name}
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
      {api().askKnowledge && (
        <div className="shrink-0 px-4 pb-2">
          <Segmented
            size="sm"
            value={mode}
            onChange={(v) => {
              if (v === mode) return;
              abortRef.current?.abort();
              setMode(v);
              setThread({ id: uid('ai'), messages: [] });
            }}
            options={[
              { value: 'chat', label: 'Assistant' },
              { value: 'knowledge', label: 'Company knowledge' },
            ]}
          />
        </div>
      )}
      {list.length > 1 && !knowledge && (
        <div className="shrink-0 pb-2" data-testid="assistant-picker">
          <Chips options={list.map((a) => ({ value: a.id, label: a.name }))} value={current.id} onChange={choose} />
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {empty ? (
          <div className="flex min-h-full flex-col justify-end px-4 pb-4">
            <div className="flex flex-col items-center pt-6 pb-8 text-center">
              <BrandMark size={64} glow />
              <h2 className="mt-5 text-[22px] font-bold tracking-tight">{knowledge ? 'Ask your company' : 'How can I help?'}</h2>
              <p className="mt-1.5 max-w-xs text-sm text-text-2">
                {knowledge
                  ? "Answers come from your workspace's knowledge pages and meeting notes, with links to the sources."
                  : 'Ask about your channels, tasks and notes. I can summarise, draft and create tasks for you.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(knowledge ? KNOWLEDGE_SUGGESTIONS : SUGGESTIONS).map((s) => (
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
            onKeyDown={(e) => {
              // With a physical keyboard, Enter sends and Shift+Enter starts a new line.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && finePointer()) {
                e.preventDefault();
                if (!busy && input.trim()) ask(input);
              }
            }}
            placeholder={knowledge ? 'Ask about your company…' : 'Message Oruinwan AI…'}
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
        <AiQuotaLine ws={ws} className="pt-1.5" />
        <p className="pt-1 text-center text-[11px] text-text-3">AI can make mistakes. Check important answers.</p>
      </div>
      <div aria-hidden style={{ height: keyboardOpen ? 0 : 'calc(72px + var(--sab))' }} className="shrink-0" />
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Past conversations">
        <div className="px-2 pb-3">
          {history === null ? (
            <SkeletonRows count={4} avatar={false} />
          ) : history.length ? (
            history.map((t) => (
              <div key={t.id} className={cx('flex items-center rounded-xl', t.id === thread.id && 'bg-surface-2')}>
                <button
                  type="button"
                  onClick={() => openPast(t)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-2"
                >
                  <Icon as={Sparkles} size="sm" className="shrink-0 text-accent-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{t.title || 'Conversation'}</span>
                    {t.preview && <span className="block truncate text-xs text-text-2">{t.preview}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-text-3">{shortAgo(t.updatedAt)}</span>
                </button>
                <IconButton icon={MoreHorizontal} label={`Options for ${t.title || 'conversation'}`} onClick={() => setMenuFor(t)} />
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-text-2">No conversations yet. They're saved here and on your other devices.</p>
          )}
        </div>
      </Sheet>
      <ActionSheet
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.title || 'Conversation'}
        actions={[
          { label: 'Rename', icon: Pencil, onSelect: () => setRenaming({ id: menuFor.id, title: menuFor.title || '' }) },
          { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setDeleting(menuFor) },
        ]}
      />
      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename conversation"
        confirmLabel="Save"
        onConfirm={saveTitle}
      >
        {renaming && (
          <Field
            label="Name"
            value={renaming.title}
            autoFocus
            maxLength={120}
            onChange={(e) => setRenaming((r) => ({ ...r, title: e.target.value }))}
          />
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this conversation?"
        body="It's removed from this device and your other devices."
        confirmLabel="Delete"
        danger
        onConfirm={removePast}
      />
    </div>
  );
}
