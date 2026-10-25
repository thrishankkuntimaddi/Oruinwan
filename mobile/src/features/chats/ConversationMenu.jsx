// The ⋮ menu of a conversation and the sheets it opens: search in the conversation, pinned,
// threads, reminders, saved messages, channel members, mute, block, clear and delete. The same
// tools as the web client's chat header, on the same server APIs.
import { useState } from 'react';
import {
  Ban, BarChart3, Bell, BellOff, BellRing, Bookmark, BookmarkX, CircleCheck, Eraser, Headphones, Info, MessagesSquare, Phone, Pin, PinOff, Search, Trash2, UserRound, Users, Video,
} from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useDirectory } from '../../data/hooks.js';
import { useFlag } from '../../config/flags.js';
import { nav } from '../../app/nav.js';
import { toast } from '../../lib/bus.js';
import { clock, dayLabel, shortAgo } from '../../lib/time.js';
import { reminderLabel } from '../../lib/reminders.js';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { Chips, SearchField } from '../../ui/Controls.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Row, RowGroup } from '../../ui/List.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { useHuddlesAvailable } from '../huddles/HuddlesScreen.jsx';
import { startHuddle } from '../huddles/huddle.js';
import { MessageCard } from './SavedScreen.jsx';
import { conversationMenuItems, matchExcerpt, searchConversation } from './conversationMenu.js';

const ICONS = {
  huddle: Headphones,
  voice: Phone,
  video: Video,
  poll: BarChart3,
  search: Search,
  threads: MessagesSquare,
  reminders: BellRing,
  pinned: Pin,
  saved: Bookmark,
  channelInfo: Info,
  members: Users,
  groupInfo: Users,
  profile: UserRound,
  clear: Eraser,
  delete: Trash2,
};

const PRESENCE_TEXT = { active: 'Active', online: 'Active', away: 'Away', dnd: 'Do not disturb', offline: 'Offline' };

/**
 * Mute and block state of a conversation. Channels: muted from the channel list (and the
 * channel's settings). DMs: GET /v2/dm/:id/status, as on the web.
 */
export function useConversationStatus(kind, id, meta) {
  const isDm = kind === 'dm' && !meta?.agentId;
  const { data: dm } = useQuery(isDm && id && api().dmStatus && `dmStatus:${id}`, () => api().dmStatus(id), { staleMs: 60_000 });
  const { data: policy } = useQuery(kind === 'channel' && id && api().channelPolicy && `channelPolicy:${id}`, () => api().channelPolicy(id), { staleMs: 5 * 60_000 });
  const muted = kind === 'channel' ? Boolean(policy?.muted ?? meta?.muted) : Boolean(dm?.muted);
  return { muted, blocked: Boolean(dm?.blocked), blockedByOther: Boolean(dm?.blockedByOther) };
}

function MessageRows({ list, conv, directory, onOpen, meta, action, empty }) {
  if (!list) return <SkeletonRows count={4} />;
  if (!list.length) return empty;
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
      {list.map((item) => {
        // Saved and reminder entries wrap their message (null when it's gone); pins and threads are messages.
        const m = item && 'message' in item ? item.message : item;
        return <MessageCard key={item.id || m?.id} m={m} conv={conv} convName={meta?.(item) || ''} directory={directory} onOpen={(x) => x && onOpen(x)} action={action?.(item)} />;
      })}
    </div>
  );
}

function SearchSheet({ open, onClose, items, directory, onJump }) {
  const [q, setQ] = useState('');
  const results = searchConversation(items, q);
  return (
    <Sheet open={open} onClose={onClose} title="Search in conversation" full>
      <div className="px-4 pb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search messages" autoFocus />
        <p className="mt-2 text-[12px] text-text-3">Messages are end-to-end encrypted, so this searches the ones loaded on this device.</p>
      </div>
      {q.trim() && !results.length ? (
        <EmptyState icon={Search} title="No matches" body="Try another word." />
      ) : (
        <div className="px-2 pb-3">
          {results.map((m) => {
            const author = m.author || directory[m.authorId] || { name: 'Someone' };
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onClose();
                  onJump(m);
                }}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left active:bg-surface-2"
              >
                <Avatar name={author.name} src={author.avatarUrl} size="sm" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[14px] font-semibold">{author.name}</span>
                    <span className="shrink-0 text-[11px] text-text-3">{shortAgo(m.at)}</span>
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-snug break-words text-text-2">{matchExcerpt(m.text, q)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function PinnedSheet({ open, onClose, conv, directory, onJump }) {
  const { data, error } = useQuery(open && api().pinnedMessages && `pinned:${conv.id}`, () => api().pinnedMessages(conv), { staleMs: 10_000 });
  const unpin = async (m) => {
    setQueryData(`pinned:${conv.id}`, (list) => list?.filter((x) => x.id !== m.id));
    try {
      await api().togglePin(conv, m.id);
      invalidate(`messages:${conv.id}`);
      toast('Unpinned');
    } catch (err) {
      toast(err.message || 'Could not unpin', 'danger');
      invalidate(`pinned:${conv.id}`);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Pinned messages" full>
      {error && !data ? (
        <EmptyState icon={Pin} title="Couldn't load" body={error.message} />
      ) : (
        <MessageRows
          list={data}
          conv={conv}
          directory={directory}
          meta={(m) => (m.at ? `${dayLabel(m.at)} · ${clock(m.at)}` : '')}
          onOpen={(m) => {
            onClose();
            onJump(m);
          }}
          action={(m) => (
            <button type="button" aria-label="Unpin" onClick={() => unpin(m)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={PinOff} size={17} />
            </button>
          )}
          empty={<EmptyState icon={Pin} title="Nothing pinned" body="Long-press a message and choose Pin to conversation." />}
        />
      )}
    </Sheet>
  );
}

function ThreadsSheet({ open, onClose, conv, directory }) {
  const { data, error } = useQuery(open && api().channelThreads && `threads:${conv.id}`, () => api().channelThreads(conv.id), { staleMs: 10_000 });
  // All threads here, or only the ones I follow (with unread replies first in the line).
  const [filter, setFilter] = useState('all');
  const list = data && filter === 'following' ? data.filter((m) => m.following) : data;
  const unread = (data || []).reduce((n, m) => n + (m.following ? m.unread || 0 : 0), 0);
  const openThread = (m) => {
    onClose();
    if (m.unread) setQueryData(`threads:${conv.id}`, (l) => l?.map((t) => (t.id === m.id ? { ...t, unread: 0 } : t)));
    nav.push('thread', { kind: conv.kind, convId: conv.id, messageId: m.id });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Threads" full>
      <Chips
        className="pb-3"
        value={filter}
        onChange={setFilter}
        options={[{ value: 'all', label: 'All' }, { value: 'following', label: unread ? `Following · ${unread} new` : 'Following' }]}
      />
      {error && !data ? (
        <EmptyState icon={MessagesSquare} title="Couldn't load" body={error.message} />
      ) : (
        <MessageRows
          list={list}
          conv={conv}
          directory={directory}
          meta={(m) => [m.unread ? `${m.unread} new` : null, `${m.replyCount || 0} ${m.replyCount === 1 ? 'reply' : 'replies'}`, m.lastReplyAt && `last ${shortAgo(m.lastReplyAt)}`, m.locked && 'locked', m.resolved && 'resolved'].filter(Boolean).join(' · ')}
          onOpen={openThread}
          empty={filter === 'following'
            ? <EmptyState icon={MessagesSquare} title="No followed threads" body="Threads you start, reply to or are mentioned in show up here." />
            : <EmptyState icon={MessagesSquare} title="No threads yet" body="Long-press a message and choose Reply in thread." />}
        />
      )}
    </Sheet>
  );
}

function RemindersSheet({ open, onClose, conv, directory, onJump }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, error } = useQuery(open && ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 10_000 });
  const here = data ? data.filter((r) => r.conv?.id === conv.id) : null;
  const cancel = async (r) => {
    setQueryData(`reminders:${ws}`, (list) => list?.filter((x) => x.id !== r.id));
    try {
      await api().cancelReminder(r.id);
      toast('Reminder cancelled');
    } catch (err) {
      toast(err.message || 'Could not cancel the reminder', 'danger');
      invalidate('reminders');
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Reminders" full>
      {error && !data ? (
        <EmptyState icon={BellRing} title="Couldn't load" body={error.message} />
      ) : (
        <MessageRows
          list={here}
          conv={conv}
          directory={directory}
          meta={(r) => [reminderLabel(r.at), r.note].filter(Boolean).join(' · ')}
          onOpen={(m) => {
            onClose();
            onJump(m);
          }}
          action={(r) => (
            <button type="button" aria-label="Cancel reminder" onClick={() => cancel(r)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={BellOff} size={17} />
            </button>
          )}
          empty={<EmptyState icon={BellRing} title="No reminders here" body="Long-press a message and choose Remind me about this." />}
        />
      )}
    </Sheet>
  );
}

function SavedSheet({ open, onClose, conv, directory, onJump }) {
  const ws = useSession((s) => s.workspaceId);
  const { data, error } = useQuery(open && ws && `saved:${ws}`, () => api().savedMessages(ws));
  const here = data ? data.filter((x) => x.conv?.id === conv.id) : null;
  const unsave = async (item) => {
    setQueryData(`saved:${ws}`, (list) => list?.filter((x) => x.message.id !== item.message.id));
    try {
      await api().toggleSave(conv, item.message.id);
      invalidate(`messages:${conv.id}`);
      toast('Removed from saved');
    } catch (err) {
      toast(err.message || 'Could not remove it', 'danger');
      invalidate('saved:');
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Saved messages" full>
      {error && !data ? (
        <EmptyState icon={Bookmark} title="Couldn't load" body={error.message} />
      ) : (
        <MessageRows
          list={here}
          conv={conv}
          directory={directory}
          meta={(x) => (x.message?.at ? shortAgo(x.message.at) : '')}
          onOpen={(m) => {
            onClose();
            onJump(m);
          }}
          action={(x) => (
            <button type="button" aria-label="Remove from saved" onClick={() => unsave(x)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
              <Icon as={BookmarkX} size={17} />
            </button>
          )}
          empty={<EmptyState icon={Bookmark} title="Nothing saved here" body="Long-press a message and choose Save for later." />}
        />
      )}
    </Sheet>
  );
}

function MembersSheet({ open, onClose, meta, directory }) {
  const people = (meta?.memberIds || []).map((id) => directory[id]).filter(Boolean);
  return (
    <Sheet open={open} onClose={onClose} title={`Members · ${people.length || meta?.memberCount || 0}`} full>
      {people.length ? (
        <RowGroup className="mb-3">
          {people.map((u) => (
            <Row
              key={u.id}
              leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
              title={u.name}
              subtitle={u.title || PRESENCE_TEXT[u.presence]}
              onClick={() => {
                onClose();
                nav.push('profile', { userId: u.id });
              }}
            />
          ))}
        </RowGroup>
      ) : (
        <EmptyState icon={Users} title="No members to show" />
      )}
    </Sheet>
  );
}

const CONFIRM = {
  block: { title: 'Block this person?', body: "They won't be able to message you here, and you won't be able to message them until you unblock them.", confirm: 'Block' },
  clear: { title: 'Clear chat history?', body: 'Messages so far are cleared for you only. The others still see them. This can’t be undone.', confirm: 'Clear chat' },
  delete: { title: 'Delete this chat?', body: 'It leaves your list and its history is cleared for you. A new message brings the conversation back.', confirm: 'Delete' },
};

/**
 * The ⋮ menu. Props: open/onClose, conv { kind, id }, meta (the channel or DM row), label,
 * status (useConversationStatus), items (the loaded messages, for search), onJump(message),
 * onPoll (null when polls can't be created here).
 */
export function ConversationMenu({ open, onClose, conv, meta, label, status, items, onJump, onPoll, mode = 'actions' }) {
  const directory = useDirectory();
  const huddles = useHuddlesAvailable();
  const threadsOn = useFlag('threads');
  const [sheet, setSheet] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { kind, id } = conv;
  const isGroup = kind === 'dm' && Boolean(meta?.isGroup);
  const scope = kind === 'channel' ? { channelId: id } : { dmId: id };

  const list = conversationMenuItems({
    kind,
    isGroup,
    isAgent: Boolean(meta?.agentId),
    muted: status.muted,
    blocked: status.blocked,
    huddles,
    polls: Boolean(onPoll),
    threads: threadsOn && Boolean(api().channelThreads),
  }).filter((item) => item.section === mode);

  // Sheets open after the menu's exit animation, so the two never stack.
  const later = (fn) => setTimeout(fn, 220);
  const call = async (video) => {
    try {
      await startHuddle(scope, label, { video });
    } catch (err) {
      toast(err.message || 'Could not start the call', 'danger');
    }
  };

  const toggleMute = async () => {
    const next = !status.muted;
    try {
      if (kind === 'channel') {
        setQueryData(`channelPolicy:${id}`, (p) => (p ? { ...p, muted: next } : p));
        setQueryData(`channels:${useSession.getState().workspaceId}`, (l) => l?.map((c) => (c.id === id ? { ...c, muted: next } : c)));
        await api().setChannelMuted(id, next);
      } else {
        setQueryData(`dmStatus:${id}`, (s) => ({ ...(s || {}), muted: next }));
        await api().setDmMuted(id, next);
      }
      toast(next ? 'Notifications muted' : 'Notifications unmuted');
    } catch (err) {
      toast(err.message || 'Could not change notifications', 'danger');
      invalidate(`dmStatus:${id}`, `channelPolicy:${id}`, 'channels');
    }
  };

  const setBlocked = async (next) => {
    setQueryData(`dmStatus:${id}`, (s) => ({ ...(s || {}), blocked: next }));
    try {
      await api().setDmBlocked(id, next);
      toast(next ? 'User blocked' : 'User unblocked');
    } catch (err) {
      toast(err.message || 'Could not change that', 'danger');
      invalidate(`dmStatus:${id}`);
    }
  };

  const confirmed = async () => {
    const what = confirm;
    setBusy(true);
    try {
      if (what === 'block') await setBlocked(true);
      else if (what === 'clear') {
        await api().clearDm(id);
        invalidate(`messages:${id}`, 'dms');
        toast('Chat cleared');
      } else if (what === 'delete') {
        await api().deleteDm(id);
        invalidate('dms');
        toast('Chat deleted');
        nav.pop();
      }
      setConfirm(null);
    } catch (err) {
      toast(err.message || 'Something went wrong', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const run = {
    huddle: () => call(false),
    voice: () => call(false),
    video: () => call(true),
    poll: () => later(onPoll),
    search: () => later(() => setSheet('search')),
    threads: () => later(() => setSheet('threads')),
    reminders: () => later(() => setSheet('reminders')),
    pinned: () => later(() => setSheet('pinned')),
    saved: () => later(() => setSheet('saved')),
    members: () => later(() => setSheet('members')),
    channelInfo: () => nav.push('channelInfo', { id }),
    groupInfo: () => nav.push('groupInfo', { id }),
    profile: () => meta?.userId && nav.push('profile', { userId: meta.userId }),
    mute: toggleMute,
    block: () => (status.blocked ? setBlocked(false) : later(() => setConfirm('block'))),
    clear: () => later(() => setConfirm('clear')),
    delete: () => later(() => setConfirm('delete')),
  };
  const icon = (item) => (item.id === 'mute' ? (status.muted ? Bell : BellOff) : item.id === 'block' ? (status.blocked ? CircleCheck : Ban) : ICONS[item.id]);

  const close = () => setSheet(null);
  return (
    <>
      <ActionSheet
        open={open}
        onClose={onClose}
        title={label}
        actions={list.map((item) => ({ label: item.label, icon: icon(item), danger: item.danger, onSelect: run[item.id] }))}
      />
      <SearchSheet open={sheet === 'search'} onClose={close} items={items} directory={directory} onJump={onJump} />
      <PinnedSheet open={sheet === 'pinned'} onClose={close} conv={conv} directory={directory} onJump={onJump} />
      <ThreadsSheet open={sheet === 'threads'} onClose={close} conv={conv} directory={directory} />
      <RemindersSheet open={sheet === 'reminders'} onClose={close} conv={conv} directory={directory} onJump={onJump} />
      <SavedSheet open={sheet === 'saved'} onClose={close} conv={conv} directory={directory} onJump={onJump} />
      <MembersSheet open={sheet === 'members'} onClose={close} meta={meta} directory={directory} />
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={CONFIRM[confirm]?.title || ''}
        body={CONFIRM[confirm]?.body}
        confirmLabel={CONFIRM[confirm]?.confirm}
        danger
        busy={busy}
        onConfirm={confirmed}
      />
    </>
  );
}
