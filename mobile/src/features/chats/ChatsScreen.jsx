// Chats: one list of channels, DMs, groups and agents, newest first (features/chats/chatList.js).
// All / Channels / DMs / Agents filter it; nothing is split into sections. Long-press (or
// right-click) a chat for pin, mark as read, mute, archive and delete.
import { useMemo, useState } from 'react';
import { clearUnreadLocally } from '../../data/unread.js';
import {
  Archive, ArchiveRestore, Bell, BellOff, Bot, Check, CheckCheck, ListChecks, Compass, Hash, Info, KeyRound, Lock, LogOut, Megaphone, MessageCirclePlus, Pin, PinOff, SquarePen, Trash2, UserRound,
} from 'lucide-react';
import { TabHeader } from '../../app/TabHeader.jsx';
import { nav, useIsOpen } from '../../app/nav.js';
import { useAgents, useChannels, useDirectory, useDms } from '../../data/hooks.js';
import { api, useSession } from '../../data/session.js';
import { toast } from '../../lib/bus.js';
import { invalidate, setQueryData } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, Fab } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { StandingTag } from '../../ui/StandingTag.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Field, Segmented } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet, useOverlay } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { chatListTime } from '../../lib/time.js';
import { plainPreview } from '../../ui/Markdown.jsx';
import { useChatsUi, openConversation } from './chatsUi.js';
import { E2eeBanner } from './E2eeBanner.jsx';
import { GroupTile } from './groupScreens.jsx';
import { useLongPress } from './messages.jsx';
import { useConversationStatus } from './ConversationMenu.jsx';
import {
  allChats, archivedChats, chatListFor, isUnreadRow, previewText, segmentCounts, setChatPref, useConversationPrefs,
} from './chatList.js';

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

export const isUnread = (c) => c.unread > 0 && !c.muted;

/** Unread conversations first (newest first among them), then the rest by last activity. */
export function sortConversations(list) {
  return [...list].sort((a, b) => Number(isUnread(b)) - Number(isUnread(a)) || (b.lastAt || '').localeCompare(a.lastAt || ''));
}

/** Joined channels, people DMs and agent DMs (the Unread screen groups by these). */
export function chatSections(channels = [], dms = []) {
  return {
    channels: sortConversations(channels.filter((c) => c.isMember)),
    // A 1:1 DM nobody has written in yet isn't a conversation: it stays out of the list.
    people: sortConversations(dms.filter((d) => !d.agentId && (d.isGroup || !d.noMessages || d.unread > 0))),
    agentDms: sortConversations(dms.filter((d) => d.agentId)),
  };
}

function ChatAvatar({ row, agentIcon }) {
  const { kind, item } = row;
  if (kind === 'channel') return <ChannelTile channel={item} />;
  if (item.isGroup) return <GroupTile />;
  if (item.agentId && agentIcon) return <img src={agentIcon} alt="" className="h-11 w-11 shrink-0 rounded-xl" />;
  return <Avatar name={item.user?.name} src={item.user?.avatarUrl} size="md" presence={item.user?.presence} className="m-0.5" />;
}

const titleOf = (row) => (row.kind === 'channel' ? row.item.name : row.item.user?.name || row.item.name || 'Conversation');

/** One chat: picture, name and time on top; last message and unread count below. */
export function ChatRow({ row, agentIcon, onMenu, selecting = false, checked = false, onToggle }) {
  const { kind, item } = row;
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const unread = isUnreadRow(row);
  const selected = useIsOpen('conversation', item.id);
  // A 1:1 DM with someone who left or was removed: their name stays, with a tag.
  const person = kind === 'dm' && !item.isGroup && item.user?.id ? directory[item.user.id] : null;
  const press = useLongPress(() => onMenu?.(row));
  return (
    <button
      type="button"
      onClick={() => (selecting ? onToggle?.(row) : openConversation(kind, item.id))}
      {...(onMenu && !selecting ? press : {})}
      aria-current={selected ? 'true' : undefined}
      aria-pressed={selecting ? checked : undefined}
      data-unread={unread ? 'true' : undefined}
      data-testid={`chat-${row.key}`}
      className={cx('flex w-full select-none items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2', (selected || checked) && 'bg-surface-2')}
    >
      {selecting && (
        <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2', checked ? 'border-accent bg-gold text-on-accent' : 'border-line-strong')} aria-hidden>
          {checked && <Icon as={Check} size={14} strokeWidth={3} />}
        </span>
      )}
      <ChatAvatar row={row} agentIcon={agentIcon} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[15px]', unread ? 'font-bold text-text' : 'font-medium text-text')}>
            {kind === 'channel' && <span className="text-text-3">#</span>}
            {titleOf(row)}
          </span>
          <StandingTag person={person} />
          {item.lastAt && <span className={cx('shrink-0 text-[11px]', unread ? 'font-semibold text-accent-ink' : 'text-text-3')}>{chatListTime(item.lastAt)}</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cx('min-w-0 flex-1 truncate text-[13px]', unread ? 'text-text-2' : 'text-text-3')}>
            {previewText(row, me, (t) => plainPreview(t, 90))}
          </span>
          {row.pinnedAt && <Icon as={Pin} size={13} className="shrink-0 rotate-45 text-text-3" aria-label="Pinned" />}
          {item.muted ? <Icon as={BellOff} size={14} className="shrink-0 text-text-3" aria-label="Muted" /> : <UnreadPill unread={item.unread} mentions={item.mentions} />}
        </span>
      </span>
    </button>
  );
}

/** Older callers (Unread screen) pass one conversation. */
export function ConversationRow({ kind, item }) {
  return <ChatRow row={{ kind, item, key: `${kind}:${item.id}`, pinnedAt: null, archivedAt: null }} />;
}

function markReadLocally(row) {
  clearUnreadLocally(row.kind, row.item.id);
}

/** The long-press menu of a chat. */
function ChatMenu({ row, prefs, onClose, onSelectMode }) {
  const kind = row?.kind;
  const item = row?.item;
  const { muted } = useConversationStatus(kind || 'channel', item?.id, item);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!row && !confirm) return null;
  const conv = row ? { kind, id: item.id } : null;
  const ws = useSession.getState().workspaceId;

  const toggleMute = async () => {
    try {
      if (kind === 'channel') await api().setChannelMuted(item.id, !muted);
      else await api().setDmMuted(item.id, !muted);
      invalidate(kind === 'channel' ? `channelPolicy:${item.id}` : `dmStatus:${item.id}`, 'channels', 'dms');
      toast(muted ? 'Notifications on' : 'Muted');
    } catch (err) {
      toast(err.message || 'Could not change notifications', 'danger');
    }
  };
  const markRead = async () => {
    markReadLocally(row);
    try {
      await api().markRead(conv);
    } catch {
      invalidate('channels', 'dms');
    }
  };

  const actions = row
    ? [
        onSelectMode && { label: 'Select chats', icon: ListChecks, hint: 'Archive, mute, delete or message several at once', onSelect: () => onSelectMode(row) },
        { label: row.pinnedAt ? 'Unpin' : 'Pin to top', icon: row.pinnedAt ? PinOff : Pin, hint: row.pinnedAt ? null : 'Up to 3 chats stay at the top', onSelect: () => setChatPref(conv, { pinned: !row.pinnedAt }, prefs) },
        isUnreadRow(row) && { label: 'Mark as read', icon: CheckCheck, onSelect: markRead },
        !item.agentId && { label: muted ? 'Unmute notifications' : 'Mute notifications', icon: muted ? Bell : BellOff, onSelect: toggleMute },
        {
          label: row.archivedAt ? 'Unarchive' : 'Archive',
          icon: row.archivedAt ? ArchiveRestore : Archive,
          onSelect: async () => {
            if (await setChatPref(conv, { archived: !row.archivedAt }, prefs)) toast(row.archivedAt ? 'Moved back to Chats' : 'Archived');
          },
        },
        kind === 'channel'
          ? { label: 'Channel details', icon: Info, onSelect: () => nav.push('channelInfo', { id: item.id }, { tab: 'chats' }) }
          : item.isGroup
            ? { label: 'Group details', icon: Info, onSelect: () => nav.push('groupInfo', { id: item.id }, { tab: 'chats' }) }
            : !item.agentId && item.user?.id && { label: 'View profile', icon: UserRound, onSelect: () => nav.push('profile', { userId: item.user.id }, { tab: 'chats' }) },
        kind === 'channel'
          ? !item.isDefault && { label: 'Leave channel', icon: LogOut, danger: true, onSelect: () => setConfirm({ row, what: 'leave' }) }
          : item.isGroup
            ? { label: 'Leave group', icon: LogOut, danger: true, onSelect: () => setConfirm({ row, what: 'leaveGroup' }) }
            : { label: 'Delete chat', icon: Trash2, danger: true, onSelect: () => setConfirm({ row, what: 'delete' }) },
      ]
    : [];

  const run = async () => {
    const { row: r, what } = confirm;
    setBusy(true);
    try {
      if (what === 'leave') await api().leaveChannel(r.item.id);
      else if (what === 'leaveGroup') await api().leaveGroupDm(r.item.id);
      else await api().deleteDm(r.item.id);
      const key = r.kind === 'channel' ? `channels:${ws}` : `dms:${ws}`;
      setQueryData(key, (list) => (what === 'leave' ? list?.map((c) => (c.id === r.item.id ? { ...c, isMember: false } : c)) : list?.filter((c) => c.id !== r.item.id)));
      invalidate(r.kind === 'channel' ? 'channels' : 'dms');
      toast(what === 'delete' ? 'Chat deleted' : 'You left');
      setConfirm(null);
    } catch (err) {
      toast(err.message || 'That didn’t work', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const name = confirm ? titleOf(confirm.row) : '';
  return (
    <>
      <ActionSheet open={Boolean(row)} onClose={onClose} title={row ? (kind === 'channel' ? `#${titleOf(row)}` : titleOf(row)) : ''} actions={actions} />
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.what === 'delete' ? `Delete chat with ${name}?` : confirm?.what === 'leave' ? `Leave #${name}?` : `Leave ${name}?`}
        body={
          confirm?.what === 'delete'
            ? 'It is removed from your list and cleared for you. They keep their copy; a new message brings the chat back.'
            : confirm?.what === 'leave'
              ? 'You stop getting its messages. You can join again from Browse channels if it is public.'
              : 'You stop getting messages from this group. Someone in it can add you back.'
        }
        confirmLabel={confirm?.what === 'delete' ? 'Delete' : 'Leave'}
        danger
        busy={busy}
        onConfirm={run}
      />
    </>
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

function FooterLink({ icon, round, label, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-accent-ink active:bg-surface-2">
      <span className={cx('grid h-11 w-11 place-items-center border border-dashed border-line-strong', round ? 'rounded-full' : 'rounded-xl')}>
        <Icon as={icon} size={18} />
      </span>
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}

/** Agents you haven't talked to yet (Agents filter only): tap to start. */
function AgentStarter({ agent }) {
  return (
    <button type="button" onClick={() => chatWithAgent(agent)} data-testid={`agent-${agent.id}`} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
      <img src={agent.icon} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{agent.name}</span>
        <span className="block truncate text-[13px] text-text-3">{agent.tagline || agent.maker}</span>
      </span>
      <span className="shrink-0 text-[12px] font-medium text-accent-ink">Start</span>
    </button>
  );
}

export function ChatsScreen() {
  const segment = useChatsUi((s) => s.segment);
  const setSegment = useChatsUi((s) => s.setSegment);
  const { data: channels, loading: cLoading } = useChannels();
  const { data: dms, loading: dLoading } = useDms();
  const { data: agents } = useAgents();
  const prefs = useConversationPrefs();
  const [menu, setMenu] = useState(null);
  // Selecting several chats (long-press → Select chats): row keys.
  const [picked, setPicked] = useState(null);
  const selecting = picked !== null;
  const togglePick = (row) =>
    setPicked((p) => {
      const next = new Set(p || []);
      if (next.has(row.key)) next.delete(row.key);
      else next.add(row.key);
      return next;
    });

  const rows = useMemo(() => allChats(channels || [], dms || [], prefs), [channels, dms, prefs]);
  const list = useMemo(() => chatListFor(rows, segment), [rows, segment]);
  const archived = useMemo(() => archivedChats(rows), [rows]);
  const counts = useMemo(() => segmentCounts(rows), [rows]);
  const agentIcons = useMemo(() => new Map((agents || []).map((a) => [a.id, a.icon])), [agents]);
  const unstarted = useMemo(() => {
    const talked = new Set((dms || []).filter((d) => d.agentId).map((d) => d.agentId));
    return (agents || []).filter((a) => !talked.has(a.id));
  }, [agents, dms]);
  const notJoined = (channels || []).filter((c) => !c.isMember).length;
  const archivedUnread = archived.filter(isUnreadRow).length;
  const loading = (cLoading && !channels) || (dLoading && !dms);

  return (
    <Screen>
      <TabHeader title="Chats">
        <div className="px-4 pb-3">
          <Segmented
            label="Show"
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'channels', label: 'Channels', count: counts.channels },
              { value: 'dms', label: 'DMs', count: counts.dms },
              { value: 'agents', label: 'Agents', count: counts.agents },
            ]}
          />
        </div>
      </TabHeader>
      <Body tab="chats" onRefresh={() => invalidate('channels', 'dms', 'convPrefs')}>
        <E2eeBanner className="mt-1 mb-1" />
        {loading ? (
          <SkeletonRows count={8} />
        ) : (
          <>
            <div role="list" aria-label="Chats" className="pt-1">
              {list.map((row) => (
                <div role="listitem" key={row.key}>
                  <ChatRow
                    row={row}
                    agentIcon={agentIcons.get(row.item.agentId)}
                    onMenu={setMenu}
                    selecting={selecting}
                    checked={Boolean(picked?.has(row.key))}
                    onToggle={togglePick}
                  />
                </div>
              ))}
            </div>
            {segment === 'agents' && unstarted.map((a) => <AgentStarter key={a.id} agent={a} />)}
            {!list.length && segment !== 'agents' && (
              <EmptyState
                icon={segment === 'channels' ? Hash : MessageCirclePlus}
                title={segment === 'channels' ? 'No channels yet' : segment === 'dms' ? 'No direct messages yet' : 'No conversations yet'}
                body={segment === 'channels' ? 'Browse the workspace’s channels or create one.' : 'Start a conversation with someone in this workspace.'}
              />
            )}
            {archived.length > 0 && segment === 'all' && (
              <button
                type="button"
                onClick={() => nav.push('archivedChats')}
                className="mt-1 flex w-full items-center gap-3 border-t border-line-soft px-4 py-3 text-left active:bg-surface-2"
                data-testid="archived-chats"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-2">
                  <Icon as={Archive} size={18} />
                </span>
                <span className="flex-1 text-[15px] font-medium">Archived</span>
                <span className="text-[13px] text-text-3">{archivedUnread ? `${archivedUnread} unread · ` : ''}{archived.length}</span>
              </button>
            )}
            <div className="mt-2 border-t border-line-soft pt-1">
              {(segment === 'all' || segment === 'channels') && (
                <FooterLink icon={Compass} label={`Browse channels${notJoined ? ` · ${notJoined} more` : ''}`} onClick={() => nav.push('browseChannels')} />
              )}
              {segment === 'dms' && <FooterLink icon={MessageCirclePlus} round label="New message" onClick={() => nav.push('newMessage')} />}
              {segment === 'agents' && (
                <FooterLink icon={KeyRound} label="Connect your own agent" testId="agents-manage" onClick={() => nav.push('agents', { connect: true })} />
              )}
              {segment === 'agents' && !agents?.length && <EmptyState icon={Bot} title="No agents yet" body="Connect an agent with your own key to chat with it here." />}
            </div>
          </>
        )}
      </Body>
      {selecting ? (
        <SelectionBar rows={list.filter((r) => picked.has(r.key))} prefs={prefs} onDone={() => setPicked(null)} onAll={() => setPicked(new Set(list.map((r) => r.key)))} />
      ) : (
        <Fab compact icon={SquarePen} label="New message" onClick={() => nav.push('newMessage')} />
      )}
      <ChatMenu row={menu} prefs={prefs} onClose={() => setMenu(null)} onSelectMode={(row) => setPicked(new Set([row.key]))} />
    </Screen>
  );
}

/**
 * Several chats at once: mark read, mute, archive, delete (DMs) or leave (channels, groups), or
 * send one message to all of them (each encrypted for its own conversation).
 */
function SelectionBar({ rows, prefs, onDone, onAll }) {
  const [confirm, setConfirm] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useOverlay(true, onDone);
  const n = rows.length;
  const each = async (fn, done) => {
    setBusy(true);
    let failed = 0;
    for (const r of rows) {
      try {
        await fn(r);
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    invalidate('channels', 'dms', 'convPrefs');
    toast(failed ? `${done}, but ${failed} didn’t work` : done, failed ? 'warning' : 'success');
    onDone();
  };
  const conv = (r) => ({ kind: r.kind, id: r.item.id });
  const markRead = () => each(async (r) => (markReadLocally(r), api().markRead(conv(r))), 'Marked as read');
  const mute = () => each((r) => (r.kind === 'channel' ? api().setChannelMuted(r.item.id, true) : api().setDmMuted(r.item.id, true)), 'Muted');
  const archive = () => each((r) => setChatPref(conv(r), { archived: true }, prefs), 'Archived');
  const remove = () =>
    each((r) => {
      if (r.kind === 'channel') return r.item.isDefault ? Promise.reject(new Error('default')) : api().leaveChannel(r.item.id);
      if (r.item.isGroup) return api().leaveGroupDm(r.item.id);
      return api().deleteDm(r.item.id);
    }, 'Done');
  const send = () => each((r) => api().sendMessage(conv(r), text.trim(), { clientTempId: `multi-${Date.now()}-${r.item.id}` }), `Sent to ${n} chat${n === 1 ? '' : 's'}`);
  const Action = ({ icon, label, onClick, danger }) => (
    <button type="button" disabled={!n || busy} onClick={onClick} className={cx('flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium disabled:opacity-40 active:bg-surface-2', danger ? 'text-danger' : 'text-text')}>
      <Icon as={icon} size={20} />
      {label}
    </button>
  );
  return (
    <>
      <div className="glass-strong absolute inset-x-3 z-20 rounded-2xl border px-2 pt-2 pb-1.5 shadow-xl" style={{ bottom: 'calc(var(--sab) + 72px)' }} data-testid="chat-selection">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[14px] font-semibold">{n} selected</span>
          <span className="flex gap-3">
            <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={onAll}>Select all</button>
            <button type="button" className="text-[13px] font-medium text-text-2" onClick={onDone}>Cancel</button>
          </span>
        </div>
        <div className="flex">
          <Action icon={SquarePen} label="Message" onClick={() => setWriting(true)} />
          <Action icon={CheckCheck} label="Read" onClick={markRead} />
          <Action icon={BellOff} label="Mute" onClick={mute} />
          <Action icon={Archive} label="Archive" onClick={archive} />
          <Action icon={Trash2} label="Delete" danger onClick={() => setConfirm(true)} />
        </div>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete or leave ${n} chat${n === 1 ? '' : 's'}?`}
        body="Direct messages are deleted for you. You leave channels and groups (default channels stay)."
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => (setConfirm(false), remove())}
      />
      <Sheet
        open={writing}
        onClose={() => setWriting(false)}
        title={`Message ${n} chat${n === 1 ? '' : 's'}`}
        footer={<Button block loading={busy} disabled={!text.trim()} onClick={() => (setWriting(false), send())}>Send to {n}</Button>}
      >
        <div className="px-5 pb-4">
          <Field multiline rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write once, sent to each chat separately" autoFocus />
          <p className="mt-2 text-[12px] text-text-2">Each chat gets its own copy, end-to-end encrypted for that conversation.</p>
        </div>
      </Sheet>
    </>
  );
}

/** Archived chats: same rows; long-press to unarchive. */
export function ArchivedChatsScreen() {
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  const { data: agents } = useAgents();
  const prefs = useConversationPrefs();
  const [menu, setMenu] = useState(null);
  const rows = useMemo(() => archivedChats(allChats(channels || [], dms || [], prefs)), [channels, dms, prefs]);
  const agentIcons = useMemo(() => new Map((agents || []).map((a) => [a.id, a.icon])), [agents]);
  return (
    <Screen>
      <Header title="Archived" subtitle="Long-press a chat to move it back" />
      <Body>
        {rows.length ? (
          rows.map((row) => <ChatRow key={row.key} row={row} agentIcon={agentIcons.get(row.item.agentId)} onMenu={setMenu} />)
        ) : (
          <EmptyState icon={Archive} title="Nothing archived" body="Long-press a chat in Chats and choose Archive to move it here." />
        )}
      </Body>
      <ChatMenu row={menu} prefs={prefs} onClose={() => setMenu(null)} />
    </Screen>
  );
}
