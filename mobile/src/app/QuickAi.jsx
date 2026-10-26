// The AI button's quick window: a small panel above the tab bar with the keyboard up. Ask, the
// answer streams in right there, ask again; "Open Oruinwan AI" moves to the full screen. (Home's
// "Ask AI" tile opens the full screen directly.)
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { ArrowUp, Maximize2, SquarePen, Square, X } from 'lucide-react';
import { api, useSession } from '../data/session.js';
import { nav } from './nav.js';
import { continueInAi } from '../features/ai/aiUi.js';
import { useOverlay } from '../ui/Overlay.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Markdown } from '../ui/Markdown.jsx';
import { Spinner } from '../ui/Feedback.jsx';
import { cx } from '../ui/cx.js';
import { AiEyes } from './AiEyes.jsx';

export const useQuickAi = create((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

const SUGGESTIONS = ['What did I miss today?', 'What’s due for me?', 'Draft a status update'];

/** The last few turns, as the AI takes them. */
export function quickHistory(turns, question, keep = 6) {
  return [...turns.flatMap((t) => [{ role: 'user', content: t.q }, ...(t.a ? [{ role: 'assistant', content: t.a }] : [])]), { role: 'user', content: question }].slice(-keep);
}

export function QuickAi() {
  const open = useQuickAi((s) => s.open);
  const hide = useQuickAi((s) => s.hide);
  const ws = useSession((s) => s.workspaceId);
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState([]); // [{ q, a, error, done }]
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const abort = useRef(null);
  const scroller = useRef(null);
  useOverlay(open, hide);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 60);
    else abort.current?.abort();
  }, [open]);
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: scroller.current.scrollHeight });
  }, [turns]);

  if (!open) return null;

  const patchLast = (fn) => setTurns((list) => list.map((t, i) => (i === list.length - 1 ? fn(t) : t)));
  const ask = async (text = q) => {
    const question = String(text || '').trim();
    if (!question || busy || !api().aiAsk) return;
    const history = quickHistory(turns, question);
    setTurns((list) => [...list, { q: question, a: '' }]);
    setQ('');
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const result = await api().aiAsk(ws, history, { signal: ctrl.signal, onToken: (partial) => patchLast((t) => ({ ...t, a: partial })) });
      patchLast((t) => ({ ...t, a: result?.text || t.a || 'No answer came back.', done: true }));
    } catch (err) {
      if (ctrl.signal.aborted) patchLast((t) => ({ ...t, done: true, a: t.a || '_Stopped._' }));
      else patchLast((t) => ({ ...t, error: err.message || 'Oruinwan AI could not answer right now.', done: true }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  // Expand: the same conversation on the full screen (an answer still coming is asked again there).
  const openFull = () => {
    const last = turns[turns.length - 1];
    const unfinished = last && !last.done;
    if (unfinished) abort.current?.abort();
    const kept = unfinished ? turns.slice(0, -1) : turns;
    const prompt = q.trim() || (unfinished ? last.q : '');
    hide();
    if (!kept.length && !prompt) nav.openAi();
    else continueInAi(kept, prompt);
  };
  const newChat = () => {
    abort.current?.abort();
    setTurns([]);
    setQ('');
    setTimeout(() => input.current?.focus(), 30);
  };

  return (
    <>
      <button type="button" aria-label="Close" tabIndex={-1} className="fixed inset-0 z-[40] bg-black/10 animate-fade-in" onClick={hide} />
      <div
        role="dialog"
        aria-label="Quick Oruinwan AI"
        data-testid="quick-ai"
        className="glass-strong fixed inset-x-3 z-[41] mx-auto max-w-[560px] overflow-hidden rounded-3xl border shadow-xl animate-drop-in"
        style={{ bottom: 'calc(var(--sab) + 12px)' }}
      >
        <div className="flex items-center gap-2 px-3.5 pt-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-accent-ink">
            <AiEyes size={18} />
          </span>
          <span className="flex-1 text-[14px] font-semibold">Oruinwan AI</span>
          {turns.length > 0 && (
            <button type="button" aria-label="New chat" title="New chat" onClick={newChat} data-testid="quick-ai-new" className="grid h-8 w-8 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={SquarePen} size={15} />
            </button>
          )}
          <button type="button" aria-label="Open Oruinwan AI" onClick={openFull} className="grid h-8 w-8 place-items-center rounded-full text-text-2 active:bg-surface-2">
            <Icon as={Maximize2} size={15} />
          </button>
          <button type="button" aria-label="Close" onClick={hide} className="grid h-8 w-8 place-items-center rounded-full text-text-2 active:bg-surface-2">
            <Icon as={X} size={16} />
          </button>
        </div>
        {turns.length > 0 ? (
          <div ref={scroller} className="max-h-[38vh] space-y-3 overflow-y-auto px-4 pt-2" aria-live="polite">
            {turns.map((t, i) => (
              <div key={i}>
                <p className="text-[12px] text-text-3">“{t.q}”</p>
                {t.error ? (
                  <p className="text-[14px] text-danger">{t.error}</p>
                ) : t.a ? (
                  <div className="text-[14px] leading-relaxed"><Markdown text={t.a} /></div>
                ) : (
                  <p className="flex items-center gap-2 text-[14px] text-text-2"><Spinner /> Thinking…</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="pressable shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-text-2">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="send"
            placeholder={turns.length ? 'Ask a follow-up' : 'Ask Oruinwan AI anything'}
            aria-label="Ask Oruinwan AI"
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-input px-4 text-[15px] outline-none focus:border-accent/70"
          />
          {busy ? (
            <button type="button" aria-label="Stop" onClick={() => abort.current?.abort()} className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-text">
              <Icon as={Square} size={14} />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Ask"
              disabled={!q.trim()}
              className={cx('grid h-10 w-10 place-items-center rounded-full', q.trim() ? 'bg-gold text-on-accent' : 'bg-surface-2 text-text-3')}
            >
              <Icon as={ArrowUp} size={18} />
            </button>
          )}
        </form>
      </div>
    </>
  );
}
