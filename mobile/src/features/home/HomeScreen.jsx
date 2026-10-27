// Home: a greeting, a row of small cards for what needs you (unread, open tasks, huddles, saved,
// drafts, scheduled, sent, Ask AI), the latest activity (5), your active tasks (3), Quick jump
// (up to 5 places you choose), Jump to (every part of the workspace) and recent notes.
import { useMemo, useRef, useState } from 'react';
import {
  Bookmark, BookOpen, Check, ChevronRight, Clock3, Download, FileText, FolderOpen, Hash, Headphones, Lock, Megaphone, MessageCircle, PenLine, Plug, Send, Sparkles,
  SquareCheckBig, UserPlus, Users, Workflow, Pin,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useChannels, useDirectory, useDms, useNotes, useNotifications, useTasks, useUnreadCounts } from '../../data/hooks.js';
import { invalidate, useQuery } from '../../data/query.js';
import { useFlags } from '../../config/flags.js';
import { remoteSnapshot } from '../../config/remote.js';
import { useUpdate } from '../../update/updater.js';
import { Body, Screen } from '../../ui/Screen.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Segmented } from '../../ui/Controls.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { cx } from '../../ui/cx.js';
import { greeting, dueLabel, shortAgo } from '../../lib/time.js';
import { htmlToText } from '../../ui/sanitize.js';
import { openChats, openConversation } from '../chats/chatsUi.js';
import { PushPrompt } from '../push/PushPrompt.jsx';
import { useHuddlesAvailable } from '../huddles/HuddlesScreen.jsx';
import { useHuddle } from '../huddles/huddle.js';
import { ActivityRow } from './ActivityRow.jsx';
import { groupActivity } from './activityGroups.js';
import { TaskRow } from '../tasks/TaskRow.jsx';
import { draftsIn, useDrafts } from '../chats/drafts.js';
import { MAX_PINS, RECENT_IN_ROW, quickJumpItems, setQuickJump, togglePin, useQuickJump } from './quickJump.js';
import { toast } from '../../lib/bus.js';

import { InviteSheet, canInvite } from '../workspace/InviteSheet.jsx';

/** The most recent conversations, channels and DMs mixed, newest first. */
export function recentConversations(channels = [], dms = [], count = 5) {
  return [
    ...channels.filter((c) => c.isMember && c.lastAt).map((c) => ({ kind: 'channel', item: c })),
    ...dms.filter((d) => d.lastAt).map((d) => ({ kind: 'dm', item: d })),
  ]
    .sort((a, b) => String(b.item.lastAt).localeCompare(String(a.item.lastAt)))
    .slice(0, count);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One small card in the row at the top: icon, count, label. */
function MiniCard({ icon, label, value, detail, highlight, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      className="pressable flex w-[118px] shrink-0 snap-start flex-col rounded-card border border-line-soft bg-surface px-3 py-2.5 text-left"
      style={{ backgroundImage: 'var(--glass)' }}
    >
      <span className="flex items-center gap-1.5">
        <span className={cx('grid h-7 w-7 place-items-center rounded-lg', highlight ? 'bg-gold text-on-accent' : 'bg-accent/12 text-accent-ink')}>
          <Icon as={icon} size={14} />
        </span>
        <span className="text-[20px] font-bold leading-none tabular-nums">{value}</span>
      </span>
      <span className="mt-1.5 block truncate text-[12px] font-medium">{label}</span>
      {detail && <span className="block truncate text-[11px] text-text-2">{detail}</span>}
    </button>
  );
}

function SectionHead({ title, action, onAction }) {
  return (
    <div className="flex items-baseline justify-between px-4 pt-6 pb-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-2">{title}</h2>
      {action && (
        <button type="button" onClick={onAction} className="text-[13px] font-medium text-accent-ink">
          {action}
        </button>
      )}
    </div>
  );
}

const PLACES = {
  files: { label: 'Files', icon: FolderOpen, open: () => nav.push('files') },
  knowledge: { label: 'Knowledge', icon: BookOpen, open: () => nav.push('knowledge') },
  huddles: { label: 'Huddles', icon: Headphones, open: () => nav.push('huddles') },
  tasks: { label: 'Tasks', icon: SquareCheckBig, open: () => nav.setTab('tasks') },
  notes: { label: 'Notes', icon: FileText, open: () => nav.setTab('notes') },
  automations: { label: 'Automations', icon: Workflow, open: () => nav.push('automations') },
  ai: { label: 'Oruinwan AI', icon: Sparkles, open: () => nav.openAi() },
};

/** A Quick jump bubble: a person, a group, a channel or a place. Long-press pins or unpins it. */
function QuickBubble({ entry, channels, dms }) {
  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  let label = '';
  let visual = null;
  let open = null;
  let unread = false;
  if (entry.kind === 'place') {
    const p = PLACES[entry.id];
    if (!p) return null;
    label = p.label;
    visual = (
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line-soft bg-surface text-accent-ink">
        <Icon as={p.icon} size={20} />
      </span>
    );
    open = p.open;
  } else {
    const item = entry.kind === 'channel' ? channels.find((c) => c.id === entry.id) : dms.find((d) => d.id === entry.id);
    if (!item) return null;
    unread = item.unread > 0 && !item.muted;
    label = entry.kind === 'channel' ? `#${item.name}` : item.user?.name?.split(' ')[0] || 'Chat';
    visual =
      entry.kind === 'channel' || item.isGroup ? (
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface-2 text-text-2">
          <Icon as={item.isGroup ? Users : item.private ? Lock : Hash} size={18} />
        </span>
      ) : (
        <Avatar name={item.user?.name} src={item.user?.avatarUrl} size="lg" presence={item.user?.presence} />
      );
    open = () => openConversation(entry.kind, item.id);
  }
  const pin = () => {
    const result = togglePin(entry);
    toast(result === 'full' ? `You can pin up to ${MAX_PINS}. Unpin one first.` : result === 'pinned' ? `Pinned ${label}` : `Unpinned ${label}`, result === 'full' ? 'danger' : 'success');
  };
  const startPress = () => {
    longPressed.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      pin();
    }, 500);
  };
  const endPress = () => clearTimeout(pressTimer.current);
  return (
    <button
      type="button"
      onClick={() => (longPressed.current ? (longPressed.current = false) : open?.())}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label}${entry.pinned ? ', pinned' : ''}. Long-press to ${entry.pinned ? 'unpin' : 'pin'}`}
      className="pressable relative flex w-[64px] shrink-0 snap-start flex-col items-center gap-1.5"
      data-testid="quick-jump-item"
    >
      {visual}
      {unread && <span className="absolute top-0 right-2 h-3 w-3 rounded-full bg-gold ring-2 ring-bg" aria-label="Unread" />}
      {entry.pinned && (
        <span className="absolute top-0 left-1 grid h-4 w-4 place-items-center rounded-full bg-surface text-accent-ink ring-1 ring-line" aria-hidden data-testid="quick-jump-pin">
          <Icon as={Pin} size={10} />
        </span>
      )}
      <span className="w-full truncate text-center text-[11px] text-text-2">{label}</span>
    </button>
  );
}

function QuickJumpEditor({ open, onClose, channels, dms, current }) {
  const [picked, setPicked] = useState(current);
  const key = (x) => `${x.kind}:${x.id}`;
  const has = (x) => picked.some((p) => key(p) === key(x));
  const toggle = (x) => setPicked((p) => (has(x) ? p.filter((y) => key(y) !== key(x)) : p.length < MAX_PINS ? [...p, x] : p));
  const options = [
    ...Object.entries(PLACES).map(([id, p]) => ({ kind: 'place', id, label: p.label, icon: p.icon })),
    ...channels.filter((c) => c.isMember).map((c) => ({ kind: 'channel', id: c.id, label: `#${c.name}`, icon: c.private ? Lock : Hash })),
    ...dms.filter((d) => !d.agentId).map((d) => ({ kind: 'dm', id: d.id, label: d.user?.name || d.name, icon: d.isGroup ? Users : MessageCircle })),
  ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Pinned · ${picked.length}/${MAX_PINS}`}
      full
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => (setQuickJump(null), onClose())}>
            Clear pins
          </Button>
          <Button className="flex-1" onClick={() => (setQuickJump(picked), onClose())} data-testid="quick-jump-save">
            Save
          </Button>
        </div>
      }
    >
      <p className="px-5 pb-2 text-[13px] text-text-2">Pinned places stay first in Quick jump; your latest chats follow. Pin up to {MAX_PINS} (or long-press a bubble).</p>
      <ul className="px-2 pb-2">
        {options.map((o) => (
          <li key={key(o)}>
            <button type="button" onClick={() => toggle(o)} aria-pressed={has(o)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2">
              <Icon as={o.icon} size={18} className="text-text-2" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{o.label}</span>
              <span className={cx('grid h-6 w-6 place-items-center rounded-full border', has(o) ? 'border-accent bg-gold text-on-accent' : 'border-line-strong')}>
                {has(o) && <Icon as={Check} size={14} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** A Jump to tile: icon, name and a line of detail (2 per row). */
function JumpTile({ icon, label, detail, onClick }) {
  return (
    <button type="button" onClick={onClick} className="pressable flex items-center gap-3 rounded-card border border-line-soft bg-surface px-3 py-3 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-ink">
        <Icon as={icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium">{label}</span>
        <span className="block truncate text-[12px] text-text-2">{detail}</span>
      </span>
    </button>
  );
}

const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'dms', label: 'DMs' },
];

export function HomeScreen() {
  const user = useSession((s) => s.user);
  const ws = useSession((s) => s.workspaceId);
  const flags = useFlags((s) => s.flags);
  const huddlesOn = useHuddlesAvailable();
  const liveCount = useHuddle((s) => Object.keys(s.live).length);
  const unread = useUnreadCounts();
  const directory = useDirectory();
  const { data: tasks } = useTasks();
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const { data: notes } = useNotes();
  const { data: notifications } = useNotifications();
  const update = useUpdate((s) => (s.status === 'available' ? s.manifest : null));
  const announcement = remoteSnapshot().announcement;
  const allDrafts = useDrafts((s) => s.all);
  const customQuick = useQuickJump((s) => s.items);
  const [activityFilter, setActivityFilter] = useState('all');
  const [editingQuick, setEditingQuick] = useState(false);
  const workspace = useWorkspace();
  const mode = useSession((s) => s.mode);
  const [inviting, setInviting] = useState(false);

  // Same cache keys as the Saved, Huddles and Drafts & sent screens, so opening them is instant.
  const saved = useQuery(ws && `saved:${ws}`, () => api().savedMessages(ws), { staleMs: 60_000 });
  const reminders = useQuery(ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 60_000 });
  const upcoming = useQuery(huddlesOn && ws && `meetingpage:${ws}:upcoming:`, () => api().meetingsPage(ws, { status: 'upcoming', q: '' }), { staleMs: 60_000 });
  const scheduled = useQuery(api().scheduledMessages && ws && `scheduled:${ws}`, () => api().scheduledMessages(ws), { staleMs: 60_000 });

  const myOpen = useMemo(() => (tasks || []).filter((t) => t.assigneeIds.includes(user?.id) && !['done', 'cancelled'].includes(t.status)), [tasks, user?.id]);
  const activeTasks = useMemo(
    () =>
      [...myOpen]
        .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || String(a.due || '9').localeCompare(String(b.due || '9')))
        .slice(0, 3),
    [myOpen],
  );
  const overdue = myOpen.filter((t) => dueLabel(t.due)?.tone === 'overdue').length;
  const dueToday = myOpen.filter((t) => dueLabel(t.due)?.tone === 'today').length;
  const unreadConvs = useMemo(
    () => (channels || []).filter((c) => c.isMember && c.unread > 0 && !c.muted).length + (dms || []).filter((d) => d.unread > 0).length,
    [channels, dms],
  );
  const recent = useMemo(() => recentConversations(channels || [], dms || [], RECENT_IN_ROW), [channels, dms]);
  const quick = quickJumpItems(customQuick, recent);
  const activity = useMemo(() => {
    const all = notifications || [];
    const shown = activityFilter === 'mentions' ? all.filter((n) => n.type === 'mention') : activityFilter === 'dms' ? all.filter((n) => ['dm', 'thread', 'reaction'].includes(n.type)) : all;
    return groupActivity(shown).slice(0, 5);
  }, [notifications, activityFilter]);
  const recentNotes = useMemo(() => [...(notes || [])].filter((n) => !n.archived).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 6), [notes]);

  const upcomingCount = upcoming.data?.meetings?.length || 0;
  const savedCount = saved.data?.length || 0;
  const reminderCount = reminders.data?.length || 0;
  const draftCount = draftsIn(allDrafts, ws).length;
  const scheduledCount = scheduled.data?.length || 0;
  const firstName = (user?.name || '').split(' ')[0];
  const unreadMessages = unread.channels + unread.dms;
  const joined = (channels || []).filter((c) => c.isMember).length;
  const people = (dms || []).filter((d) => !d.agentId).length;

  const refresh = () => {
    invalidate('tasks', 'channels', 'dms', 'saved:', 'reminders', 'meetingpage:', 'notifications', 'notes', 'scheduled:');
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
        <p className="px-4 pt-0.5 text-[14px] text-text-2">
          {unreadMessages ? `${plural(unreadMessages, 'unread message')} in ${plural(unreadConvs, 'conversation')}` : overdue ? `${plural(overdue, 'task')} overdue` : 'You’re all caught up.'}
        </p>

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

        <div className="no-scrollbar mt-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1" aria-label="At a glance">
          <MiniCard testId="home-unread" icon={MessageCircle} label="Unread" value={unreadMessages} highlight={unreadMessages > 0} detail={unreadConvs ? `in ${plural(unreadConvs, 'conversation')}` : 'Nothing new'} onClick={() => nav.push('unread')} />
          <MiniCard testId="home-tasks" icon={SquareCheckBig} label="My open tasks" value={myOpen.length} highlight={overdue > 0} detail={overdue ? `${overdue} overdue` : dueToday ? `${dueToday} due today` : 'Nothing due today'} onClick={() => nav.setTab('tasks')} />
          {huddlesOn && (
            <MiniCard testId="home-huddles" icon={Headphones} label="Huddles" value={liveCount || upcomingCount} highlight={liveCount > 0} detail={liveCount ? 'live now' : upcomingCount ? 'upcoming' : 'None scheduled'} onClick={() => nav.push('huddles')} />
          )}
          <MiniCard testId="home-saved" icon={Bookmark} label="Saved" value={savedCount} detail={reminderCount ? plural(reminderCount, 'reminder') : 'No reminders'} onClick={() => nav.push('saved', reminderCount && !savedCount ? { tab: 'reminders' } : {})} />
          <MiniCard testId="home-drafts" icon={PenLine} label="Drafts" value={draftCount} detail="Unsent messages" onClick={() => nav.push('outgoing', { tab: 'drafts' })} />
          <MiniCard testId="home-scheduled" icon={Clock3} label="Scheduled" value={scheduledCount} detail="Send later" onClick={() => nav.push('outgoing', { tab: 'scheduled' })} />
          <MiniCard testId="home-sent" icon={Send} label="Sent" value="›" detail="Your messages" onClick={() => nav.push('outgoing', { tab: 'sent' })} />
          {mode === 'live' && canInvite(workspace) && (
            <MiniCard testId="home-invite" icon={UserPlus} label="Invite" value="+" detail="Add people to the team" onClick={() => setInviting(true)} />
          )}
          {flags.ai && <MiniCard testId="home-ai" icon={Sparkles} label="Ask AI" value="✦" detail="Draft or catch up" onClick={() => nav.openAi()} />}
        </div>

        <SectionHead title="Activity" action="View all" onAction={() => nav.setTab('activity')} />
        <div className="px-4">
          <Segmented label="Activity" value={activityFilter} onChange={setActivityFilter} options={ACTIVITY_FILTERS} size="sm" />
        </div>
        {activity.length ? (
          <div className="mx-4 mt-2 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {activity.map((n) => (
              <ActivityRow key={n.id} item={n} directory={directory} />
            ))}
          </div>
        ) : (
          <p className="mx-4 mt-2 rounded-card border border-dashed border-line px-4 py-4 text-center text-[13px] text-text-2">Nothing new here.</p>
        )}

        {activeTasks.length > 0 && (
          <>
            <SectionHead title="Your tasks" action="See all" onAction={() => nav.setTab('tasks')} />
            <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
              {activeTasks.map((t) => (
                <TaskRow key={t.id} task={t} directory={directory} compact />
              ))}
            </div>
          </>
        )}

        <SectionHead title="Quick jump" action="Pins" onAction={() => setEditingQuick(true)} />
        {/* Sideways: pins first, then the latest conversations. */}
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-1" data-testid="quick-jump">
          {quick.map((e) => (
            <QuickBubble key={`${e.kind}:${e.id}`} entry={e} channels={channels || []} dms={dms || []} />
          ))}
          {(customQuick?.length || 0) < MAX_PINS && (
            <button type="button" onClick={() => setEditingQuick(true)} className="pressable flex w-[64px] shrink-0 flex-col items-center gap-1.5" data-testid="quick-jump-add">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-line-strong text-text-2">
                <Icon as={Pin} size={18} />
              </span>
              <span className="text-[11px] text-text-2">Pin</span>
            </button>
          )}
        </div>

        <SectionHead title="Jump to" />
        <div className="grid grid-cols-2 gap-2 px-4">
          <JumpTile icon={Hash} label="Channels" detail={`${joined} joined`} onClick={() => openChats('channels')} />
          <JumpTile icon={MessageCircle} label="Direct messages" detail={plural(people, 'conversation')} onClick={() => openChats('dms')} />
          {flags.files && <JumpTile icon={FolderOpen} label="Files" detail="Shared in this workspace" onClick={() => nav.push('files')} />}
          {flags.knowledge && <JumpTile icon={BookOpen} label="Knowledge" detail="Pages and handbook" onClick={() => nav.push('knowledge')} />}
          {flags.integrations && <JumpTile icon={Plug} label="Integrations" detail="Apps and webhooks" onClick={() => nav.push('integrations')} />}
          {huddlesOn && <JumpTile icon={Headphones} label="Huddles" detail="Voice calls and meetings" onClick={() => nav.push('huddles')} />}
          <JumpTile icon={Workflow} label="Automations" detail="Rules, runs and history" onClick={() => nav.push('automations')} />
          {flags.ai && <JumpTile icon={Sparkles} label="Ask AI" detail="Your AI chats and history" onClick={() => nav.openAi()} />}
        </div>

        {recentNotes.length > 0 && (
          <>
            <SectionHead title="Recent notes" action="All notes" onAction={() => nav.setTab('notes')} />
            <div className="no-scrollbar flex snap-x gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-2">
              {recentNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => nav.push('note', { id: n.id }, { tab: 'notes' })}
                  className="pressable flex h-[128px] w-[150px] shrink-0 snap-start flex-col rounded-card border border-line-soft bg-surface p-3 text-left"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-ink">{n.type === 'meeting' ? 'Meeting' : 'Document'}</span>
                  <span className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug">{n.title || 'Untitled'}</span>
                  <span className="mt-1 line-clamp-2 text-[12px] text-text-2">{htmlToText(n.content, 80)}</span>
                  <span className="mt-auto text-[11px] text-text-3">{shortAgo(n.updatedAt)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Body>
      <QuickJumpEditor key={editingQuick ? 'open' : 'closed'} open={editingQuick} onClose={() => setEditingQuick(false)} channels={channels || []} dms={dms || []} current={customQuick || []} />
      <InviteSheet open={inviting} onClose={() => setInviting(false)} workspace={workspace} />
    </Screen>
  );
}

