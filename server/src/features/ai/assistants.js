'use strict';

/**
 * The assistants a workspace can talk to: Oruinwan AI (the workspace's default engine) and each
 * outside model an admin connected (Settings → AI). People pick one in the AI panel, or mention
 * it in a conversation: @ai, @claude, @chatgpt, @gemini, @grok.
 */

const AIProvider = require('../integrations/ai-provider.model');
const { modelsFor } = require('../../../../ai/providers');

const CATALOG = {
  default: { name: 'Oruinwan AI', mention: 'ai', aliases: ['ai', 'oruinwan', 'oruinwan-ai', 'oruinwan_ai', 'oruinwanai'] },
  anthropic: { name: 'Claude', mention: 'claude', aliases: ['claude'], maker: 'Anthropic' },
  openai: { name: 'ChatGPT', mention: 'chatgpt', aliases: ['chatgpt', 'gpt'], maker: 'OpenAI' },
  gemini: { name: 'Gemini', mention: 'gemini', aliases: ['gemini'], maker: 'Google' },
  xai: { name: 'Grok', mention: 'grok', aliases: ['grok'], maker: 'xAI' },
  local_llm: { name: 'Self-hosted model', mention: 'local', aliases: ['local'], maker: 'Your server' },
};

// 'claude' is an older name for the anthropic provider.
const canonical = (provider) => (provider === 'claude' ? 'anthropic' : provider);

const ALIAS_TO_ID = Object.fromEntries(
  Object.entries(CATALOG).flatMap(([id, a]) => a.aliases.map((alias) => [alias, id])),
);

/** Any assistant mention: @ai, @oruinwan(-ai), @claude, @chatgpt, @gpt, @gemini, @grok, @local. */
const MENTION_RE = /(^|[\s(])@(oruinwan(?:[-_ ]?ai)?|ai|claude|chatgpt|gpt|gemini|grok|local)\b/i;

/** Which assistant a message addresses ('default', 'anthropic', …), or null. The first mention wins. */
function assistantForMention(text) {
  const m = MENTION_RE.exec(String(text || ''));
  if (!m) return null;
  return ALIAS_TO_ID[m[2].toLowerCase().replace(/ /g, '-')] || 'default';
}

function describe(id) {
  return CATALOG[canonical(id)] || null;
}

/**
 * The assistants this person can use in this workspace, default first:
 * [{ id, name, mention, maker, model, isDefault, source: 'personal'|'workspace' }]
 */
async function listAssistants(workspaceId, { defaultProvider, defaultModel, userId = null } = {}) {
  const records = workspaceId ? await AIProvider.find({ workspaceId, status: 'active' }).lean() : [];
  const list = [{ id: 'default', ...pick(CATALOG.default), model: defaultModel || null, provider: defaultProvider || null, isDefault: true }];
  const seen = new Set();
  // The person's own connections first: they answer for this person even when the workspace has one too.
  if (workspaceId && userId) {
    const mine = await require('../connections/connections.service').usableAgents(workspaceId, userId);
    for (const c of mine) {
      if (!CATALOG[c.provider]) continue;
      seen.add(c.provider);
      list.push({ id: c.provider, ...pick(CATALOG[c.provider]), model: c.model || modelsFor(c.provider).chat, provider: c.provider, isDefault: false, source: 'personal' });
    }
  }
  for (const r of records) {
    const id = canonical(r.provider);
    if (seen.has(id) || !CATALOG[id]) continue;
    seen.add(id);
    list.push({ id, ...pick(CATALOG[id]), model: r.config?.model || modelsFor(id).chat, provider: id, isDefault: false, source: 'workspace' });
  }
  return list;
}

const pick = (a) => ({ name: a.name, mention: a.mention, maker: a.maker || null });

/**
 * When a connected model refused its API key (wrong, revoked or out of credit): the message to
 * show, naming the assistant and whose key it was (`keySource` 'personal' or 'workspace'). Otherwise null.
 */
function keyRejectedMessage(err, assistant, keySource = 'workspace') {
  const rejected = err?.status === 401 || err?.status === 403
    || /invalid.{0,12}api.?key|x-api-key|incorrect api key|api key not valid|permission denied/i.test(err?.message || '');
  if (!rejected) return null;
  const name = assistant && assistant !== 'default' ? describe(assistant)?.name : null;
  if (keySource === 'personal') return `${name || 'The AI provider'} didn't accept your API key. Reconnect it in Agents.`;
  return `${name || 'The AI provider'} didn't accept this workspace's API key. A workspace admin can reconnect it in Settings → AI.`;
}

module.exports = { CATALOG, MENTION_RE, assistantForMention, listAssistants, describe, canonical, keyRejectedMessage };
