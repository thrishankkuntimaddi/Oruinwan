// Signed-in layout: each tab keeps its own stack; tab roots are mounted on first visit and
// stay mounted, so switching tabs never loses scroll position or drafts.
//  - Phones: pushed screens slide over the tab root, with the tab bar at the bottom.
//  - Wide windows (app/layout.js): a sidebar, and for list tabs the list on the left with the
//    open screen beside it. The AI tab stays a single centred column.
import { Suspense, useEffect, useState } from 'react';
import { FileText, House, MessagesSquare, SquareCheckBig } from 'lucide-react';
import { TABS, markPane, useNav } from './nav.js';
import { TAB_ROOTS, ROUTES } from './routes.js';
import { PaneContext, SPLIT_TABS, useWide } from './layout.js';
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
  if (!SPLIT_TABS.has(tab)) {
    return (
      <div className="relative mx-auto h-full w-full max-w-3xl border-x border-line-soft" {...paneEvents(tab, 'detail')}>
        <Root tab={tab} />
        <Stack stack={stack} split={false} />
      </div>
    );
  }
  const empty = PLACEHOLDER[tab];
  return (
    <div className="flex h-full">
      <section
        aria-label="List"
        className="relative h-full w-[360px] shrink-0 border-r border-line-soft xl:w-[400px]"
        {...paneEvents(tab, 'list')}
      >
        <Root tab={tab} />
      </section>
      <section
        aria-label="Details"
        className="relative h-full min-w-0 flex-1"
        {...paneEvents(tab, 'detail')}
      >
        {stack.length === 0 && (
          <div className="grid h-full place-items-center">
            <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
          </div>
        )}
        <Stack stack={stack} split />
      </section>
    </div>
  );
}

export function Shell() {
  const tab = useNav((s) => s.tab);
  const stacks = useNav((s) => s.stacks);
  const flags = useFlags((s) => s.flags);
  const wide = useWide();
  const [visited, setVisited] = useState(() => new Set(['home']));

  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set([...v, tab])));
    logEvent('screen_view', { screen_name: tab });
  }, [tab]);

  // If a remote flag turns a tab off while it is open, fall back to Home.
  useEffect(() => {
    if ((tab === 'ai' && !flags.ai) || (tab === 'notes' && !flags.notes)) useNav.getState().setTab('home');
  }, [tab, flags.ai, flags.notes]);

  // Ctrl+K / ⌘K opens search from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (useNav.getState().overlays.length) return;
        if (wide) useNav.getState().open('home', 'search');
        else useNav.getState().push('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide]);

  const stack = stacks[tab];

  if (wide) {
    return (
      <div className="flex h-full overflow-hidden bg-bg">
        <UnreadBadge />
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
    </div>
  );
}
