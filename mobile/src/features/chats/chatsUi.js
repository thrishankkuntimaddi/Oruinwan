// UI state for the Chats tab that other screens can set (e.g. Home → "Direct messages").
import { create } from 'zustand';
import { nav } from '../../app/nav.js';

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
