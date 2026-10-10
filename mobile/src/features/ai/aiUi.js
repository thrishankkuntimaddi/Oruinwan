// Lets any screen hand a question to the AI tab ("Summarize this channel", "Break this task down").
import { create } from 'zustand';
import { nav } from '../../app/nav.js';

export const useAiUi = create((set) => ({
  pending: null, // a prompt waiting to be sent when the AI tab opens
  take: () => {
    let value = null;
    set((s) => {
      value = s.pending;
      return { pending: null };
    });
    return value;
  },
}));

export function askAiAbout(prompt) {
  useAiUi.setState({ pending: { prompt, at: Date.now() } });
  nav.open('ai');
}
