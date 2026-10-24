// Home › Unread: every conversation with new messages, grouped like the Chats tab
// (Channels, Direct messages, Agents). Tapping one opens it in Chats.
import { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { useChannels, useDms } from '../../data/hooks.js';
import { invalidate } from '../../data/query.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { Section } from '../../ui/List.jsx';
import { ConversationRow, chatSections, isUnread } from './ChatsScreen.jsx';

/** The unread conversations in each Chats section: { channels, people, agentDms }. */
export function unreadSections(channels = [], dms = []) {
  const all = chatSections(channels, dms);
  return {
    channels: all.channels.filter(isUnread),
    people: all.people.filter(isUnread),
    agentDms: all.agentDms.filter(isUnread),
  };
}

export function UnreadScreen() {
  const { data: channels, loading: cLoading } = useChannels();
  const { data: dms, loading: dLoading } = useDms();
  const groups = useMemo(() => unreadSections(channels || [], dms || []), [channels, dms]);
  const total = groups.channels.length + groups.people.length + groups.agentDms.length;
  const loading = (cLoading && !channels) || (dLoading && !dms);

  const sections = [
    { key: 'channels', title: 'Channels', kind: 'channel', items: groups.channels },
    { key: 'people', title: 'Direct messages', kind: 'dm', items: groups.people },
    { key: 'agents', title: 'Agents', kind: 'dm', items: groups.agentDms },
  ].filter((s) => s.items.length);

  return (
    <Screen>
      <Header title="Unread" subtitle={loading ? '' : total ? `${total} ${total === 1 ? 'conversation' : 'conversations'}` : 'All caught up'} />
      <Body onRefresh={() => invalidate('channels', 'dms')}>
        {loading ? (
          <SkeletonRows count={6} />
        ) : !total ? (
          <EmptyState icon={MessageCircle} title="No unread messages" body="New messages in your channels, direct messages and agent chats show up here." />
        ) : (
          sections.map((s) => (
            <Section key={s.key} title={s.title}>
              <div className="mx-4 overflow-hidden rounded-card border border-line-soft bg-surface divide-y divide-line-soft">
                {s.items.map((item) => (
                  <ConversationRow key={item.id} kind={s.kind} item={item} />
                ))}
              </div>
            </Section>
          ))
        )}
      </Body>
    </Screen>
  );
}
