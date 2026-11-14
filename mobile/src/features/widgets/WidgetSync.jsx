// Keeps the Android home-screen widgets up to date: builds the snapshot (widgetSnapshot.js) from
// the data the app already loads and hands it to the native side (WidgetsPlugin.java) when it
// changes, at most every couple of seconds, and when the app goes to the background.
import { useEffect, useMemo, useRef } from 'react';
import { useSession, useWorkspace, api } from '../../data/session.js';
import { useChannels, useDms, useTasks } from '../../data/hooks.js';
import { useQuery } from '../../data/query.js';
import { allChats, useConversationPrefs } from '../chats/chatList.js';
import { useHuddle } from '../huddles/huddle.js';
import { plainPreview } from '../../ui/Markdown.jsx';
import { onAppState } from '../../native/index.js';
import { useAppearance } from '../../app/theme.js';
import { buildWidgetSnapshot } from './widgetSnapshot.js';
import { pushWidgetSnapshot, widgetsAvailable } from './widgetBridge.js';

export function WidgetSync() {
  if (!widgetsAvailable()) return null;
  return <WidgetSyncInner />;
}

function WidgetSyncInner() {
  const workspace = useWorkspace();
  const me = useSession((s) => s.user?.id);
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const prefs = useConversationPrefs();
  const { data: tasks } = useTasks();
  const liveMap = useHuddle((s) => s.live);
  const theme = useAppearance((s) => s.resolved);
  const ws = workspace?.id;
  const { data: upcoming } = useQuery(ws && `widget-meetings:${ws}`, () => api().meetingsPage(ws, { status: 'upcoming' }), { staleMs: 60_000 });

  const rows = useMemo(() => allChats(channels || [], dms || [], prefs), [channels, dms, prefs]);
  const live = useMemo(() => {
    const byId = new Map(rows.map((r) => [String(r.item.id), r]));
    return Object.entries(liveMap || {}).map(([key, h]) => {
      const r = byId.get(key);
      const title = r ? (r.kind === 'channel' ? `#${String(r.item.name || '').replace(/^#+/, '')}` : r.item.user?.name || r.item.name) : 'Huddle';
      return { title, count: (h.participants || []).length, kind: r?.kind, id: r?.item.id };
    });
  }, [liveMap, rows]);

  const snapshot = useMemo(
    () => ({ ...buildWidgetSnapshot({ workspace, me, rows, tasks: tasks || [], live, meetings: upcoming?.meetings || [], plain: (t) => plainPreview(t, 90) }), theme }),
    [workspace, me, rows, tasks, live, upcoming, theme],
  );

  // Send when what the widgets show changes (not for the timestamp alone), coalescing bursts.
  const sent = useRef('');
  const latest = useRef(snapshot);
  latest.current = snapshot;
  useEffect(() => {
    const { updatedAt: _at, ...shown } = snapshot;
    const key = JSON.stringify(shown);
    if (key === sent.current) return undefined;
    const t = setTimeout(() => {
      sent.current = key;
      pushWidgetSnapshot(snapshot);
    }, 1500);
    return () => clearTimeout(t);
  }, [snapshot]);

  // Leaving the app: make sure the widgets have the latest.
  useEffect(() => {
    let off = () => {};
    onAppState((active) => {
      if (!active) pushWidgetSnapshot(latest.current);
    }).then((f) => (off = f));
    return () => off();
  }, []);

  return null;
}
