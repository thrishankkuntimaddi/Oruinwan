// In-place search under a tab's header. What you're looking at comes first (Chats → chats,
// people to start a conversation with, channels to join; Tasks → tasks; Notes → notes;
// Activity → activity), then a few results from elsewhere, then "See all results", which opens
// the full workspace search (features/search/SearchScreen.jsx) with the same words.
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileText, Hash, Search, UserPlus } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useAgents, useChannels, useDirectory, useDms, useMembers, useNotes, useNotifications, useTasks } from '../../data/hooks.js';
import { invalidate, useQuery } from '../../data/query.js';
import { useE2ee } from '../../data/e2ee.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { EmptyState, Spinner } from '../../ui/Feedback.jsx';
import { plainPreview } from '../../ui/Markdown.jsx';
import { htmlToText } from '../../ui/sanitize.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { matchMessage, parseSearchQuery } from '../../lib/searchQuery.js';
import { personMatchRank, searchPeople, wordStartMatch } from '../../lib/peopleSearch.js';
import { ChannelTile, chatWithAgent } from '../chats/ChatsScreen.jsx';
import { allChats, chatListFor, useConversationPrefs } from '../chats/chatList.js';
import { openConversation } from '../chats/chatsUi.js';
import { TaskRow } from '../tasks/TaskRow.jsx';
import { ActivityRow } from '../home/ActivityRow.jsx';

/** Section order per tab: its own results first. */
export const ORDER = {
  chats: ['chats', 'start', 'join', 'messages'],
  tasks: ['tasks', 'chats', 'notes', 'start'],
  notes: ['notes', 'tasks', 'chats'],
  activity: ['activity', 'chats', 'tasks', 'notes'],
  home: ['chats', 'start', 'tasks', 'notes', 'messages'],
};

const TITLES = {
  chats: 'Chats',
  start: 'Start a conversation',
  join: 'Channels you can join',
  messages: 'Messages',
  tasks: 'Tasks',
  notes: 'Notes',
  activity: 'Activity',
};

const PLACEHOLDER = {
  chats: 'Search chats and people',
  tasks: 'Search tasks',
  notes: 'Search notes',
  activity: 'Search activity',
  home: 'Search your workspace',
};
export const placeholderFor = (context) => PLACEHOLDER[context] || PLACEHOLDER.home;

const words = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
const allWords = (hay, q) => {
  const h = String(hay || '').toLowerCase();
  return words(q).every((w) => h.includes(w));
};

/** Chats matching the query: by channel, group or person name (word starts). */
export function matchChats(rows, query) {
  if (!query.trim()) return [];
  return chatListFor(rows, 'all')
    .concat(rows.filter((r) => r.archivedAt))
    .filter((r) => {
      if (r.kind === 'channel') return wordStartMatch(`${r.item.name} ${r.item.topic || ''}`, query);
      if (r.item.isGroup) return wordStartMatch(r.item.name || r.item.user?.name, query) || (r.item.members || []).some((m) => personMatchRank(m, query) >= 0);
      return personMatchRank(r.item.user || {}, query) >= 0;
    });
}

/** People without a 1:1 DM yet, matching the query (Start a conversation). */
export function peopleToStart(members, dms, me, query) {
  if (!query.trim()) return [];
  const talked = new Set((dms || []).filter((d) => !d.isGroup && !d.agentId).map((d) => d.user?.id));
  return searchPeople((members || []).filter((u) => u.id !== me && !talked.has(u.id) && !u.bot && !u.deactivated), query);
}

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function QuickSearch({ context = 'home', query, onClose }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const e2ee = useE2ee((s) => s.status);
  const order = ORDER[context] || ORDER.home;
  const wants = (k) => order.includes(k);
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const { data: members } = useMembers();
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const { data: notifications } = useNotifications();
  const directory = useDirectory();
  const prefs = useConversationPrefs();
  const [opening, setOpening] = useState(null);
  const q = query.trim();
  const debounced = useDebounced(q);

  const wantMessages = wants('messages') && debounced.length >= 2 && e2ee === 'ready' && api().searchMessages;
  const messages = useQuery(wantMessages && `qsearch:${ws}:${debounced.toLowerCase()}`, () => {
    const parsed = parseSearchQuery(debounced);
    const ctx = { usernameOf: (id) => directory[id]?.username, nameOf: (id) => directory[id]?.name };
    return api().searchMessages(ws, (m, conv) => matchMessage(m, conv, parsed, ctx));
  });

  const results = useMemo(() => {
    const rows = allChats(channels || [], dms || [], prefs);
    const talkedAgents = new Set((dms || []).filter((d) => d.agentId).map((d) => d.agentId));
    return {
      chats: matchChats(rows, q),
      agents: q ? (agents || []).filter((a) => !talkedAgents.has(a.id) && wordStartMatch(a.name, q)) : [],
      start: peopleToStart(members, dms, me, q),
      join: q ? (channels || []).filter((c) => !c.isMember && wordStartMatch(`${c.name} ${c.topic || ''}`, q)) : [],
      tasks: q ? (tasks || []).filter((t) => allWords(`${t.title} ${t.issueKey || ''} ${t.description || ''}`, q)) : [],
      notes: q ? (notes || []).filter((n) => !n.archived && allWords(`${n.title} ${htmlToText(n.content, 3000)}`, q)) : [],
      activity: q ? (notifications || []).filter((n) => allWords(`${n.title || ''} ${n.text || ''} ${n.body || ''} ${n.actorName || ''}`, q)) : [],
      messages: wantMessages ? messages.data || [] : [],
    };
  }, [channels, dms, prefs, agents, members, me, q, tasks, notes, notifications, wantMessages, messages.data]);

  const startDm = async (u) => {
    setOpening(u.id);
    try {
      const id = await api().openDm(ws, u.id);
      invalidate('dms');
      onClose();
      openConversation('dm', id);
    } catch (err) {
      toast(err.message || 'Could not open the conversation', 'danger');
    } finally {
      setOpening(null);
    }
  };
  const go = (fn) => () => {
    onClose();
    fn();
  };

  if (!q) {
    return (
      <div className="px-6 pt-10 text-center text-[14px] text-text-2" data-testid="quick-search-hint">
        <Icon as={Search} size={28} className="mx-auto mb-3 text-text-3" />
        {context === 'chats'
          ? 'Type a name to find a chat, start a conversation or find a message.'
          : context === 'tasks'
            ? 'Find a task by title or key (like ORU-12), then anything else in the workspace.'
            : context === 'notes'
              ? 'Find a note by its title or what’s in it.'
              : 'Find chats, people, tasks and notes.'}
      </div>
    );
  }

  const limit = (k) => (k === order[0] ? 8 : 4);
  const sections = order
    .map((k) => {
      const list = results[k] || [];
      if (k === 'chats' && !list.length && !results.agents.length) return null;
      if (k === 'messages' && !list.length && !messages.loading) return null;
      if (k !== 'chats' && k !== 'messages' && !list.length) return null;
      return k;
    })
    .filter(Boolean);
  const nothing = !sections.length && !messages.loading;

  return (
    <div className="pb-6" data-testid="quick-search">
      {nothing && <EmptyState icon={Search} title={`Nothing here matches “${q}”`} body="Try fewer letters, or search everything." />}
      {sections.map((k) => (
        <Section key={k} title={TITLES[k]}>
          {k === 'chats' && (
            <div className="overflow-hidden">
              {results.chats.slice(0, limit(k)).map((row) => (
                // Same path as message results: close the search, then open the chat, in one tap
                // handler (no long-press or capture tricks that a phone's tap could miss).
                <Row
                  key={row.key}
                  leading={
                    row.kind === 'channel' ? (
                      <ChannelTile channel={row.item} size={36} />
                    ) : (
                      <Avatar name={row.item.user?.name || row.item.name} src={row.item.user?.avatarUrl} size="sm" presence={row.item.isGroup ? undefined : row.item.user?.presence} />
                    )
                  }
                  title={row.kind === 'channel' ? `#${row.item.name}` : row.item.user?.name || row.item.name || 'Chat'}
                  subtitle={row.item.lastText ? plainPreview(row.item.lastText, 80) : row.kind === 'channel' ? 'Channel' : row.item.isGroup ? 'Group' : 'Direct message'}
                  data-testid={`qs-chat-${row.key}`}
                  onClick={go(() => openConversation(row.kind, row.item.id))}
                />
              ))}
              {results.agents.slice(0, 3).map((a) => (
                <Row key={a.id} leading={<img src={a.icon} alt="" className="h-9 w-9 rounded-xl" />} title={a.name} subtitle="Agent · start a chat" onClick={go(() => chatWithAgent(a))} />
              ))}
            </div>
          )}
          {k === 'start' && (
            <RowGroup>
              {results.start.slice(0, limit(k)).map((u) => (
                <Row
                  key={u.id}
                  leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                  title={u.name}
                  subtitle={u.title || (u.username ? `@${u.username}` : 'No messages yet')}
                  trailing={opening === u.id ? <Spinner className="text-text-2" /> : <Icon as={UserPlus} size={16} className="text-accent-ink" />}
                  chevron={false}
                  onClick={() => startDm(u)}
                />
              ))}
            </RowGroup>
          )}
          {k === 'join' && (
            <RowGroup>
              {results.join.slice(0, limit(k)).map((c) => (
                <Row key={c.id} leading={<ChannelTile channel={c} size={36} />} title={c.name} subtitle={`${c.memberCount} members${c.topic ? ` · ${c.topic}` : ''}`} onClick={go(() => openConversation('channel', c.id))} />
              ))}
            </RowGroup>
          )}
          {k === 'messages' && (
            <RowGroup>
              {messages.loading && !results.messages.length ? (
                <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-text-2">
                  <Spinner /> Searching messages on this device…
                </div>
              ) : (
                results.messages.slice(0, limit(k)).map((m) => (
                  <Row
                    key={m.id}
                    leading={<Avatar name={directory[m.authorId]?.name} src={directory[m.authorId]?.avatarUrl} size="sm" />}
                    title={plainPreview(m.text, 120) || 'Message'}
                    subtitle={`${directory[m.authorId]?.name || 'Someone'} in ${m.convName} · ${shortAgo(m.at)}`}
                    multiline
                    onClick={go(() =>
                      m.parentId ? nav.push('thread', { kind: m.convKind, convId: m.convId, messageId: m.parentId }, { tab: 'chats' }) : openConversation(m.convKind, m.convId, { highlight: m.id }),
                    )}
                  />
                ))
              )}
            </RowGroup>
          )}
          {k === 'tasks' && (
            <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft" onClick={onClose}>
              {results.tasks.slice(0, limit(k)).map((t) => (
                <TaskRow key={t.id} task={t} directory={directory} compact />
              ))}
            </div>
          )}
          {k === 'notes' && (
            <RowGroup>
              {results.notes.slice(0, limit(k)).map((n) => (
                <Row key={n.id} icon={FileText} title={n.title} subtitle={htmlToText(n.content, 90)} onClick={go(() => nav.push('note', { id: n.id }, { tab: 'notes' }))} />
              ))}
            </RowGroup>
          )}
          {k === 'activity' && (
            <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft" onClick={onClose}>
              {results.activity.slice(0, limit(k)).map((n) => (
                <ActivityRow key={n.id} item={n} directory={directory} />
              ))}
            </div>
          )}
        </Section>
      ))}
      <div className="mx-4 mt-5">
        <button
          type="button"
          onClick={go(() => nav.push('search', { q }))}
          className="pressable flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left"
          data-testid="quick-search-all"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-ink">
            <Icon as={Hash} size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">See all results</span>
            <span className="block truncate text-[12px] text-text-2">Messages, pages, files and more for “{q}”</span>
          </span>
          <Icon as={ArrowRight} size={16} className="text-text-3" />
        </button>
      </div>
    </div>
  );
}
