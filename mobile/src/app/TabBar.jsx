import { House, MessagesSquare, Sparkles, SquareCheckBig, FileText } from 'lucide-react';
import { useNav } from './nav.js';
import { useFlag } from '../config/flags.js';
import { useUnreadCounts, useTasks } from '../data/hooks.js';
import { useSession } from '../data/session.js';
import { cx } from '../ui/cx.js';
import { Icon } from '../ui/Icon.jsx';
import { dueLabel } from '../lib/time.js';
import { useKeyboard } from '../native/keyboard.js';

function useDueSoonCount() {
  const { data } = useTasks();
  const me = useSession((s) => s.user?.id);
  return (data || []).filter(
    (t) => t.assigneeIds.includes(me) && !['done', 'cancelled'].includes(t.status) && ['overdue', 'today'].includes(dueLabel(t.due)?.tone),
  ).length;
}

export function TabBar() {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  const aiOn = useFlag('ai');
  const notesOn = useFlag('notes');
  const unread = useUnreadCounts();
  const due = useDueSoonCount();
  const keyboardOpen = useKeyboard((s) => s.open);

  const items = [
    { id: 'home', label: 'Home', icon: House, dot: unread.notifications > 0 },
    { id: 'chats', label: 'Chats', icon: MessagesSquare, badge: unread.channels + unread.dms },
    aiOn && { id: 'ai', label: 'AI', icon: Sparkles, hero: true },
    { id: 'tasks', label: 'Tasks', icon: SquareCheckBig, badge: due },
    notesOn && { id: 'notes', label: 'Notes', icon: FileText },
  ].filter(Boolean);

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label="Main"
      className="absolute inset-x-0 bottom-0 z-20 border-t border-line-soft bg-bg pb-safe"
    >
      <div className="mx-auto flex h-[60px] max-w-[520px] items-stretch">
        {items.map((it) => {
          const active = tab === it.id;
          if (it.hero) {
            return (
              <button
                key={it.id}
                type="button"
                aria-label="Oruinwan AI"
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(it.id)}
                className="relative flex flex-1 flex-col items-center justify-end pb-1.5"
              >
                <span
                  className={cx(
                    'pressable absolute -top-4 grid h-[52px] w-[52px] place-items-center rounded-full ring-4 ring-bg',
                    'bg-gold text-on-accent',
                    active && 'scale-105',
                  )}
                >
                  <Icon as={it.icon} size="lg" />
                </span>
                <span className={cx('text-[11px] font-medium', active ? 'text-accent-ink' : 'text-text-2')}>{it.label}</span>
              </button>
            );
          }
          return (
            <button
              key={it.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(it.id)}
              className={cx('relative flex flex-1 flex-col items-center justify-center gap-1', active ? 'text-accent-ink' : 'text-text-2')}
            >
              <span
                className={cx('absolute top-0 h-0.5 w-6 rounded-full bg-accent transition-opacity', active ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              <span className="relative">
                <Icon as={it.icon} size={22} />
                {it.badge > 0 && (
                  <span className="absolute -top-1.5 left-3.5 min-w-[18px] h-[18px] rounded-full bg-gold px-1 text-center text-[10px] font-bold leading-[18px] text-on-accent ring-2 ring-bg">
                    {it.badge > 99 ? '99+' : it.badge}
                  </span>
                )}
                {it.dot && !it.badge && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" />}
              </span>
              <span className="text-[11px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
