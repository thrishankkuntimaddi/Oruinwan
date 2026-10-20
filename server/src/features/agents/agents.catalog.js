'use strict';

/**
 * The Agents & tools directory. Agents are AI models people chat with (a DM in the sidebar, or an
 * @mention in a conversation). Tools are integrations that bring other services in.
 *
 * Authorization: Anthropic, OpenAI, Google and xAI don't let other apps sign people in with their
 * consumer accounts, so an agent is authorized with an API key from that company (verified with a
 * live request before it's saved). Oruinwan AI is built in and always installed.
 */

const AGENTS = [
  {
    id: 'default',
    kind: 'agent',
    name: 'Oruinwan AI',
    maker: 'Oruinwan',
    mention: 'ai',
    builtIn: true,
    tagline: 'Your workspace assistant. Runs on Oruinwan’s own servers.',
    description: 'Knows your channels, tasks, notes and knowledge base. Summarises, drafts, creates tasks and answers questions about your work.',
    capabilities: ['Answers about your workspace', 'Creates tasks and notes', 'Summaries and drafts', 'Stays on Oruinwan’s servers'],
  },
  {
    id: 'anthropic',
    kind: 'agent',
    name: 'Claude',
    maker: 'Anthropic',
    mention: 'claude',
    tagline: 'Thoughtful writing, analysis and code.',
    description: 'Claude by Anthropic. Great for long documents, careful reasoning, writing and code review.',
    capabilities: ['Writing and editing', 'Analysis and research', 'Code help', 'Long documents'],
    authorization: { type: 'api_key', label: 'Anthropic API key', keysUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…', keyPattern: '^sk-ant-' },
  },
  {
    id: 'openai',
    kind: 'agent',
    name: 'ChatGPT',
    maker: 'OpenAI',
    mention: 'chatgpt',
    tagline: 'Work, write and code with ChatGPT.',
    description: 'OpenAI’s GPT models. Brainstorm, draft, explain and code.',
    capabilities: ['Brainstorming', 'Drafting and rewriting', 'Explaining things', 'Code help'],
    authorization: { type: 'api_key', label: 'OpenAI API key', keysUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…', keyPattern: '^sk-' },
  },
  {
    id: 'gemini',
    kind: 'agent',
    name: 'Gemini',
    maker: 'Google',
    mention: 'gemini',
    tagline: 'Google’s multimodal model.',
    description: 'Google Gemini. Fast answers, summaries and ideas.',
    capabilities: ['Quick answers', 'Summaries', 'Ideas and plans'],
    authorization: { type: 'api_key', label: 'Google AI Studio API key', keysUrl: 'https://aistudio.google.com/app/apikey', keyHint: 'AIza…', keyPattern: '^AIza' },
  },
  {
    id: 'xai',
    kind: 'agent',
    name: 'Grok',
    maker: 'xAI',
    mention: 'grok',
    tagline: 'xAI’s Grok, with a sense of humour.',
    description: 'Grok by xAI. Direct answers and a lighter tone.',
    capabilities: ['Direct answers', 'Brainstorming', 'Code help'],
    authorization: { type: 'api_key', label: 'xAI API key', keysUrl: 'https://console.x.ai', keyHint: 'xai-…', keyPattern: '^xai-' },
  },
];

// Tools: the integrations Oruinwan already has. Installing one opens its own setup.
const TOOLS = [
  { id: 'github', kind: 'tool', name: 'GitHub', maker: 'GitHub', tagline: 'Pull requests, issues and AI code review in your channels.', setup: 'integrations' },
  { id: 'jira', kind: 'tool', name: 'Jira', maker: 'Atlassian', tagline: 'Create and track issues from conversations.', setup: 'integrations', flag: 'integrations' },
  { id: 'zoom', kind: 'tool', name: 'Zoom', maker: 'Zoom', tagline: 'Start and schedule Zoom meetings.', setup: 'integrations', flag: 'integrations' },
  { id: 'webhooks', kind: 'tool', name: 'Incoming webhooks', maker: 'Oruinwan', tagline: 'Post messages into a channel from any service.', setup: 'integrations' },
];

/**
 * Tools a member can also connect "just for me", so actions they start run as them (an issue
 * created from chat is opened by their GitHub account). GitHub offers a real OAuth sign-in when the
 * server has a GitHub OAuth app (GITHUB_CONNECT_CLIENT_ID); a fine-grained or classic personal
 * access token works everywhere. Jira Cloud has no OAuth for this here, so it's email + API token.
 */
const PERSONAL_TOOLS = {
  github: {
    actsAs: 'Issues you create from chat are opened by your GitHub account, and pull requests you open in Oruinwan are read with your access.',
    token: { label: 'GitHub personal access token', url: 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=Oruinwan', hint: 'ghp_… or github_pat_…' },
  },
  jira: {
    actsAs: 'Jira issues you create from chat are reported by you.',
    token: { label: 'Jira API token', url: 'https://id.atlassian.com/manage-profile/security/api-tokens', hint: 'Paste the token' },
  },
};

const byId = (id) => AGENTS.find((a) => a.id === id) || null;

module.exports = { AGENTS, TOOLS, PERSONAL_TOOLS, byId };
