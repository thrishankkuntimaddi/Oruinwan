// Slash commands in the phone composer. The commands, their arguments and help text are shared
// with the web app (platform/commands/slashCommands.js); this file is the phone's list, help bar
// and the actions behind them.
import { X } from 'lucide-react';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { api } from '../../data/session.js';
import { invalidate, setQueryData } from '../../data/query.js';
import { nav } from '../../app/nav.js';
import { toast } from '../../lib/bus.js';
import { startHuddle } from '../huddles/huddle.js';

export {
  filterCommands, prepareCommand, runPrepared, typingHint, helpLines, runsWithoutArgs, parseCommandLine,
} from '../../../../platform/commands/slashCommands.js';

const realId = (id) => (id && !String(id).startsWith('tmp') ? String(id) : null);

/** The list shown while typing "/name": tap to pick. `active` is the row the arrow keys are on. */
export function SlashList({ items, active = 0, onPick }) {
  if (!items) return null;
  if (!items.length) {
    return (
      <p className="animate-fade-in border-b border-line-soft px-4 py-3 text-[13px] text-text-2" data-testid="slash-menu">
        No command like that. Type /help to see them all.
      </p>
    );
  }
  return (
    <div role="listbox" aria-label="Commands" data-testid="slash-menu" className="animate-fade-in max-h-64 overflow-y-auto border-b border-line-soft">
      {items.map((c, i) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={i === active}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className={cx('flex w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2', i === active && 'bg-surface-2')}
          data-testid={`slash-item-${c.name}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[15px]" aria-hidden="true">
            {c.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">
              <span className="font-mono font-semibold">/{c.name}</span>
              {c.args && <span className="ml-1.5 font-mono text-[12px] text-text-3">{c.args}</span>}
            </span>
            <span className="block truncate text-[12px] text-text-2">{c.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Above the composer:
 *   { kind: 'hint', usage, description, unavailable }   while typing a command's arguments
 *   { kind: 'error', message }                          the command can't run as typed
 *   { kind: 'unknown', name }                           not a command: send as text?
 *   { kind: 'help', lines }                             /help
 */
export function SlashBar({ notice, onClose, onSendAsText, onEdit }) {
  if (!notice) return null;
  const close = onClose && (
    <button type="button" aria-label="Close" onPointerDown={(e) => e.preventDefault()} onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2">
      <Icon as={X} size={14} />
    </button>
  );
  if (notice.kind === 'hint') {
    return (
      <div className="animate-fade-in border-b border-line-soft px-4 py-2" role="status" data-testid="slash-hint">
        <p className="font-mono text-[12px] text-text">{notice.usage}</p>
        <p className={cx('text-[12px]', notice.unavailable ? 'text-danger' : 'text-text-2')}>{notice.unavailable || notice.description}</p>
      </div>
    );
  }
  if (notice.kind === 'error') {
    return (
      <div className="animate-pop-in flex items-start gap-2 border-b border-line-soft bg-danger/8 px-4 py-2" role="alert" data-testid="slash-error">
        <p className="min-w-0 flex-1 text-[13px] text-text">{notice.message}</p>
        {close}
      </div>
    );
  }
  if (notice.kind === 'unknown') {
    return (
      <div className="animate-pop-in flex items-center gap-2 border-b border-line-soft px-4 py-2" role="alert" data-testid="slash-unknown">
        <p className="min-w-0 flex-1 text-[13px]">
          <span className="font-mono">/{notice.name}</span> isn't a command. Send as text?
        </p>
        <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onEdit} className="rounded-full px-3 py-1.5 text-[13px] font-medium text-text-2">
          Edit
        </button>
        <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onSendAsText} className="rounded-full bg-gold px-3 py-1.5 text-[13px] font-medium text-on-accent" data-testid="slash-send-as-text">
          Send as text
        </button>
      </div>
    );
  }
  if (notice.kind === 'help') {
    return (
      <div className="animate-pop-in max-h-72 overflow-y-auto border-b border-line-soft px-4 py-2" role="dialog" aria-label="Commands" data-testid="slash-help">
        <div className="flex items-center pb-1">
          <p className="flex-1 text-[14px] font-semibold">Commands</p>
          {close}
        </div>
        {notice.lines.map((l) => (
          <div key={l.usage} className={cx('py-1', !l.available && 'opacity-55')}>
            <p className="font-mono text-[12px]">{l.usage}</p>
            <p className="text-[12px] text-text-2">
              {l.description}
              {l.available ? '' : ' · not here'}
            </p>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/**
 * The phone's actions for slash commands in a conversation or a thread. Everything a command
 * posts goes through `convo.send`, the normal end-to-end encrypted path.
 */
export function phoneCommands({
  conv, ws, me, meta, label, isGroup = false, threadOf = null, canPost = true, canManage = false,
  convo, mentions, people = [], onSummarize = null, onGroupOffer = null, aiOn = true, huddlesOn = true,
}) {
  const kind = conv.kind;
  const send = async (text) => {
    const saved = await convo.send(text, { mentionText: mentions?.textFor?.(text), people: mentions?.peopleFor?.(text) });
    return realId(saved?.id) ? { id: saved.id } : null;
  };
  const scope = kind === 'channel' ? { channelId: conv.id } : { dmId: conv.id };
  const has = (name) => typeof api()[name] === 'function';
  const ctx = {
    where: threadOf ? 'thread' : kind === 'channel' ? 'channel' : isGroup ? 'group' : 'dm',
    canPost,
    isChannelAdmin: kind === 'channel' && Boolean(canManage),
    me: { id: me },
    people: (people || []).map((p) => ({ id: p.id, username: p.username, name: p.name })).filter((p) => p.id && p.username),
    send,
    unsend: (id) => api().deleteMessage(conv, id),
    lastMessageId: () => {
      const items = convo.items || [];
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const id = realId(items[i]?.id);
        if (id && !items[i].pending && !items[i].failed) return id;
      }
      return threadOf ? realId(threadOf) : null;
    },
    toast: (message, tone) => toast(message, tone === 'error' ? 'danger' : tone),
    setStatus: has('setCustomStatus') ? (status) => api().setCustomStatus(status) : undefined,
    setPresence: has('setPresence') ? (p) => api().setPresence(p) : undefined,
    openSearch: (words) => nav.push('search', { q: [kind === 'channel' && meta?.name ? `in:#${meta.name}` : '', words].filter(Boolean).join(' ') }),
  };
  if (has('createTask')) {
    ctx.createTask = async ({ title, assigneeIds, dueDate, linkedMessageId }) => {
      const task = await api().createTask(ws, {
        title, assigneeIds, due: dueDate, status: 'todo', priority: 'medium', linkedMessageId, source: 'chat',
        ...(kind === 'channel' ? { channelId: conv.id } : {}),
      });
      invalidate('tasks:');
      return task;
    };
  }
  if (has('remindMe')) {
    ctx.remind = ({ messageId, at, note, forUserId }) => api().remindMe(conv, messageId, at, note, { forUserId }).then((r) => (invalidate('reminders:'), r));
  }
  if (has('createPoll')) {
    ctx.createPoll = async ({ question, options }) => {
      const m = await api().createPoll(conv, { question, options, allowMultiple: false, anonymous: false, endDate: null });
      if (m) convo.append?.(m);
    };
  }
  if (has('sendChecklist')) {
    ctx.createChecklist = async (list) => {
      const m = await api().sendChecklist(conv, list);
      if (m) convo.append?.(m);
    };
  }
  if (huddlesOn && !meta?.agentId) {
    ctx.startCall = ({ video }) => startHuddle(scope, label, { video });
    if (has('openDm')) {
      ctx.callPerson = async (person) => {
        const dmId = await api().openDm(ws, person.id);
        const id = dmId?.id || dmId;
        invalidate('dms');
        nav.push('conversation', { kind: 'dm', id });
        startHuddle({ dmId: id }, person.name || person.username);
      };
    }
  }
  if (aiOn) {
    ctx.askAi = (question) => send(`@ai ${question}`);
    if (onSummarize) ctx.summarize = onSummarize;
  }
  if (!threadOf && has('scheduleMessage')) {
    ctx.scheduleMessage = async (text, at) => {
      await api().scheduleMessage(ws, conv, text, at);
      invalidate('scheduled:');
    };
  }
  if (!threadOf) {
    ctx.invite = async (list) => {
      const ids = list.map((p) => p.id);
      if (kind === 'channel') {
        await api().addChannelMembers(conv.id, ids);
        invalidate('channels');
        toast(list.length === 1 ? `Added to ${label}` : `${list.length} people added to ${label}`, 'success');
      } else if (isGroup) {
        await api().addGroupDmMembers(conv.id, ids);
        invalidate('dms');
        toast(list.length === 1 ? 'Added to the group' : `${list.length} people added to the group`, 'success');
      } else if (onGroupOffer) {
        onGroupOffer(list);
      } else {
        throw new Error('Start a group from the + button to chat with more people.');
      }
    };
    if (kind === 'channel' || isGroup) {
      ctx.leave = async () => {
        if (kind === 'channel') await api().leaveChannel(conv.id);
        else await api().leaveGroupDm(conv.id);
        invalidate(kind === 'channel' ? 'channels' : 'dms');
        toast(kind === 'channel' ? `You left ${label}` : 'You left the group', 'success');
        nav.pop();
      };
    }
    ctx.setMuted = async (muted) => {
      if (kind === 'channel') {
        setQueryData(`channelPolicy:${conv.id}`, (p) => (p ? { ...p, muted } : p));
        setQueryData(`channels:${ws}`, (l) => l?.map((c) => (c.id === conv.id ? { ...c, muted } : c)));
        await api().setChannelMuted(conv.id, muted);
      } else {
        setQueryData(`dmStatus:${conv.id}`, (s) => ({ ...(s || {}), muted }));
        await api().setDmMuted(conv.id, muted);
      }
    };
    if (kind === 'channel' && has('setChannelTopic')) {
      ctx.setTopic = async (topic) => {
        await api().setChannelTopic(conv.id, topic);
        invalidate('channels');
      };
    }
  }
  return ctx;
}
