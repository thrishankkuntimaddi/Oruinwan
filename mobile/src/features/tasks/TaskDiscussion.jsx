import { useState } from 'react';
import { CheckCircle2, Hash, Lock, MessagesSquare, RotateCcw, Send, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { STATUS_META, PRIORITY_META } from '../../data/constants.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Row, RowGroup, Section } from '../../ui/List.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Markdown } from '../../ui/Markdown.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { cx } from '../../ui/cx.js';
import { shortAgo } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { PeoplePicker } from './TaskEditorSheet.jsx';

const statusLabel = (s) => STATUS_META[s]?.label || String(s || '').replace(/_/g, ' ');
const priorityLabel = (p) => PRIORITY_META[p]?.label || String(p || '');
const day = (v) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'none');

/** One line for an automatic entry, same words as the web's Discussion tab. */
export function describeEntry(e) {
  const ev = e?.event || {};
  const name = (id) => ev.names?.[String(id)] || 'someone';
  const names = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map(name).join(', ');
  switch (ev.type) {
    case 'status': return `moved it from ${statusLabel(ev.from)} to ${statusLabel(ev.to)}${ev.meta?.reason ? ` — “${ev.meta.reason}”` : ''}`;
    case 'resolved': return 'resolved the discussion: the task is done';
    case 'reopened': return 'reopened the discussion: the task is no longer done';
    case 'assignee_added': return `assigned ${name(ev.to)}`;
    case 'assignee_removed': return `unassigned ${name(ev.from)}`;
    case 'reassigned': return `reassigned it to ${names(ev.to)}`;
    case 'due_date':
      if (!ev.to) return 'cleared the due date';
      return ev.from ? `changed the due date from ${day(ev.from)} to ${day(ev.to)}` : `set the due date to ${day(ev.to)}`;
    case 'priority': return `changed priority from ${priorityLabel(ev.from)} to ${priorityLabel(ev.to)}`;
    case 'participant_added': return `added ${names(ev.to)} to the discussion`;
    case 'participant_removed': return `removed ${name(ev.from)} from the discussion`;
    case 'thread_linked': return `created this task from a thread${ev.meta?.channelName ? ` in #${ev.meta.channelName}` : ''}`;
    default: return String(ev.type || 'updated').replace(/_/g, ' ');
  }
}

export const discussionKey = (id) => `taskdisc:${id}`;

export function useTaskDiscussion(id) {
  return useQuery(id && api().taskDiscussion && discussionKey(id), () => api().taskDiscussion(id), { staleMs: 10_000 });
}

function openThread(linked) {
  if (!linked || linked.restricted) return;
  nav.push('thread', { kind: linked.convKind, convId: linked.convId, messageId: linked.messageId });
}

/** "From #channel thread" with its latest replies (decrypted on this phone). */
export function LinkedThread({ linked }) {
  if (!linked) return null;
  if (linked.restricted) {
    return (
      <RowGroup>
        <Row icon={Lock} title="From a thread you can't see" />
      </RowGroup>
    );
  }
  const where = linked.channelName ? `#${linked.channelName}` : 'a direct message';
  return (
    <div data-testid="task-linked-thread" className="mx-4 rounded-card border border-line-soft bg-surface">
      <button type="button" onClick={() => openThread(linked)} className="flex w-full items-center gap-2 border-b border-line-soft px-4 py-3 text-left">
        <Icon as={Hash} size={15} />
        <span className="flex-1 text-sm font-medium">
          From {where} thread · {linked.replyCount} {linked.replyCount === 1 ? 'reply' : 'replies'}
        </span>
        {linked.locked && <Icon as={Lock} size={14} />}
        <span className="text-[13px] font-medium text-accent-ink">Open</span>
      </button>
      <div className="space-y-1.5 px-4 py-3 text-sm">
        {linked.parent && (
          <p className="truncate">
            <b>{linked.parent.sender}:</b> {linked.parent.text}
          </p>
        )}
        {linked.replies.map((r) => (
          <p key={r.id} data-testid="task-linked-reply" className="truncate text-text-2">
            <b className="text-text">{r.sender}</b> {r.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/** On the task screen: the Discussion row and the Linked thread. */
export function TaskDiscussionSection({ id, title = '' }) {
  const { data } = useTaskDiscussion(id);
  const comments = (data?.entries || []).filter((e) => e.kind === 'comment');
  const last = comments[comments.length - 1];
  return (
    <>
      <Section title="Discussion">
        <RowGroup>
          <Row
            icon={MessagesSquare}
            title={data?.resolved ? 'Discussion · resolved' : 'Discussion'}
            subtitle={last ? `${last.author?.username || 'Someone'}: ${last.text}` : 'Talk it through with the assignee and creator'}
            value={comments.length ? String(comments.length) : undefined}
            chevron
            onClick={() => nav.push('taskDiscussion', { id, title })}
          />
        </RowGroup>
      </Section>
      {data?.linkedThread && (
        <Section title="Linked thread">
          <LinkedThread linked={data.linkedThread} />
        </Section>
      )}
    </>
  );
}

/** A task's discussion: comments, automatic status / assignee / due-date entries, people. */
export function TaskDiscussionScreen({ id, title = '' }) {
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const { data, loading, error } = useTaskDiscussion(id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);

  const refresh = () => invalidate(discussionKey(id), `task:${id}`);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const entry = await api().postTaskComment(id, body);
      setQueryData(discussionKey(id), (d) => (d && !d.entries.some((e) => e.id === entry.id) ? { ...d, entries: [...d.entries, entry] } : d));
      setText('');
      refresh();
    } catch (err) {
      toast(err.message || 'Could not post your comment', 'danger');
    } finally {
      setSending(false);
    }
  };

  const addPeople = async () => {
    setAdding(false);
    if (!picked.length) return;
    try {
      const added = await api().addTaskParticipants(id, picked);
      toast(added.length ? `Added ${added.length} ${added.length === 1 ? 'person' : 'people'}` : 'They are already in the discussion', 'success');
      setPicked([]);
      refresh();
    } catch (err) {
      toast(err.message || 'Could not add people', 'danger');
    }
  };

  const removePerson = async (p) => {
    try {
      await api().removeTaskParticipant(id, p.id);
      toast(p.id === me ? 'You left the discussion' : `${p.username || 'They'} left the discussion`);
      refresh();
    } catch (err) {
      toast(err.message || 'Could not remove them', 'danger');
    }
  };

  const deleteComment = async (e) => {
    try {
      await api().deleteTaskComment(id, e.id);
      setQueryData(discussionKey(id), (d) => (d ? { ...d, entries: d.entries.filter((x) => x.id !== e.id) } : d));
    } catch (err) {
      toast(err.message || 'Could not delete the comment', 'danger');
    }
  };

  const perms = data?.permissions || {};
  const nameOf = (u) => directory[u?.id]?.name || u?.username || 'Someone';
  const removable = (p) => !p.roles.includes('creator') && !p.roles.includes('assignee') && (p.id === me || perms.canModerate);
  const roleLabel = (roles) => (roles.includes('creator') ? 'Creator' : roles.includes('assignee') ? 'Assignee' : roles.includes('added') ? 'Added' : 'Watching');

  return (
    <Screen>
      <Header
        title="Discussion"
        subtitle={title}
        border
        actions={perms.canAddPeople ? <IconButton icon={UserPlus} label="Add people" onClick={() => setAdding(true)} /> : null}
      />
      <Body onRefresh={refresh}>
        {!data ? (
          error && !loading ? <EmptyState icon={MessagesSquare} title="Couldn't load the discussion" body={error.message} /> : <SkeletonRows count={4} />
        ) : (
          <div data-testid="task-discussion" className="space-y-4 pb-4">
            {data.resolved && (
              <p data-testid="task-discussion-resolved" className="mx-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                <Icon as={CheckCircle2} size={15} /> Resolved — the task is done. It reopens if the task moves out of Done.
              </p>
            )}
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              {data.participants.map((p) => (
                <span key={p.id} data-testid="task-discussion-person" className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-[13px]">
                  <Avatar name={nameOf(p)} src={p.avatarUrl} size="xs" />
                  {nameOf(p)}
                  <span className="text-text-2">· {roleLabel(p.roles)}</span>
                  {removable(p) && (
                    <button type="button" aria-label={p.id === me ? 'Leave the discussion' : `Remove ${nameOf(p)}`} onClick={() => removePerson(p)} className="text-text-2">
                      <Icon as={UserMinus} size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {data.linkedThread && <LinkedThread linked={data.linkedThread} />}
            {data.entries.length === 0 ? (
              <EmptyState icon={MessagesSquare} title="No comments yet" body="Status changes, reassignments and due-date changes show up here too." />
            ) : (
              <ol className="space-y-3 px-4">
                {data.entries.map((e) =>
                  e.kind === 'event' ? (
                    <li key={e.id} data-testid="task-discussion-event" className="flex items-center gap-2 text-[13px] text-text-2">
                      <Icon as={e.event?.type === 'resolved' ? CheckCircle2 : e.event?.type === 'reopened' ? RotateCcw : MessagesSquare} size={13} />
                      <span className="flex-1">
                        <b className="text-text">{e.author ? nameOf(e.author) : 'Oruinwan'}</b> {describeEntry(e)} · {shortAgo(e.at)}
                      </span>
                    </li>
                  ) : (
                    <li key={e.id} data-testid="task-discussion-comment" className="flex items-start gap-3">
                      <Avatar name={nameOf(e.author)} src={e.author?.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold">{nameOf(e.author)}</span>
                          <span className="text-xs text-text-2">{shortAgo(e.at)}</span>
                          {(e.author?.id === me || perms.canModerate) && (
                            <button type="button" aria-label="Delete comment" onClick={() => deleteComment(e)} className="ml-auto text-text-2">
                              <Icon as={Trash2} size={14} />
                            </button>
                          )}
                        </div>
                        <Markdown text={e.text} className="text-sm" />
                        {e.attachments.map((a) => (
                          <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="block text-xs text-accent-ink">
                            📎 {a.name}
                          </a>
                        ))}
                      </div>
                    </li>
                  ),
                )}
              </ol>
            )}
          </div>
        )}
      </Body>
      {perms.canComment && (
        <div className="flex items-end gap-2 border-t border-line-soft bg-surface px-3 py-2 pb-safe">
          <textarea
            aria-label="Write a comment"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={data?.resolved ? 'Comment on this resolved task (@ to mention)' : 'Write a comment (@ to mention)'}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-3.5 py-2 text-[15px] outline-none"
          />
          <button
            type="button"
            aria-label="Send comment"
            disabled={sending || !text.trim()}
            onClick={send}
            className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full', text.trim() ? 'bg-accent text-on-accent' : 'bg-surface-3 text-text-3')}
          >
            <Icon as={Send} size={17} />
          </button>
        </div>
      )}
      <PeoplePicker open={adding} title="Add to the discussion" value={picked} onChange={setPicked} onClose={addPeople} />
    </Screen>
  );
}
