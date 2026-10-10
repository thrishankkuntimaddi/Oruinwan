// Signed-in layout: each tab keeps its own stack; tab roots are mounted on first visit and
// stay mounted, so switching tabs never loses scroll position or drafts.
import { Suspense, useEffect, useState } from 'react';
import { TABS, useNav } from './nav.js';
import { TAB_ROOTS, ROUTES } from './routes.js';
import { TabBar } from './TabBar.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { HomeScreen } from '../features/home/HomeScreen.jsx';
import { SkeletonRows } from '../ui/Feedback.jsx';
import { useFlags } from '../config/flags.js';
import { logEvent } from '../config/remote.js';

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

export function Shell() {
  const tab = useNav((s) => s.tab);
  const stacks = useNav((s) => s.stacks);
  const pop = useNav((s) => s.pop);
  const flags = useFlags((s) => s.flags);
  const [visited, setVisited] = useState(() => new Set(['home']));

  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set([...v, tab])));
    logEvent('screen_view', { screen_name: tab });
  }, [tab]);

  // If a remote flag turns a tab off while it is open, fall back to Home.
  useEffect(() => {
    if ((tab === 'ai' && !flags.ai) || (tab === 'notes' && !flags.notes)) useNav.getState().setTab('home');
  }, [tab, flags.ai, flags.notes]);

  const stack = stacks[tab];

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      {TABS.filter((t) => visited.has(t)).map((t) => (
        <div key={t} className="absolute inset-0" hidden={t !== tab}>
          <ErrorBoundary>
            <Suspense fallback={<Fallback />}>
              <TabRoot tab={t} />
            </Suspense>
          </ErrorBoundary>
          {stacks[t].map((route, i) => {
            const Comp = ROUTES[route.name];
            return (
              <div
                key={route.key}
                className="absolute inset-0 bg-bg animate-screen-in"
                style={{ zIndex: 30 + i }}
                aria-hidden={i < stacks[t].length - 1 ? true : undefined}
              >
                <ErrorBoundary onBack={pop}>
                  <Suspense fallback={<Fallback />}>
                    {Comp ? <Comp {...route.params} /> : <Missing name={route.name} />}
                  </Suspense>
                </ErrorBoundary>
              </div>
            );
          })}
        </div>
      ))}
      {stack.length === 0 && <TabBar />}
    </div>
  );
}
