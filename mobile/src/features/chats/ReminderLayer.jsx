// "Remind me" reminders firing while the app is open: a banner at the top with the message
// (decrypted here), Open and Dismiss. The server sends 'reminder-fired' (and 'reminder:due'
// from the older scheduler); either one shows the banner once.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, X } from 'lucide-react';
import { api } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { on } from '../../lib/bus.js';
import { tap } from '../../native/index.js';
import { Icon } from '../../ui/Icon.jsx';
import { plainPreview } from '../../ui/Markdown.jsx';
import { openStoredMessage, useConversationName } from './chatsUi.js';

const seen = new Set();
const SHOW_MS = 15_000;

export function ReminderLayer() {
  const [items, setItems] = useState([]);
  const nameOf = useConversationName();

  useEffect(
    () =>
      on('socket', async ({ event, payload } = {}) => {
        if (event !== 'reminder-fired' && event !== 'reminder:due') return;
        const id = String(payload?.reminderId || '');
        if (!id || seen.has(id) || !api().readReminder) return;
        seen.add(id);
        invalidate('reminders');
        const r = await api().readReminder(payload).catch(() => ({ id, note: payload?.note || '' }));
        tap('heavy');
        setItems((list) => [...list.filter((x) => x.id !== id), r].slice(-3));
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), SHOW_MS);
      }),
    [],
  );

  if (!items.length) return null;
  const dismiss = (id) => setItems((list) => list.filter((x) => x.id !== id));
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-3 pt-safe" aria-live="assertive">
      {items.map((r) => {
        const m = r.message;
        const text = m?.state === 'ok' ? plainPreview(m.text, 120) : m ? 'Open the conversation to read it.' : '';
        return (
          <div
            key={r.id}
            role="alert"
            className="glass-strong pointer-events-auto mt-2 flex w-full max-w-md animate-pop-in items-start gap-3 rounded-2xl border px-3.5 py-3"
            style={{ boxShadow: 'var(--glass-edge), var(--shadow-pop)' }}
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-ink">
              <Icon as={BellRing} size={16} />
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                dismiss(r.id);
                openStoredMessage(r.conv, m);
              }}
            >
              <span className="block text-[14px] font-semibold">Reminder{r.conv ? ` · ${nameOf(r.conv)}` : ''}</span>
              {r.note && <span className="block text-[13px] text-text-2">{r.note}</span>}
              {text && <span className="mt-0.5 block text-[14px] leading-snug text-text">{text}</span>}
              {r.conv && <span className="mt-1 block text-[12px] font-medium text-accent-ink">Open message</span>}
            </button>
            <button type="button" aria-label="Dismiss reminder" onClick={() => dismiss(r.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-2">
              <Icon as={X} size={16} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
