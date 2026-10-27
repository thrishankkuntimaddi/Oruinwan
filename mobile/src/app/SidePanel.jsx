// The side panel (right): you — your profile and status, account, saved, drafts and scheduled,
// settings and help. Opens from the profile picture in every tab's header, or by swiping in from
// the right edge on a tab's main screen. The workspace has its own drawer on the left
// (WorkspaceDrawer.jsx).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark, ChevronRight, CircleHelp, Clock3, LifeBuoy, LogOut, Send, Settings, Sparkles, UserRound,
} from 'lucide-react';
import { create } from 'zustand';
import { useSession } from '../data/session.js';
import { useUpdate } from '../update/updater.js';
import { nav } from './nav.js';
import { useOverlay, usePresence } from '../ui/Overlay.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { cx } from '../ui/cx.js';

export const useSidePanel = create(() => ({ open: false }));
export const openSidePanel = () => useSidePanel.setState({ open: true });
export const closeSidePanel = () => useSidePanel.setState({ open: false });

const PRESENCE = { active: 'Active', online: 'Active', away: 'Away', dnd: 'Do not disturb', offline: 'Offline' };

function Item({ icon, label, hint, onClick, danger, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cx('flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2', danger ? 'text-danger' : 'text-text')}
    >
      <Icon as={icon} size={20} className={danger ? '' : 'text-text-2'} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block truncate text-[12px] text-text-2">{hint}</span>}
      </span>
      {!danger && <Icon as={ChevronRight} size={16} className="text-text-3" />}
    </button>
  );
}

export function SidePanel() {
  const open = useSidePanel((s) => s.open);
  const user = useSession((s) => s.user);
  const update = useUpdate((s) => s.status);
  const { mounted, closing } = usePresence(open, 200);
  useOverlay(open, closeSidePanel);
  const panel = useRef(null);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);

  useEffect(() => {
    if (!open) setDx(0);
  }, [open]);

  const go = (fn) => () => {
    closeSidePanel();
    fn();
  };

  if (!mounted) return null;

  // Drag the panel back to the right to close it.
  const touch = {
    onTouchStart: (e) => {
      drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false };
    },
    onTouchMove: (e) => {
      const d = drag.current;
      if (!d) return;
      const mx = e.touches[0].clientX - d.x;
      const my = e.touches[0].clientY - d.y;
      if (!d.active && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my)) d.active = true;
      if (d.active) setDx(Math.max(0, mx));
    },
    onTouchEnd: () => {
      if (dx > 80) closeSidePanel();
      else setDx(0);
      drag.current = null;
    },
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[58]" role="presentation">
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={closeSidePanel}
          className={cx('scrim absolute inset-0 transition-opacity duration-200', closing ? 'opacity-0' : 'opacity-100')}
        />
        <aside
          ref={panel}
          role="dialog"
          aria-label="You"
          className="glass absolute inset-y-0 right-0 flex w-[86%] max-w-[360px] flex-col border-l border-line-soft bg-bg pt-safe pb-safe shadow-2xl"
          style={{
            transform: closing ? 'translateX(100%)' : `translateX(${dx}px)`,
            transition: drag.current?.active ? 'none' : 'transform 220ms var(--ease-out-soft)',
            animation: closing ? undefined : 'side-in 220ms var(--ease-out-soft) both',
          }}
          {...touch}
        >
          <div className="flex-1 overflow-y-auto px-3 pb-6 pt-4">
            <button
              type="button"
              onClick={go(() => nav.push('settings.profile'))}
              className="flex w-full items-center gap-3.5 rounded-card border border-line-soft bg-surface p-3.5 text-left"
              style={{ backgroundImage: 'var(--glass)' }}
            >
              <Avatar name={user?.name} src={user?.avatarUrl} size="lg" presence={user?.presence} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold">{user?.name}</span>
                <span className="block truncate text-[13px] text-text-2">{PRESENCE[user?.presence] || 'Active'} · Edit profile</span>
              </span>
            </button>

            <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-3">You</p>
            <Item icon={Bookmark} label="Saved messages" onClick={go(() => nav.push('saved'))} />
            <Item icon={Clock3} label="Drafts & scheduled" onClick={go(() => nav.push('outgoing', { tab: 'scheduled' }))} testId="side-outgoing" />
            <Item icon={Send} label="Sent" onClick={go(() => nav.push('outgoing', { tab: 'sent' }))} />
            <Item icon={Sparkles} label="AI chat history" onClick={go(() => nav.openAi())} />
            <Item icon={UserRound} label="Profile" onClick={go(() => nav.push('settings.profile'))} />
            <Item
              icon={Settings}
              label="Settings"
              hint={update === 'available' || update === 'required' ? 'An update is ready' : null}
              onClick={go(() => nav.push('settings'))}
              testId="side-settings"
            />

            <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-3">Help</p>
            <Item icon={CircleHelp} label="Help center" onClick={go(() => nav.push('settings.help'))} />
            <Item icon={LifeBuoy} label="Contact support" onClick={go(() => nav.push('settings.support'))} />
            <Item icon={LogOut} label="Sign out" danger onClick={go(() => nav.push('settings', { confirmSignOut: true }))} />
          </div>
        </aside>
      </div>
    </>,
    document.body,
  );
}

/** Swipe in from the left edge on a pushed screen to go back (as on iPhone). */
export function useEdgeBack(enabled, onBack) {
  useEffect(() => {
    if (!enabled) return undefined;
    let start = null;
    const down = (e) => {
      const t = e.touches[0];
      start = t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null;
    };
    const move = (e) => {
      if (!start) return;
      const t = e.touches[0];
      if (t.clientX - start.x > 70 && Math.abs(t.clientY - start.y) < 50) {
        start = null;
        onBack();
      }
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
    };
  }, [enabled, onBack]);
}

/** Swipe in from the right edge (on a tab's main screen) to open the panel. */
export function useEdgeSwipe(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let start = null;
    const down = (e) => {
      const t = e.touches[0];
      start = t.clientX > window.innerWidth - 28 ? { x: t.clientX, y: t.clientY } : null;
    };
    const move = (e) => {
      if (!start) return;
      const t = e.touches[0];
      if (start.x - t.clientX > 50 && Math.abs(t.clientY - start.y) < 40) {
        start = null;
        openSidePanel();
      }
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
    };
  }, [enabled]);
}
