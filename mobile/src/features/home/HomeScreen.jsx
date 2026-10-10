// Home: the dashboard. Ordered by what needs attention first: what's new for me,
// what's due, then quick access to everything else.
import { useMemo, useState } from 'react';
import {
  AtSign, Bell, BookOpen, ChevronRight, FolderOpen, Hash, Megaphone, MessageCircle, Plug, Search, SquareCheckBig,
  Sparkles, ArrowRight, Download, FlaskConical,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav } from '../../app/nav.js';
import { useSession } from '../../data/session.js';
import { useChannels, useDirectory, useDms, useNotes, useNotifications, useTasks, useUnreadCounts } from '../../data/hooks.js';
import { invalidate } from '../../data/query.js';
import { useFlags } from '../../config/flags.js';
import { remoteSnapshot } from '../../config/remote.js';
import { useUpdate } from '../../update/updater.js';
import { Body, Screen } from '../../ui/Screen.jsx';
import { IconButton, Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Section } from '../../ui/List.jsx';
import { Segmented } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { greeting, shortAgo, dueLabel } from '../../lib/time.js';
import { NOTE_TYPES } from '../../data/constants.js';
import { htmlToText } from '../../ui/sanitize.js';
import { TaskRow } from '../tasks/TaskRow.jsx';
import { ActivityRow } from './ActivityRow.jsx';
import { openChats } from '../chats/chatsUi.js';

function StatTile({ value, label, tone, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex flex-1 flex-col items-start rounded-card border border-line-soft bg-surface p-3.5 text-left"
      style={{ backgroundImage: 'var(--glass)', boxShadow: 'var(--spec)' }}
    >
      <Icon as={icon} size="sm" className={cx('mb-3', tone || 'text-text-3')} />
      <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums">{value}</span>
      <span className="mt-1.5 text-xs text-text-2">{label}</span>
    </button>
  );
}

function QuickTile({ icon, label, detail, onClick }) {
  return (
    <button type="button" onClick={onClick} className="pressable flex items-center gap-3 rounded-card border border-line-soft bg-surface p-3 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent/12 text-accent-ink">
        <Icon as={icon} size="sm" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium">{label}</span>
        {detail != null && <span className="block truncate text-xs text-text-2">{detail}</span>}
      </span>
    </button>
  );
}

export function HomeScreen() {
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);
  const flags = useFlags((s) => s.flags);
  const unread = useUnreadCounts();
  const directory = useDirectory();
  const { data: notifications, loading: nLoading } = useNotifications();
  const { data: tasks, loading: tLoading } = useTasks();
  const { data: notes } = useNotes();
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const update = useUpdate((s) => (s.status === 'available' ? s.manifest : null));
  const [filter, setFilter] = useState('all');
  const announcement = remoteSnapshot().announcement;

  const myTasks = useMemo(
    () =>
      (tasks || [])
        .filter((t) => t.assigneeIds.includes(user?.id) && !['done', 'cancelled'].includes(t.status))
        .sort((a, b) => (a.due || '9').localeCompare(b.due || '9')),
    [tasks, user?.id],
  );
  const dueToday = myTasks.filter((t) => ['overdue', 'today'].includes(dueLabel(t.due)?.tone)).length;

  const activity = useMemo(() => {
    const list = notifications || [];
    if (filter === 'mentions') return list.filter((n) => n.type === 'mention');
    if (filter === 'dms') return list.filter((n) => n.type === 'dm');
    return list;
  }, [notifications, filter]);

  const firstName = (user?.name || '').split(' ')[0];
  const summary = [
    unread.channels + unread.dms ? `${unread.channels + unread.dms} unread` : null,
    dueToday ? `${dueToday} ${dueToday === 1 ? 'task' : 'tasks'} due today` : null,
  ].filter(Boolean);

  const refresh = () => {
    invalidate('notifications', 'tasks', 'channels', 'dms', 'notes');
    return useSession.getState().loadWorkspaces();
  };

  return (
    <Screen>
      <TabHeader
        title="Home"
        actions={
          <>
            <IconButton icon={Search} label="Search" onClick={() => nav.push('search')} />
            <IconButton
              icon={Bell}
              label={`Notifications${unread.notifications ? `, ${unread.notifications} unread` : ''}`}
              badge={unread.notifications}
              onClick={() => nav.push('notifications')}
            />
          </>
        }
      />
      <Body tab="home" onRefresh={refresh}>
        {mode === 'demo' && (
          <button
            type="button"
            onClick={() => useSession.getState().signOut()}
            className="mx-4 mt-1 flex w-[calc(100%-2rem)] items-center gap-2.5 rounded-card border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-left"
          >
            <Icon as={FlaskConical} size="sm" className="shrink-0 text-accent-ink" />
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="font-medium">Demo workspace.</span> <span className="text-text-2">Sample data, stored only on this phone.</span>
            </span>
            <span className="shrink-0 text-[13px] font-medium text-accent-ink">Sign in</span>
          </button>
        )}

        <div className="px-4 pt-4 pb-1">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-sm text-text-2">{summary.length ? summary.join(' · ') : "You're all caught up."}</p>
        </div>

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
              <span className="block truncate text-xs text-text-2">Tap to see what's new and update</span>
            </span>
            <Icon as={ChevronRight} size="sm" className="text-text-3" />
          </button>
        )}

        <div className="mt-4 flex gap-2.5 px-4">
          <StatTile
            icon={MessageCircle}
            value={unread.channels + unread.dms}
            label="Unread"
            tone={unread.channels + unread.dms ? 'text-accent-ink' : undefined}
            onClick={() => nav.setTab('chats')}
          />
          <StatTile
            icon={AtSign}
            value={unread.mentions}
            label="Mentions"
            tone={unread.mentions ? 'text-danger' : undefined}
            onClick={() => nav.push('notifications', { initial: 'mentions' })}
          />
          <StatTile
            icon={SquareCheckBig}
            value={dueToday}
            label="Due today"
            tone={dueToday ? 'text-warning' : undefined}
            onClick={() => nav.setTab('tasks')}
          />
        </div>

        <Section
          title="Activity"
          action={
            <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => nav.push('notifications')}>
              View all
            </button>
          }
        >
          <div className="px-4 pb-2">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'mentions', label: 'Mentions' },
                { value: 'dms', label: 'DMs' },
              ]}
            />
          </div>
          <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {nLoading ? (
              <SkeletonRows count={3} />
            ) : activity.length ? (
              activity.slice(0, 5).map((n) => <ActivityRow key={n.id} item={n} directory={directory} />)
            ) : (
              <p className="px-4 py-6 text-center text-sm text-text-2">Nothing new here.</p>
            )}
          </div>
        </Section>

        <Section
          title="Your tasks"
          action={
            <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => nav.setTab('tasks')}>
              See all
            </button>
          }
        >
          <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {tLoading ? (
              <SkeletonRows count={3} avatar={false} />
            ) : myTasks.length ? (
              myTasks.slice(0, 4).map((t) => <TaskRow key={t.id} task={t} directory={directory} compact />)
            ) : (
              <EmptyState icon={SquareCheckBig} title="No open tasks" body="Tasks assigned to you will show up here." className="py-8" />
            )}
          </div>
        </Section>

        <Section title="Jump to">
          <div className="grid grid-cols-2 gap-2.5 px-4">
            <QuickTile icon={Hash} label="Channels" detail={`${(channels || []).filter((c) => c.isMember).length} joined`} onClick={() => openChats('channels')} />
            <QuickTile icon={MessageCircle} label="Direct messages" detail={`${(dms || []).length} conversations`} onClick={() => openChats('dms')} />
            {flags.files && <QuickTile icon={FolderOpen} label="Files" detail="Shared in this workspace" onClick={() => nav.push('files')} />}
            {flags.knowledge && <QuickTile icon={BookOpen} label="Knowledge" detail="Pages and handbook" onClick={() => nav.push('knowledge')} />}
            {flags.integrations && <QuickTile icon={Plug} label="Integrations" detail="Apps and webhooks" onClick={() => nav.push('integrations')} />}
            {flags.ai && <QuickTile icon={Sparkles} label="Ask AI" detail="Summaries and drafts" onClick={() => nav.setTab('ai')} />}
          </div>
        </Section>

        {flags.notes && notes?.length > 0 && (
          <Section
            title="Recent notes"
            action={
              <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={() => nav.setTab('notes')}>
                All notes
              </button>
            }
          >
            <div className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
              {notes
                .filter((n) => !n.archived)
                .slice(0, 6)
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => nav.push('note', { id: n.id })}
                    className="pressable flex h-36 w-44 shrink-0 snap-start flex-col overflow-hidden rounded-card border border-line-soft bg-surface p-3.5 text-left"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wider text-accent-ink">{NOTE_TYPES[n.type] || 'Note'}</span>
                    <span className="mt-1 line-clamp-2 shrink-0 text-[14px] font-semibold leading-snug">{n.title}</span>
                    <span className="mt-1 line-clamp-2 min-h-0 text-xs text-text-2">{htmlToText(n.content, 90)}</span>
                    <span className="mt-auto shrink-0 pt-1 text-[11px] text-text-3">{shortAgo(n.updatedAt)}</span>
                  </button>
                ))}
            </div>
          </Section>
        )}

        {mode === 'demo' && (
          <div className="mx-4 mt-8 rounded-card border border-line-soft bg-surface p-4 text-center">
            <p className="text-sm text-text-2">Ready to use your own workspace?</p>
            <Button className="mt-3" size="sm" iconRight={ArrowRight} onClick={() => useSession.getState().signOut()}>
              Sign in to your server
            </Button>
          </div>
        )}
      </Body>
    </Screen>
  );
}
