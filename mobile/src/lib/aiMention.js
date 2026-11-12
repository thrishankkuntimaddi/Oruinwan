// Assistants in conversations: a message that mentions @ai (Oruinwan AI) or a model the workspace
// connected (@claude, @chatgpt, @gpt, @gemini, @grok) gets an answer in the same conversation.
// Same rule as the server and the web client: one copy in platform/people/aiMention.js.
export { AI_MENTION_RE, mentionsAI } from '../../../platform/people/aiMention.js';

export const DEFAULT_ASSISTANT = { id: 'default', name: 'Oruinwan AI', mention: 'ai' };

/**
 * While typing: when the word before the caret is "@…" and could become an assistant's mention,
 * returns { start, end, matches } (matches: the assistants it could be). Otherwise null.
 */
export function assistantMentionAt(text, caret = text.length, assistants = [DEFAULT_ASSISTANT]) {
  const before = text.slice(0, caret);
  const match = /(^|\s)(@[a-z-]*)$/i.exec(before);
  if (!match) return null;
  const word = match[2].slice(1).toLowerCase();
  const matches = assistants.filter((a) => {
    const names = a.id === 'default' ? ['ai', 'oruinwan'] : [a.mention];
    return names.some((n) => n.startsWith(word)) && !names.includes(word);
  });
  if (!matches.length) return null;
  return { start: caret - match[2].length, end: caret, matches };
}

/** The Oruinwan AI–only form, kept for callers that only offer @ai. */
export function aiMentionAt(text, caret = text.length) {
  const at = assistantMentionAt(text, caret);
  return at ? { start: at.start, end: at.end } : null;
}
