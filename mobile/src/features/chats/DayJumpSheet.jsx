// Jump to a date: a month calendar where only days with messages can be picked (tap the date
// chip in a conversation). Older history loads as you go back.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Sheet } from '../../ui/Overlay.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { cx } from '../../ui/cx.js';

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

/** Days that have at least one message: Map of "y-m-d" → first message id that day. */
export function messageDays(items) {
  const days = new Map();
  for (const m of items || []) {
    if (!m?.at || m.state === 'system') continue;
    const k = dayKey(m.at);
    if (!days.has(k)) days.set(k, m.id);
  }
  return days;
}

/** The weeks of a month (Monday first), each day as a Date or null for padding. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(pad).fill(null), ...Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function DayJumpSheet({ open, onClose, items, initial, onJump, hasMore, onLoadOlder, loadingOlder }) {
  const days = useMemo(() => messageDays(items), [items]);
  const start = initial ? new Date(initial) : new Date();
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  useEffect(() => {
    if (open) {
      const d = initial ? new Date(initial) : new Date();
      setCursor({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [open, initial]);
  const oldest = items?.find((m) => m.at)?.at;
  const oldestMonth = oldest ? new Date(oldest) : null;
  const atOldest = oldestMonth && (cursor.y < oldestMonth.getFullYear() || (cursor.y === oldestMonth.getFullYear() && cursor.m <= oldestMonth.getMonth()));
  const now = new Date();
  const atNewest = cursor.y > now.getFullYear() || (cursor.y === now.getFullYear() && cursor.m >= now.getMonth());
  const move = (by) => setCursor((c) => {
    const d = new Date(c.y, c.m + by, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <Sheet open={open} onClose={onClose} title="Jump to a date">
      <div className="px-4 pb-4" data-testid="day-jump">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => move(-1)} disabled={atOldest && !hasMore} className="grid h-9 w-9 place-items-center rounded-full text-text-2 disabled:opacity-30">
            <Icon as={ChevronLeft} size={18} />
          </button>
          <span className="text-[15px] font-semibold">{title}</span>
          <button type="button" aria-label="Next month" onClick={() => move(1)} disabled={atNewest} className="grid h-9 w-9 place-items-center rounded-full text-text-2 disabled:opacity-30">
            <Icon as={ChevronRight} size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-text-3">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 space-y-1">
          {monthGrid(cursor.y, cursor.m).map((week, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {week.map((d, j) => {
                if (!d) return <span key={j} />;
                const id = days.get(dayKey(d));
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={!id}
                    onClick={() => onJump(id)}
                    aria-label={d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                    className={cx('grid h-10 place-items-center rounded-xl text-[14px] tabular-nums', id ? 'bg-accent/15 font-semibold text-accent-ink active:bg-accent/25' : 'text-text-3/60')}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-text-3">Days with messages are highlighted.</p>
        {hasMore && atOldest && onLoadOlder && (
          <Button block variant="secondary" className="mt-3" loading={loadingOlder} onClick={onLoadOlder}>
            Load older messages
          </Button>
        )}
      </div>
    </Sheet>
  );
}
