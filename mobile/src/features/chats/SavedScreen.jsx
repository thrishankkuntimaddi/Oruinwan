// Saved for later and Remind me: the messages you kept, and the reminders still to come.
import { useState } from 'react';
import { Bookmark, BellRing, BookmarkX, BellOff, Hash, MessageCircle } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { useDirectory } from '../../data/hooks.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Segmented } from '../../ui/Controls.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { plainPreview } from '../../ui/Markdown.jsx';
import { shortAgo } from '../../lib/time.js';
import { reminderLabel } from '../../lib/reminders.js';
import { toast } from '../../lib/bus.js';
import { openStoredMessage, useConversationName } from './chatsUi.js';

export function preview(m) {
  if (!m) return 'This message is no longer available.';
  if (m.poll) return `📊 ${m.poll.question}`;
  if (m.state === 'locked') return 'Encrypted. Unlock your messages to read.';
  if (m.state !== 'ok') return m.attachments?.[0]?.name || m.text || 'Attachment';
  if (m.type === 'checklist') return '☑️ Checklist';
  return plainPreview(m.text, 160) || m.attachments?.[0]?.name || 'Message';
}

export function MessageCard({ m, conv, convName, directory, meta, action, onOpen }) {
  const author = m ? m.author || directory[m.authorId] : null;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <button type="button" onClick={() => (onOpen ? onOpen(m) : openStoredMessage(conv, m))} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <Avatar name={author?.name || '?'} src={author?.avatarUrl} size="sm" className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold">{author?.name || 'Someone'}</span>
            {m?.at && <span className="shrink-0 text-[11px] text-text-3">{shortAgo(m.at)}</span>}
          </span>
          <span className="mt-0.5 block text-[14px] leading-snug break-words text-text">{preview(m)}</span>
          <span className="mt-1 flex items-center gap-1 text-[12px] text-text-2">
            <Icon as={conv?.kind === 'channel' ? Hash : MessageCircle} size={12} /> {convName}
            {meta && <span className="text-text-3"> · {meta}</span>}
          </span>
        </span>
      </button>
      {action}
    </div>
  );
}

export function SavedScreen({ tab: initialTab = 'saved' }) {
  const ws = useSession((s) => s.workspaceId);
  const directory = useDirectory();
  const nameOf = useConversationName();
  const [tab, setTab] = useState(initialTab);
  const saved = useQuery(tab === 'saved' && ws && `saved:${ws}`, () => api().savedMessages(ws));
  const reminders = useQuery(tab === 'reminders' && ws && `reminders:${ws}`, () => api().reminders(ws), { staleMs: 10_000 });

  const unsave = async (item) => {
    setQueryData(`saved:${ws}`, (list) => list?.filter((x) => x.message.id !== item.message.id));
    try {
      await api().toggleSave(item.conv, item.message.id);
      invalidate(`messages:${item.conv.id}`);
      toast('Removed from saved');
    } catch (err) {
      toast(err.message || 'Could not remove it', 'danger');
      invalidate('saved:');
    }
  };
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

  const list = tab === 'saved' ? saved : reminders;
  return (
    <Screen>
      <Header title="Saved items">
        <div className="px-4 pb-3">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'saved', label: 'Saved for later' },
              { value: 'reminders', label: 'Reminders' },
            ]}
          />
        </div>
      </Header>
      <Body onRefresh={() => invalidate(tab === 'saved' ? 'saved:' : 'reminders')}>
        {list.loading ? (
          <SkeletonRows />
        ) : list.error && !list.data ? (
          <EmptyState icon={tab === 'saved' ? Bookmark : BellRing} title="Couldn't load" body={list.error.message} />
        ) : !list.data?.length ? (
          tab === 'saved' ? (
            <EmptyState icon={Bookmark} title="Nothing saved yet" body="Long-press a message and choose Save for later to keep it here." />
          ) : (
            <EmptyState icon={BellRing} title="No reminders" body="Long-press a message and choose Remind me about this." />
          )
        ) : (
          <div className="mx-4 mt-1 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
            {tab === 'saved'
              ? saved.data.map((item) => (
                  <MessageCard
                    key={item.message.id}
                    m={item.message}
                    conv={item.conv}
                    convName={nameOf(item.conv)}
                    directory={directory}
                    action={
                      <button type="button" aria-label="Remove from saved" onClick={() => unsave(item)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
                        <Icon as={BookmarkX} size={17} />
                      </button>
                    }
                  />
                ))
              : reminders.data.map((r) => (
                  <MessageCard
                    key={r.id}
                    m={r.message}
                    conv={r.conv}
                    convName={nameOf(r.conv)}
                    directory={directory}
                    meta={[reminderLabel(r.at), r.note].filter(Boolean).join(' · ')}
                    action={
                      <button type="button" aria-label="Cancel reminder" onClick={() => cancel(r)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-2 active:bg-surface-2">
                        <Icon as={BellOff} size={17} />
                      </button>
                    }
                  />
                ))}
          </div>
        )}
      </Body>
    </Screen>
  );
}
