// Lets any screen hand a question to Oruinwan AI ("Summarize this channel", "Break this task down").
import { create } from 'zustand';
import { nav } from '../../app/nav.js';

export const useAiUi = create((set) => ({
  pending: null, // a prompt waiting to be sent when the AI screen opens
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

/**
 * Continue a conversation from the quick AI window on the full screen: the same messages, and
 * the question still being typed (if any) asked there. `turns` are [{ q, a, done }].
 */
export function continueInAi(turns, prompt = '') {
  const at = Date.now();
  const messages = [];
  (turns || []).forEach((t, i) => {
    if (!t?.q) return;
    messages.push({ id: `qu${at}-${i}`, role: 'user', content: t.q, at });
    if (t.a || t.error) messages.push({ id: `qa${at}-${i}`, role: 'assistant', text: t.a || t.error, at, done: true });
  });
  const thread = { id: `ai-quick-${at}`, title: (turns?.[0]?.q || prompt || '').slice(0, 60), messages };
  useAiUi.setState({ pending: { prompt: String(prompt || '').trim() || null, thread, at } });
  nav.open('ai');
}
