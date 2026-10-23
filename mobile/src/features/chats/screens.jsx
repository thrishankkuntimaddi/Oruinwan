import { useMemo, useState } from 'react';
import {
  Info, UserRound, Hash, Lock, BellOff, Bell, BellRing, LogOut, Users, MessageCircle, Mail, AtSign, Plus, Check, Clock, Sparkles, Ellipsis, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useAssistants, useChannels, useDirectory, useDms, useMembers } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useViewing } from '../../data/live/viewing.js';
import { Header, Screen, Body } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Field, SearchField, Toggle } from '../../ui/Controls.jsx';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows, Spinner } from '../../ui/Feedback.jsx';
import { toast } from '../../lib/bus.js';
import { useFlag } from '../../config/flags.js';
import { canBroadcast, mentionTextFor } from '../../lib/mentions.js';
import { peopleInText } from '../../lib/aiPeople.js';
import {
  ChecklistComposerSheet, ConvertTaskSheet, EditHistorySheet, ParticipantsSheet, PollComposerSheet, ReminderSheet, SummarySheet, TranslateSheet,
} from './sheets.jsx';
import { useConversation } from './useConversation.js';
import { useAiReplies } from './useAiReplies.js';
import { AiLiveReply, Composer, ComposerPlusSheet, MessageActions, MessageItem, MessageList, useFilePickers } from './messages.jsx';
import { ChannelTile, channelGlyph } from './ChatsScreen.jsx';
import { openConversation } from './chatsUi.js';
import { TaskEditorSheet } from '../tasks/TaskEditorSheet.jsx';
import { askAiAbout } from '../ai/aiUi.js';
import { E2eeBanner } from './E2eeBanner.jsx';
import { usePlanBlock } from '../plan/plan.js';
import { blockedNote, isPlanLimit } from '../plan/planText.js';
import { PlanLimitNote } from '../plan/PlanLimitNote.jsx';
import { HuddleBanner, HuddleButton } from '../huddles/HuddlesScreen.jsx';
import { GroupTile } from './groupScreens.jsx';

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
  const [convertFrom, setConvertFrom] = useState(null);
  const [editing, setEditing] = useState(null);
  const [remindOf, setRemindOf] = useState(null);
  const [translateOf, setTranslateOf] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);
  const threadsOn = useFlag('threads');
  const aiOn = useFlag('ai');

  const save = async (m) => {
    const before = Boolean(m.saved);
    convo.patchMessage(m.id, (x) => ({ ...x, saved: !before }));
    try {
      const saved = await api().toggleSave(conv, m.id);
      if (saved === before) convo.patchMessage(m.id, (x) => ({ ...x, saved }));
      invalidate('saved:');
      toast(saved ? 'Saved for later' : 'Removed from saved');
    } catch (err) {
      convo.patchMessage(m.id, (x) => ({ ...x, saved: before }));
      toast(err.message || 'Could not update saved messages', 'danger');
    }
  };

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
        onSave={api().toggleSave ? () => save(active) : null}
        onRemind={api().remindMe ? () => setRemindOf(active) : null}
        onTranslate={api().translate && aiOn ? () => setTranslateOf(active) : null}
        onHistory={api().messageVersions ? () => setHistoryOf(active) : null}
        onTask={() => (api().convertToTask ? setConvertFrom(active) : setTaskFrom(active))}
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
                description: taskFrom.text ? `From ${label}:\n> ${taskFrom.text.slice(0, 400)}` : '',
                channelId: conv.kind === 'channel' ? conv.id : null,
              }
            : null
        }
      />
      <ConvertTaskSheet message={convertFrom} conv={conv} label={label} onClose={() => setConvertFrom(null)} />
      <ReminderSheet message={remindOf} conv={conv} onClose={() => setRemindOf(null)} />
      <TranslateSheet message={translateOf} onClose={() => setTranslateOf(null)} />
      <EditHistorySheet message={historyOf} conv={conv} onClose={() => setHistoryOf(null)} />
    </>
  );

  const onLongPress = (m, what) => {
    if (what === 'profile') nav.push('profile', { userId: m.authorId });
    else if (what === 'history') setHistoryOf(m);
    else if (!m.pending) setActive(m);
  };

  return { actions, onLongPress, editing, setEditing, openTask: () => setTaskFrom({ text: '' }) };
}

/** The decrypted end of a conversation, as AI features take it: [{ id, sender, text, isMe }]. */
function transcript(items, directory, me, limit = 200) {
  return items
    .filter((m) => m.state === 'ok' && m.text?.trim() && !m.pending && m.type !== 'checklist')
    .slice(-limit)
    .map((m) => ({ id: m.id, sender: m.authorId === me ? 'Me' : m.author?.name || directory[m.authorId]?.name || 'Someone', text: m.text, isMe: m.authorId === me }));
}

/** Mentions offered in a conversation's composer, and the handles to send with a message. */
function useMentions({ kind, id, meta, me }) {
  const { data: members } = useMembers();
  const { data: channels } = useChannels();
  const workspace = useWorkspace();
  const { data: policy } = useQuery(kind === 'channel' && api().channelPolicy && `channelPolicy:${id}`, () => api().channelPolicy(id), { staleMs: 5 * 60_000 });
  return useMemo(() => {
    const all = members || [];
    const inChannel = kind === 'channel';
    const memberIds = inChannel && meta?.memberIds?.length ? new Set(meta.memberIds) : null;
    // In a channel, its members first; anyone in the workspace can still be mentioned.
    const people = memberIds ? [...all.filter((u) => memberIds.has(u.id)), ...all.filter((u) => !memberIds.has(u.id))] : all;
    const allowBroadcast = canBroadcast(policy, { canManage: policy?.canManage, workspaceRole: workspace?.role });
    const usernames = new Set(all.map((u) => String(u.username || '').toLowerCase()).filter(Boolean));
    return {
      composer: { people, channels: (channels || []).filter((c) => !c.private || c.isMember), me, inChannel, allowBroadcast },
      textFor: (text) => mentionTextFor(text, usernames, { allowBroadcast: inChannel && allowBroadcast }),
      // The people named, as { id, name, username }, for the assistant when the message is for it.
      peopleFor: (text) => peopleInText(text, { people: all, me }),
    };
  }, [members, channels, policy, workspace?.role, kind, meta?.memberIds, me]);
}

export function ConversationScreen({ kind, id, highlight = null, draft = '' }) {
  const conv = useMemo(() => ({ kind, id }), [kind, id]);
  // On screen: the server sends no notification or push for messages here.
  useViewing(kind, id);
  const meta = useConversationMeta(kind, id);
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const workspace = useWorkspace();
  const directory = useDirectory();
  const label0 = kind === 'channel' ? `#${meta?.name || 'channel'}` : meta?.user?.name || 'Direct message';
  const isGroup = kind === 'dm' && Boolean(meta?.isGroup);
  const convo = useConversation(conv, { name: label0, agentId: meta?.agentId || null });
  const aiReplies = useAiReplies(id);
  const { data: assistants } = useAssistants();
  const [plus, setPlus] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sheet, setSheet] = useState(null); // 'poll' | 'checklist' | 'summary'
  const aiOn = useFlag('ai');
  // Unread when the conversation opened (opening marks it read), for "since you last read".
  const [unreadAtOpen] = useState(() => meta?.unread || 0);

  const label = label0;
  const huddleScope = useMemo(() => (kind === 'channel' ? { channelId: id } : { dmId: id }), [kind, id]);
  const tools = useMessageTools({ conv, convo, me, label });
  const pickers = useFilePickers(convo.sendFiles);
  const mentions = useMentions({ kind, id, meta, me });
  const recent = useMemo(() => (aiOn && !meta?.agentId ? transcript(convo.items, directory, me, 8) : null), [aiOn, meta?.agentId, convo.items, directory, me]);

  const isAdmin = ['admin', 'owner'].includes(workspace?.role);
  const readOnly = kind === 'channel' && meta?.broadcast && !isAdmin;
  const notMember = kind === 'channel' && meta && !meta.isMember;
  const canPost = !readOnly && !notMember;

  const summaryOptions = useMemo(() => {
    const all = () => transcript(convo.items, directory, me);
    const run = (list, mode) => () => api().summarizeConversation(ws, list, { title: label, mode });
    const unread = unreadAtOpen > 0 ? all().slice(-unreadAtOpen) : [];
    return [
      unread.length > 0 && { id: 'unread', label: `Since you last read (${unread.length})`, run: run(unread, 'summary'), hint: 'The messages that were new when you opened this conversation.' },
      { id: 'recent', label: 'Recent conversation', run: run(all(), 'summary'), hint: 'The latest messages loaded on this device.' },
      { id: 'actions', label: 'Action items', run: run(all(), 'action_items') },
      { id: 'bullets', label: 'Key points', run: run(all(), 'bullets') },
    ].filter(Boolean);
  }, [convo.items, directory, me, ws, label, unreadAtOpen]);

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
      : meta?.agentId ? 'AI agent · answers every message' : isGroup ? `${meta.memberCount} people` : PRESENCE_TEXT[meta?.user?.presence] || '';

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
      ) : isGroup ? (
        <>
          <GroupTile size={52} />
          <h2 className="mt-3 text-xl font-bold">{meta?.name}</h2>
          <p className="mt-1 text-sm text-text-2">The start of this group of {meta?.memberCount} people.</p>
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

  const createPoll = async (poll) => {
    const m = await api().createPoll(conv, poll);
    convo.append(m);
  };
  const createChecklist = async (list) => {
    const m = await api().sendChecklist(conv, list);
    convo.append(m);
  };

  return (
    <Screen>
      <Header
        title={title}
        subtitle={subtitle}
        border
        actions={
          <>
            {aiOn && !meta?.agentId && api().summarizeConversation && <IconButton icon={Sparkles} label="Summarize with AI" onClick={() => setSheet('summary')} />}
            {!meta?.agentId && <HuddleButton scope={huddleScope} title={label} />}
            {kind === 'channel' ? (
              <IconButton icon={Info} label="Channel details" onClick={() => nav.push('channelInfo', { id })} />
            ) : isGroup ? (
              <IconButton icon={Users} label="Group info" onClick={() => nav.push('groupInfo', { id })} />
            ) : (
              <IconButton icon={UserRound} label="Profile" onClick={() => meta && nav.push('profile', { userId: meta.userId })} />
            )}
          </>
        }
      />
      {!meta?.agentId && <HuddleBanner scope={huddleScope} title={label} />}
      <MessageList
        items={convo.items}
        directory={directory}
        me={me}
        loading={convo.loading}
        header={!convo.loading && !convo.hasMore ? intro : null}
        onReact={convo.react}
        onRetry={convo.retry}
        onCancelUpload={convo.cancelUpload}
        onLongPress={tools.onLongPress}
        onOpenThread={(m) => nav.push('thread', { kind, convId: id, messageId: m.id })}
        footer={aiReplies.map((r) => <AiLiveReply key={r.id} reply={r} />)}
        highlightId={highlight}
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
          aiMentions={aiOn}
          assistants={assistants}
          mentions={mentions.composer}
          recent={recent}
          onVoice={canPost ? (file) => convo.sendFiles([file]) : null}
          disabled={readOnly}
          disabledReason="Only admins can post in this channel."
          initial={draft}
          editText={tools.editing?.text || ''}
          editing={Boolean(tools.editing)}
          onCancelEdit={() => tools.setEditing(null)}
          onPlus={() => setPlus(true)}
          onSend={(text) => {
            if (tools.editing) {
              convo.edit(tools.editing.id, text);
              tools.setEditing(null);
            } else convo.send(text, { mentionText: mentions.textFor(text), people: mentions.peopleFor(text) });
          }}
        />
      )}
      {tools.actions}
      {pickers.inputs}
      <ComposerPlusSheet
        open={plus}
        onClose={() => setPlus(false)}
        onPick={canPost ? pickers.pick : null}
        onPoll={canPost && api().createPoll ? () => setSheet('poll') : null}
        onChecklist={canPost && api().sendChecklist ? () => setSheet('checklist') : null}
        onAskAi={aiOn ? () => (api().summarizeConversation ? setSheet('summary') : askAiAbout(`Summarize the recent conversation in ${label} and list any action items for me.`)) : null}
        onTask={tools.openTask}
      />
      <PollComposerSheet open={sheet === 'poll'} onClose={() => setSheet(null)} onCreate={createPoll} />
      <ChecklistComposerSheet open={sheet === 'checklist'} onClose={() => setSheet(null)} onCreate={createChecklist} />
      <SummarySheet open={sheet === 'summary'} onClose={() => setSheet(null)} title={`Summarize ${label}`} options={summaryOptions} />
    </Screen>
  );
}

export function ThreadScreen({ kind, convId, messageId, draft = '' }) {
  const conv = useMemo(() => ({ kind, id: convId }), [kind, convId]);
  useViewing(kind, convId, messageId);
  const meta = useConversationMeta(kind, convId);
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const label = kind === 'channel' ? `#${meta?.name || ''}` : meta?.user?.name || '';
  const convo = useConversation(conv, { threadOf: messageId, name: label });
  const aiReplies = useAiReplies(convId, messageId);
  const { data: assistants } = useAssistants();
  const aiOn = useFlag('ai');
  const tools = useMessageTools({ conv, convo, me, label, threadOf: messageId });
  const pickers = useFilePickers(convo.sendFiles);
  const mentions = useMentions({ kind, id: convId, meta, me });
  const [attach, setAttach] = useState(false);
  const [sheet, setSheet] = useState(null); // 'menu' | 'people' | 'summary'
  const info = convo.meta;

  const follow = async () => {
    const next = !info?.following;
    convo.patchMeta({ following: next });
    try {
      const r = await api().followThread(messageId, next);
      convo.patchMeta({ following: r.following, ...(r.followerCount != null ? { followerCount: r.followerCount } : {}) });
      toast(r.following ? "You'll be notified about new replies" : 'Unfollowed this thread');
    } catch (err) {
      convo.patchMeta({ following: !next });
      toast(err.message || 'Could not change following', 'danger');
    }
  };
  const resolve = async () => {
    const next = !info?.resolved;
    convo.patchMeta({ resolved: next });
    try {
      const resolved = await api().resolveThread(messageId);
      convo.patchMeta({ resolved, resolvedBy: resolved ? { id: me } : null });
      invalidate(`messages:${convId}`);
      toast(resolved ? 'Marked as resolved' : 'Reopened');
    } catch (err) {
      convo.patchMeta({ resolved: !next });
      toast(err.message || 'Could not change the thread', 'danger');
    }
  };

  const summaryOptions = useMemo(
    () => [
      {
        id: 'thread',
        label: 'Summary',
        run: () =>
          api().summarizeThread(
            ws,
            messageId,
            convo.parent?.state === 'ok' ? convo.parent.text : '',
            transcript(convo.items, directory, me).map(({ sender, text }) => ({ sender, text })),
          ),
      },
    ],
    [ws, messageId, convo.parent, convo.items, directory, me],
  );

  const resolvedBy = info?.resolvedBy?.id ? directory[info.resolvedBy.id]?.name || info.resolvedBy.username : null;
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2 text-xs text-text-2">
        <span className="font-medium">
          {convo.items.length} {convo.items.length === 1 ? 'reply' : 'replies'}
        </span>
        {info?.participants?.length > 0 && (
          <button type="button" onClick={() => setSheet('people')} className="inline-flex items-center gap-1 font-medium text-accent-ink">
            <Icon as={Users} size={13} /> {info.participants.length} {info.participants.length === 1 ? 'person' : 'people'}
          </button>
        )}
        {info?.resolved && (
          <span className="inline-flex items-center gap-1 text-success">
            <Icon as={CheckCircle2} size={13} /> Resolved{resolvedBy ? ` by ${resolvedBy}` : ''}
          </span>
        )}
      </div>
    </div>
  ) : null;

  return (
    <Screen>
      <Header
        title="Thread"
        subtitle={label && `in ${label}`}
        border
        actions={
          info ? (
            <>
              <IconButton icon={info.following ? BellRing : Bell} active={info.following} label={info.following ? 'Unfollow thread' : 'Follow thread'} onClick={follow} />
              <IconButton icon={Ellipsis} label="Thread options" onClick={() => setSheet('menu')} />
            </>
          ) : null
        }
      />
      <MessageList
        items={convo.items}
        directory={directory}
        me={me}
        loading={convo.loading}
        header={header}
        onReact={convo.react}
        onRetry={convo.retry}
        onCancelUpload={convo.cancelUpload}
        onLongPress={tools.onLongPress}
        onOpenThread={() => {}}
        footer={aiReplies.map((r) => <AiLiveReply key={r.id} reply={r} />)}
      />
      <Composer
        placeholder={info?.resolved ? 'Reply in this resolved thread' : 'Reply in thread'}
        onPlus={() => setAttach(true)}
        aiMentions={aiOn}
        assistants={assistants}
        mentions={mentions.composer}
        onVoice={(file) => convo.sendFiles([file])}
        initial={draft}
        editText={tools.editing?.text || ''}
        editing={Boolean(tools.editing)}
        onCancelEdit={() => tools.setEditing(null)}
        onSend={(text) => {
          if (tools.editing) {
            convo.edit(tools.editing.id, text);
            tools.setEditing(null);
          } else convo.send(text, { mentionText: mentions.textFor(text), people: mentions.peopleFor(text) });
        }}
      />
      {tools.actions}
      {pickers.inputs}
      <ComposerPlusSheet open={attach} onClose={() => setAttach(false)} onPick={pickers.pick} title="Add to reply" />
      <ActionSheet
        open={sheet === 'menu'}
        onClose={() => setSheet(null)}
        title="Thread"
        actions={[
          { label: info?.following ? 'Unfollow thread' : 'Follow thread', icon: info?.following ? BellOff : Bell, hint: 'Get notified about new replies', onSelect: follow },
          { label: info?.resolved ? 'Reopen thread' : 'Mark as resolved', icon: info?.resolved ? RotateCcw : CheckCircle2, onSelect: resolve },
          { label: 'People in this thread', icon: Users, onSelect: () => setTimeout(() => setSheet('people'), 220) },
          aiOn && api().summarizeThread && { label: 'Summarize thread', icon: Sparkles, hint: 'With Oruinwan AI, from the replies decrypted here', onSelect: () => setTimeout(() => setSheet('summary'), 220) },
        ]}
      />
      <ParticipantsSheet open={sheet === 'people'} onClose={() => setSheet(null)} participants={info?.participants || []} directory={directory} />
      <SummarySheet open={sheet === 'summary'} onClose={() => setSheet(null)} title="Thread summary" options={summaryOptions} />
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
          <Row icon={Users} tile="accent" title="New group" subtitle="A conversation with several people" onClick={() => nav.replace('newGroup')} />
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
  // The free plan's channels per workspace: say so here instead of failing on Create.
  const { plan, blocked } = usePlanBlock(ws, 'channels.perWorkspace');
  const submit = async () => {
    if (!name.trim() || blocked) return;
    setBusy(true);
    try {
      const c = await api().createChannel(ws, { name, topic, isPrivate });
      invalidate('channels');
      onClose();
      setName('');
      setTopic('');
      openConversation('channel', c.id);
    } catch (err) {
      if (!isPlanLimit(err)) toast(err.message || 'Could not create the channel', 'danger');
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
        <Button block onClick={submit} loading={busy} disabled={!name.trim() || blocked}>
          Create channel
        </Button>
      }
    >
      <div className="space-y-4 px-5 pb-4">
        {blocked && <PlanLimitNote>{blockedNote(plan, 'channels.perWorkspace')}</PlanLimitNote>}
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

