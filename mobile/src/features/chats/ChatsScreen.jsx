import { useMemo, useState } from 'react';
import { Hash, Lock, Megaphone, BellOff, Search, SquarePen, Compass, MessageCirclePlus } from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav, useIsOpen } from '../../app/nav.js';
import { useChannels, useDms } from '../../data/hooks.js';
import { invalidate } from '../../data/query.js';
import { Body, Screen } from '../../ui/Screen.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Segmented, SearchField } from '../../ui/Controls.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { plainPreview } from '../../ui/Markdown.jsx';
import { useChatsUi, openConversation } from './chatsUi.js';
import { E2eeBanner } from './E2eeBanner.jsx';

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

function UnreadPill({ unread, mentions }) {
  if (mentions) {
    return <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white">@{mentions}</span>;
  }
  if (!unread) return null;
  return <span className="min-w-5 rounded-full bg-gold px-1.5 text-center text-[11px] font-bold leading-5 text-on-accent">{unread > 99 ? '99+' : unread}</span>;
}

function ConversationRow({ kind, item }) {
  const unread = item.unread > 0 && !item.muted;
  const title = kind === 'channel' ? item.name : item.user?.name;
  const selected = useIsOpen('conversation', item.id);
  return (
    <button
      type="button"
      onClick={() => openConversation(kind, item.id)}
      aria-current={selected ? 'true' : undefined}
      className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2', selected && 'bg-surface-2')}
    >
      {kind === 'channel' ? <ChannelTile channel={item} /> : <Avatar name={item.user?.name} src={item.user?.avatarUrl} size="md" presence={item.user?.presence} className="m-0.5" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[15px]', unread ? 'font-semibold text-text' : 'text-text')}>
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

function GroupTitle({ children }) {
  return <h2 className="px-4 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{children}</h2>;
}

export function ChatsScreen() {
  const segment = useChatsUi((s) => s.segment);
  const setSegment = useChatsUi((s) => s.setSegment);
  const [query, setQuery] = useState('');
  const { data: channels, loading: cLoading } = useChannels();
  const { data: dms, loading: dLoading } = useDms();

  const q = query.trim().toLowerCase();
  const joined = useMemo(
    () =>
      (channels || [])
        .filter((c) => c.isMember && (!q || c.name.toLowerCase().includes(q)))
        .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')),
    [channels, q],
  );
  const people = useMemo(() => (dms || []).filter((d) => !q || d.user?.name?.toLowerCase().includes(q)), [dms, q]);
  const notJoined = (channels || []).filter((c) => !c.isMember).length;

  const unreadAll = useMemo(
    () =>
      [
        ...joined.filter((c) => c.unread > 0 && !c.muted).map((c) => ({ kind: 'channel', item: c })),
        ...people.filter((d) => d.unread > 0).map((d) => ({ kind: 'dm', item: d })),
      ].sort((a, b) => (b.item.lastAt || '').localeCompare(a.item.lastAt || '')),
    [joined, people],
  );

  const channelUnread = joined.filter((c) => !c.muted).reduce((a, c) => a + (c.unread || 0), 0);
  const dmUnread = people.reduce((a, d) => a + (d.unread || 0), 0);
  const loading = (cLoading && !channels) || (dLoading && !dms);

  const showChannels = segment !== 'dms';
  const showDms = segment !== 'channels';
  const unreadIds = new Set(unreadAll.map((u) => u.item.id));

  return (
    <Screen>
      <TabHeader
        title="Chats"
        actions={
          <>
            <IconButton icon={Search} label="Search messages" onClick={() => nav.push('search')} />
            <IconButton icon={SquarePen} label="New message" onClick={() => nav.push('newMessage')} />
          </>
        }
      >
        <div className="space-y-2.5 px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Find a channel or person" />
          <Segmented
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'all', label: 'All' },
              { value: 'channels', label: 'Channels', count: channelUnread },
              { value: 'dms', label: 'Direct', count: dmUnread },
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
            {segment === 'all' && unreadAll.length > 0 && !q && (
              <>
                <GroupTitle>Unread</GroupTitle>
                {unreadAll.map(({ kind, item }) => (
                  <ConversationRow key={item.id} kind={kind} item={item} />
                ))}
              </>
            )}
            {showChannels && (
              <>
                <GroupTitle>Channels</GroupTitle>
                {joined
                  .filter((c) => segment !== 'all' || q || !unreadIds.has(c.id))
                  .map((c) => (
                    <ConversationRow key={c.id} kind="channel" item={c} />
                  ))}
                {!joined.length && <p className="px-4 py-3 text-sm text-text-2">{q ? 'No channels match.' : "You haven't joined any channels yet."}</p>}
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
              </>
            )}
            {showDms && (
              <>
                <GroupTitle>Direct messages</GroupTitle>
                {people
                  .filter((d) => segment !== 'all' || q || !unreadIds.has(d.id))
                  .map((d) => (
                    <ConversationRow key={d.id} kind="dm" item={d} />
                  ))}
                {!people.length && q && <p className="px-4 py-3 text-sm text-text-2">No people match.</p>}
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
              </>
            )}
            {!joined.length && !people.length && !q && (
              <EmptyState icon={Hash} title="No conversations yet" body="Join a channel or start a direct message." />
            )}
          </>
        )}
      </Body>
    </Screen>
  );
}
