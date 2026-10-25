// The phone tab bar: five places (Home · Chats · Tasks · Notes · Activity unless the person
// changed them). The line above it is a handle: drag it up (or tap it) for the drawer with
// everything else — Files, Knowledge, Huddles, Automations, Integrations, Agents, Saved,
// Settings — and Edit, which picks the five places on the bar (app/tabBarPrefs.js).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Bookmark, Bot, Check, Pencil, Plug, Settings, Workflow } from 'lucide-react';
import { nav, useNav } from './nav.js';
import { useFlag } from '../config/flags.js';
import { useUnreadCounts, useTasks } from '../data/hooks.js';
import { useSession } from '../data/session.js';
import { cx } from '../ui/cx.js';
import { Icon } from '../ui/Icon.jsx';
import { Sheet, useOverlay } from '../ui/Overlay.jsx';
import { Button } from '../ui/Button.jsx';
import { dueLabel } from '../lib/time.js';
import { useKeyboard } from '../native/keyboard.js';
import { tap } from '../native/index.js';
import { BAR_CHOICES, MAX_BAR, MIN_BAR, TAB_META, setBarItems, useTabBar } from './tabBarPrefs.js';

export function useDueSoonCount() {
  const { data } = useTasks();
  const me = useSession((s) => s.user?.id);
  return (data || []).filter(
    (t) => t.assigneeIds.includes(me) && !['done', 'cancelled'].includes(t.status) && ['overdue', 'today'].includes(dueLabel(t.due)?.tone),
  ).length;
}

/** Drawer places that aren't tabs: opened as screens in the current tab. */
const MORE = [
  { id: 'automations', label: 'Automations', icon: Workflow, open: () => nav.push('automations') },
  { id: 'integrations', label: 'Integrations', icon: Plug, open: () => nav.push('integrations') },
  { id: 'agents', label: 'Agents', icon: Bot, open: () => nav.push('agents') },
  { id: 'saved', label: 'Saved', icon: Bookmark, open: () => nav.push('saved') },
  { id: 'settings', label: 'Settings', icon: Settings, open: () => nav.push('settings') },
];

const DRAWER_H = 236;

function EditBarSheet({ open, onClose }) {
  const items = useTabBar((s) => s.items);
  const notesOn = useFlag('notes');
  const [draft, setDraft] = useState(items);
  useEffect(() => {
    if (open) setDraft(items);
  }, [open, items]);
  const choices = BAR_CHOICES.filter((t) => t !== 'notes' || notesOn);
  const toggle = (t) => {
    if (t === 'home') return;
    setDraft((d) => (d.includes(t) ? (d.length > MIN_BAR ? d.filter((x) => x !== t) : d) : d.length < MAX_BAR ? [...d, t] : d));
  };
  const move = (t, by) =>
    setDraft((d) => {
      const i = d.indexOf(t);
      const j = i + by;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit tab bar"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDraft(['home', 'chats', 'tasks', 'notes', 'activity'])}>
            Reset
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setBarItems(draft);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <p className="px-5 pb-2 text-[13px] text-text-2">
        Pick {MIN_BAR} to {MAX_BAR} places for the bar and put them in order. Home always stays. Everything else is in the drawer above the bar.
      </p>
      <ul className="px-3 pb-3">
        {draft.map((t, i) => (
          <li key={t} className="flex items-center gap-3 rounded-xl px-2 py-2">
            <button type="button" onClick={() => toggle(t)} disabled={t === 'home'} aria-label={`Remove ${TAB_META[t].label}`} className="grid h-6 w-6 place-items-center rounded-md bg-gold text-on-accent disabled:opacity-60">
              <Icon as={Check} size={14} />
            </button>
            <Icon as={TAB_META[t].icon} size={20} className="text-text-2" />
            <span className="flex-1 text-[15px]">{TAB_META[t].label}</span>
            <button type="button" aria-label={`Move ${TAB_META[t].label} up`} disabled={i === 0} onClick={() => move(t, -1)} className="grid h-8 w-8 place-items-center rounded-lg text-text-2 disabled:opacity-30">
              <Icon as={ArrowUp} size={16} />
            </button>
            <button type="button" aria-label={`Move ${TAB_META[t].label} down`} disabled={i === draft.length - 1} onClick={() => move(t, 1)} className="grid h-8 w-8 place-items-center rounded-lg text-text-2 disabled:opacity-30">
              <Icon as={ArrowDown} size={16} />
            </button>
          </li>
        ))}
        {choices
          .filter((t) => !draft.includes(t))
          .map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <button
                type="button"
                onClick={() => toggle(t)}
                disabled={draft.length >= MAX_BAR}
                aria-label={`Add ${TAB_META[t].label}`}
                className="h-6 w-6 rounded-md border border-line-strong disabled:opacity-40"
              />
              <Icon as={TAB_META[t].icon} size={20} className="text-text-3" />
              <span className="flex-1 text-[15px] text-text-2">{TAB_META[t].label}</span>
            </li>
          ))}
      </ul>
    </Sheet>
  );
}

export function TabBar() {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  const notesOn = useFlag('notes');
  const unread = useUnreadCounts();
  const due = useDueSoonCount();
  const keyboardOpen = useKeyboard((s) => s.open);
  const bar = useTabBar((s) => s.items);
  const [open, setOpen] = useState(false);
  const [pull, setPull] = useState(0); // drawer height while dragging
  const [editing, setEditing] = useState(false);
  const drag = useRef(null);
  useOverlay(open, () => setOpen(false));

  const badges = { chats: unread.channels + unread.dms, tasks: due, activity: unread.notifications };
  const items = bar.filter((t) => t !== 'notes' || notesOn).map((id) => ({ id, ...TAB_META[id], badge: badges[id] || 0 }));
  const drawerTabs = BAR_CHOICES.filter((t) => !bar.includes(t) && (t !== 'notes' || notesOn));

  if (keyboardOpen) return null;

  const height = drag.current ? pull : open ? DRAWER_H : 0;
  const onHandleDown = (e) => {
    drag.current = { y: e.clientY, base: open ? DRAWER_H : 0, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPull(open ? DRAWER_H : 0);
  };
  const onHandleMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    setPull(Math.max(0, Math.min(DRAWER_H + 24, d.base + dy)));
  };
  const onHandleUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const next = d.moved ? pull > DRAWER_H / 3 : !open;
    if (next !== open) tap('select');
    setOpen(next);
  };
  const go = (fn) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      {(open || height > 0) &&
        createPortal(
          <button type="button" aria-label="Close" tabIndex={-1} className="scrim fixed inset-0 z-[19] animate-fade-in" onClick={() => setOpen(false)} />,
          document.body,
        )}
      <nav aria-label="Main" className="glass-bar absolute inset-x-0 bottom-0 z-20 border-t border-[var(--glass-border)] pb-safe">
        <div
          role="button"
          tabIndex={0}
          aria-label={open ? 'Close more places' : 'More places: drag up or tap'}
          aria-expanded={open}
          data-testid="tabbar-handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((v) => !v))}
          className="absolute inset-x-0 -top-3 z-10 flex h-6 touch-none cursor-grab items-center justify-center"
        >
          <span className={cx('h-1 w-10 rounded-full bg-line-strong transition-colors', open && 'bg-accent')} />
        </div>
        <div
          className="overflow-hidden"
          style={{ height, transition: drag.current ? 'none' : 'height 240ms var(--ease-out-soft)' }}
          aria-hidden={!open}
          data-testid="tabbar-drawer"
        >
          <div className="mx-auto grid max-w-[520px] grid-cols-4 gap-1 px-3 pt-4">
            {drawerTabs.map((t) => (
              <button key={t} type="button" onClick={() => go(() => setTab(t))} className="pressable flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-text-2" tabIndex={open ? 0 : -1}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-line-soft bg-surface">
                  <Icon as={TAB_META[t].icon} size={20} />
                </span>
                <span className="text-[11px] font-medium">{TAB_META[t].label}</span>
              </button>
            ))}
            {MORE.map((m) => (
              <button key={m.id} type="button" onClick={() => go(m.open)} className="pressable flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-text-2" tabIndex={open ? 0 : -1}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-line-soft bg-surface">
                  <Icon as={m.icon} size={20} />
                </span>
                <span className="text-[11px] font-medium">{m.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => go(() => setEditing(true))} className="pressable flex flex-col items-center gap-1.5 rounded-xl py-2.5 text-accent-ink" tabIndex={open ? 0 : -1} data-testid="tabbar-edit">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-dashed border-accent/60">
                <Icon as={Pencil} size={18} />
              </span>
              <span className="text-[11px] font-medium">Edit bar</span>
            </button>
          </div>
        </div>
        <div className="mx-auto flex h-[60px] max-w-[520px] items-stretch">
          {items.map((it) => {
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                type="button"
                aria-label={`${it.label}${it.badge ? `, ${it.badge} new` : ''}`}
                aria-current={active ? 'page' : undefined}
                data-tour={it.id}
                onClick={() => {
                  setOpen(false);
                  setTab(it.id);
                }}
                className={cx('relative flex flex-1 flex-col items-center justify-center gap-1', active ? 'text-accent-ink' : 'text-text-2')}
              >
                <span
                  className={cx('absolute top-0 h-0.5 w-6 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--c-accent)/0.7)] transition-opacity duration-200', active ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span className="relative">
                  <Icon as={it.icon} size={22} />
                  {it.badge > 0 && (
                    <span className="absolute -top-1.5 left-3.5 min-w-[18px] h-[18px] rounded-full bg-gold px-1 text-center text-[10px] font-bold leading-[18px] text-on-accent ring-2 ring-bg">
                      {it.badge > 99 ? '99+' : it.badge}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium">{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <EditBarSheet open={editing} onClose={() => setEditing(false)} />
    </>
  );
}
