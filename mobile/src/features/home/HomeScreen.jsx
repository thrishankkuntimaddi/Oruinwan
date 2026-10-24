// Home: four tiles for what needs you (Unread, Tasks, Huddles, Saved & reminders), then a short
// "Jump to" list of your most recent conversations. Notifications live in the Activity tab.
import { useMemo } from 'react';
import {
  Bookmark, BookOpen, ChevronRight, Download, FolderOpen, Hash, Headphones, Lock, Megaphone, MessageCircle, Plug, SquareCheckBig, Users,
  Workflow,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useChannels, useDms, useTasks, useUnreadCounts } from '../../data/hooks.js';
import { invalidate, useQuery } from '../../data/query.js';
import { useFlags } from '../../config/flags.js';
import { remoteSnapshot } from '../../config/remote.js';
import { useUpdate } from '../../update/updater.js';
import { Body, Screen } from '../../ui/Screen.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Section } from '../../ui/List.jsx';
import { cx } from '../../ui/cx.js';
import { greeting, shortAgo, dueLabel } from '../../lib/time.js';
import { openConversation } from '../chats/chatsUi.js';
import { PushPrompt } from '../push/PushPrompt.jsx';
import { useHuddlesAvailable } from '../huddles/HuddlesScreen.jsx';
import { useHuddle } from '../huddles/huddle.js';

/** One Home tile: an icon, a big count and a line of detail. */
function Tile({ icon, label, value, detail, highlight, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      className="pressable flex min-h-[112px] flex-col rounded-card border border-line-soft bg-surface p-3.5 text-left"
      style={{ backgroundImage: 'var(--glass)' }}
    >
      <span className="flex w-full items-center justify-between">
        <span className={cx('grid h-9 w-9 place-items-center rounded-[10px]', highlight ? 'bg-gold text-on-accent' : 'bg-accent/12 text-accent-ink')}>
          <Icon as={icon} size="sm" />
        </span>
        <Icon as={ChevronRight} size={16} className="text-text-3" />
      </span>
      <span className="mt-auto pt-3 text-[26px] font-bold leading-none tabular-nums">{value}</span>
      <span className="mt-1.5 block truncate text-[13px] font-medium">{label}</span>
      {detail && <span className="block truncate text-[12px] text-text-2">{detail}</span>}
    </button>
  );
}

/** The most recent conversations, channels and DMs mixed, newest first. */
export function recentConversations(channels = [], dms = [], count = 5) {
  return [
    ...channels.filter((c) => c.isMember && c.lastAt).map((c) => ({ kind: 'channel', item: c })),
    ...dms.filter((d) => d.lastAt).map((d) => ({ kind: 'dm', item: d })),
  ]
    .sort((a, b) => String(b.item.lastAt).localeCompare(String(a.item.lastAt)))
    .slice(0, count);
}

function JumpRow({ kind, item }) {
  const unread = item.unread > 0 && !item.muted;
  const name = kind === 'channel' ? item.name : item.user?.name || 'Direct message';
  return (
    <button
      type="button"
      onClick={() => openConversation(kind, item.id)}
      className="flex w-full items-center gap-3 px-3.5 py-2 text-left active:bg-surface-2"
    >
      {kind === 'channel' || item.isGroup ? (
        <span
          className={cx('grid h-[30px] w-[30px] shrink-0 place-items-center border border-line bg-surface-2 text-text-2', item.isGroup ? 'rounded-full' : 'rounded-lg')}
          aria-hidden
        >
          <Icon as={item.isGroup ? Users : item.private ? Lock : Hash} size={14} />
        </span>
      ) : (
        <Avatar name={item.user?.name} src={item.user?.avatarUrl} size="sm" presence={item.user?.presence} />
      )}
      <span className={cx('min-w-0 flex-1 truncate text-[14px]', unread ? 'font-semibold' : 'text-text')}>{name}</span>
      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
      <span className="shrink-0 text-[11px] text-text-3">{shortAgo(item.lastAt)}</span>
    </button>
  );
}

function ShortcutChip({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-soft bg-surface px-3.5 text-[13px] font-medium text-text-2"
    >
      <Icon as={icon} size={15} className="text-accent-ink" />
      {label}
    </button>
  );
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function HomeScreen() {
  const user = useSession((s) => s.user);
  const ws = useSession((s) => s.workspaceId);
  const flags = useFlags((s) => s.flags);
  const huddlesOn = useHuddlesAvailable();
  const liveCount = useHuddle((s) => Object.keys(s.live).length);
  const unread = useUnreadCounts();
  const { data: tasks } = useTasks();
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const update = useUpdate((s) => (s.status === 'available' ? s.manifest : null));
  const announcement = remoteSnapshot().announcement;

  // Same cache keys as the Saved and Huddles screens, so opening them is instant.
  const saved = useQuery(ws && `saved:${ws}`, () => api().savedMessages(ws), { staleMs: 60_000 });
  const reminders = useQuery(ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 60_000 });
  const upcoming = useQuery(huddlesOn && ws && `meetingpage:${ws}:upcoming:`, () => api().meetingsPage(ws, { status: 'upcoming', q: '' }), {
    staleMs: 60_000,
  });

  const myOpen = useMemo(
    () => (tasks || []).filter((t) => t.assigneeIds.includes(user?.id) && !['done', 'cancelled'].includes(t.status)),
    [tasks, user?.id],
  );
  const overdue = myOpen.filter((t) => dueLabel(t.due)?.tone === 'overdue').length;
  const dueToday = myOpen.filter((t) => dueLabel(t.due)?.tone === 'today').length;

  const unreadConvs = useMemo(
    () => (channels || []).filter((c) => c.isMember && c.unread > 0 && !c.muted).length + (dms || []).filter((d) => d.unread > 0).length,
    [channels, dms],
  );
  const recent = useMemo(() => recentConversations(channels || [], dms || []), [channels, dms]);

  const upcomingCount = upcoming.data?.meetings?.length || 0;
  const savedCount = saved.data?.length || 0;
  const reminderCount = reminders.data?.length || 0;

  const firstName = (user?.name || '').split(' ')[0];
  const unreadMessages = unread.channels + unread.dms;

  const refresh = () => {
    invalidate('tasks', 'channels', 'dms', 'saved:', 'reminders', 'meetingpage:');
    return useSession.getState().loadWorkspaces();
  };

  return (
    <Screen>
      <TabHeader title="Home" />
      <Body tab="home" onRefresh={refresh}>
        <h2 className="px-4 pt-4 text-[22px] font-bold leading-tight tracking-tight">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h2>

        <PushPrompt className="mx-4 mt-3" />

        {announcement && (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-card border border-line bg-surface px-3.5 py-3 text-[13px]">
            <Icon as={Megaphone} size="sm" className="mt-0.5 shrink-0 text-accent-ink" />
            <span>{announcement}</span>
          </div>
        )}

        {update && (
          <button
            type="button"
            onClick={() => nav.push('settings.updates')}
            className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-card border border-accent/35 bg-surface px-3.5 py-3 text-left"
          >
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-gold text-on-accent">
              <Icon as={Download} size="sm" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">Version {update.version} is ready</span>
              <span className="block truncate text-xs text-text-2">Tap to see what&apos;s new and update</span>
            </span>
            <Icon as={ChevronRight} size="sm" className="text-text-3" />
          </button>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5 px-4">
          <Tile
            testId="home-unread"
            icon={MessageCircle}
            label="Unread"
            value={unreadMessages}
            highlight={unreadMessages > 0}
            detail={unreadConvs ? `in ${plural(unreadConvs, 'conversation')}` : 'Nothing new'}
            onClick={() => nav.push('unread')}
          />
          <Tile
            testId="home-tasks"
            icon={SquareCheckBig}
            label="My open tasks"
            value={myOpen.length}
            highlight={overdue > 0}
            detail={overdue ? `${overdue} overdue` : dueToday ? `${dueToday} due today` : 'Nothing due today'}
            onClick={() => nav.setTab('tasks')}
          />
          {huddlesOn && (
            <Tile
              testId="home-huddles"
              icon={Headphones}
              label="Huddles"
              value={liveCount || upcomingCount}
              highlight={liveCount > 0}
              detail={liveCount ? `live now${upcomingCount ? ` · ${upcomingCount} upcoming` : ''}` : upcomingCount ? 'upcoming' : 'None scheduled'}
              onClick={() => nav.push('huddles')}
            />
          )}
          <Tile
            testId="home-saved"
            icon={Bookmark}
            label="Saved"
            value={savedCount}
            detail={reminderCount ? plural(reminderCount, 'reminder') : 'No reminders'}
            onClick={() => nav.push('saved', reminderCount && !savedCount ? { tab: 'reminders' } : {})}
          />
        </div>

        {recent.length > 0 && (
          <Section title="Jump to" className="mt-6">
            <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
              {recent.map(({ kind, item }) => (
                <JumpRow key={`${kind}:${item.id}`} kind={kind} item={item} />
              ))}
            </div>
          </Section>
        )}

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="More">
          {flags.files && <ShortcutChip icon={FolderOpen} label="Files" onClick={() => nav.push('files')} />}
          {flags.knowledge && <ShortcutChip icon={BookOpen} label="Knowledge" onClick={() => nav.push('knowledge')} />}
          <ShortcutChip icon={Workflow} label="Automations" onClick={() => nav.push('automations')} />
          {flags.integrations && <ShortcutChip icon={Plug} label="Integrations" onClick={() => nav.push('integrations')} />}
        </div>
      </Body>
    </Screen>
  );
}
