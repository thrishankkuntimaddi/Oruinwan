// Signed-in layout: each tab keeps its own stack; tab roots are mounted on first visit and
// stay mounted, so switching tabs never loses scroll position or drafts.
//  - Phones: pushed screens slide over the tab root, with the tab bar at the bottom.
//  - Split windows (tablets in portrait, app/layout.js): list tabs keep the phone layout in a
//    column on the left, tab bar included, with the open screen beside it.
//  - Wide windows: a sidebar, and for list tabs the list on the left with the open screen
//    beside it. The AI tab stays a single centred column.
import { Suspense, useEffect, useState } from 'react';
import { FileText, House, MessagesSquare, SquareCheckBig } from 'lucide-react';
import { TABS, markPane, useNav } from './nav.js';
import { TAB_ROOTS, ROUTES } from './routes.js';
import { PaneContext, SPLIT_TABS, useListWidth, useSplit, useWide } from './layout.js';
import { TabBar } from './TabBar.jsx';
import { Sidebar } from './Sidebar.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { HomeScreen } from '../features/home/HomeScreen.jsx';
import { EmptyState, SkeletonRows } from '../ui/Feedback.jsx';
import { cx } from '../ui/cx.js';
import { useFlags } from '../config/flags.js';
import { logEvent } from '../config/remote.js';
import { useUnreadCounts } from '../data/hooks.js';
import { setBadgeCount } from '../native/index.js';
import { HuddleLayer } from '../features/huddles/HuddleLayer.jsx';
import { SHORTCUTS, shortcutFor } from './shortcuts.js';
import { useOutbox } from '../data/outbox.js';

/** A small pill while there is no connection: what you see is saved data; sends are queued. */
function OfflinePill() {
  const online = useOutbox((s) => s.online);
  const queued = useOutbox((s) => s.items.filter((i) => i.status !== 'failed').length);
  if (online && !queued) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ top: 'calc(var(--sat) + 6px)' }} role="status" aria-live="polite">
      <span className="glass rounded-full border px-3 py-1 text-[12px] font-medium text-text-2">
        {online ? `Sending ${queued} queued message${queued === 1 ? '' : 's'}…` : `Offline · showing saved data${queued ? ` · ${queued} queued` : ''}`}
      </span>
    </div>
  );
}
import { Sheet } from '../ui/Overlay.jsx';

function ShortcutsSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard shortcuts">
      <ul className="px-5 pb-4">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 text-[15px] last:border-0">
            <span>{s.label}</span>
            <kbd className="shrink-0 rounded-md border border-line bg-surface-2 px-2 py-0.5 font-sans text-[13px] text-text-2">{s.keys}</kbd>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function Fallback() {
  return (
    <div className="h-full bg-bg pt-safe">
      <div className="h-14" />
      <SkeletonRows count={7} />
    </div>
  );
}

function Missing({ name }) {
  return <div className="grid h-full place-items-center bg-bg text-sm text-text-2">Screen “{name}” is not available.</div>;
}

function TabRoot({ tab }) {
  if (tab === 'home') return <HomeScreen />;
  const Comp = TAB_ROOTS[tab];
  return Comp ? <Comp /> : <Missing name={tab} />;
}

/** A tab's pushed screens, each covering the one below it. */
function Stack({ stack, split }) {
  const pop = useNav((s) => s.pop);
  return stack.map((route, i) => {
    const Comp = ROUTES[route.name];
    return (
      <div
        key={route.key}
        className={cx('absolute inset-0 bg-bg', split && i === 0 ? 'animate-fade-in' : 'animate-screen-in')}
        style={{ zIndex: 30 + i }}
        aria-hidden={i < stack.length - 1 ? true : undefined}
      >
        <PaneContext.Provider value={{ split, depth: i }}>
          <ErrorBoundary onBack={pop}>
            <Suspense fallback={<Fallback />}>
              {Comp ? <Comp {...route.params} /> : <Missing name={route.name} />}
            </Suspense>
          </ErrorBoundary>
        </PaneContext.Provider>
      </div>
    );
  });
}

function Root({ tab }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fallback />}>
        <TabRoot tab={tab} />
      </Suspense>
    </ErrorBoundary>
  );
}

/** Remembers which pane a click or key press happened in (see markPane in nav.js). */
const paneEvents = (tab, pane) => {
  const mark = () => markPane(tab, pane);
  return { onPointerDownCapture: mark, onClickCapture: mark, onKeyDownCapture: mark };
};

const PLACEHOLDER = {
  home: { icon: House, title: 'Nothing open', body: 'Open a notification, task, note or anything from the sidebar and it shows here.' },
  chats: { icon: MessagesSquare, title: 'Pick a conversation', body: 'Channels and direct messages open here, next to your list.' },
  tasks: { icon: SquareCheckBig, title: 'Pick a task', body: 'Details, subtasks and comments open here.' },
  notes: { icon: FileText, title: 'Pick a note', body: 'Notes open here, so you can keep your list in view.' },
};

/** Unread conversations on the dock / taskbar icon (desktop app only). Its own component so
 * count changes don't re-render the whole shell. */
function UnreadBadge() {
  const unread = useUnreadCounts();
  const total = unread.channels + unread.dms;
  useEffect(() => setBadgeCount(total), [total]);
  useEffect(() => () => setBadgeCount(0), []);
  return null;
}

function WideTab({ tab, stack }) {
  const listWidth = useListWidth();
  if (!SPLIT_TABS.has(tab)) {
    return (
      <div className="relative mx-auto h-full w-full max-w-3xl border-x border-line-soft" {...paneEvents(tab, 'detail')}>
        <Root tab={tab} />
        <Stack stack={stack} split={false} />
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <section
        aria-label="List"
        className="relative h-full shrink-0 border-r border-line-soft"
        style={{ width: listWidth }}
        {...paneEvents(tab, 'list')}
      >
        <Root tab={tab} />
      </section>
      <DetailPane tab={tab} stack={stack} />
    </div>
  );
}

/** The open item beside a list: its stack, or a hint while nothing is open. */
function DetailPane({ tab, stack }) {
  const empty = PLACEHOLDER[tab];
  return (
    <section aria-label="Details" className="relative h-full min-w-0 flex-1" {...paneEvents(tab, 'detail')}>
      {stack.length === 0 && (
        <div className="grid h-full place-items-center">
          <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
        </div>
      )}
      <Stack stack={stack} split />
    </section>
  );
}

/**
 * Split layout (768-1023 px): the list keeps the phone layout, tab bar included, in a column
 * on the left, and the open item fills the rest. The tab bar stays inside the list column so it
 * never covers the open item's composer. Tabs that aren't lists (AI) use the phone layout.
 */
function SplitTab({ tab, stack }) {
  const listWidth = useListWidth();
  if (!SPLIT_TABS.has(tab)) {
    return (
      <div className="relative h-full">
        <Root tab={tab} />
        <Stack stack={stack} split={false} />
        {stack.length === 0 && <TabBar />}
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <section aria-label="List" className="relative h-full shrink-0 border-r border-line-soft" style={{ width: listWidth }} {...paneEvents(tab, 'list')}>
        <Root tab={tab} />
        <TabBar />
      </section>
      <DetailPane tab={tab} stack={stack} />
    </div>
  );
}

export function Shell() {
  const tab = useNav((s) => s.tab);
  const stacks = useNav((s) => s.stacks);
  const flags = useFlags((s) => s.flags);
  const wide = useWide();
  const split = useSplit();
  const [visited, setVisited] = useState(() => new Set(['home']));

  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set([...v, tab])));
    logEvent('screen_view', { screen_name: tab });
  }, [tab]);

  // If a remote flag turns a tab off while it is open, fall back to Home.
  useEffect(() => {
    if ((tab === 'ai' && !flags.ai) || (tab === 'notes' && !flags.notes)) useNav.getState().setTab('home');
  }, [tab, flags.ai, flags.notes]);

  // Hardware keyboard shortcuts (app/shortcuts.js): ⌘K search, ⌘1-5 tabs, ⌘[ back, ⌘, settings.
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const tabs = TABS.filter((t) => (t !== 'ai' || flags.ai) && (t !== 'notes' || flags.notes));
    const onKey = (e) => {
      const action = shortcutFor(e, tabs);
      if (!action) return;
      e.preventDefault();
      const navState = useNav.getState();
      if (navState.overlays.length && action.kind !== 'help') return;
      const openHub = (name) => (wide ? navState.open('home', name) : navState.push(name));
      if (action.kind === 'search') openHub('search');
      else if (action.kind === 'settings') openHub('settings');
      else if (action.kind === 'notifications') openHub('notifications');
      else if (action.kind === 'back') navState.pop();
      else if (action.kind === 'tab') navState.setTab(action.tab);
      else if (action.kind === 'help') setHelp((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, flags.ai, flags.notes]);

  const stack = stacks[tab];

  if (wide) {
    return (
      <div className="flex h-full overflow-hidden bg-bg">
        <UnreadBadge />
        <HuddleLayer />
        <OfflinePill />
        <ShortcutsSheet open={help} onClose={() => setHelp(false)} />
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          {TABS.filter((t) => visited.has(t)).map((t) => (
            <div key={t} className="absolute inset-0" hidden={t !== tab}>
              <WideTab tab={t} stack={stacks[t]} />
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (split) {
    return (
      <div className="relative h-full overflow-hidden bg-bg">
        {TABS.filter((t) => visited.has(t)).map((t) => (
          <div key={t} className="absolute inset-0" hidden={t !== tab}>
            <SplitTab tab={t} stack={stacks[t]} />
          </div>
        ))}
        <UnreadBadge />
        <HuddleLayer />
        <OfflinePill />
        <ShortcutsSheet open={help} onClose={() => setHelp(false)} />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      {TABS.filter((t) => visited.has(t)).map((t) => (
        <div key={t} className="absolute inset-0" hidden={t !== tab}>
          <Root tab={t} />
          <Stack stack={stacks[t]} split={false} />
        </div>
      ))}
      {stack.length === 0 && <TabBar />}
      <UnreadBadge />
      <HuddleLayer />
        <OfflinePill />
        <ShortcutsSheet open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
