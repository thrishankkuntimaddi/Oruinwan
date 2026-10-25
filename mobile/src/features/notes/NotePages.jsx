// A note's pages: a strip under the title — tap a page to open it, + to add one. Swiping the
// strip (or the page) sideways moves to the previous or next page.
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate } from '../../data/query.js';
import { nav } from '../../app/nav.js';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';

/** The page next to the current one (by = -1 previous, 1 next), or null. */
export function neighbourPage(pages, currentId, by) {
  const i = (pages || []).findIndex((p) => p.id === currentId);
  if (i < 0) return null;
  return pages[i + by] || null;
}

export function NotePages({ note, canEdit }) {
  const ws = useSession((s) => s.workspaceId);
  const [adding, setAdding] = useState(false);
  const pages = note.pages && note.pages.length ? note.pages : [{ id: note.id, title: note.title }];
  const rootId = note.parentId || pages[0]?.id || note.id;
  const go = (p) => p && p.id !== note.id && nav.replace('note', { id: p.id });

  const add = async () => {
    setAdding(true);
    try {
      const page = await api().addNotePage(ws, rootId);
      invalidate(`note:${rootId}`);
      nav.replace('note', { id: page.id, fresh: true });
    } catch (err) {
      toast(err.message || 'Could not add a page', 'danger');
    } finally {
      setAdding(false);
    }
  };

  // Swipe sideways on the strip: previous / next page.
  const start = useRef(null);
  const touch = {
    onTouchStart: (e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }),
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(neighbourPage(pages, note.id, dx < 0 ? 1 : -1));
    },
  };

  if (pages.length < 2 && !canEdit) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5" {...touch} data-testid="note-pages">
      <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {pages.map((p, i) => {
          const on = p.id === note.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => go(p)}
              aria-current={on ? 'page' : undefined}
              ref={on ? (el) => el?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }) : undefined}
              className={cx('pressable h-8 max-w-[160px] shrink-0 truncate rounded-full border px-3 text-[13px] font-medium', on ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface text-text-2')}
            >
              {i === 0 ? `1 · ${p.title || 'Untitled'}` : `${i + 1} · ${p.title || `Page ${i + 1}`}`}
            </button>
          );
        })}
      </div>
      {canEdit && (
        <button type="button" onClick={add} disabled={adding} aria-label="Add a page" className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-text-2 disabled:opacity-50" data-testid="note-add-page">
          <Icon as={Plus} size={15} />
        </button>
      )}
    </div>
  );
}
