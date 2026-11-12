// Assistants in conversations: a message that mentions @ai (Oruinwan AI) or a model the workspace
// connected (@claude, @chatgpt, @gpt, @gemini, @grok, @local) gets an answer in the same conversation.
// Same rule as the server (server/src/features/ai/assistants.js); web and phone import this file.
export const AI_MENTION_RE = /(^|[\s(])@(oruinwan(?:[-_ ]?ai)?|ai|claude|chatgpt|gpt|gemini|grok|local)\b/i;

export const mentionsAI = (text) => AI_MENTION_RE.test(String(text || ''));
