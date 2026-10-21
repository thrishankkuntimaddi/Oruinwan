// UI state for the Chats tab that other screens can set (e.g. Home → "Direct messages").
import { create } from 'zustand';
import { nav } from '../../app/nav.js';
import { useChannels, useDms } from '../../data/hooks.js';

export const useChatsUi = create((set) => ({
  segment: 'all', // all | channels | dms
  setSegment: (segment) => set({ segment }),
}));

export function openChats(segment = 'all') {
  useChatsUi.getState().setSegment(segment);
  nav.open('chats');
}

export function openConversation(kind, id, extra = {}) {
  nav.push('conversation', { kind, id, ...extra }, { tab: 'chats' });
}

/** "#general", a person's name, or a fallback, for a stored message's conversation. */
export function useConversationName() {
  const { data: channels } = useChannels();
  const { data: dms } = useDms();
  return (conv) => {
    if (!conv) return 'a conversation';
    if (conv.kind === 'channel') return conv.name || `#${(channels || []).find((c) => c.id === conv.id)?.name || 'channel'}`;
    return (dms || []).find((d) => d.id === conv.id)?.user?.name || 'a direct message';
  };
}

/** Opens a saved or reminded message: its thread for a reply, else its conversation. */
export function openStoredMessage(conv, m) {
  if (!conv) return;
  if (m?.parentId) nav.push('thread', { kind: conv.kind, convId: conv.id, messageId: m.parentId }, { tab: 'chats' });
  else openConversation(conv.kind, conv.id, m?.id ? { highlight: m.id } : {});
}
