// The workspace drawer, from the left: the workspace's cover and picture (owners and admins change
// them right here), then everything about the workspace: switch, details, invite, calendar and the
// workspace's places. Opens from the workspace at the top left of every tab, or by swiping in
// from the left edge on a tab's main screen. (Your own things are in the side panel on the right.)
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Building2, CalendarDays, ChevronRight, FolderOpen, Headphones, Repeat2, Shield, UserPlus, Bell } from 'lucide-react';
import { create } from 'zustand';
import { useSession, useWorkspace } from '../data/session.js';
import { useMembers } from '../data/hooks.js';
import { nav } from './nav.js';
import { useOverlay, usePresence } from '../ui/Overlay.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { cx } from '../ui/cx.js';
import { WorkspaceHero } from '../features/workspace/WorkspaceHero.jsx';
import { WorkspaceSheet } from '../features/workspace/WorkspaceSheet.jsx';
import { InviteSheet, canInvite } from '../features/workspace/InviteSheet.jsx';

export const useWorkspaceDrawer = create(() => ({ open: false }));
export const openWorkspaceDrawer = () => useWorkspaceDrawer.setState({ open: true });
export const closeWorkspaceDrawer = () => useWorkspaceDrawer.setState({ open: false });

function Item({ icon, label, hint, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left text-text active:bg-surface-2">
      <Icon as={icon} size={20} className="text-text-2" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block truncate text-[12px] text-text-2">{hint}</span>}
      </span>
      <Icon as={ChevronRight} size={16} className="text-text-3" />
    </button>
  );
}

/** Who runs this workspace: the owner, then its admins, so every member knows who to ask. */
export function Leaders({ members, onOpen }) {
  const people = (members || []).filter((m) => m.workspaceRole === 'owner' || m.workspaceRole === 'admin');
  if (!people.length) return null;
  people.sort((a, b) => (a.workspaceRole === b.workspaceRole ? a.name.localeCompare(b.name) : a.workspaceRole === 'owner' ? -1 : 1));
  return (
    <div className="mt-3 rounded-xl border border-line-soft bg-surface px-1 py-1" data-testid="workspace-leaders">
      <p className="px-2.5 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-3">Owner and admins</p>
      {people.slice(0, 6).map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen?.(p.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left active:bg-surface-2">
          <Avatar name={p.name} src={p.avatarUrl} size="sm" presence={p.presence} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{p.name}</span>
          <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', p.workspaceRole === 'owner' ? 'bg-gold/20 text-accent-ink' : 'bg-surface-3 text-text-2')}>
            {p.workspaceRole === 'owner' ? 'Owner' : 'Admin'}
          </span>
        </button>
      ))}
      {people.length > 6 && <p className="px-2.5 pb-1.5 text-[12px] text-text-2">and {people.length - 6} more admins</p>}
    </div>
  );
}

export function WorkspaceDrawer() {
  const open = useWorkspaceDrawer((s) => s.open);
  const workspace = useWorkspace();
  const mode = useSession((s) => s.mode);
  const { data: members } = useMembers();
  const [switcher, setSwitcher] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { mounted, closing } = usePresence(open, 200);
  useOverlay(open, closeWorkspaceDrawer);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  useEffect(() => {
    if (!open) setDx(0);
  }, [open]);

  const go = (fn) => () => {
    closeWorkspaceDrawer();
    fn();
  };
  const isAdmin = ['owner', 'admin'].includes(workspace?.role);
  const sheets = (
    <>
      <WorkspaceSheet open={switcher} onClose={() => setSwitcher(false)} />
      {inviting && <InviteSheet open onClose={() => setInviting(false)} />}
    </>
  );
  if (!mounted) return sheets;

  // Drag the drawer back to the left to close it.
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
      if (d.active) setDx(Math.min(0, mx));
    },
    onTouchEnd: () => {
      if (dx < -80) closeWorkspaceDrawer();
      else setDx(0);
      drag.current = null;
    },
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" role="presentation">
        <button
          type="button"
          aria-label="Close"
          tabIndex={-1}
          onClick={closeWorkspaceDrawer}
          className={cx('scrim absolute inset-0 transition-opacity duration-200', closing ? 'opacity-0' : 'opacity-100')}
        />
        <aside
          role="dialog"
          aria-label="Workspace"
          data-testid="workspace-drawer"
          className="glass absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col border-r border-line-soft bg-bg pt-safe pb-safe shadow-2xl"
          style={{
            transform: closing ? 'translateX(-100%)' : `translateX(${dx}px)`,
            transition: drag.current?.active ? 'none' : 'transform 220ms var(--ease-out-soft)',
            animation: closing ? undefined : 'side-in-left 220ms var(--ease-out-soft) both',
          }}
          {...touch}
        >
          <div className="flex-1 overflow-y-auto px-3 pb-6 pt-3">
            {workspace ? (
              <>
                <WorkspaceHero workspace={workspace} editable={mode === 'live' && isAdmin} size={68} coverHeight={110} />
                <div className="px-1 pt-2">
                  <h2 className="truncate text-[20px] font-bold tracking-tight">{workspace.name}</h2>
                  <p className="text-[13px] text-text-2">
                    {[workspace.role && workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1), `${members?.length ?? workspace.memberCount ?? 0} members`].filter(Boolean).join(' · ')}
                  </p>
                  {workspace.profile?.tagline && <p className="mt-1 text-[13px]">{workspace.profile.tagline}</p>}
                </div>
                <Leaders members={members} onOpen={(id) => (closeWorkspaceDrawer(), nav.push('profile', { userId: id }))} />
              </>
            ) : (
              <p className="px-3 py-6 text-[15px] text-text-2">No workspace selected</p>
            )}

            <div className="mt-4">
              <Item icon={Repeat2} label="Switch workspace" hint="Your other workspaces" onClick={() => (closeWorkspaceDrawer(), setSwitcher(true))} testId="drawer-switch" />
              <Item icon={Building2} label="Workspace details" hint="About, members and channels" onClick={go(() => nav.push('workspace'))} testId="drawer-details" />
              {mode === 'live' && canInvite(workspace) && <Item icon={UserPlus} label="Invite people" onClick={() => (closeWorkspaceDrawer(), setInviting(true))} />}
            </div>
            <p className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-3">Places</p>
            <Item icon={CalendarDays} label="Calendar" hint="Meetings, tasks due and reminders" onClick={go(() => nav.push('calendar'))} testId="drawer-calendar" />
            <Item icon={Headphones} label="Huddles" onClick={go(() => nav.push('huddles'))} />
            <Item icon={FolderOpen} label="Files" onClick={go(() => nav.push('files'))} />
            <Item icon={BookOpen} label="Knowledge" onClick={go(() => nav.push('knowledge'))} />
            <Item icon={Bell} label="Notification settings" onClick={go(() => nav.push('settings.notifications'))} />
            {isAdmin && <Item icon={Shield} label="Admin" hint="Features, permissions and people" onClick={go(() => nav.push('admin'))} />}
          </div>
        </aside>
      </div>
      {sheets}
    </>,
    document.body,
  );
}

/** Swipe in from the left edge (on a tab's main screen) to open the workspace drawer. */
export function useLeftEdgeSwipe(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let start = null;
    const down = (e) => {
      const t = e.touches[0];
      // Android's back gesture owns the outermost pixels, so a swipe may start a little further in.
      // Not on things that slide sideways themselves (chat rows, carousels, sliders).
      const own = e.target?.closest?.('[data-swipe], input[type="range"], .overflow-x-auto, .snap-x');
      start = t.clientX < 64 && !own ? { x: t.clientX, y: t.clientY } : null;
    };
    const move = (e) => {
      if (!start) return;
      const t = e.touches[0];
      if (t.clientX - start.x > 60 && Math.abs(t.clientY - start.y) < 40) {
        start = null;
        openWorkspaceDrawer();
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
