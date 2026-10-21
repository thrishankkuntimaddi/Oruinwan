// Secondary screens reached from Home, the header and Settings.
import { useMemo, useState } from 'react';
import {
  Bell, CheckCheck, File, FolderOpen, Plug,
  SquareCheckBig, Users, Webhook, KeyRound, ExternalLink, Shield, MessageCircle, Settings2, UserPlus,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import {
  useChannels, useDirectory, useFiles, useIntegrations, useMembers, useNotifications,
} from '../../data/hooks.js';
import { invalidate, setQueryData } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, SearchField } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { openExternal, shareLink } from '../../native/index.js';
import { formatBytes } from '../../lib/files.js';
import { FILE_ICONS } from '../media/Attachments.jsx';
import { ActivityRow } from '../home/ActivityRow.jsx';
import { WorkspaceTile } from '../workspace/WorkspaceTile.jsx';
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

export function NotificationsScreen({ initial = 'all' }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, loading } = useNotifications();
  const directory = useDirectory();
  const [filter, setFilter] = useState(initial);
  const list = useMemo(() => {
    const all = data || [];
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
      <Header
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        actions={unread > 0 && <IconButton icon={CheckCheck} label="Mark all as read" onClick={markAll} />}
      >
        <Chips options={NOTIF_FILTERS} value={filter} onChange={setFilter} className="pb-3" />
      </Header>
      <Body onRefresh={() => invalidate('notifications')}>
        {loading ? (
          <SkeletonRows />
        ) : list.length ? (
          <div className="mx-4 mt-1 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {list.map((n) => (
              <ActivityRow key={n.id} item={n} directory={directory} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Bell} title="Nothing here" body="Mentions, direct messages, tasks, meetings and design reviews show up here." />
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


export function FilesScreen() {
  const { data, loading } = useFiles();
  const directory = useDirectory();
  const [query, setQuery] = useState('');
  const files = (data || []).filter((f) => !query || f.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Screen>
      <Header title="Files">
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search files" />
        </div>
      </Header>
      <Body onRefresh={() => invalidate('files')}>
        {loading ? (
          <SkeletonRows />
        ) : files.length ? (
          <RowGroup className="mt-1">
            {files.map((f) => (
              <Row
                key={f.id}
                icon={FILE_ICONS[f.kind] || File}
                tile="accent"
                title={f.name}
                subtitle={[formatBytes(f.size), directory[f.owner]?.name, shortAgo(f.at)].filter(Boolean).join(' · ')}
                // Details: tags, versions, comments and sharing; Open from there shows the file.
                onClick={() => nav.push('file', { id: f.id })}
              />
            ))}
          </RowGroup>
        ) : (
          <EmptyState icon={FolderOpen} title={query ? 'No files match' : 'No files yet'} body="Files shared in this workspace show up here." />
        )}
      </Body>
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

/** Shares a team invite link through the system share sheet. */
async function invite(workspace) {
  try {
    const url = await api().teamInviteLink(workspace.id);
    if (!url) return toast("Couldn't create an invite link", 'danger');
    const result = await shareLink({ title: `Join ${workspace.name} on Oruinwan`, text: `Join ${workspace.name} on Oruinwan`, url });
    if (result === 'copied') toast('Invite link copied');
  } catch (err) {
    toast(err.message || "Couldn't create an invite link", 'danger');
  }
}

export function WorkspaceScreen() {
  const workspace = useWorkspace();
  const mode = useSession((s) => s.mode);
  const { data: members, loading } = useMembers();
  const { data: channels } = useChannels();
  // The free plan's people per workspace (pending invites count too).
  const { plan, blocked: inviteBlocked } = usePlanBlock(workspace?.id, 'members.perWorkspace');
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
        <div className="flex flex-col items-center px-6 pb-2 text-center">
          <WorkspaceTile workspace={workspace} size={72} />
          <h1 className="mt-4 text-2xl font-bold">{workspace.name}</h1>
          {workspace.description && <p className="mt-1 text-sm text-text-2">{workspace.description}</p>}
          <p className="mt-2 text-xs text-text-3">
            {workspace.role ? `${workspace.role.charAt(0).toUpperCase()}${workspace.role.slice(1)}` : 'Member'} · {members?.length ?? workspace.memberCount ?? '–'} members ·{' '}
            {(channels || []).length} channels
          </p>
        </div>
        <Section title="This workspace">
          <RowGroup>
            {mode === 'live' && isAdmin && (
              <Row
                icon={UserPlus}
                title="Invite people"
                subtitle={inviteBlocked ? 'Free plan limit reached' : 'Share a link to join this workspace'}
                onClick={() => invite(workspace)}
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
          {inviteBlocked && isAdmin && <PlanLimitNote className="mx-4 mt-2">{blockedNote(plan, 'members.perWorkspace')}</PlanLimitNote>}
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
    </Screen>
  );
}
