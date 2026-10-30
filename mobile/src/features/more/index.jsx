// Secondary screens reached from Home, the header and Settings.
import { useEffect, useMemo, useState } from 'react';
import {
  Archive, ArchiveRestore, Bell, CalendarDays, CheckCheck, Download, File, FolderOpen, MoreHorizontal, Plug, Share2, Star, StarOff, Trash2,
  SquareCheckBig, Users, Webhook, KeyRound, ExternalLink, Shield, MessageCircle, Settings2, UserPlus,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { TabHeader } from '../../app/TabHeader.jsx';
import { api, useSession, useWorkspace } from '../../data/session.js';
import {
  useChannels, useDirectory, useIntegrations, useMembers, useNotifications, useSharedFiles, useTasks,
} from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, Field, SearchField } from '../../ui/Controls.jsx';
import { BrandLogo } from '../../ui/BrandLogo.jsx';
import { useWebUrl } from '../../data/live/webUrl.js';
import { CalendarView } from './CalendarView.jsx';
import { calendarEvents } from './calendar.js';
import { hasUpcoming, personalReminders, usePersonalReminders } from './personalReminders.js';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { openExternal } from '../../native/index.js';
import { fileIconKind, formatBytes } from '../../lib/files.js';
import { canShareFiles, downloadFile, openFile, shareFile } from '../media/media.js';
import { KIND_CHIPS, SORT_OPTIONS as SHARED_SORTS, fileMarks, messageTarget, toggleFileMark, useFileMarks, whereLabel } from '../files/filesUi.js';
import { FILE_ICONS } from '../media/Attachments.jsx';
import { ActivityRow } from '../home/ActivityRow.jsx';
import { groupActivity } from '../home/activityGroups.js';
import { WorkspaceHero } from '../workspace/WorkspaceHero.jsx';
import { InviteSheet, canInvite } from '../workspace/InviteSheet.jsx';
import { usePlanBlock } from '../plan/plan.js';
import { blockedNote } from '../plan/planText.js';
import { PlanLimitNote } from '../plan/PlanLimitNote.jsx';

// ---------------------------------------------------------------- Notifications

const NOTIF_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'messages', label: 'Messages' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'reviews', label: 'Reviews' },
];

/** The calendar on its own screen (from the workspace drawer, the tab bar drawer and Activity). */
export function CalendarScreen() {
  return (
    <Screen>
      <Header title="Calendar" />
      <Body>
        <CalendarView />
      </Body>
    </Screen>
  );
}

/** The Activity tab: notifications, with the same header as every other tab. */
export function ActivityScreen() {
  return <NotificationsScreen asTab />;
}


/** True when a meeting, task due, reminder or scheduled message is in the next 24 hours. */
function useUpcomingSoon(enabled) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const { data: tasks } = useTasks();
  const upcoming = useQuery(enabled && ws && api().meetingsPage && `calendar:upcoming:${ws}`, () => api().meetingsPage(ws, { status: 'upcoming', limit: 100 }), { staleMs: 60_000 });
  const reminders = useQuery(enabled && ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 60_000 });
  const personal = usePersonalReminders((s) => s.byWs[ws]);
  useEffect(() => {
    if (enabled && ws) personalReminders(ws);
  }, [enabled, ws]);
  return useMemo(() => {
    if (!enabled) return false;
    const events = calendarEvents({ meetings: upcoming.data?.meetings || [], tasks: tasks || [], reminders: reminders.data || [], personal: personal || [], me });
    return hasUpcoming(events);
  }, [enabled, upcoming.data, tasks, reminders.data, personal, me]);
}

/** Notifications. `asTab`: the Activity tab's root; otherwise a pushed screen (older links). */
export function NotificationsScreen({ initial = 'all', asTab = false }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useNotifications();
  const directory = useDirectory();
  const [filter, setFilter] = useState(initial);
  // The Activity tab can show a calendar of meetings, tasks due, reminders and scheduled messages.
  // Opening the Activity tab shows activity; the calendar is one tap away (and opens on the month).
  const [view, setView] = useState('list');
  const pickView = setView;
  const upcomingSoon = useUpcomingSoon(asTab && view === 'list');
  const list = useMemo(() => {
    const all = data || [];
    const shown = (() => {
      switch (filter) {
        case 'unread':
          return all.filter((n) => !n.read);
        case 'mentions':
          return all.filter((n) => n.type === 'mention');
        case 'messages':
          return all.filter((n) => ['dm', 'thread', 'reaction', 'mention'].includes(n.type));
        case 'tasks':
          return all.filter((n) => n.type.startsWith('task'));
        case 'meetings':
          return all.filter((n) => n.type === 'meeting');
        case 'reviews':
          return all.filter((n) => n.type === 'design');
        default:
          return all;
      }
    })();
    // One row per chat ("Ben · 5 new messages"), like Home's Activity.
    return groupActivity(shown);
  }, [data, filter]);
  const unread = (data || []).filter((n) => !n.read).length;

  const markAll = async () => {
    setQueryData(`notifications:${ws}`, (l) => l?.map((n) => ({ ...n, read: true })));
    try {
      await api().markAllNotificationsRead(ws);
      toast('All caught up', 'success');
    } catch (err) {
      toast(err.message || 'Could not mark as read', 'danger');
      invalidate('notifications');
    }
  };

  return (
    <Screen>
      {asTab ? (
        <TabHeader
          title={view === 'calendar' ? 'Calendar' : 'Activity'}
          actions={
            <>
              {view === 'list' && unread > 0 && <IconButton icon={CheckCheck} label="Mark all as read" onClick={markAll} />}
              {/* Calendar and Activity, one tap apart. */}
              <span className="relative">
                <IconButton
                  icon={view === 'calendar' ? Bell : CalendarDays}
                  label={view === 'calendar' ? 'Show activity' : upcomingSoon ? 'Show calendar, something coming up' : 'Show calendar'}
                  data-testid="activity-calendar-toggle"
                  onClick={() => pickView(view === 'calendar' ? 'list' : 'calendar')}
                />
                {view === 'list' && upcomingSoon && (
                  <span className="pointer-events-none absolute top-2 right-2 h-2 w-2 rounded-full bg-gold ring-2 ring-bg" data-testid="calendar-upcoming-dot" />
                )}
              </span>
            </>
          }
        >
          {view === 'list' && <Chips options={NOTIF_FILTERS} value={filter} onChange={setFilter} className="pb-3" />}
        </TabHeader>
      ) : (
        <Header
          title="Notifications"
          subtitle={unread ? `${unread} unread` : 'All caught up'}
          actions={unread > 0 && <IconButton icon={CheckCheck} label="Mark all as read" onClick={markAll} />}
        >
          <Chips options={NOTIF_FILTERS} value={filter} onChange={setFilter} className="pb-3" />
        </Header>
      )}
      <Body tab={asTab ? 'activity' : undefined} onRefresh={() => invalidate('notifications', 'calendar:', 'reminders', 'scheduled:', 'tasks')}>
        {view === 'calendar' ? (
          <CalendarView />
        ) : loading ? (
          <SkeletonRows />
        ) : list.length ? (
          <div className="mx-4 mt-3 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {list.map((n) => (
              <ActivityRow key={n.id} item={n} directory={directory} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title={filter === 'all' ? 'No activity yet' : 'Nothing here'}
            body="Mentions, direct messages, tasks, meetings and design reviews show up here."
          />
        )}
        <div className="mt-6 px-4">
          <Button variant="secondary" size="sm" icon={Settings2} onClick={() => nav.push('settings.notifications')}>
            Notification settings
          </Button>
        </div>
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- Files


const FILE_SOURCES = [
  { value: 'all', label: 'Everywhere' },
  { value: 'starred', label: 'Starred' },
  { value: 'library', label: 'Uploads' },
  { value: 'channels', label: 'Channels' },
  { value: 'dms', label: 'Direct messages' },
  { value: 'archived', label: 'Archived' },
];
// Starred and Archived are kept on this phone; the server is asked for everything.
const LOCAL_SOURCES = new Set(['starred', 'archived']);

/** One file: icon, name (with a star), details, and ⋯ for its actions, all on one centred line. */
function FileRow({ item, starred, onOpen, onMore }) {
  return (
    <div className="flex items-center">
      <button type="button" onClick={onOpen} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left active:bg-surface-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent/12 text-accent-ink">
          <Icon as={FILE_ICONS[fileIconKind(item)] || File} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[15px] text-text">
            <span className="truncate">{item.name}</span>
            {starred && <Icon as={Star} size={12} className="shrink-0 fill-current text-gold" aria-label="Starred" />}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-text-2">
            {[formatBytes(item.size), item.byName, whereLabel(item), shortAgo(item.at)].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      <IconButton icon={MoreHorizontal} label={`More for ${item.name}`} className="mx-1 shrink-0" onClick={onMore} />
    </div>
  );
}

/**
 * Every file shared with the person in this workspace: attachments from their channels,
 * DMs and group DMs, plus files uploaded to the workspace library. Chat files open in the
 * same viewers as in the conversation; uploads open their details (tags, versions, sharing).
 */
export function FilesScreen() {
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(50);
  const [menu, setMenu] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const ws = useSession((st) => st.workspaceId);
  const marks = useFileMarks((st) => st.byWs[ws]) || fileMarks(ws);
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { data, loading, error } = useSharedFiles({ kind, source: LOCAL_SOURCES.has(source) ? 'all' : source, q, sort, limit });
  const all = data?.items || [];
  const items =
    source === 'starred' ? all.filter((i) => marks.starred.includes(i.id))
      : source === 'archived' ? all.filter((i) => marks.archived.includes(i.id))
        : all.filter((i) => !marks.archived.includes(i.id));
  const filtering = Boolean(q) || kind !== 'all' || source !== 'all';
  // Swipe sideways between the files in the list (uploads open their own page instead).
  const swipeable = items.filter((i) => !(i.source === 'library' && i.fileId));

  const open = (item) => {
    if (item.source === 'library' && item.fileId) nav.push('file', { id: item.fileId });
    else openFile(item, swipeable);
  };
  const mark = (kindOf, item) => {
    const on = toggleFileMark(ws, kindOf, item.id);
    toast(kindOf === 'starred' ? (on ? 'Starred' : 'Removed from Starred') : on ? 'Archived. Find it under Archived.' : 'Back in your files', 'success');
  };
  const remove = async () => {
    const item = deleting;
    setDeleting(null);
    try {
      await api().deleteLibraryFile(item.fileId);
      toast(`${item.name} was deleted`, 'success');
      invalidate('files');
    } catch (err) {
      toast(err.message || "Couldn't delete that file", 'danger');
    }
  };
  const goToMessage = (item) => {
    const target = messageTarget(item);
    if (target) nav.push(target.route, target.params, { tab: 'chats' });
  };
  const clear = () => { setQuery(''); setQ(''); setKind('all'); setSource('all'); };

  return (
    <Screen>
      <Header title="Files" subtitle={data ? `${data.total} shared with you` : ''}>
        <div className="px-4 pb-2">
          <SearchField value={query} onChange={setQuery} placeholder="Find a file by name" />
        </div>
        <Chips options={KIND_CHIPS} value={kind} onChange={setKind} className="pb-2" />
        <Chips options={FILE_SOURCES} value={source} onChange={setSource} className="pb-2" />
        <div className="flex items-center justify-end gap-2 px-4 pb-3">
          <label htmlFor="files-sort" className="text-[12px] text-text-2">Sort</label>
          <select
            id="files-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-8 rounded-lg border border-line bg-input px-2 text-[13px] text-text"
          >
            {SHARED_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Header>
      <Body onRefresh={() => invalidate('files')}>
        {loading && !items.length ? (
          <SkeletonRows />
        ) : error && !items.length ? (
          <EmptyState
            icon={FolderOpen}
            title="Couldn't load files"
            body={error.message || 'Check your connection and try again.'}
            action={<Button variant="secondary" size="sm" onClick={() => invalidate('files')}>Try again</Button>}
          />
        ) : items.length ? (
          <>
            <RowGroup className="mt-1">
              {items.map((item) => (
                <FileRow key={item.id} item={item} starred={marks.starred.includes(item.id)} onOpen={() => open(item)} onMore={() => setMenu(item)} />
              ))}
            </RowGroup>
            {data?.hasMore && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="sm" onClick={() => setLimit((n) => Math.min(100, n + 50))} disabled={limit >= 100}>
                  {limit >= 100 ? 'Refine the search to see more' : 'Show more'}
                </Button>
              </div>
            )}
          </>
        ) : source === 'starred' || source === 'archived' ? (
          <EmptyState
            icon={source === 'starred' ? Star : Archive}
            title={source === 'starred' ? 'No starred files' : 'Nothing archived'}
            body={source === 'starred' ? 'Tap ⋯ on a file and Star it to keep it here.' : 'Archive files you’re done with: they leave the list but stay here.'}
          />
        ) : filtering ? (
          <EmptyState
            icon={FolderOpen}
            title="No files match"
            body="Try another name, type or place."
            action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="Nothing shared yet"
            body="Files sent in your channels, direct messages and group chats show up here automatically, with who shared them and where — along with files uploaded to the workspace."
          />
        )}
      </Body>
      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu?.name}
        actions={menu ? [
          { label: 'Open', icon: ExternalLink, onSelect: () => open(menu) },
          menu.messageId && { label: 'Go to message', hint: `In ${whereLabel(menu)}`, icon: MessageCircle, onSelect: () => goToMessage(menu) },
          marks.starred.includes(menu.id)
            ? { label: 'Remove star', icon: StarOff, onSelect: () => mark('starred', menu) }
            : { label: 'Star', icon: Star, onSelect: () => mark('starred', menu) },
          canShareFiles() && { label: 'Share…', icon: Share2, onSelect: () => shareFile(menu) },
          { label: 'Download', icon: Download, onSelect: () => downloadFile(menu) },
          marks.archived.includes(menu.id)
            ? { label: 'Unarchive', icon: ArchiveRestore, onSelect: () => mark('archived', menu) }
            : { label: 'Archive', hint: 'Hide it from the list; it stays under Archived', icon: Archive, onSelect: () => mark('archived', menu) },
          menu.source === 'library' && menu.fileId && { label: 'Delete', hint: 'For everyone in the workspace', icon: Trash2, danger: true, onSelect: () => setDeleting(menu) },
        ] : []}
      />
      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name || 'this file'}?`}
        body="It's removed from the workspace's Files for everyone. Files sent in chats stay in their conversations."
        confirmLabel="Delete"
        danger
        onConfirm={remove}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- Integrations

const FALLBACK_ICON = { webhooks: Webhook, api: KeyRound };

function IntegrationLogo({ item, size = 40 }) {
  return (
    <BrandLogo
      id={item.id}
      size={size}
      fallback={
        <span className="grid shrink-0 place-items-center rounded-[10px] bg-accent/12 text-accent-ink" style={{ width: size, height: size }}>
          <Icon as={FALLBACK_ICON[item.id] || Plug} size="sm" />
        </span>
      }
    />
  );
}

/** Connect (or reconnect) an app with its keys, right on the phone. Admins only. */
function ConnectForm({ item, ws, onDone }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields = (item.form || []).filter((f) => !f.kind || f.kind === 'text' || f.kind === 'secret' || f.kind === 'url' || f.kind === 'email');
  const submit = async (e) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && !String(values[f.key] || '').trim());
    if (missing) return setError(`${missing.label} is needed.`);
    setBusy(true);
    setError('');
    try {
      const config = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
      await api().connectIntegration(ws, item.id, config);
      toast(`${item.name} is connected`, 'success');
      invalidate('integrations');
      onDone();
    } catch (err) {
      setError(err.message || `Couldn't connect ${item.name}`);
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
      {item.setup?.length > 0 && (
        <ol className="list-decimal space-y-1.5 rounded-xl border border-line-soft bg-surface-2 py-3 pl-8 pr-3.5 text-[13px] text-text-2">
          {item.setup.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {fields.map((f) => (
        <Field
          key={f.key}
          label={`${f.label}${f.required ? '' : ' (optional)'}`}
          type={f.secret || f.kind === 'secret' ? 'password' : 'text'}
          value={values[f.key] || ''}
          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          placeholder={f.placeholder}
          hint={f.hint}
          autoCapitalize="none"
          autoComplete="off"
        />
      ))}
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{error}</p>}
      <Button type="submit" block loading={busy} icon={Plug}>
        {item.connected ? 'Update keys' : `Connect ${item.name}`}
      </Button>
    </form>
  );
}

export function IntegrationsScreen() {
  const { data, loading } = useIntegrations();
  const workspace = useWorkspace();
  const ws = useSession((s) => s.workspaceId);
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
  const webBase = useWebUrl(server);
  const isAdmin = ['owner', 'admin'].includes(workspace?.role);
  const [active, setActive] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data || []).filter((it) => !q || `${it.name} ${it.description} ${it.category}`.toLowerCase().includes(q));
    // What's connected first, then each category.
    const map = new Map();
    const on = list.filter((i) => i.connected);
    if (on.length) map.set('Connected', on);
    for (const it of list.filter((i) => !i.connected)) {
      const key = it.category || 'Other apps';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()];
  }, [data, query]);
  const connected = (data || []).filter((i) => i.connected).length;
  const close = () => {
    setActive(null);
    setConnecting(false);
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      await api().disconnectIntegration(ws, active.id);
      toast(`${active.name} was disconnected`, 'success');
      invalidate('integrations');
      close();
    } catch (err) {
      toast(err.message || 'That didn’t work', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Integrations" subtitle={data ? `${connected} connected` : ''} />
      <Body onRefresh={() => invalidate('integrations')}>
        {!loading && (data || []).length > 6 && (
          <div className="px-4 pt-2">
            <SearchField value={query} onChange={setQuery} placeholder="Search apps" />
          </div>
        )}
        {loading ? (
          <SkeletonRows />
        ) : !(data || []).length ? (
          <EmptyState
            icon={Plug}
            title="Integrations are off"
            body={isAdmin ? 'Integrations are switched off for this workspace. Turn them on in Admin → Features.' : 'Integrations are switched off for this workspace. Ask an owner or admin to turn them on.'}
            action={isAdmin ? <Button onClick={() => nav.push('admin.features')}>Open Admin → Features</Button> : null}
          />
        ) : (
          <>
            {!isAdmin && (
              <p className="mx-4 mt-2 rounded-xl border border-line-soft bg-surface px-3.5 py-2.5 text-[13px] text-text-2">
                Owners and admins connect apps for the workspace. Tap one to see what it does.
              </p>
            )}
            {groups.map(([category, items]) => (
              <Section key={category} title={category}>
                <RowGroup>
                  {items.map((it) => (
                    <Row
                      key={it.id}
                      leading={<IntegrationLogo item={it} />}
                      title={it.name}
                      subtitle={it.connected ? it.detail || 'Connected' : it.description}
                      trailing={
                        <span className={cx('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', it.connected ? 'bg-success/12 text-success' : isAdmin ? 'bg-accent/15 text-accent-ink' : 'bg-surface-3 text-text-2')}>
                          {it.connected ? 'On' : isAdmin ? 'Connect' : 'Off'}
                        </span>
                      }
                      onClick={() => setActive(it)}
                    />
                  ))}
                </RowGroup>
              </Section>
            ))}
            {!groups.length && <EmptyState icon={Plug} title="No apps match" body="Try another name." />}
          </>
        )}
      </Body>
      <Sheet open={Boolean(active)} onClose={close}>
        {active && (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3.5">
              <IntegrationLogo item={active} size={48} />
              <div>
                <h2 className="text-lg font-semibold">{active.name}</h2>
                <p className={cx('text-[13px]', active.connected ? 'text-success' : 'text-text-2')}>
                  {active.connected ? `Connected${active.detail ? ` · ${active.detail}` : ''}` : 'Not connected'}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-text-2">{active.description}</p>
            {mode === 'live' && isAdmin && (connecting || !active.connected) && active.form?.length > 0 ? (
              <ConnectForm item={active} ws={ws} onDone={close} />
            ) : (
              !isAdmin && <p className="mt-4 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-3 text-[13px] text-text-2">Ask a workspace owner or admin to connect {active.name}.</p>
            )}
            {mode === 'live' && isAdmin && active.connected && !connecting && (
              <div className="mt-4 space-y-2">
                {active.form?.length > 0 && <Button block variant="secondary" icon={KeyRound} onClick={() => setConnecting(true)}>Update keys</Button>}
                <Button block variant="secondary" className="text-danger" loading={busy} onClick={disconnect}>Disconnect</Button>
              </div>
            )}
            {mode === 'live' && webBase && (
              <Button block variant="ghost" className="mt-2" icon={ExternalLink} onClick={() => openExternal(`${webBase}/settings?tab=integrations`)}>
                Channel routing and more in the web app
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

// ---------------------------------------------------------------- Workspace

export function WorkspaceScreen() {
  const workspace = useWorkspace();
  const mode = useSession((s) => s.mode);
  const { data: members, loading } = useMembers();
  const { data: channels } = useChannels();
  // The free plan's people per workspace (pending invites count too).
  const { plan, blocked: inviteBlocked } = usePlanBlock(workspace?.id, 'members.perWorkspace');
  const [inviting, setInviting] = useState(false);
  if (!workspace) {
    return (
      <Screen>
        <Header title="Workspace" />
        <EmptyState icon={Users} title="No workspace selected" />
      </Screen>
    );
  }
  const isAdmin = ['admin', 'owner'].includes(workspace.role);
  return (
    <Screen>
      <Header title="Workspace" />
      <Body>
        {/* Cover and picture; admins change them right here. */}
        <WorkspaceHero workspace={workspace} editable={mode === 'live' && isAdmin} className="mx-4 mt-2" />
        <div className="flex flex-col items-start px-5 pb-2 text-left">
          <h1 className="mt-3 text-2xl font-bold">{workspace.name}</h1>
          {workspace.profile?.tagline && <p className="mt-1 text-[15px] font-medium">{workspace.profile.tagline}</p>}
          {workspace.description && <p className="mt-1 text-sm text-text-2">{workspace.description}</p>}
          {(workspace.profile?.website || workspace.profile?.location) && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-2">
              {workspace.profile.website && (
                <button type="button" className="text-accent-ink" onClick={() => openExternal(workspace.profile.website)}>
                  {workspace.profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </button>
              )}
              {workspace.profile.location && <span>{workspace.profile.location}</span>}
            </p>
          )}
          <p className="mt-2 text-xs text-text-3">
            {workspace.role ? `${workspace.role.charAt(0).toUpperCase()}${workspace.role.slice(1)}` : 'Member'} · {members?.length ?? workspace.memberCount ?? '–'} members ·{' '}
            {(channels || []).length} channels
          </p>
        </div>
        <Section title="This workspace">
          <RowGroup>
            {mode === 'live' && canInvite(workspace) && (
              <Row
                icon={UserPlus}
                title="Invite people"
                subtitle={inviteBlocked ? 'Free plan limit reached' : 'Share a link or send email invitations'}
                onClick={() => setInviting(true)}
                disabled={inviteBlocked}
              />
            )}
            <Row icon={Bell} title="Notification settings" onClick={() => nav.push('settings.notifications')} />
            <Row icon={Plug} title="Integrations" onClick={() => nav.push('integrations')} />
            <Row icon={SquareCheckBig} title="Tasks" onClick={() => nav.setTab('tasks')} />
            {isAdmin && mode === 'live' && (
              <Row icon={Shield} title="Admin" subtitle="Features, permissions, people and compliance" onClick={() => nav.push('admin')} />
            )}
          </RowGroup>
          {inviteBlocked && canInvite(workspace) && <PlanLimitNote className="mx-4 mt-2">{blockedNote(plan, 'members.perWorkspace')}</PlanLimitNote>}
        </Section>
        <Section title={`Members${members ? ` · ${members.length}` : ''}`}>
          {loading ? (
            <SkeletonRows count={4} />
          ) : (
            <RowGroup>
              {(members || []).slice(0, 30).map((u) => (
                <Row
                  key={u.id}
                  leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                  title={u.name}
                  subtitle={u.title || u.email}
                  trailing={<Icon as={MessageCircle} size="sm" className="text-text-3" />}
                  onClick={() => nav.push('profile', { userId: u.id })}
                />
              ))}
            </RowGroup>
          )}
        </Section>
      </Body>
      <InviteSheet open={inviting} onClose={() => setInviting(false)} workspace={workspace} />
    </Screen>
  );
}
