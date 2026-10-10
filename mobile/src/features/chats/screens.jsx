import { useMemo, useState } from 'react';
import {
  Info, UserRound, Hash, Lock, BellOff, Bell, LogOut, Users, MessageCircle, Mail, AtSign, Plus, Check, Clock,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useChannels, useDirectory, useDms, useMembers } from '../../data/hooks.js';
import { invalidate, setQueryData } from '../../data/query.js';
import { Header, Screen, Body } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Field, SearchField, Toggle } from '../../ui/Controls.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows, Spinner } from '../../ui/Feedback.jsx';
import { toast } from '../../lib/bus.js';
import { useFlag } from '../../config/flags.js';
import { useConversation } from './useConversation.js';
import { Composer, ComposerPlusSheet, MessageActions, MessageItem, MessageList } from './messages.jsx';
import { ChannelTile, channelGlyph } from './ChatsScreen.jsx';
import { openConversation } from './chatsUi.js';
import { TaskEditorSheet } from '../tasks/TaskEditorSheet.jsx';
import { askAiAbout } from '../ai/aiUi.js';
import { E2eeBanner } from './E2eeBanner.jsx';

const PRESENCE_TEXT = { active: 'Active', online: 'Active', away: 'Away', dnd: 'Do not disturb', offline: 'Offline' };

function useConversationMeta(kind, id) {
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  if (kind === 'channel') return (channels || []).find((c) => c.id === id) || null;
  return (dms || []).find((d) => d.id === id) || null;
}

function useMessageTools({ conv, convo, me, label, threadOf }) {
  const [active, setActive] = useState(null);
  const [taskFrom, setTaskFrom] = useState(null);
  const [editing, setEditing] = useState(null);
  const threadsOn = useFlag('threads');

  const actions = (
    <>
      <MessageActions
        message={active}
        me={me}
        open={Boolean(active)}
        onClose={() => setActive(null)}
        canThread={threadsOn && !threadOf}
        onReact={convo.react}
        onReply={() => nav.push('thread', { kind: conv.kind, convId: conv.id, messageId: active.id })}
        onPin={
          api().togglePin
            ? async () => {
                try {
                  const pinned = await api().togglePin(conv, active.id);
                  toast(pinned ? 'Pinned to the conversation' : 'Unpinned');
                  invalidate(`messages:${conv.id}`);
                } catch (err) {
                  toast(err.message || 'Could not pin the message', 'danger');
                }
              }
            : null
        }
        onSave={
          api().toggleSave
            ? async () => {
                const saved = await api().toggleSave(conv, active.id);
                toast(saved ? 'Saved for later' : 'Removed from saved');
              }
            : null
        }
        onTask={() => setTaskFrom(active)}
        onEdit={() => setEditing(active)}
        onDelete={() => convo.remove(active.id)}
      />
      <TaskEditorSheet
        open={Boolean(taskFrom)}
        onClose={() => setTaskFrom(null)}
        initial={
          taskFrom
            ? {
                title: taskFrom.text.split('\n')[0].replace(/[*_`#>]/g, '').slice(0, 80),
                description: `From ${label}:\n> ${taskFrom.text.slice(0, 400)}`,
                channelId: conv.kind === 'channel' ? conv.id : null,
              }
            : null
        }
      />
    </>
  );

  const onLongPress = (m, what) => {
    if (what === 'profile') nav.push('profile', { userId: m.authorId });
    else if (!m.pending) setActive(m);
  };

  return { actions, onLongPress, editing, setEditing, openTask: () => setTaskFrom({ text: '' }) };
}

export function ConversationScreen({ kind, id }) {
  const conv = useMemo(() => ({ kind, id }), [kind, id]);
  const meta = useConversationMeta(kind, id);
  const me = useSession((s) => s.user?.id);
  const workspace = useWorkspace();
  const directory = useDirectory();
  const convo = useConversation(conv);
  const [plus, setPlus] = useState(false);
  const [joining, setJoining] = useState(false);
  const aiOn = useFlag('ai');

  const label = kind === 'channel' ? `#${meta?.name || 'channel'}` : meta?.user?.name || 'Direct message';
  const tools = useMessageTools({ conv, convo, me, label });

  const isAdmin = ['admin', 'owner'].includes(workspace?.role);
  const readOnly = kind === 'channel' && meta?.broadcast && !isAdmin;
  const notMember = kind === 'channel' && meta && !meta.isMember;

  const title =
    kind === 'channel' ? (
      <span className="flex items-center gap-1.5">
        <Icon as={channelGlyph(meta)} size={16} className="shrink-0 text-text-2" />
        <span className="truncate">{meta?.name || '…'}</span>
      </span>
    ) : (
      meta?.user?.name || '…'
    );
  const subtitle =
    kind === 'channel'
      ? [meta?.memberCount && `${meta.memberCount} members`, meta?.topic].filter(Boolean).join(' · ')
      : PRESENCE_TEXT[meta?.user?.presence] || '';

  const join = async () => {
    setJoining(true);
    try {
      await api().joinChannel(id);
      invalidate('channels');
      toast(`Joined #${meta?.name}`, 'success');
    } catch (err) {
      toast(err.message || 'Could not join', 'danger');
    } finally {
      setJoining(false);
    }
  };

  const intro = (
    <div className="px-4 pt-6 pb-4">
      {kind === 'channel' ? (
        <>
          <ChannelTile channel={meta} size={52} />
          <h2 className="mt-3 text-xl font-bold">#{meta?.name}</h2>
          <p className="mt-1 text-sm text-text-2">{meta?.topic || 'The start of this channel.'}</p>
        </>
      ) : (
        <>
          <Avatar name={meta?.user?.name} src={meta?.user?.avatarUrl} size="lg" />
          <h2 className="mt-3 text-xl font-bold">{meta?.user?.name}</h2>
          <p className="mt-1 text-sm text-text-2">This is the start of your conversation{meta?.user?.title ? ` with ${meta.user.title.toLowerCase()} ${meta.user.name.split(' ')[0]}` : ''}.</p>
        </>
      )}
    </div>
  );

  return (
    <Screen>
      <Header
        title={title}
        subtitle={subtitle}
        border
        actions={
          kind === 'channel' ? (
            <IconButton icon={Info} label="Channel details" onClick={() => nav.push('channelInfo', { id })} />
          ) : (
            <IconButton icon={UserRound} label="Profile" onClick={() => meta && nav.push('profile', { userId: meta.userId })} />
          )
        }
      />
      <MessageList
        items={convo.items}
        directory={directory}
        me={me}
        loading={convo.loading}
        header={!convo.loading && !convo.hasMore ? intro : null}
        onReact={convo.react}
        onRetry={convo.retry}
        onLongPress={tools.onLongPress}
        onOpenThread={(m) => nav.push('thread', { kind, convId: id, messageId: m.id })}
      />
      <E2eeBanner className="mb-2" />
      {notMember ? (
        <div className="shrink-0 border-t border-line-soft bg-bg px-4 pt-3 pb-safe">
          <p className="text-center text-[13px] text-text-2">You're previewing #{meta.name}.</p>
          <Button block className="my-3" loading={joining} onClick={join}>
            Join channel
          </Button>
        </div>
      ) : (
        <Composer
          placeholder={`Message ${label}`}
          disabled={readOnly}
          disabledReason="Only admins can post in this channel."
          initial={tools.editing?.text || ''}
          editing={Boolean(tools.editing)}
          onCancelEdit={() => tools.setEditing(null)}
          onPlus={() => setPlus(true)}
          onSend={(text) => {
            if (tools.editing) {
              convo.edit(tools.editing.id, text);
              tools.setEditing(null);
            } else convo.send(text);
          }}
        />
      )}
      {tools.actions}
      <ComposerPlusSheet
        open={plus}
        onClose={() => setPlus(false)}
        onAskAi={aiOn ? () => askAiAbout(`Summarize the recent conversation in ${label} and list any action items for me.`) : null}
        onTask={tools.openTask}
      />
    </Screen>
  );
}

export function ThreadScreen({ kind, convId, messageId }) {
  const conv = useMemo(() => ({ kind, id: convId }), [kind, convId]);
  const meta = useConversationMeta(kind, convId);
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const convo = useConversation(conv, { threadOf: messageId });
  const label = kind === 'channel' ? `#${meta?.name || ''}` : meta?.user?.name || '';
  const tools = useMessageTools({ conv, convo, me, label, threadOf: messageId });

  const header = convo.parent ? (
    <div className="border-b border-line-soft pb-3">
      <MessageItem
        m={convo.parent}
        hideThread
        directory={directory}
        me={me}
        onReact={convo.react}
        onLongPress={tools.onLongPress}
        onOpenThread={() => {}}
        onRetry={() => {}}
      />
      <p className="px-4 pt-2 text-xs font-medium text-text-2">
        {convo.items.length} {convo.items.length === 1 ? 'reply' : 'replies'}
      </p>
    </div>
  ) : null;

  return (
    <Screen>
      <Header title="Thread" subtitle={label && `in ${label}`} border />
      <MessageList
        items={convo.items}
        directory={directory}
        me={me}
        loading={convo.loading}
        header={header}
        onReact={convo.react}
        onRetry={convo.retry}
        onLongPress={tools.onLongPress}
        onOpenThread={() => {}}
      />
      <Composer placeholder="Reply in thread" onSend={convo.send} />
      {tools.actions}
    </Screen>
  );
}

export function ChannelInfoScreen({ id }) {
  const { data: channels } = useChannels();
  const directory = useDirectory();
  const channel = (channels || []).find((c) => c.id === id);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!channel) {
    return (
      <Screen>
        <Header title="Channel" />
        <SkeletonRows />
      </Screen>
    );
  }
  const members = (channel.memberIds || []).map((m) => directory[m]).filter(Boolean);

  const setMuted = async (muted) => {
    setQueryData(`channels:${useSession.getState().workspaceId}`, (list) => list?.map((c) => (c.id === id ? { ...c, muted } : c)));
    try {
      await api().setChannelMuted(id, muted);
    } catch (err) {
      toast(err.message || 'Could not change notifications', 'danger');
      invalidate('channels');
    }
  };

  return (
    <Screen>
      <Header title="Channel details" />
      <Body>
        <div className="flex flex-col items-center px-6 pt-4 pb-2 text-center">
          <ChannelTile channel={channel} size={64} />
          <h1 className="mt-3 text-2xl font-bold">#{channel.name}</h1>
          <p className="mt-1 text-sm text-text-2">{channel.topic || 'No description'}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-3">
            <Icon as={channel.private ? Lock : Hash} size={13} />
            {channel.private ? 'Private channel' : channel.broadcast ? 'Announcement channel' : 'Public channel'} · {channel.memberCount} members
          </p>
        </div>
        <Section title="Notifications">
          <RowGroup footer="Muted channels don't add to your unread count or send notifications.">
            <Row
              icon={channel.muted ? BellOff : Bell}
              tile="accent"
              title="Mute this channel"
              trailing={<Toggle checked={Boolean(channel.muted)} onChange={setMuted} label="Mute this channel" />}
            />
          </RowGroup>
        </Section>
        <Section title={`Members · ${members.length}`}>
          <RowGroup>
            {members.slice(0, 50).map((u) => (
              <Row
                key={u.id}
                leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                title={u.name}
                subtitle={u.title || PRESENCE_TEXT[u.presence]}
                onClick={() => nav.push('profile', { userId: u.id })}
              />
            ))}
          </RowGroup>
        </Section>
        <Section>
          <RowGroup>
            <Row icon={LogOut} danger title={`Leave #${channel.name}`} onClick={() => setLeave(true)} />
          </RowGroup>
        </Section>
      </Body>
      <Dialog
        open={leave}
        onClose={() => setLeave(false)}
        title={`Leave #${channel.name}?`}
        body={channel.private ? "It's private, so you'll need an invite to come back." : 'You can rejoin any time from Browse channels.'}
        confirmLabel="Leave"
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api().leaveChannel(id);
            invalidate('channels');
            setLeave(false);
            nav.pop();
            nav.pop();
            toast(`You left #${channel.name}`);
          } catch (err) {
            toast(err.message || 'Could not leave', 'danger');
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}

export function ProfileScreen({ userId }) {
  const directory = useDirectory();
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const user = directory[userId];
  const [opening, setOpening] = useState(false);
  if (!user) {
    return (
      <Screen>
        <Header title="Profile" />
        <SkeletonRows count={3} />
      </Screen>
    );
  }
  const message = async () => {
    setOpening(true);
    try {
      const dmId = await api().openDm(ws, userId);
      invalidate('dms');
      nav.pop();
      openConversation('dm', dmId);
    } catch (err) {
      toast(err.message || 'Could not open the conversation', 'danger');
    } finally {
      setOpening(false);
    }
  };
  return (
    <Screen>
      <Header title="" />
      <Body>
        <div className="flex flex-col items-center px-6 pb-4 text-center">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" presence={user.presence} />
          <h1 className="mt-4 text-2xl font-bold">{user.name}</h1>
          {user.title && <p className="mt-0.5 text-sm text-text-2">{user.title}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-2">
            <Icon as={Clock} size={13} /> {PRESENCE_TEXT[user.presence] || 'Offline'}
          </p>
          {userId !== me && (
            <Button className="mt-5 w-full max-w-xs" icon={MessageCircle} loading={opening} onClick={message}>
              Message
            </Button>
          )}
        </div>
        <Section title="Contact">
          <RowGroup>
            {user.email && <Row icon={Mail} title="Email" value={user.email} />}
            {user.username && <Row icon={AtSign} title="Username" value={`@${user.username}`} />}
            {user.about && <Row icon={Info} title="About" subtitle={user.about} multiline />}
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

export function NewMessageScreen() {
  const { data: members, loading } = useMembers();
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const people = (members || []).filter((u) => u.id !== me && (!query || u.name.toLowerCase().includes(query.toLowerCase())));
  const open = async (u) => {
    setBusy(u.id);
    try {
      const dmId = await api().openDm(ws, u.id);
      invalidate('dms');
      nav.pop();
      openConversation('dm', dmId);
    } catch (err) {
      toast(err.message || 'Could not open the conversation', 'danger');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen>
      <Header title="New message">
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search people" autoFocus />
        </div>
      </Header>
      <Body>
        <RowGroup className="mt-1">
          <Row icon={Hash} tile="accent" title="Browse channels" onClick={() => nav.replace('browseChannels')} />
        </RowGroup>
        <Section title="People">
          {loading ? (
            <SkeletonRows count={6} />
          ) : people.length ? (
            <RowGroup>
              {people.map((u) => (
                <Row
                  key={u.id}
                  leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
                  title={u.name}
                  subtitle={u.title || u.email}
                  trailing={busy === u.id ? <Spinner className="text-text-2" /> : null}
                  chevron={false}
                  onClick={() => open(u)}
                />
              ))}
            </RowGroup>
          ) : (
            <EmptyState icon={Users} title="No one found" body="Only people in this workspace can be messaged." />
          )}
        </Section>
      </Body>
    </Screen>
  );
}

export function BrowseChannelsScreen() {
  const { data: channels, loading } = useChannels();
  const ws = useSession((s) => s.workspaceId);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [create, setCreate] = useState(false);
  const list = (channels || [])
    .filter((c) => !query || c.name.includes(query.toLowerCase()))
    .sort((a, b) => Number(a.isMember) - Number(b.isMember) || a.name.localeCompare(b.name));

  const join = async (c) => {
    setBusy(c.id);
    try {
      await api().joinChannel(c.id);
      invalidate('channels');
      openConversation('channel', c.id);
    } catch (err) {
      toast(err.message || 'Could not join', 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Header title="Browse channels" actions={<IconButton icon={Plus} label="Create channel" onClick={() => setCreate(true)} />}>
        <div className="px-4 pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search channels" />
        </div>
      </Header>
      <Body>
        {loading ? (
          <SkeletonRows />
        ) : (
          <RowGroup className="mt-1">
            {list.map((c) => (
              <Row
                key={c.id}
                leading={<ChannelTile channel={c} size={36} />}
                title={c.name}
                subtitle={`${c.memberCount} members${c.topic ? ` · ${c.topic}` : ''}`}
                chevron={false}
                trailing={
                  c.isMember ? (
                    <span className="flex items-center gap-1 text-xs text-text-2">
                      <Icon as={Check} size={14} /> Joined
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy === c.id} onClick={(e) => (e.stopPropagation(), join(c))}>
                      Join
                    </Button>
                  )
                }
                onClick={() => openConversation('channel', c.id)}
              />
            ))}
          </RowGroup>
        )}
      </Body>
      <CreateChannelSheet open={create} onClose={() => setCreate(false)} ws={ws} />
    </Screen>
  );
}

function CreateChannelSheet({ open, onClose, ws }) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const c = await api().createChannel(ws, { name, topic, isPrivate });
      invalidate('channels');
      onClose();
      setName('');
      setTopic('');
      openConversation('channel', c.id);
    } catch (err) {
      toast(err.message || 'Could not create the channel', 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New channel"
      footer={
        <Button block onClick={submit} loading={busy} disabled={!name.trim()}>
          Create channel
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        <Field label="Name" icon={Hash} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. design-review" autoCapitalize="none" />
        <Field label="Description (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is this channel about?" />
        <div className="flex items-center justify-between rounded-xl border border-line bg-input px-3.5 py-3">
          <span>
            <span className="block text-[15px]">Private channel</span>
            <span className="block text-[13px] text-text-2">Only invited people can see it</span>
          </span>
          <Toggle checked={isPrivate} onChange={setPrivate} label="Private channel" />
        </div>
      </div>
    </Sheet>
  );
}

