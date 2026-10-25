// Drafts, scheduled and sent messages, in one place (side panel → Drafts & scheduled / Sent).
import { useMemo, useState } from 'react';
import { CalendarClock, Clock3, PenLine, Send, Trash2, TriangleAlert } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { invalidate, setQueryData, useQuery } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Segmented } from '../../ui/Controls.jsx';
import { ActionSheet } from '../../ui/Overlay.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { plainPreview } from '../../ui/Markdown.jsx';
import { chatListTime } from '../../lib/time.js';
import { toast } from '../../lib/bus.js';
import { openConversation, useConversationName } from './chatsUi.js';
import { clearDraft, draftsIn, useDrafts } from './drafts.js';
import { ScheduleSheet } from './ScheduleSheet.jsx';

const whenLabel = (d) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Item({ icon, tone, title, body, meta, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-2" data-testid={testId}>
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-accent/12 text-accent-ink'}`}>
        <Icon as={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</span>
          {meta && <span className="shrink-0 text-[11px] text-text-3">{meta}</span>}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-2">{body}</span>
      </span>
    </button>
  );
}

export function OutgoingScreen({ tab: initialTab = 'scheduled' }) {
  const ws = useSession((s) => s.workspaceId);
  const [tab, setTab] = useState(initialTab === 'sent' ? 'sent' : initialTab === 'drafts' ? 'drafts' : 'scheduled');
  const nameOf = useConversationName();
  const all = useDrafts((s) => s.all);
  const drafts = useMemo(() => draftsIn(all, ws), [all, ws]);
  const scheduled = useQuery(tab === 'scheduled' && api().scheduledMessages && ws && `scheduled:${ws}`, () => api().scheduledMessages(ws), { staleMs: 10_000 });
  const sent = useQuery(tab === 'sent' && api().sentMessages && ws && `sent:${ws}`, () => api().sentMessages(ws), { staleMs: 20_000 });
  const [menu, setMenu] = useState(null);
  const [moving, setMoving] = useState(null);

  const cancel = async (s) => {
    setQueryData(`scheduled:${ws}`, (l) => l?.filter((x) => x.id !== s.id));
    try {
      await api().cancelScheduled(s.id);
      toast('Scheduled message cancelled');
    } catch (err) {
      toast(err.message || 'Could not cancel it', 'danger');
      invalidate('scheduled:');
    }
  };
  const sendNow = async (s) => {
    try {
      await api().sendScheduledNow(s.id);
      toast('Sent', 'success');
    } catch (err) {
      toast(err.message || 'Could not send it', 'danger');
    } finally {
      invalidate('scheduled:', 'channels', 'dms');
    }
  };

  return (
    <Screen>
      <Header title="Drafts & sent">
        <div className="px-4 pb-3">
          <Segmented
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'drafts', label: 'Drafts', count: drafts.length },
              { value: 'scheduled', label: 'Scheduled', count: scheduled.data?.length || 0 },
              { value: 'sent', label: 'Sent' },
            ]}
          />
        </div>
      </Header>
      <Body onRefresh={() => invalidate('scheduled:', 'sent:')}>
        {tab === 'drafts' &&
          (drafts.length ? (
            <div className="divide-y divide-line-soft">
              {drafts.map((d) => (
                <Item
                  key={`${d.kind}:${d.id}`}
                  icon={PenLine}
                  title={nameOf({ kind: d.kind, id: d.id })}
                  body={plainPreview(d.text, 160)}
                  meta={chatListTime(d.at)}
                  onClick={() => setMenu({ type: 'draft', item: d })}
                  testId="draft-row"
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={PenLine} title="No drafts" body="What you type in a conversation and don't send is kept here." />
          ))}
        {tab === 'scheduled' &&
          (scheduled.loading && !scheduled.data ? (
            <SkeletonRows count={4} />
          ) : scheduled.data?.length ? (
            <div className="divide-y divide-line-soft">
              {scheduled.data.map((s) => (
                <Item
                  key={s.id}
                  icon={s.status === 'failed' ? TriangleAlert : Clock3}
                  tone={s.status === 'failed' ? 'danger' : null}
                  title={nameOf(s.conv)}
                  body={s.status === 'failed' ? `Not sent: ${s.error || 'try again'}` : plainPreview(s.text, 160) || 'Encrypted message'}
                  meta={s.status === 'failed' ? 'Failed' : whenLabel(s.sendAt)}
                  onClick={() => setMenu({ type: 'scheduled', item: s })}
                  testId="scheduled-row"
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarClock} title="Nothing scheduled" body="In a conversation, press and hold Send (or + → Send later) to pick when it goes out." />
          ))}
        {tab === 'sent' &&
          (sent.loading && !sent.data ? (
            <SkeletonRows count={5} />
          ) : sent.data?.length ? (
            <div className="divide-y divide-line-soft">
              {sent.data.map((m) => (
                <Item
                  key={m.id}
                  icon={Send}
                  title={nameOf(m.conv)}
                  body={m.attachments?.length ? `📎 ${m.attachments[0].name}` : plainPreview(m.text, 160) || 'Message'}
                  meta={chatListTime(m.at)}
                  onClick={() => openConversation(m.conv.kind, m.conv.id, { highlight: m.id })}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Send} title="Nothing sent yet" body="Messages you send in this workspace show up here." />
          ))}
      </Body>
      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu ? nameOf(menu.type === 'draft' ? { kind: menu.item.kind, id: menu.item.id } : menu.item.conv) : ''}
        actions={
          menu?.type === 'draft'
            ? [
                { label: 'Continue writing', icon: PenLine, onSelect: () => openConversation(menu.item.kind, menu.item.id) },
                { label: 'Discard draft', icon: Trash2, danger: true, onSelect: () => clearDraft(ws, { kind: menu.item.kind, id: menu.item.id }) },
              ]
            : menu?.type === 'scheduled'
              ? [
                  { label: 'Send now', icon: Send, onSelect: () => sendNow(menu.item) },
                  { label: 'Change time', icon: CalendarClock, onSelect: () => setTimeout(() => setMoving(menu.item), 220) },
                  { label: 'Open conversation', icon: PenLine, onSelect: () => openConversation(menu.item.conv.kind, menu.item.conv.id) },
                  { label: 'Cancel', icon: Trash2, danger: true, onSelect: () => cancel(menu.item) },
                ]
              : []
        }
      />
      <ScheduleSheet
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        preview={moving?.text}
        onPick={async (when) => {
          const item = moving;
          setMoving(null);
          try {
            await api().rescheduleMessage(item.id, when);
            toast(`Moved to ${whenLabel(when)}`, 'success');
          } catch (err) {
            toast(err.message || 'Could not change the time', 'danger');
          } finally {
            invalidate('scheduled:');
          }
        }}
      />
    </Screen>
  );
}
