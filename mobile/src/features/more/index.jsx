// Secondary screens reached from Home, the header and Settings.
import { useEffect, useMemo, useState } from 'react';
import {
  Bell, CheckCheck, Download, File, FolderOpen, MoreHorizontal, Plug,
  SquareCheckBig, Users, Webhook, KeyRound, ExternalLink, Shield, MessageCircle, Settings2, UserPlus,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { TabHeader } from '../../app/TabHeader.jsx';
import { api, useSession, useWorkspace } from '../../data/session.js';
import {
  useChannels, useDirectory, useIntegrations, useMembers, useNotifications, useSharedFiles,
} from '../../data/hooks.js';
import { invalidate, setQueryData } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, SearchField, Segmented } from '../../ui/Controls.jsx';
import { prefs } from '../../native/storage.js';
import { CalendarView } from './CalendarView.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { ActionSheet, Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { openExternal } from '../../native/index.js';
import { fileIconKind, formatBytes, previewKind } from '../../lib/files.js';
import { downloadFile, openFile } from '../media/media.js';
import { KIND_CHIPS, SORT_OPTIONS as SHARED_SORTS, messageTarget, whereLabel } from '../files/filesUi.js';
import { FILE_ICONS } from '../media/Attachments.jsx';
import { ActivityRow } from '../home/ActivityRow.jsx';
import { groupActivity } from '../home/activityGroups.js';
import { WorkspaceTile } from '../workspace/WorkspaceTile.jsx';
import { InviteSheet, canInvite } from '../workspace/InviteSheet.jsx';
import { usePlanBlock } from '../plan/plan.js';
import { blockedNote } from '../plan/planText.js';
import { PlanLimitNote } from '../plan/PlanLimitNote.jsx';
import githubLogo from '../../assets/integrations/github.svg';
import gitlabLogo from '../../assets/integrations/gitlab.svg';
import jiraLogo from '../../assets/integrations/jira.svg';
import zoomLogo from '../../assets/integrations/zoom.svg';

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

/** The Activity tab: notifications, with the same header as every other tab. */
export function ActivityScreen() {
  return <NotificationsScreen asTab />;
}

const ACTIVITY_VIEWS = [
  { value: 'list', label: 'Activity' },
  { value: 'calendar', label: 'Calendar' },
];

/** Notifications. `asTab`: the Activity tab's root; otherwise a pushed screen (older links). */
export function NotificationsScreen({ initial = 'all', asTab = false }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useNotifications();
  const directory = useDirectory();
  const [filter, setFilter] = useState(initial);
  // The Activity tab can show a calendar of meetings, tasks due, reminders and scheduled messages.
  const [view, setView] = useState(() => (asTab ? prefs.get('activity.view', 'list') : 'list'));
  const pickView = (v) => {
    prefs.set('activity.view', v);
    setView(v);
  };
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
        <TabHeader title="Activity" actions={view === 'list' && unread > 0 && <IconButton icon={CheckCheck} label="Mark all as read" onClick={markAll} />}>
          <div className="px-4 pb-2.5">
            <Segmented label="View" value={view} onChange={pickView} options={ACTIVITY_VIEWS} size="sm" />
          </div>
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
  { value: 'library', label: 'Uploads' },
  { value: 'channels', label: 'Channels' },
  { value: 'dms', label: 'Direct messages' },
];

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
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { data, loading, error } = useSharedFiles({ kind, source, q, sort, limit });
  const items = data?.items || [];
  const filtering = Boolean(q) || kind !== 'all' || source !== 'all';
  const media = items.filter((i) => ['image', 'video'].includes(previewKind(i)));

  const open = (item) => {
    if (item.source === 'library' && item.fileId) nav.push('file', { id: item.fileId });
    else openFile(item, media.includes(item) ? media : undefined);
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
                <div key={item.id} className="flex items-center pr-2">
                  <Row
                    className="flex-1"
                    icon={FILE_ICONS[fileIconKind(item)] || File}
                    tile="accent"
                    title={item.name}
                    subtitle={[formatBytes(item.size), item.byName, whereLabel(item), shortAgo(item.at)].filter(Boolean).join(' · ')}
                    chevron={false}
                    onClick={() => open(item)}
                  />
                  <IconButton icon={MoreHorizontal} label={`More for ${item.name}`} onClick={() => setMenu(item)} />
                </div>
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
          { label: 'Download', icon: Download, onSelect: () => downloadFile(menu) },
        ] : []}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- Integrations

const LOGOS = { github: githubLogo, gitlab: gitlabLogo, jira: jiraLogo, zoom: zoomLogo };
const FALLBACK_ICON = { webhooks: Webhook, api: KeyRound };

function IntegrationLogo({ item, size = 40 }) {
  const logo = LOGOS[item.id];
  if (logo) return <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-[10px]" />;
  return (
    <span className="grid shrink-0 place-items-center rounded-[10px] bg-accent/12 text-accent-ink" style={{ width: size, height: size }}>
      <Icon as={FALLBACK_ICON[item.id] || Plug} size="sm" />
    </span>
  );
}

export function IntegrationsScreen() {
  const { data, loading } = useIntegrations();
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
  const [active, setActive] = useState(null);
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of data || []) {
      const key = it.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()];
  }, [data]);
  const connected = (data || []).filter((i) => i.connected).length;

  return (
    <Screen>
      <Header title="Integrations" subtitle={data ? `${connected} connected` : ''} />
      <Body onRefresh={() => invalidate('integrations')}>
        {loading ? (
          <SkeletonRows />
        ) : !groups.length ? (
          <EmptyState icon={Plug} title="No integrations available" body="Your workspace admin can enable integrations in the web app." />
        ) : (
          groups.map(([category, items]) => (
            <Section key={category} title={category}>
              <RowGroup>
                {items.map((it) => (
                  <Row
                    key={it.id}
                    leading={<IntegrationLogo item={it} />}
                    title={it.name}
                    subtitle={it.connected ? it.detail || 'Connected' : it.description}
                    trailing={
                      <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', it.connected ? 'bg-success/12 text-success' : 'bg-surface-3 text-text-2')}>
                        {it.connected ? 'On' : 'Off'}
                      </span>
                    }
                    onClick={() => setActive(it)}
                  />
                ))}
              </RowGroup>
            </Section>
          ))
        )}
      </Body>
      <Sheet open={Boolean(active)} onClose={() => setActive(null)}>
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
            <p className="mt-4 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-3 text-[13px] text-text-2">
              Connecting and configuring apps needs a browser sign-in with the provider, so it happens in the Oruinwan web app.
            </p>
            {mode === 'live' && server && (
              <Button block className="mt-4" icon={ExternalLink} onClick={() => openExternal(`${server}/settings?tab=integrations`)}>
                Manage in the web app
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
        {workspace.profile?.coverUrl && (
          <div className="mx-4 mt-2 h-28 overflow-hidden rounded-card border border-line-soft" data-testid="workspace-cover">
            <img src={workspace.profile.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className={cx('flex flex-col items-center px-6 pb-2 text-center', workspace.profile?.coverUrl && '-mt-9')}>
          <WorkspaceTile workspace={workspace} size={72} className={workspace.profile?.coverUrl ? 'ring-4 ring-[var(--bg)]' : undefined} />
          <h1 className="mt-4 text-2xl font-bold">{workspace.name}</h1>
          {workspace.profile?.tagline && <p className="mt-1 text-[15px] font-medium">{workspace.profile.tagline}</p>}
          {workspace.description && <p className="mt-1 text-sm text-text-2">{workspace.description}</p>}
          {(workspace.profile?.website || workspace.profile?.location) && (
            <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-2">
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
