// Wide-window navigation: replaces the bottom tab bar. A narrow rail with icons on laptops,
// and labels too once there is room. Search, notifications, files and knowledge open in
// the Home tab's detail pane, so the list on the left keeps its place.
import { useState } from 'react';
import {
  Bell, BookOpen, ChevronDown, FileText, FolderOpen, House, MessagesSquare, Search, Settings, Sparkles, SquareCheckBig,
} from 'lucide-react';
import { useNav, markPane } from './nav.js';
import { useDueSoonCount } from './TabBar.jsx';
import { useFlags } from '../config/flags.js';
import { useUnreadCounts } from '../data/hooks.js';
import { useSession, useWorkspace } from '../data/session.js';
import { useUpdate } from '../update/updater.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { cx } from '../ui/cx.js';
import { WorkspaceTile } from '../features/workspace/WorkspaceTile.jsx';
import { WorkspaceSheet } from '../features/workspace/WorkspaceSheet.jsx';

const HUB_ROUTES = ['search', 'notifications', 'files', 'knowledge'];
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
export const SEARCH_SHORTCUT = isMac ? '⌘K' : 'Ctrl K';

function Count({ value }) {
  if (!value) return null;
  return (
    <span className="min-w-[18px] rounded-full bg-gold px-1 text-center text-[10px] font-bold leading-[18px] text-on-accent">
      {value > 99 ? '99+' : value}
    </span>
  );
}

function Item({ icon, label, active, badge, dot, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={`${label}${badge ? `, ${badge} new` : dot ? ', new activity' : ''}`}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] transition-colors',
        'justify-center xl:justify-start',
        active ? 'bg-accent/12 font-medium text-accent-ink' : 'text-text-2 hover:bg-surface-2 hover:text-text',
      )}
    >
      <span className="relative shrink-0">
        <Icon as={icon} size={20} />
        {(badge > 0 || dot) && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg xl:hidden" aria-hidden />
        )}
      </span>
      <span className="hidden min-w-0 flex-1 truncate xl:block">{label}</span>
      <span className="hidden xl:inline-flex">
        {badge > 0 ? <Count value={badge} /> : dot ? <span className="h-2 w-2 rounded-full bg-accent" aria-hidden /> : null}
        {hint && !badge && <kbd className="font-sans text-[11px] text-text-3">{hint}</kbd>}
      </span>
    </button>
  );
}

export function Sidebar() {
  const tab = useNav((s) => s.tab);
  const homeTop = useNav((s) => s.stacks.home[0]?.name);
  const setTab = useNav((s) => s.setTab);
  const open = useNav((s) => s.open);
  const flags = useFlags((s) => s.flags);
  const unread = useUnreadCounts();
  const due = useDueSoonCount();
  const workspace = useWorkspace();
  const user = useSession((s) => s.user);
  const update = useUpdate((s) => s.status);
  const [switcher, setSwitcher] = useState(false);

  const hub = tab === 'home' && (HUB_ROUTES.includes(homeTop) || homeTop?.startsWith('settings')) ? homeTop : null;
  const main = [
    { id: 'home', label: 'Home', icon: House, dot: unread.notifications > 0 },
    { id: 'chats', label: 'Chats', icon: MessagesSquare, badge: unread.channels + unread.dms },
    flags.ai && { id: 'ai', label: 'Oruinwan AI', icon: Sparkles },
    { id: 'tasks', label: 'Tasks', icon: SquareCheckBig, badge: due },
    flags.notes && { id: 'notes', label: 'Notes', icon: FileText },
  ].filter(Boolean);
  const more = [
    { route: 'search', label: 'Search', icon: Search, hint: SEARCH_SHORTCUT },
    { route: 'notifications', label: 'Notifications', icon: Bell, badge: unread.notifications },
    flags.files && { route: 'files', label: 'Files', icon: FolderOpen },
    flags.knowledge && { route: 'knowledge', label: 'Knowledge', icon: BookOpen },
  ].filter(Boolean);

  return (
    <nav
      aria-label="Main"
      onPointerDownCapture={() => markPane(tab, 'sidebar')}
      onClickCapture={() => markPane(tab, 'sidebar')}
      className="flex h-full w-[76px] shrink-0 flex-col border-r border-line-soft bg-surface/60 pt-safe xl:w-60"
    >
      <button
        type="button"
        onClick={() => setSwitcher(true)}
        aria-label={`Workspace: ${workspace?.name || 'none'}. Switch workspace`}
        title={workspace?.name || 'Switch workspace'}
        className="mx-3 mt-3 mb-2 flex items-center justify-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-surface-2 xl:justify-start"
      >
        <WorkspaceTile workspace={workspace} size={36} />
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-[14px] font-semibold leading-5">{workspace?.name || 'No workspace'}</span>
          <span className="block truncate text-[12px] text-text-2">Switch workspace</span>
        </span>
        <Icon as={ChevronDown} size={16} className="hidden shrink-0 text-text-3 xl:block" />
      </button>

      <div className="no-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {main.map((it) => (
          <Item key={it.id} {...it} active={tab === it.id && !hub} onClick={() => (hub && it.id === 'home' ? open('home') : setTab(it.id))} />
        ))}
        <div className="mx-1 my-3 border-t border-line-soft" />
        {more.map((it) => (
          <Item key={it.route} {...it} active={hub === it.route} onClick={() => open('home', it.route)} />
        ))}
      </div>

      <div className="border-t border-line-soft px-3 py-3 pb-[max(0.75rem,var(--sab))]">
        <button
          type="button"
          onClick={() => open('home', 'settings')}
          aria-label="Profile and settings"
          title="Profile and settings"
          aria-current={hub?.startsWith('settings') ? 'page' : undefined}
          className={cx(
            'flex w-full items-center justify-center gap-2.5 rounded-xl p-1.5 text-left transition-colors xl:justify-start',
            hub?.startsWith('settings') ? 'bg-accent/12' : 'hover:bg-surface-2',
          )}
        >
          <span className="relative">
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" presence={user?.presence} />
            {(update === 'available' || update === 'required') && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" aria-label="Update available" />
            )}
          </span>
          <span className="hidden min-w-0 flex-1 xl:block">
            <span className="block truncate text-[14px] font-medium leading-5">{user?.name || 'You'}</span>
            <span className="block truncate text-[12px] text-text-2">Settings</span>
          </span>
          <Icon as={Settings} size={16} className="hidden shrink-0 text-text-3 xl:block" />
        </button>
      </div>
      <WorkspaceSheet open={switcher} onClose={() => setSwitcher(false)} />
    </nav>
  );
}
