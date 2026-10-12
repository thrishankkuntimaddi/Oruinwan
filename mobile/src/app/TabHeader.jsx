// Header used by every tab root: workspace switcher on the left, page actions and the
// profile avatar (→ Settings) on the right. Wide windows have both in the sidebar, so there
// the header is just the title and the actions.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSession, useWorkspace } from '../data/session.js';
import { useUpdate } from '../update/updater.js';
import { nav } from './nav.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { cx } from '../ui/cx.js';
import { useWide } from './layout.js';
import { WorkspaceTile } from '../features/workspace/WorkspaceTile.jsx';
import { WorkspaceSheet } from '../features/workspace/WorkspaceSheet.jsx';

export function TabHeader({ title, actions, children, className }) {
  const [switcher, setSwitcher] = useState(false);
  const workspace = useWorkspace();
  const user = useSession((s) => s.user);
  const update = useUpdate((s) => s.status);
  const wide = useWide();

  if (wide) {
    return (
      <header className={cx('z-10 shrink-0 bg-bg/95 pt-safe backdrop-blur-md', className)}>
        <div className="flex h-16 items-center gap-2 pl-5 pr-2">
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight">{title}</h1>
          {actions}
        </div>
        {children}
      </header>
    );
  }

  return (
    <header className={cx('z-10 shrink-0 bg-bg/95 pt-safe backdrop-blur-md', className)}>
      <div className="flex h-16 items-center gap-2 pl-4 pr-2">
        <button
          type="button"
          onClick={() => setSwitcher(true)}
          aria-label={`Workspace: ${workspace?.name || 'none'}. Switch workspace`}
          className="pressable flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <WorkspaceTile workspace={workspace} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[20px] font-bold leading-6 tracking-tight">{title}</span>
            <span className="flex items-center gap-0.5 text-[12px] text-text-2">
              <span className="truncate">{workspace?.name || 'No workspace'}</span>
              <Icon as={ChevronDown} size={14} className="shrink-0" />
            </span>
          </span>
        </button>
        {actions}
        <button
          type="button"
          aria-label="Profile and settings"
          onClick={() => nav.push('settings')}
          className="pressable relative ml-1 rounded-full p-1"
        >
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" presence={user?.presence} />
          {(update === 'available' || update === 'required') && (
            <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" aria-label="Update available" />
          )}
        </button>
      </div>
      {children}
      <WorkspaceSheet open={switcher} onClose={() => setSwitcher(false)} />
    </header>
  );
}
