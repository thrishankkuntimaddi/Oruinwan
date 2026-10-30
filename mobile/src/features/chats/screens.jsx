import { useMemo, useRef, useState } from 'react';
import { selfPresence } from '../../lib/presence.js';
import {
  ChevronDown, Headphones, Video, Info, Hash, Lock, BellOff, Bell, BellRing, LogOut, Users, MessageCircle, Mail, AtSign, Plus, Check, Clock, Sparkles, Ellipsis, CheckCircle2, RotateCcw, LockOpen, UserPlus, X,
} from 'lucide-react';
import { ThreadPeopleSheet } from './ThreadPeopleSheet.jsx';
import { nav } from '../../app/nav.js';
import { api, useSession, useWorkspace } from '../../data/session.js';
import { useAssistants, useChannels, useDirectory, useDms, useMembers } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useViewing } from '../../data/live/viewing.js';
import { Header, Screen, Body } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { StandingTag } from '../../ui/StandingTag.jsx';
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
import { searchPeople, wordStartMatch } from '../../lib/peopleSearch.js';
import { TaskEditorSheet } from '../tasks/TaskEditorSheet.jsx';
import { askAiAbout } from '../ai/aiUi.js';
import { E2eeBanner } from './E2eeBanner.jsx';
import { usePlanBlock } from '../plan/plan.js';
import { blockedNote, isPlanLimit } from '../plan/planText.js';
import { PlanLimitNote } from '../plan/PlanLimitNote.jsx';
import { HuddleBanner, HuddleButton, useHuddlesAvailable } from '../huddles/HuddlesScreen.jsx';
import { startHuddle } from '../huddles/huddle.js';
import { GroupTile, HistoryChoice, addedMessage } from './groupScreens.jsx';
import { MessageInfoSheet } from './MessageInfoSheet.jsx';
import { DayJumpSheet } from './DayJumpSheet.jsx';
import { AiIsland } from './AiIsland.jsx';
import { phoneCommands } from './slash.jsx';
import { QUICK_REACTIONS } from '../../data/constants.js';
import { ConversationMenu, PinnedBanner, useConversationStatus } from './ConversationMenu.jsx';
import { EllipsisVertical, Share2, Copy, Link2 } from 'lucide-react';
import { useWebUrl } from '../../data/live/webUrl.js';
import { copyText, shareText } from '../../native/index.js';
import { messageLink, messageShareText, shareableBody, threadLink, threadTitle, threadTranscript } from '../../lib/shareContent.js';

const PRESENCE_TEXT = { active: 'Active', online: 'Active', away: 'Away', dnd: 'Do not disturb', offline: 'Offline' };

function useConversationMeta(kind, id) {
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  if (kind === 'channel') return (channels || []).find((c) => c.id === id) || null;
  return (dms || []).find((d) => d.id === id) || null;
}

function useMessageTools({ conv, convo, me, label, threadOf, onQuote }) {
  const [active, setActive] = useState(null);
  const [taskFrom, setTaskFrom] = useState(null);
  const [convertFrom, setConvertFrom] = useState(null);
  const [editing, setEditing] = useState(null);
  const [remindOf, setRemindOf] = useState(null);
  const [translateOf, setTranslateOf] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);
  const [infoOf, setInfoOf] = useState(null);
  const threadsOn = useFlag('threads');
  const aiOn = useFlag('ai');
  const share = useShareLinks(conv);
  const directory = useDirectory();

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
        onQuote={onQuote ? () => onQuote(active) : null}
        onReply={() => nav.push('thread', { kind: conv.kind, convId: conv.id, messageId: active.id })}
        onPin={
          api().togglePin
            ? async () => {
                try {
                  const pinned = await api().togglePin(conv, active.id, !active.pinned);
                  toast(pinned ? 'Pinned to the conversation' : 'Unpinned');
                  invalidate(`messages:${conv.id}`, `pinned:${conv.id}`);
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
        onInfo={api().messageInfo ? () => setInfoOf(active) : null}
        onCopyLink={share.ready ? () => share.copy(share.messageLink(active), 'Link copied') : null}
        onShare={
          share.ready
            ? () => {
                const m = active;
                const sender = m.authorId === me ? directory[me]?.name || 'Me' : m.author?.name || directory[m.authorId]?.name || 'Someone';
                share.send(label ? `Message in ${label}` : 'Message', messageShareText({ sender, body: shareableBody(m), link: share.messageLink(m) }));
              }
            : null
        }
        onTask={() => (api().convertToTask ? setConvertFrom(active) : setTaskFrom(active))}
        onEdit={() => setEditing(active)}
        onDelete={(scope) => convo.remove(active.id, scope)}
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
      <MessageInfoSheet message={infoOf} conv={conv} onClose={() => setInfoOf(null)} />
    </>
  );

  const onLongPress = (m, what) => {
    if (what === 'profile') nav.push('profile', { userId: m.authorId });
    else if (what === 'history') setHistoryOf(m);
    else if (!m.pending) setActive(m);
  };

  return { actions, onLongPress, editing, setEditing, openTask: () => setTaskFrom({ text: '' }) };
}

/**
 * Links to messages and threads in this conversation, and copy / share-sheet helpers. Shared
 * text is built on this device from decrypted messages; nothing is uploaded.
 */
function useShareLinks(conv) {
  const ws = useSession((s) => s.workspaceId);
  const server = useSession((s) => s.server);
  const base = useWebUrl(server);
  const ready = Boolean(ws && base);
  return {
    ready,
    messageLink: (m) => messageLink({ base, workspaceId: ws, kind: conv.kind, conversationId: conv.id, message: m }),
    threadLink: (parentId) => threadLink({ base, workspaceId: ws, kind: conv.kind, conversationId: conv.id, parentId }),
    copy: async (text, done = 'Copied') => {
      if (text && (await copyText(text))) toast(done);
      else toast("Couldn't copy on this device", 'danger');
    },
    send: async (title, text) => {
      const result = await shareText({ title, text });
      if (result === 'copied') toast('Copied — paste it anywhere');
      else if (result === 'failed') toast("Couldn't share on this device", 'danger');
    },
  };
}

/** Double tap a message: the reaction most used on it already, or 👍. Mine already? Nothing changes. */
export function doubleTapEmoji(m, me) {
  const entries = Object.entries(m.reactions || {}).filter(([, u]) => u.length).sort((a, b) => b[1].length - a[1].length);
  const emoji = entries[0]?.[0] || QUICK_REACTIONS[0] || '👍';
  return (m.reactions?.[emoji] || []).includes(me) ? null : emoji;
}

/**
 * Ticks on my messages in a DM or group DM: 'sending', 'sent', or 'read' once everyone else
 * read it (the server leaves out people who turned read receipts off).
 */
export function receiptFor(m, me, others) {
  if (m.authorId !== me || m.state === 'deleted' || m.failed) return null;
  if (m.pending) return 'sending';
  if (!others?.length) return 'sent';
  const read = new Set(m.readBy || []);
  return others.every((id) => read.has(id)) ? 'read' : 'sent';
}

/** Quote, reply, schedule and jump helpers shared by a conversation and a thread. */
function useComposerExtras({ conv, convo, me }) {
  const ws = useSession((s) => s.workspaceId);
  const [quote, setQuote] = useState(null);
  const [jumpTo, setJumpTo] = useState(null);
  const scheduleRef = useRef(null);
  const quotedOf = (m) => (m ? { id: m.id, authorId: m.authorId, authorName: m.author?.name || null, text: m.text, state: m.state } : null);
  return {
    quote,
    setQuote,
    jumpTo,
    setJumpTo,
    scheduleRef,
    quotedOf,
    jumpToMessage: (id) => {
      if (convo.items.some((x) => x.id === id)) {
        setJumpTo(null);
        setTimeout(() => setJumpTo(id), 0);
      } else toast('That message is further back than this device has loaded.');
    },
    doubleTap: (m) => {
      const emoji = doubleTapEmoji(m, me);
      if (emoji) convo.react(m.id, emoji);
    },
    schedule: async (text, when) => {
      try {
        await api().scheduleMessage(ws, conv, text, when, { quotedMessageId: quote?.id || null });
        setQuote(null);
        invalidate('scheduled:');
        toast(`Scheduled for ${new Date(when).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success');
        return true;
      } catch (err) {
        toast(err.message || 'Could not schedule it', 'danger');
        return false;
      }
    },
  };
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
      people: all,
      // Channel admins (and the workspace owner) manage the channel: /topic.
      canManage: Boolean(policy?.canManage) || workspace?.role === 'owner',
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
  const [sheet, setSheet] = useState(null); // 'poll' | 'checklist' | 'summary' | 'menu' | 'days'
  const extras = useComposerExtras({ conv, convo, me });
  const { jumpTo, setJumpTo } = extras;
  const [dayAt, setDayAt] = useState(null);
  const [olderBusy, setOlderBusy] = useState(false);
  // People I @mentioned who aren't in this channel: "Add them?" (Slack-like). [{ id, name, username }]
  const [mentionInvite, setMentionInvite] = useState(null);
  const [mentionInviteBusy, setMentionInviteBusy] = useState(false);
  // In a 1:1 DM, mentioning someone else offers a group with the three of you: { people, text }.
  const [groupOffer, setGroupOffer] = useState(null);
  const status = useConversationStatus(kind, id, meta);
  const aiOn = useFlag('ai');
  // Unread when the conversation opened (opening marks it read), for "since you last read".
  const [unreadAtOpen] = useState(() => meta?.unread || 0);

  const label = label0;
  const huddleScope = useMemo(() => (kind === 'channel' ? { channelId: id } : { dmId: id }), [kind, id]);
  const tools = useMessageTools({ conv, convo, me, label, onQuote: extras.setQuote });
  // Ticks in DMs and group DMs (not channels, not agents): read once the others have read it.
  const others = useMemo(() => (kind === 'dm' && !meta?.agentId ? (meta?.participantIds || []).filter((x) => x && x !== me) : null), [kind, meta, me]);
  const pickers = useFilePickers(convo.sendFiles);
  const mentions = useMentions({ kind, id, meta, me });
  const recent = useMemo(() => (aiOn && !meta?.agentId ? transcript(convo.items, directory, me, 8) : null), [aiOn, meta?.agentId, convo.items, directory, me]);

  const showIsland = aiOn && !meta?.agentId && convo.items.length > 0;
  const isAdmin = ['admin', 'owner'].includes(workspace?.role);
  const readOnly = kind === 'channel' && meta?.broadcast && !isAdmin;
  const notMember = kind === 'channel' && meta && !meta.isMember;
  const blocked = kind === 'dm' && (status.blocked || status.blockedByOther);
  const canPost = !readOnly && !notMember && !blocked;

  // A message picked from search, pinned, saved or reminders: show it here (or its thread).
  const jump = (m) => {
    if (m.parentId) nav.push('thread', { kind, convId: id, messageId: m.parentId });
    else if (convo.items.some((x) => x.id === m.id)) setJumpTo(m.id);
    else toast('That message is further back than this device has loaded.');
  };

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

  // Tap the name: what's in the conversation (info, members, threads, pinned…), see ConversationMenu.
  const title = (
    <button type="button" onClick={() => setSheet('hub')} className="pressable flex max-w-full items-center gap-1.5 text-left" data-testid="conversation-hub" aria-label={`${label}: details`}>
      {kind === 'channel' && <Icon as={channelGlyph(meta)} size={16} className="shrink-0 text-text-2" />}
      <span className="truncate">{kind === 'channel' ? meta?.name || '…' : meta?.user?.name || '…'}</span>
      <Icon as={ChevronDown} size={15} className="shrink-0 text-text-3" />
    </button>
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

  const huddlesOn = useHuddlesAvailable();
  const commands = phoneCommands({
    conv, ws, me, meta, label, isGroup, canPost, canManage: mentions.canManage, convo, mentions, people: mentions.people, aiOn, huddlesOn,
    onSummarize: api().summarizeConversation ? () => setSheet('summary') : () => askAiAbout(`Summarize the recent conversation in ${label}.`),
    onGroupOffer: isGroup && api().addGroupDmMembers
      ? (list) => setGroupOffer({ people: list, text: '', add: true })
      : meta?.user?.id && api().createGroupDm ? (list) => setGroupOffer({ people: list, text: '' }) : null,
  });

  return (
    <Screen>
      <Header
        title={title}
        subtitle={subtitle}
        border
        actions={
          <>
            {/* Groups: the To: bar with this group's people, to add or remove someone and open
                that conversation instead (this group doesn't change). */}
            {isGroup && (
              <IconButton
                icon={UserPlus}
                label="Add or remove people"
                data-testid="group-edit-people"
                onClick={() => nav.push('newMessage', {
                  people: (meta?.participantIds || []).filter((pid) => pid && pid !== me).map((pid) => ({ id: pid, name: directory?.[pid]?.name || 'Someone' })),
                })}
              />
            )}
            {!meta?.agentId && <HuddleButton scope={huddleScope} title={label} />}
            <IconButton icon={EllipsisVertical} label="More options" data-testid="conversation-menu" onClick={() => setSheet('menu')} />
          </>
        }
      />
      {!meta?.agentId && <HuddleBanner scope={huddleScope} title={label} />}
      <PinnedBanner conv={conv} directory={directory} onJump={extras.jumpToMessage} />
      <div className="relative flex min-h-0 flex-1 flex-col">
      {showIsland && <AiIsland title={label} transcript={() => transcript(convo.items, directory, me).map(({ sender, text }) => ({ sender, text }))} />}
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
        // Tap a message for its thread view; swipe right to reply; double tap to react.
        onTapMessage={(m) => nav.push('thread', { kind, convId: id, messageId: m.id })}
        onSwipeReply={canPost ? (m) => extras.setQuote(m) : null}
        onDoubleTap={extras.doubleTap}
        receipt={others ? (m) => receiptFor(m, me, others) : null}
        onDayTap={(at) => {
          setDayAt(at);
          setSheet('days');
        }}
        onJumpTo={extras.jumpToMessage}
        onReachTop={convo.hasMore ? convo.loadOlder : null}
        topInset={showIsland ? 40 : 0}
        footer={aiReplies.map((r) => <AiLiveReply key={r.id} reply={r} />)}
        highlightId={jumpTo || highlight}
      />
      </div>
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
          placeholder={isGroup && !meta?.groupName ? 'Message the group' : `Message ${label}`}
          aiMentions={aiOn}
          assistants={assistants}
          mentions={mentions.composer}
          recent={recent}
          onVoice={canPost ? (file) => convo.sendFiles([file]) : null}
          disabled={readOnly || blocked}
          disabledReason={blocked ? (status.blocked ? 'You blocked this person. Unblock them from the ⋮ menu to send messages.' : "You can't send messages to this person.") : 'Only admins can post in this channel.'}
          initial={draft}
          editText={tools.editing?.text || ''}
          editing={Boolean(tools.editing)}
          onCancelEdit={() => tools.setEditing(null)}
          onPlus={() => setPlus(true)}
          quote={extras.quote}
          onCancelQuote={() => extras.setQuote(null)}
          onSchedule={api().scheduleMessage ? extras.schedule : null}
          scheduleRef={extras.scheduleRef}
          draftConv={draft ? null : conv}
          directory={directory}
          me={me}
          commands={meta?.agentId ? null : commands}
          onSend={(text) => {
            if (tools.editing) {
              convo.edit(tools.editing.id, text);
              tools.setEditing(null);
            } else {
              const people = mentions.peopleFor(text);
              convo.send(text, { mentionText: mentions.textFor(text), people, quoted: extras.quotedOf(extras.quote) });
              extras.setQuote(null);
              if (kind === 'channel' && api().addChannelMembers) {
                const inChannel = new Set(meta?.memberIds || []);
                const outsiders = (people || []).filter((p) => p.id && p.id !== me && !inChannel.has(p.id));
                if (outsiders.length) setMentionInvite(outsiders);
              } else if (kind === 'dm' && isGroup && api().addGroupDmMembers) {
                // A group: mentioning someone who isn't in it offers to add them.
                const inGroup = new Set(meta?.participantIds || []);
                const others = (people || []).filter((p) => p.id && p.id !== me && !inGroup.has(p.id));
                if (others.length) setGroupOffer({ people: others, text, add: true });
              } else if (kind === 'dm' && !isGroup && !meta?.agentId && !meta?.isSelf && meta?.user?.id && api().createGroupDm) {
                const others = (people || []).filter((p) => p.id && p.id !== me && p.id !== meta.user.id);
                if (others.length) {
                  setGroupOffer({ people: others, text });
                  // Already a group with exactly us? Then the offer opens it instead of starting one.
                  Promise.resolve(api().findConversation?.(ws, [meta.user.id, ...others.map((p) => p.id)]))
                    .then((found) => found?.isGroup && setGroupOffer((o) => (o && o.text === text ? { ...o, existing: found } : o)))
                    .catch(() => {});
                }
              }
            }
          }}
        />
      )}
      <Dialog
        open={Boolean(groupOffer)}
        onClose={() => setGroupOffer(null)}
        title={
          groupOffer?.add
            ? `Add ${groupOffer.people.length === 1 ? groupOffer.people[0].name : `${groupOffer.people.length} people`} to the group?`
            : groupOffer?.existing
              ? `Open your group with ${meta?.user?.name || 'them'} and ${groupOffer?.people.length === 1 ? groupOffer.people[0].name : `${groupOffer?.people.length || 0} others`}?`
              : `Start a group with ${meta?.user?.name || 'them'} and ${groupOffer?.people.length === 1 ? groupOffer.people[0].name : `${groupOffer?.people.length || 0} others`}?`
        }
        body={groupOffer?.add ? "They aren't in this group yet." : groupOffer?.existing ? 'You already have a group with exactly these people. This chat stays as it is; your message goes there to carry on.' : "They aren't in this chat. The group is a new conversation and this chat stays as it is; your message goes there to carry on."}
        confirmLabel={groupOffer?.add ? 'Add to group' : groupOffer?.existing ? 'Open group' : 'Start group'}
        cancelLabel="Not now"
        busy={mentionInviteBusy}
        onConfirm={async () => {
          setMentionInviteBusy(true);
          if (groupOffer?.add) {
            try {
              const history = groupOffer.history || 'from_now';
              const next = await api().addGroupDmMembers(id, groupOffer.people.map((p) => p.id), { history });
              invalidate('dms');
              toast(addedMessage(groupOffer.people.length, history, next?.limitedHistory), 'success');
              setGroupOffer(null);
            } catch (err) {
              toast(err.message || 'Could not add them', 'danger');
            } finally {
              setMentionInviteBusy(false);
            }
            return;
          }
          try {
            const group = await api().createGroupDm(ws, [meta.user.id, ...groupOffer.people.map((p) => p.id)]);
            const groupId = group?.id || group;
            invalidate('dms');
            setGroupOffer(null);
            nav.replace('conversation', { kind: 'dm', id: groupId, draft: groupOffer.text });
          } catch (err) {
            toast(err.message || 'Could not start the group', 'danger');
          } finally {
            setMentionInviteBusy(false);
          }
        }}
      >
        {groupOffer?.add && (
          <div className="mt-4">
            <HistoryChoice value={groupOffer.history || 'from_now'} onChange={(history) => setGroupOffer((o) => (o ? { ...o, history } : o))} />
            <button
              type="button"
              className="mt-3 w-full text-center text-[14px] font-medium text-accent-ink"
              disabled={mentionInviteBusy}
              onClick={async () => {
                // A separate group with everyone here plus them; this group stays as it is.
                setMentionInviteBusy(true);
                try {
                  const others = (meta?.participantIds || []).filter((p) => p !== me);
                  const group = await api().createGroupDm(ws, [...others, ...groupOffer.people.map((p) => p.id)], '', { newGroup: true });
                  invalidate('dms');
                  setGroupOffer(null);
                  nav.replace('conversation', { kind: 'dm', id: group?.id || group, draft: groupOffer.text });
                } catch (err) {
                  toast(err.message || 'Could not start the group', 'danger');
                } finally {
                  setMentionInviteBusy(false);
                }
              }}
            >
              Start a new group instead
            </button>
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(mentionInvite)}
        onClose={() => setMentionInvite(null)}
        title={
          mentionInvite?.length === 1
            ? `Add ${mentionInvite[0].name || `@${mentionInvite[0].username}`} to ${label}?`
            : `Add ${mentionInvite?.length || 0} people to ${label}?`
        }
        body={`${(mentionInvite || []).map((p) => p.name || `@${p.username}`).join(', ')} ${mentionInvite?.length === 1 ? "isn't" : "aren't"} in this channel yet. Added, they see the whole conversation.`}
        confirmLabel="Add to channel"
        cancelLabel="Not now"
        busy={mentionInviteBusy}
        onConfirm={async () => {
          setMentionInviteBusy(true);
          try {
            await api().addChannelMembers(id, mentionInvite.map((p) => p.id));
            invalidate('channels');
            toast(mentionInvite.length === 1 ? `Added to ${label}` : `${mentionInvite.length} people added to ${label}`, 'success');
          } catch (err) {
            toast(err.message || 'Could not add them', 'danger');
          } finally {
            setMentionInviteBusy(false);
            setMentionInvite(null);
          }
        }}
      />
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
        onSchedule={canPost && api().scheduleMessage ? () => setTimeout(() => extras.scheduleRef.current?.(), 220) : null}
      />
      <DayJumpSheet
        open={sheet === 'days'}
        onClose={() => setSheet(null)}
        items={convo.items}
        initial={dayAt}
        hasMore={convo.hasMore}
        loadingOlder={olderBusy}
        onLoadOlder={async () => {
          setOlderBusy(true);
          try {
            await convo.loadOlder();
          } catch (err) {
            toast(err.message || 'Could not load older messages', 'danger');
          } finally {
            setOlderBusy(false);
          }
        }}
        onJump={(mid) => {
          setSheet(null);
          extras.jumpToMessage(mid);
        }}
      />
      <ConversationMenu
        open={sheet === 'menu' || sheet === 'hub'}
        mode={sheet === 'hub' ? 'hub' : 'actions'}
        onClose={() => setSheet((s) => (s === 'menu' || s === 'hub' ? null : s))}
        conv={conv}
        meta={meta}
        label={label}
        status={status}
        items={convo.items}
        onJump={jump}
        onPoll={canPost && api().createPoll ? () => setSheet('poll') : null}
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
  const extras = useComposerExtras({ conv, convo, me });
  const tools = useMessageTools({ conv, convo, me, label, threadOf: messageId, onQuote: extras.setQuote });
  const pickers = useFilePickers(convo.sendFiles);
  const mentions = useMentions({ kind, id: convId, meta, me });
  const [attach, setAttach] = useState(false);
  const [sheet, setSheet] = useState(null); // 'menu' | 'people' | 'summary'
  const info = convo.meta;
  const share = useShareLinks(conv);
  const nameOf = (m) => (m.authorId === me ? directory[me]?.name || 'Me' : m.author?.name || directory[m.authorId]?.name || 'Someone');
  const threadText = () =>
    threadTranscript({
      title: threadTitle(kind, label),
      messages: [convo.parent, ...convo.items].filter((m) => m && !m.pending).map((m) => ({ sender: nameOf(m), text: shareableBody(m), at: m.at })),
      link: share.threadLink(messageId),
    });

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

  // Channel admins, workspace admins and the thread's starter lock it (no new replies).
  const toggleLock = async () => {
    const next = !info?.locked;
    try {
      const r = await api().lockThread(messageId, next);
      convo.patchMeta({ locked: r.locked, lockedBy: r.lockedBy });
      invalidate('threads:');
      toast(r.locked ? 'Thread locked. No new replies until it is unlocked.' : 'Thread unlocked');
    } catch (err) {
      toast(err.message || 'Could not change the thread lock', 'danger');
    }
  };
  const lockedByName = info?.lockedBy ? (info.lockedBy.id === me ? 'you' : directory[info.lockedBy.id]?.name || info.lockedBy.username) : null;

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
  const isGroup = kind === 'dm' && Boolean(meta?.isGroup);
  const huddlesOn = useHuddlesAvailable();
  const commands = phoneCommands({
    conv, ws, me, meta, label, isGroup, threadOf: messageId, canPost: !info?.locked, canManage: mentions.canManage, convo, mentions, people: mentions.people, aiOn, huddlesOn,
    onSummarize: () => setSheet('summary'),
  });
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
        onDoubleTap={extras.doubleTap}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2 text-xs text-text-2">
        <span className="font-medium">
          {convo.items.length ? `${convo.items.length} ${convo.items.length === 1 ? 'reply' : 'replies'}` : 'No replies yet. Reply below to start the thread.'}
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
        {info?.locked && (
          <span data-testid="thread-locked" className="inline-flex items-center gap-1 text-accent-ink">
            <Icon as={Lock} size={13} /> Locked{lockedByName ? ` by ${lockedByName}` : ''}
          </span>
        )}
      </div>
    </div>
  ) : null;

  return (
    <Screen>
      <Header
        title={convo.items.length ? 'Thread' : 'Message'}
        subtitle={label && `in ${label}`}
        border
        actions={
          info ? (
            <>
              {!meta?.agentId && <HuddleButton scope={kind === 'channel' ? { channelId: convId } : { dmId: convId }} title={label} />}
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
        onSwipeReply={info?.locked ? null : (m) => extras.setQuote(m)}
        onDoubleTap={extras.doubleTap}
        onJumpTo={extras.jumpToMessage}
        highlightId={extras.jumpTo}
        footer={aiReplies.map((r) => <AiLiveReply key={r.id} reply={r} />)}
      />
      {info?.locked ? (
        <div data-testid="thread-locked-composer" className="flex items-center gap-2 border-t border-line-soft px-4 py-3 text-sm text-text-2">
          <Icon as={Lock} size={15} />
          <span className="flex-1">This thread is locked{lockedByName ? ` by ${lockedByName}` : ''}. You can still read it.</span>
          {info.canLock && (
            <button type="button" className="text-[13px] font-medium text-accent-ink" onClick={toggleLock}>
              Unlock
            </button>
          )}
        </div>
      ) : (
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
        quote={extras.quote}
        onCancelQuote={() => extras.setQuote(null)}
        directory={directory}
        me={me}
        commands={meta?.agentId ? null : commands}
        onSend={(text) => {
          if (tools.editing) {
            convo.edit(tools.editing.id, text);
            tools.setEditing(null);
          } else {
            convo.send(text, { mentionText: mentions.textFor(text), people: mentions.peopleFor(text), quoted: extras.quotedOf(extras.quote) });
            extras.setQuote(null);
          }
        }}
      />
      )}
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
          info?.canLock && { label: info.locked ? 'Unlock thread' : 'Lock thread', icon: info.locked ? LockOpen : Lock, hint: info.locked ? 'Allow new replies again' : 'No new replies; everyone can still read it', onSelect: toggleLock },
          { label: 'Add people', icon: UserPlus, hint: 'They follow the thread and are notified', onSelect: () => setTimeout(() => setSheet('followers'), 220) },
          { label: 'People in this thread', icon: Users, onSelect: () => setTimeout(() => setSheet('people'), 220) },
          { label: 'Share thread', icon: Share2, hint: 'The replies as text, with a link', onSelect: () => share.send(threadTitle(kind, label), threadText()) },
          { label: 'Copy thread', icon: Copy, onSelect: () => share.copy(threadText(), 'Thread copied') },
          share.ready && { label: 'Copy link to thread', icon: Link2, onSelect: () => share.copy(share.threadLink(messageId), 'Link copied') },
          aiOn && api().summarizeThread && { label: 'Summarize thread', icon: Sparkles, hint: 'With Oruinwan AI, from the replies decrypted here', onSelect: () => setTimeout(() => setSheet('summary'), 220) },
        ]}
      />
      <ParticipantsSheet open={sheet === 'people'} onClose={() => setSheet(null)} participants={info?.participants || []} directory={directory} />
      <ThreadPeopleSheet open={sheet === 'followers'} onClose={() => setSheet(null)} messageId={messageId} onChanged={() => invalidate(`messages:${convId}`)} />
      <SummarySheet open={sheet === 'summary'} onClose={() => setSheet(null)} title="Thread summary" options={summaryOptions} />
    </Screen>
  );
}

export function ChannelInfoScreen({ id }) {
  const { data: channels } = useChannels();
  const directory = useDirectory();
  const channel = (channels || []).find((c) => c.id === id);
  const workspace = useWorkspace();
  const me = useSession((s) => s.user?.id);
  const { data: people } = useMembers();
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [query, setQuery] = useState('');

  if (!channel) {
    return (
      <Screen>
        <Header title="Channel" />
        <SkeletonRows />
      </Screen>
    );
  }
  const members = (channel.memberIds || []).map((m) => directory[m]).filter(Boolean);
  // Same rule as the server: workspace owners/admins add to any channel, channel admins to
  // theirs, and members of a public channel to it.
  const workspaceAdmin = ['owner', 'admin'].includes(workspace?.role);
  const channelAdmin = (channel.adminIds || []).includes(me);
  const inChannel = (channel.memberIds || []).includes(me);
  const canAdd = workspaceAdmin || (channel.private ? channelAdmin : inChannel);
  const inIds = new Set(channel.memberIds || []);
  const candidates = searchPeople((people || []).filter((u) => !inIds.has(u.id) && !u.bot && !u.deactivated), query);

  const addPeople = async () => {
    setBusy(true);
    try {
      await api().addChannelMembers(id, picked);
      invalidate('channels');
      toast(picked.length === 1 ? `Added to #${channel.name}` : `${picked.length} people added to #${channel.name}`);
      setAdding(false);
    } catch (err) {
      toast(err.message || 'Could not add them', 'danger');
      invalidate('channels');
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (on) => {
    try {
      await api().setChannelDefault(workspace.id, id, on);
      invalidate('channels');
      toast(on ? `Everyone in the workspace is now in #${channel.name}` : `#${channel.name} is no longer a default channel`);
    } catch (err) {
      toast(err.message || 'Could not change it', 'danger');
    }
  };

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
        {workspaceAdmin && !channel.private && (
          <Section title="Admin">
            <RowGroup footer="Everyone who joins the workspace is added to default channels automatically.">
              <Row
                icon={Users}
                tile="accent"
                title="Default channel"
                trailing={<Toggle checked={Boolean(channel.isDefault)} onChange={setDefault} label="Default channel" />}
              />
            </RowGroup>
          </Section>
        )}
        <Section title={`Members · ${members.length}`}>
          <RowGroup>
            {canAdd && (
              <Row
                icon={UserPlus}
                tile="accent"
                title="Add people"
                subtitle="They're added right away"
                onClick={() => { setPicked([]); setQuery(''); setAdding(true); }}
              />
            )}
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
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add people to #${channel.name}`}
        footer={<Button block loading={busy} disabled={picked.length === 0} onClick={addPeople}>Add {picked.length || ''}</Button>}
      >
        <div className="px-4 pb-2">
          <SearchField value={query} onChange={setQuery} placeholder="Search people" />
        </div>
        <div className="px-2 pb-4">
          {candidates.length ? (
            <RowGroup>
              {candidates.map((u) => (
                <Row
                  key={u.id}
                  leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" />}
                  title={u.name}
                  subtitle={u.title || u.email}
                  trailing={picked.includes(u.id) ? <Icon as={Check} size="sm" className="text-accent-ink" /> : null}
                  chevron={false}
                  onClick={() => setPicked((list) => (list.includes(u.id) ? list.filter((x) => x !== u.id) : [...list, u.id]))}
                />
              ))}
            </RowGroup>
          ) : (
            <EmptyState icon={Users} title={query ? 'Nobody found' : 'Everyone is already here'} body={query ? null : 'Invite people to the workspace first.'} />
          )}
        </div>
      </Sheet>
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

/** Someone's page: who they are, how to reach them, and Message / Voice / Video in one tap. */
export function ProfileScreen({ userId }) {
  const directory = useDirectory();
  const me = useSession((s) => s.user?.id);
  const ws = useSession((s) => s.workspaceId);
  const { data: dms } = useDms();
  const huddlesOn = useHuddlesAvailable();
  const user = directory[userId];
  const [opening, setOpening] = useState(null);
  if (!user) {
    return (
      <Screen>
        <Header title="Profile" />
        <SkeletonRows count={3} />
      </Screen>
    );
  }
  const dmId = async () => {
    const existing = (dms || []).find((d) => !d.isGroup && !d.agentId && d.user?.id === userId);
    if (existing) return existing.id;
    const id = await api().openDm(ws, userId);
    invalidate('dms');
    return id;
  };
  const act = (what) => async () => {
    setOpening(what);
    try {
      const id = await dmId();
      if (what === 'message') {
        nav.replace('conversation', { kind: 'dm', id });
        return;
      }
      await startHuddle({ dmId: id }, user.name, { video: what === 'video' });
    } catch (err) {
      toast(err.message || 'That didn’t work', 'danger');
    } finally {
      setOpening(null);
    }
  };
  // Looking at your own profile: you're online.
  const presence = userId === me ? selfPresence(user) : user.presence;
  const actions = [
    { id: 'message', label: 'Message', icon: MessageCircle },
    huddlesOn && { id: 'voice', label: 'Voice', icon: Headphones },
    huddlesOn && { id: 'video', label: 'Video', icon: Video },
  ].filter(Boolean);
  return (
    <Screen>
      <Header title="" />
      <Body>
        <div className="flex flex-col items-center px-6 pb-4 text-center">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" presence={presence} />
          <h1 className="mt-4 text-2xl font-bold">{user.name}</h1>
          <StandingTag person={user} className="mt-1.5" />
          {user.title && <p className="mt-0.5 text-sm text-text-2">{user.title}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-2">
            <Icon as={Clock} size={13} /> {PRESENCE_TEXT[presence] || 'Offline'}
          </p>
          {userId !== me && (
            <div className="mt-5 grid w-full max-w-sm gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
              {actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={act(a.id)}
                  disabled={Boolean(opening)}
                  className="pressable flex flex-col items-center gap-1.5 rounded-card border border-line-soft bg-surface py-3 text-[13px] font-medium text-accent-ink disabled:opacity-60"
                  data-testid={`profile-${a.id}`}
                >
                  {opening === a.id ? <Spinner /> : <Icon as={a.icon} size={20} />}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Section title="Contact">
          <RowGroup>
            {user.email && <Row icon={Mail} title="Email" value={user.email} onClick={() => copyText(user.email).then((ok) => ok && toast('Email copied'))} />}
            {user.username && <Row icon={AtSign} title="Username" value={`@${user.username}`} />}
            {user.about && <Row icon={Info} title="About" subtitle={user.about} multiline />}
          </RowGroup>
        </Section>
      </Body>
    </Screen>
  );
}

/** New message list: people without a DM yet (by name), then people with one (most recent first). */
export function newMessagePeople(members, dms, me, query) {
  const lastWith = new Map();
  for (const d of dms || []) if (!d.isGroup && !d.agentId && d.user?.id && d.lastAt) lastWith.set(d.user.id, d.lastAt);
  const matched = searchPeople((members || []).filter((u) => u.id !== me && !u.bot && !u.deactivated), query);
  const fresh = matched.filter((u) => !lastWith.has(u.id));
  const known = matched.filter((u) => lastWith.has(u.id));
  if (!query) known.sort((a, b) => lastWith.get(b.id).localeCompare(lastWith.get(a.id)));
  return { fresh, known };
}

const joinNames = (people) => {
  const n = people.map((p) => p.name);
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

/**
 * New message with a "To:" bar, like Slack (and the web app): tap people to add them. One person
 * opens your chat with them; several open your group with exactly those people, or offer to start
 * one. "You" is your notes-to-self chat. `people` ([{ id, name }]) pre-fills it (a group's "+").
 */
export function NewMessageScreen({ people: prefill = null } = {}) {
  const { data: members, loading } = useMembers();
  const me = useSession((s) => s.user?.id);
  const myUser = useSession((s) => s.user);
  const ws = useSession((s) => s.workspaceId);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [picked, setPicked] = useState(() => (Array.isArray(prefill) ? prefill.filter((p) => p?.id && p.id !== me) : []));
  const [groupName, setGroupName] = useState('');
  const { data: dms } = useDms();
  // People you haven't messaged yet come first (that's who a new message is usually for);
  // people you already talk to follow, most recent first. Typing narrows both by word start.
  const { fresh, known } = useMemo(() => newMessagePeople(members, dms, me, query), [members, dms, me, query]);
  const pickedIds = new Set(picked.map((p) => p.id));
  const pickedMe = picked.length === 1 && picked[0].id === me;
  const notPicked = (u) => !pickedIds.has(u.id);
  const meName = myUser?.name || myUser?.username || 'You';
  const showMe = !picked.length && (!query || wordStartMatch(`${meName} you`, query));

  // Who's in the To bar decides the conversation: look it up without creating it.
  const key = picked.map((p) => p.id).sort().join(',');
  const { data: found, loading: finding } = useQuery(
    ws && key && picked.length > 1 && api().findConversation && `findConv:${ws}:${key}`,
    () => api().findConversation(ws, key.split(',')),
    { staleMs: 5_000 },
  );

  const toggle = (u) => {
    setQuery('');
    if (u.id === me || pickedMe) return setPicked(u.id === me ? [{ id: me, name: `${meName} (you)` }] : [{ id: u.id, name: u.name }]);
    setPicked((list) => (list.some((p) => p.id === u.id) ? list.filter((p) => p.id !== u.id) : [...list, { id: u.id, name: u.name }]));
    return undefined;
  };

  const openOne = async () => {
    const u = picked[0];
    setBusy('open');
    try {
      const existing = (dms || []).find((d) => !d.isGroup && !d.agentId && (u.id === me ? d.isSelf : d.user?.id === u.id && !d.isSelf));
      const dmId = existing?.id || (await api().openDm(ws, u.id));
      invalidate('dms');
      nav.replace('conversation', { kind: 'dm', id: dmId });
    } catch (err) {
      toast(err.message || 'Could not open the conversation', 'danger');
    } finally {
      setBusy(null);
    }
  };
  const openGroup = async () => {
    setBusy('open');
    try {
      const id = found?.id || (await api().createGroupDm(ws, picked.map((p) => p.id), groupName))?.id;
      invalidate('dms');
      nav.replace('conversation', { kind: 'dm', id });
    } catch (err) {
      toast(err.message || 'Could not start the group', 'danger');
    } finally {
      setBusy(null);
    }
  };

  const personRow = (u) => (
    <Row
      key={u.id}
      leading={<Avatar name={u.name} src={u.avatarUrl} size="sm" presence={u.presence} />}
      title={u.name}
      subtitle={u.title || u.email || (u.username ? `@${u.username}` : null)}
      chevron={false}
      onClick={() => toggle(u)}
    />
  );

  return (
    <Screen>
      <Header title="New message">
        <div className="px-4 pb-3">
          <div data-testid="to-bar" className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-2">
            <span className="text-[13px] font-semibold text-text-3">To:</span>
            {picked.map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid="to-chip"
                aria-label={`Remove ${p.name}`}
                onClick={() => setPicked((list) => list.filter((x) => x.id !== p.id))}
                className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2 py-0.5 text-[13px] font-semibold text-accent-ink"
              >
                {p.name} <Icon as={X} size={12} />
              </button>
            ))}
            <input
              aria-label="To"
              placeholder={picked.length ? 'Add someone else' : 'Search people'}
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !query && picked.length) setPicked((l) => l.slice(0, -1)); }}
              className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-[15px] text-text outline-none placeholder:text-text-3"
            />
          </div>
        </div>
      </Header>
      <Body>
        {picked.length > 0 && (
          <div data-testid="to-result" className="mx-4 mt-2 rounded-2xl border border-line-soft bg-surface p-4">
            {picked.length === 1 ? (
              <>
                <p className="text-[15px] font-semibold text-text">{pickedMe ? 'Your notes to yourself' : `Your chat with ${picked[0].name}`}</p>
                <p className="mt-0.5 text-[13px] text-text-2">{pickedMe ? 'Notes, links and drafts only you can see.' : 'Add more people to open a group with them instead.'}</p>
                <Button className="mt-3" block loading={busy === 'open'} data-testid="to-open" onClick={openOne}>Open chat</Button>
              </>
            ) : finding && !found ? (
              <p className="text-[14px] text-text-2">Looking for your group…</p>
            ) : found ? (
              <>
                <p className="text-[15px] font-semibold text-text">{found.name || `Your group with ${joinNames(picked)}`}</p>
                <p className="mt-0.5 text-[13px] text-text-2">You already have a group with exactly these people.</p>
                <Button className="mt-3" block loading={busy === 'open'} data-testid="to-open" onClick={openGroup}>Open group</Button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-text">{`You don't have a group with ${joinNames(picked)} yet`}</p>
                <p className="mt-0.5 text-[13px] text-text-2">Start one. Your other chats with these people stay as they are.</p>
                <input
                  aria-label="Group name"
                  placeholder="Group name (optional)"
                  value={groupName}
                  maxLength={80}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-line-strong bg-bg px-3 py-2 text-[15px] text-text outline-none"
                />
                <Button className="mt-2" block loading={busy === 'open'} data-testid="to-start-group" onClick={openGroup}>Start group</Button>
              </>
            )}
          </div>
        )}
        {!picked.length && (
          <RowGroup className="mt-1">
            <Row icon={Users} tile="accent" title="New group" subtitle="Name a group and pick its people" onClick={() => nav.push('newGroup')} />
            <Row icon={Hash} tile="accent" title="Browse channels" onClick={() => nav.push('browseChannels')} />
          </RowGroup>
        )}
        {loading && !members ? (
          <SkeletonRows count={6} />
        ) : (
          <>
            {showMe && (
              <Section title="You">
                <RowGroup>
                  <Row
                    leading={<Avatar name={meName} src={myUser?.avatarUrl} size="sm" />}
                    title={`${meName} (you)`}
                    subtitle="Notes to self"
                    chevron={false}
                    onClick={() => toggle({ id: me, name: meName })}
                  />
                </RowGroup>
              </Section>
            )}
            {[
              ['fresh', fresh.filter(notPicked), query ? 'Start a conversation' : 'People you haven’t messaged'],
              ['known', known.filter(notPicked), query ? 'Already talking' : 'Your conversations'],
            ].map(([k, list, title]) => (list.length ? (
              <Section key={k} title={title}>
                <RowGroup>{list.map(personRow)}</RowGroup>
              </Section>
            ) : null))}
            {!fresh.length && !known.length && !showMe && (
              <EmptyState icon={Users} title={query ? `No one matches “${query}”` : 'No one found'} body="Only people in this workspace can be messaged." />
            )}
          </>
        )}
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
    .filter((c) => wordStartMatch(`${c.name} ${c.topic || ''}`, query))
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

