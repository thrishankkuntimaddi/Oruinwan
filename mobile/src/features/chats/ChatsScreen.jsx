import { useMemo } from 'react';
import { Hash, Lock, Megaphone, BellOff, SquarePen, Compass, MessageCirclePlus, Bot } from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav, useIsOpen } from '../../app/nav.js';
import { useAgents, useChannels, useDms } from '../../data/hooks.js';
import { api, useSession } from '../../data/session.js';
import { toast } from '../../lib/bus.js';
import { invalidate } from '../../data/query.js';
import { Body, Screen } from '../../ui/Screen.jsx';
import { Fab } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Segmented } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { plainPreview } from '../../ui/Markdown.jsx';
import { useChatsUi, openConversation } from './chatsUi.js';
import { E2eeBanner } from './E2eeBanner.jsx';
import { GroupTile } from './groupScreens.jsx';

export function channelGlyph(c) {
  if (c?.broadcast) return Megaphone;
  if (c?.private) return Lock;
  return Hash;
}

export function ChannelTile({ channel, size = 44 }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-text-2"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon as={channelGlyph(channel)} size={size > 40 ? 20 : 16} />
    </span>
  );
}

export function UnreadPill({ unread, mentions }) {
  if (mentions) {
    return <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white">@{mentions}</span>;
  }
  if (!unread) return null;
  return <span className="min-w-5 rounded-full bg-gold px-1.5 text-center text-[11px] font-bold leading-5 text-on-accent">{unread > 99 ? '99+' : unread}</span>;
}

export function ConversationRow({ kind, item }) {
  const unread = item.unread > 0 && !item.muted;
  const title = kind === 'channel' ? item.name : item.user?.name;
  const selected = useIsOpen('conversation', item.id);
  return (
    <button
      type="button"
      onClick={() => openConversation(kind, item.id)}
      aria-current={selected ? 'true' : undefined}
      data-unread={unread ? 'true' : undefined}
      className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2', selected && 'bg-surface-2')}
    >
      {kind === 'channel' ? <ChannelTile channel={item} /> : item.isGroup ? <GroupTile /> : <Avatar name={item.user?.name} src={item.user?.avatarUrl} size="md" presence={item.user?.presence} className="m-0.5" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[15px]', unread ? 'font-bold text-text' : 'text-text')}>
            {title}
          </span>
          {item.lastAt && <span className={cx('shrink-0 text-[11px]', unread ? 'text-accent-ink' : 'text-text-3')}>{shortAgo(item.lastAt)}</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[13px]', unread ? 'text-text-2' : 'text-text-3')}>
            {item.lastText
              ? plainPreview(item.lastText, 90)
              : kind === 'channel'
                ? item.topic || `${item.memberCount} ${item.memberCount === 1 ? 'member' : 'members'}`
                : item.lastAt
                  ? 'Encrypted message'
                  : 'No messages yet'}
          </span>
          {item.muted ? <Icon as={BellOff} size={14} className="shrink-0 text-text-3" aria-label="Muted" /> : <UnreadPill unread={item.unread} mentions={item.mentions} />}
        </span>
      </span>
    </button>
  );
}

function GroupTitle({ children, count }) {
  return (
    <h2 className="flex items-center gap-2 px-4 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-2">
      {children}
      {count > 0 && <span className="font-medium normal-case tracking-normal text-accent-ink">{count} unread</span>}
    </h2>
  );
}

export const isUnread = (c) => c.unread > 0 && !c.muted;

/** Unread conversations first (newest first among them), then the rest by last activity. */
export function sortConversations(list) {
  return [...list].sort((a, b) => Number(isUnread(b)) - Number(isUnread(a)) || (b.lastAt || '').localeCompare(a.lastAt || ''));
}

/**
 * Joined channels, people DMs and agent DMs, each sorted with unread first. Every conversation
 * is in exactly one of them: unread ones are highlighted in place, never moved out of their section.
 */
export function chatSections(channels = [], dms = []) {
  return {
    channels: sortConversations(channels.filter((c) => c.isMember)),
    people: sortConversations(dms.filter((d) => !d.agentId)),
    agentDms: sortConversations(dms.filter((d) => d.agentId)),
  };
}

/** One agent, with its DM's last message and unread count once you've talked to it. */
function AgentRow({ agent, dm, onOpen }) {
  const unread = dm ? isUnread(dm) : false;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2"
      data-testid={`agent-${agent.id}`}
      data-unread={unread ? 'true' : undefined}
    >
      <img src={agent.icon} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[15px]', unread ? 'font-bold' : 'font-medium')}>{agent.name}</span>
          {dm?.lastAt && <span className={cx('shrink-0 text-[11px]', unread ? 'text-accent-ink' : 'text-text-3')}>{shortAgo(dm.lastAt)}</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[13px]', unread ? 'text-text-2' : 'text-text-3')}>
            {dm?.lastText ? plainPreview(dm.lastText, 90) : agent.tagline || agent.maker}
          </span>
          {unread && <UnreadPill unread={dm.unread} />}
        </span>
      </span>
    </button>
  );
}

/** Opens (or starts) the DM with an AI agent. */
export async function chatWithAgent(agent) {
  try {
    const id = await api().openAgentDm(useSession.getState().workspaceId, agent.id);
    invalidate('dms');
    openConversation('dm', id);
  } catch (err) {
    toast(err.message || `Couldn't open ${agent.name}`, 'danger');
  }
}

export function ChatsScreen() {
  const segment = useChatsUi((s) => s.segment);
  const setSegment = useChatsUi((s) => s.setSegment);
  const { data: channels, loading: cLoading } = useChannels();
  const { data: dms, loading: dLoading } = useDms();
  const { data: agents } = useAgents();

  const { channels: joined, people, agentDms } = useMemo(() => chatSections(channels || [], dms || []), [channels, dms]);
  const agentList = useMemo(() => {
    const dmOf = new Map(agentDms.map((d) => [d.agentId, d]));
    const hasUnread = (x) => Number(Boolean(x.dm && isUnread(x.dm)));
    return (agents || []).map((a) => ({ agent: a, dm: dmOf.get(a.id) })).sort((x, y) => hasUnread(y) - hasUnread(x));
  }, [agents, agentDms]);
  const notJoined = (channels || []).filter((c) => !c.isMember).length;

  const sum = (list) => list.filter(isUnread).reduce((a, c) => a + (c.unread || 0), 0);
  const loading = (cLoading && !channels) || (dLoading && !dms);

  const showChannels = segment === 'all' || segment === 'channels';
  const showDms = segment === 'all' || segment === 'dms';
  const showAgents = segment === 'all' || segment === 'agents';

  return (
    <Screen>
      <TabHeader title="Chats">
        <div className="px-4 pb-3">
          <Segmented
            label="Show"
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'all', label: 'All' },
              { value: 'channels', label: 'Channels', count: sum(joined) },
              { value: 'dms', label: 'DMs', count: sum(people) },
              { value: 'agents', label: 'Agents', count: sum(agentDms) },
            ]}
          />
        </div>
      </TabHeader>
      <Body tab="chats" onRefresh={() => invalidate('channels', 'dms')}>
        <E2eeBanner className="mt-1 mb-1" />
        {loading ? (
          <SkeletonRows count={8} />
        ) : (
          <>
            {showChannels && (
              <section aria-label="Channels">
                <GroupTitle count={joined.filter(isUnread).length}>Channels</GroupTitle>
                {joined.map((c) => (
                  <ConversationRow key={c.id} kind="channel" item={c} />
                ))}
                {!joined.length && <p className="px-4 py-3 text-sm text-text-2">You haven&apos;t joined any channels yet.</p>}
                <button
                  type="button"
                  onClick={() => nav.push('browseChannels')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-accent-ink active:bg-surface-2"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-line-strong">
                    <Icon as={Compass} size={18} />
                  </span>
                  <span className="text-[15px] font-medium">Browse channels{notJoined ? ` · ${notJoined} more` : ''}</span>
                </button>
              </section>
            )}
            {showDms && (
              <section aria-label="Direct messages">
                <GroupTitle count={people.filter(isUnread).length}>Direct messages</GroupTitle>
                {people.map((d) => (
                  <ConversationRow key={d.id} kind="dm" item={d} />
                ))}
                <button
                  type="button"
                  onClick={() => nav.push('newMessage')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-accent-ink active:bg-surface-2"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-line-strong">
                    <Icon as={MessageCirclePlus} size={18} />
                  </span>
                  <span className="text-[15px] font-medium">New message</span>
                </button>
              </section>
            )}
            {showAgents && (agentList.length > 0 || segment === 'agents') && (
              <section aria-label="Agents">
                <GroupTitle count={agentDms.filter(isUnread).length}>Agents</GroupTitle>
                {agentList.map(({ agent, dm }) => (
                  <AgentRow key={agent.id} agent={agent} dm={dm} onOpen={() => (dm ? openConversation('dm', dm.id) : chatWithAgent(agent))} />
                ))}
                <button
                  type="button"
                  onClick={() => nav.push('agents')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-accent-ink active:bg-surface-2"
                  data-testid="agents-manage"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-line-strong">
                    <Icon as={Bot} size={18} />
                  </span>
                  <span className="text-[15px] font-medium">Connect an agent</span>
                </button>
              </section>
            )}
            {!joined.length && !people.length && segment === 'all' && (
              <EmptyState icon={Hash} title="No conversations yet" body="Join a channel or start a direct message." />
            )}
          </>
        )}
      </Body>
      <Fab icon={SquarePen} label="New message" onClick={() => nav.push('newMessage')} />
    </Screen>
  );
}
