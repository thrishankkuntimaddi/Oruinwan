// A small "Ask AI" pill at the top of a conversation, like a dynamic island: tap it, ask about
// this conversation, and the answer appears right there. Swipe it up (or tap ×) to close.
// The question goes with the messages decrypted on this device (nothing else is uploaded).
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';

const SUGGESTIONS = ['What did I miss?', 'Any decisions?', 'What is open for me?'];
// The pill shows in full this long when a conversation opens, then shrinks to a small button.
export const ISLAND_FULL_MS = 4000;

export function AiIsland({ transcript, title }) {
  const ws = useSession((s) => s.workspaceId);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState(null); // { q, text } | { q, error }
  const [busy, setBusy] = useState(false);
  const [dy, setDy] = useState(0);
  const drag = useRef(null);
  const input = useRef(null);
  // Full "Ask AI about this chat" pill at first, then a small sparkle in the corner (it covered
  // the newest messages when it stayed).
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCompact(true), ISLAND_FULL_MS);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    setAnswer(null);
    setQ('');
    setDy(0);
  };
  const ask = async (question) => {
    const text = String(question || q).trim();
    if (!text || busy) return;
    setBusy(true);
    setAnswer(null);
    try {
      const messages = transcript();
      if (!messages.length) throw new Error('There are no messages here to ask about yet.');
      const reply = await api().askAboutConversation(ws, messages, text, { title });
      setAnswer({ q: text, text: reply || 'No answer came back.' });
      setQ('');
    } catch (err) {
      setAnswer({ q: text, error: err.message || 'Oruinwan AI could not answer.' });
    } finally {
      setBusy(false);
    }
  };

  if (!api().askAboutConversation) return null;

  if (!open && compact) {
    return (
      <div className="pointer-events-none absolute right-3 top-2 z-[5]">
        <button
          type="button"
          aria-label="Ask AI about this chat"
          onClick={() => {
            setOpen(true);
            setTimeout(() => input.current?.focus(), 60);
          }}
          className="glass pointer-events-auto pressable grid h-9 w-9 place-items-center rounded-full border text-accent-ink shadow-md animate-fade-in"
          data-testid="ai-island"
        >
          <Icon as={Sparkles} size={16} />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-2 z-[5] flex justify-center">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => input.current?.focus(), 60);
          }}
          className="glass pointer-events-auto pressable flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-medium text-accent-ink shadow-md"
          data-testid="ai-island"
        >
          <Icon as={Sparkles} size={13} /> Ask AI about this chat
        </button>
      </div>
    );
  }

  // Swipe up on the island to close it.
  const touch = {
    onPointerDown: (e) => {
      if (e.target.closest('input,button,a')) return;
      drag.current = e.clientY;
    },
    onPointerMove: (e) => drag.current != null && setDy(Math.min(0, e.clientY - drag.current)),
    onPointerUp: () => {
      if (dy < -40) close();
      else setDy(0);
      drag.current = null;
    },
  };

  return (
    <div className="absolute inset-x-3 top-2 z-[6]" style={{ transform: dy ? `translateY(${dy}px)` : undefined, opacity: dy ? Math.max(0.3, 1 + dy / 120) : 1 }}>
      <div {...touch} className="glass-strong animate-drop-in overflow-hidden rounded-3xl border shadow-xl" data-testid="ai-island-open">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent-ink">
            <Icon as={Sparkles} size={13} />
          </span>
          <span className="flex-1 text-[13px] font-semibold">Ask about {title}</span>
          <button type="button" aria-label="Close" onClick={close} className="grid h-7 w-7 place-items-center rounded-full text-text-2">
            <Icon as={X} size={15} />
          </button>
        </div>
        {(answer || busy) && (
          <div className="max-h-[40vh] overflow-y-auto px-4 pt-2 text-[14px] leading-relaxed" aria-live="polite">
            {answer?.q && <p className="mb-1 text-[12px] text-text-3">“{answer.q}”</p>}
            {busy ? (
              <p className="flex items-center gap-2 py-1 text-text-2">
                <Spinner /> Reading the conversation…
              </p>
            ) : answer?.error ? (
              <p className="text-danger">{answer.error}</p>
            ) : (
              <Markdown text={answer.text} />
            )}
          </div>
        )}
        {!answer && !busy && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="pressable shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-text-2">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={answer ? 'Ask a follow-up' : 'Ask anything about this conversation'}
            aria-label="Ask Oruinwan AI about this conversation"
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-input px-3.5 text-[14px] outline-none focus:border-accent/70"
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={!q.trim() || busy}
            className={cx('grid h-9 w-9 place-items-center rounded-full', q.trim() && !busy ? 'bg-gold text-on-accent' : 'bg-surface-2 text-text-3')}
          >
            <Icon as={ArrowUp} size={17} />
          </button>
        </form>
        <div className="flex justify-center pb-1.5" aria-hidden>
          <span className="h-1 w-8 rounded-full bg-text-3/40" />
        </div>
      </div>
    </div>
  );
}
