// Header used by every tab root: workspace switcher on the left; page actions, then [Search]
// [Profile] on the right. Search grows across the header and shows results for the tab you're
// on right under it (features/search/QuickSearch.jsx); "See all results" opens full search.
// Oruinwan AI is the floating button above the tab bar (app/AiFab.jsx), not a header button.
// Wide windows have all of these in the sidebar, so there the header is the title and actions.
// `onBack` (the AI screen, which isn't on the tab bar) swaps the switcher for a back button and
// leaves out the buttons.
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronDown, Search, X } from 'lucide-react';
import { useSession, useWorkspace } from '../data/session.js';
import { useUpdate } from '../update/updater.js';
import { nav, useNav } from './nav.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Icon } from '../ui/Icon.jsx';
import { cx } from '../ui/cx.js';
import { useWide } from './layout.js';
import { IconButton } from '../ui/Button.jsx';
import { useOverlay } from '../ui/Overlay.jsx';
import { WorkspaceTile } from '../features/workspace/WorkspaceTile.jsx';
import { openSidePanel } from './SidePanel.jsx';
import { openWorkspaceDrawer } from './WorkspaceDrawer.jsx';

const QuickSearch = lazy(() => import('../features/search/QuickSearch.jsx').then((m) => ({ default: m.QuickSearch })));

const PLACEHOLDER = {
  chats: 'Search chats and people',
  tasks: 'Search tasks',
  notes: 'Search notes',
  activity: 'Search activity',
  home: 'Search your workspace',
};

const CONTEXT_OF = { Home: 'home', Chats: 'chats', Tasks: 'tasks', Notes: 'notes', Activity: 'activity' };

/** The results panel: from under the header to the bottom of the window (the keyboard's top). */
function SearchPanel({ anchor, context, query, onClose }) {
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setBox({ top: r.bottom, left: r.left, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchor]);
  if (!box) return null;
  // Through a portal: the header's backdrop blur would otherwise contain a fixed panel.
  return createPortal(
    <div
      className="animate-drop-in fixed bottom-0 z-30 overflow-y-auto overscroll-contain border-t border-line-soft bg-bg"
      style={{ top: box.top, left: box.left, width: box.width }}
      role="region"
      aria-label="Search results"
    >
      <Suspense fallback={null}>
        <QuickSearch context={context} query={query} onClose={onClose} />
      </Suspense>
    </div>,
    document.body,
  );
}

export function TabHeader({ title, actions, children, className, onBack, context: contextProp }) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const workspace = useWorkspace();
  const user = useSession((s) => s.user);
  const update = useUpdate((s) => s.status);
  const tab = useNav((s) => s.tab);
  const wide = useWide();
  const headerRef = useRef(null);
  const inputRef = useRef(null);
  const context = contextProp || CONTEXT_OF[title] || 'home';

  const close = () => {
    setSearching(false);
    setQuery('');
  };
  useOverlay(searching, close);
  // Leaving the tab closes its search.
  useEffect(() => {
    if (searching && tab !== context && CONTEXT_OF[title]) close();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  if (wide) {
    return (
      <header className={cx('glass-header z-10 shrink-0 pt-safe', className)}>
        <div className="flex h-16 items-center gap-2 pl-5 pr-2">
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight">{title}</h1>
          {actions}
        </div>
        {children}
      </header>
    );
  }

  if (onBack) {
    return (
      <header className={cx('glass-header z-10 shrink-0 pt-safe', className)}>
        <div className="flex h-16 items-center gap-1 pl-2 pr-2">
          <IconButton icon={ArrowLeft} label="Back" onClick={onBack} />
          <h1 className="min-w-0 flex-1 truncate pl-1 text-[20px] font-bold tracking-tight">{title}</h1>
          {actions}
        </div>
        {children}
      </header>
    );
  }

  return (
    <header ref={headerRef} className={cx('glass-header relative z-10 shrink-0 pt-safe', className)}>
      {searching ? (
        <div className="flex h-16 items-center gap-2 pl-3 pr-2">
          <label className="animate-search-grow flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-input px-3.5">
            <Icon as={Search} size={18} className="shrink-0 text-text-3" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={PLACEHOLDER[context]}
              aria-label={PLACEHOLDER[context]}
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  const q = query.trim();
                  close();
                  nav.push('search', { q });
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" aria-label="Clear" onClick={() => (setQuery(''), inputRef.current?.focus())} className="grid h-6 w-6 place-items-center rounded-full bg-surface-3 text-text-2">
                <Icon as={X} size={13} />
              </button>
            )}
          </label>
          <button type="button" onClick={close} className="pressable shrink-0 px-2 text-[15px] font-medium text-accent-ink">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex h-16 items-center gap-1 pl-4 pr-2">
          <button
            type="button"
            onClick={openWorkspaceDrawer}
            aria-label={`Workspace: ${workspace?.name || 'none'}. Workspace menu`}
            data-tour="workspace"
            className="pressable mr-1 flex min-w-0 flex-1 items-center gap-3 text-left"
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
          <IconButton icon={Search} label="Search" data-tour="search" onClick={() => setSearching(true)} />
          <button
            type="button"
            aria-label="Profile and settings"
            data-tour="profile"
            onClick={openSidePanel}
            className="pressable relative rounded-full p-1"
          >
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" presence={user?.presence} />
            {(update === 'available' || update === 'required') && (
              <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" aria-label="Update available" />
            )}
          </button>
        </div>
      )}
      {!searching && children}
      {searching && <SearchPanel anchor={headerRef} context={context} query={query} onClose={close} />}
    </header>
  );
}
