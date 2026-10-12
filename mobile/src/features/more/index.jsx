// Secondary screens reached from Home, the header and Settings.
import { useEffect, useMemo, useState } from 'react';
import {
  Bell, BookOpen, CheckCheck, ChevronDown, ChevronRight, FileText, FileImage, FileSpreadsheet, File, FolderOpen, Hash, Plug, Search,
  SquareCheckBig, Users, Webhook, KeyRound, Sparkles, ExternalLink, Shield, MessageCircle, Settings2,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import {
  useChannels, useDirectory, useFiles, useIntegrations, useKnowledge, useMembers, useNotes, useNotifications, useTasks,
} from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Chips, SearchField } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Sheet } from '../../ui/Overlay.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown, plainPreview } from '../../ui/Markdown.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { htmlToText } from '../../ui/sanitize.js';
import { openExternal } from '../../native/index.js';
import { useFlag } from '../../config/flags.js';
import { ActivityRow } from '../home/ActivityRow.jsx';
import { TaskRow } from '../tasks/TaskRow.jsx';
import { openConversation } from '../chats/chatsUi.js';
import { askAiAbout } from '../ai/aiUi.js';
import { WorkspaceTile } from '../workspace/WorkspaceTile.jsx';
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
          <EmptyState icon={Bell} title="Nothing here" body="Mentions, direct messages and task updates show up here." />
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

// ---------------------------------------------------------------- Search

const SEARCH_TABS = [
  { value: 'all', label: 'All' },
  { value: 'messages', label: 'Messages' },
  { value: 'channels', label: 'Channels' },
  { value: 'people', label: 'People' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'notes', label: 'Notes' },
];

export function SearchScreen() {
  const ws = useSession((s) => s.workspaceId);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState('all');
  const { data: channels } = useChannels();
  const { data: members } = useMembers();
  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const directory = useDirectory();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const q = debounced.toLowerCase();
  const messages = useQuery(q.length >= 2 && `search:${ws}:${q}`, () => api().searchMessages?.(ws, q) ?? []);
  const results = useMemo(() => {
    if (!q) return null;
    return {
      channels: (channels || []).filter((c) => c.name.includes(q) || c.topic?.toLowerCase().includes(q)),
      people: (members || []).filter((u) => u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)),
      tasks: (tasks || []).filter((t) => t.title.toLowerCase().includes(q)),
      notes: (notes || []).filter((n) => !n.archived && (n.title.toLowerCase().includes(q) || htmlToText(n.content, 3000).toLowerCase().includes(q))),
      messages: messages.data || [],
    };
  }, [q, channels, members, tasks, notes, messages.data]);

  const show = (key) => tab === 'all' || tab === key;
  const limit = tab === 'all' ? 3 : 50;
  const total = results ? Object.values(results).reduce((a, l) => a + l.length, 0) : 0;

  return (
    <Screen>
      <Header title="Search">
        <div className="space-y-2.5 pb-3">
          <div className="px-4">
            <SearchField value={query} onChange={setQuery} placeholder="Messages, channels, people, tasks, notes" autoFocus />
          </div>
          <Chips options={SEARCH_TABS} value={tab} onChange={setTab} />
        </div>
      </Header>
      <Body>
        {!results ? (
          <EmptyState icon={Search} title="Search your workspace" body="Find messages, channels, people, tasks and notes." />
        ) : total === 0 && !messages.loading ? (
          <EmptyState icon={Search} title="No results" body={`Nothing matches “${debounced}”.`} />
        ) : (
          <>
            {show('messages') && (results.messages.length > 0 || messages.loading) && (
              <Section title="Messages">
                <RowGroup>
                  {messages.loading && !results.messages.length ? (
                    <SkeletonRows count={2} />
                  ) : (
                    results.messages.slice(0, limit).map((m) => (
                      <Row
                        key={m.id}
                        leading={<Avatar name={directory[m.authorId]?.name} size="sm" />}
                        title={plainPreview(m.text, 140)}
                        subtitle={`${directory[m.authorId]?.name || 'Someone'} in ${m.convName} · ${shortAgo(m.at)}`}
                        multiline
                        onClick={() => openConversation(m.convKind, m.convId)}
                      />
                    ))
                  )}
                </RowGroup>
              </Section>
            )}
            {show('channels') && results.channels.length > 0 && (
              <Section title="Channels">
                <RowGroup>
                  {results.channels.slice(0, limit).map((c) => (
                    <Row key={c.id} icon={Hash} title={c.name} subtitle={c.topic} onClick={() => openConversation('channel', c.id)} />
                  ))}
                </RowGroup>
              </Section>
            )}
            {show('people') && results.people.length > 0 && (
              <Section title="People">
                <RowGroup>
                  {results.people.slice(0, limit).map((u) => (
                    <Row
                      key={u.id}
                      leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                      title={u.name}
                      subtitle={u.title || u.email}
                      onClick={() => nav.push('profile', { userId: u.id })}
                    />
                  ))}
                </RowGroup>
              </Section>
            )}
            {show('tasks') && results.tasks.length > 0 && (
              <Section title="Tasks">
                <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
                  {results.tasks.slice(0, limit).map((t) => (
                    <TaskRow key={t.id} task={t} directory={directory} compact />
                  ))}
                </div>
              </Section>
            )}
            {show('notes') && results.notes.length > 0 && (
              <Section title="Notes">
                <RowGroup>
                  {results.notes.slice(0, limit).map((n) => (
                    <Row key={n.id} icon={FileText} title={n.title} subtitle={htmlToText(n.content, 90)} onClick={() => nav.push('note', { id: n.id })} />
                  ))}
                </RowGroup>
              </Section>
            )}
          </>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- Knowledge

export function KnowledgeScreen() {
  const { data, loading } = useKnowledge();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});
  const pages = data || [];
  const roots = pages.filter((p) => !p.parentId);
  const children = (id) => pages.filter((p) => p.parentId === id);
  const q = query.trim().toLowerCase();
  const matches = q ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q)) : null;

  const PageRow = ({ page, depth = 0 }) => {
    const kids = children(page.id);
    return (
      <>
        <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
          <button type="button" onClick={() => nav.push('page', { id: page.id })} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
            <span className="text-xl" aria-hidden>
              {page.icon || '📄'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{page.title}</span>
              {page.excerpt && <span className="block truncate text-[13px] text-text-2">{page.excerpt}</span>}
            </span>
          </button>
          {kids.length > 0 && (
            <IconButton
              icon={open[page.id] ? ChevronDown : ChevronRight}
              label={open[page.id] ? 'Collapse' : `Show ${kids.length} sub-pages`}
              size="sm"
              className="mr-2 text-text-2"
              onClick={() => setOpen((o) => ({ ...o, [page.id]: !o[page.id] }))}
            />
          )}
        </div>
        {open[page.id] && kids.map((k) => <PageRow key={k.id} page={k} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <Screen>
      <Header title="Knowledge">
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Find a page" />
        </div>
      </Header>
      <Body onRefresh={() => invalidate('knowledge')}>
        {loading ? (
          <SkeletonRows avatar={false} />
        ) : !pages.length ? (
          <EmptyState icon={BookOpen} title="No pages yet" body="Your team's handbook and docs live here. Create pages in the web app." />
        ) : (
          <div className="mx-4 mt-1 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {(matches || roots).map((p) => (
              <PageRow key={p.id} page={p} />
            ))}
            {matches && !matches.length && <p className="px-4 py-6 text-center text-sm text-text-2">No pages match.</p>}
          </div>
        )}
      </Body>
    </Screen>
  );
}

export function PageScreen({ id }) {
  const { data: page, loading } = useQuery(`page:${id}`, () => api().page(id));
  const aiOn = useFlag('ai');
  return (
    <Screen>
      <Header title={page?.title || ''} />
      <Body>
        {loading || !page ? (
          <SkeletonRows count={4} avatar={false} />
        ) : (
          <article className="px-5">
            <span className="text-4xl" aria-hidden>
              {page.icon || '📄'}
            </span>
            <p className="mt-3 text-xs text-text-3">Updated {shortAgo(page.updatedAt)}</p>
            <Markdown text={page.content || ''} className="mt-3" />
            {aiOn && (
              <Button
                variant="secondary"
                size="sm"
                icon={Sparkles}
                className="mt-6"
                onClick={() => askAiAbout(`Summarize the knowledge page "${page.title}":\n\n${(page.content || '').slice(0, 3000)}`)}
              >
                Summarize with AI
              </Button>
            )}
          </article>
        )}
      </Body>
    </Screen>
  );
}

// ---------------------------------------------------------------- Files

const FILE_ICON = { image: FileImage, sheet: FileSpreadsheet, pdf: FileText, doc: FileText };

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
                icon={FILE_ICON[f.kind] || File}
                tile="accent"
                title={f.name}
                subtitle={[formatSize(f.size), directory[f.owner]?.name, shortAgo(f.at)].filter(Boolean).join(' · ')}
                chevron={false}
                trailing={f.url ? <Icon as={ExternalLink} size="sm" className="text-text-3" /> : null}
                onClick={() => (f.url ? openExternal(f.url) : toast('Opening files in the app arrives in a later update. Use the web client for now.'))}
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

export function WorkspaceScreen() {
  const workspace = useWorkspace();
  const mode = useSession((s) => s.mode);
  const server = useSession((s) => s.server);
  const { data: members, loading } = useMembers();
  const { data: channels } = useChannels();
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
            <Row icon={Bell} title="Notification settings" onClick={() => nav.push('settings.notifications')} />
            <Row icon={Plug} title="Integrations" onClick={() => nav.push('integrations')} />
            <Row icon={SquareCheckBig} title="Tasks" onClick={() => nav.setTab('tasks')} />
            {isAdmin && mode === 'live' && (
              <Row icon={Shield} title="Admin console" subtitle="Members, permissions and audit logs" trailing={<Icon as={ExternalLink} size="sm" className="text-text-3" />} onClick={() => openExternal(`${server}/admin`)} />
            )}
          </RowGroup>
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
