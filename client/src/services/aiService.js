import api from './api';
import logger from '../utils/logger';

/**
 * Oruinwan Intelligence client. Every call goes to /api/ai/* which runs
 * through the shared AI gateway on the server. Messages are E2EE, so any
 * conversation text passed here is plaintext the client decrypted itself.
 */
const post = async (path, body, label) => {
    try {
        const { data } = await api.post(path, body);
        return data;
    } catch (error) {
        logger.error(`AI ${label} error:`, error?.response?.data || error);
        throw error;
    }
};

/** Human message for an AI error response. */
export function aiErrorMessage(error, fallback = 'AI request failed. Please try again.') {
    const code = error?.response?.data?.code;
    if (code === 'AI_NOT_CONFIGURED') return 'AI is not set up for this workspace yet. An admin can connect a provider in Settings → AI.';
    if (code === 'AI_DISABLED') return 'AI features are turned off for this workspace.';
    if (code === 'AI_RATE_LIMITED' || code === 'AI_PROVIDER_RATE_LIMITED' || error?.response?.status === 429) return 'AI is busy right now. Try again in a moment.';
    return error?.response?.data?.message || fallback;
}

export const aiService = {
    /** Assistant chat. `context` = { screen, conversation, note, task, selection } from AIContext. */
    chat: async (message, history = [], workspaceId = null, context = undefined) => {
        const data = await post('/api/ai/chat', { message, history, workspaceId, context }, 'chat');
        return { text: data.text, actionsExecuted: data.actionsExecuted || null, hasActions: !!data.actionsExecuted, provider: data.provider };
    },
    clearMemory: (workspaceId) => post('/api/ai/memory/clear', { workspaceId }, 'clearMemory'),

    smartReplies: ({ workspaceId, messages, tone }) => post('/api/ai/smart-replies', { workspaceId, messages, tone }, 'smartReplies'),
    translate: ({ text, targetLang, workspaceId }) => post('/api/ai/translate', { text, targetLang, workspaceId }, 'translate'),
    draft: ({ workspaceId, instruction, messages, tone, replyTo, existing }) => post('/api/ai/draft', { workspaceId, instruction, messages, tone, replyTo, existing }, 'draft'),
    /** mode: summary | bullets | action_items | decisions | question */
    conversation: ({ workspaceId, messages, mode = 'summary', question, title, parentText }) =>
        post('/api/ai/conversation', { workspaceId, messages, mode, question, title, parentText }, 'conversation'),
    extractTasks: ({ workspaceId, text, max, create = false }) => post('/api/ai/extract-tasks', { workspaceId, text, max, create }, 'extractTasks'),
    noteAssist: ({ workspaceId, action, text, title, instruction }) => post('/api/ai/notes/assist', { workspaceId, action, text, title, instruction }, 'noteAssist'),
    taskAssist: ({ workspaceId, action, task, instruction }) => post('/api/ai/tasks/assist', { workspaceId, action, task, instruction }, 'taskAssist'),

    summarize: (text, opts = {}) => post('/api/ai/summarize', { text, ...opts }, 'summarize'),
    generateTask: (context, workspaceId = null) => post('/api/ai/generate-task', { context, workspaceId }, 'generateTask'),

    capabilities: async () => (await api.get('/api/ai/capabilities')).data,
    getSettings: async (workspaceId) => (await api.get('/api/ai/settings', { params: { workspaceId } })).data,
    updateSettings: async (workspaceId, patch) => (await api.put('/api/ai/settings', { workspaceId, ...patch })).data,
    testProvider: (workspaceId) => post('/api/ai/settings/test', { workspaceId }, 'testProvider'),
    usage: async (workspaceId, days = 30) => (await api.get('/api/ai/usage', { params: { workspaceId, days } })).data,

    // Per-workspace provider keys (Settings → AI)
    listProviders: async (workspaceId) => (await api.get('/api/v2/integrations/ai-providers', { params: { workspaceId } })).data,
    connectProvider: (workspaceId, provider, apiKey, config = {}) => post('/api/v2/integrations/ai-providers/connect', { workspaceId, provider, apiKey, config }, 'connectProvider'),
    disconnectProvider: (workspaceId, provider) => post('/api/v2/integrations/ai-providers/disconnect', { workspaceId, provider }, 'disconnectProvider'),
};

/** Ask the open composer to insert text (handled by footerInput). */
export function insertIntoComposer(text) {
    if (!text) return false;
    document.dispatchEvent(new CustomEvent('chttrix:composer:insert', { detail: { text } }));
    return true;
}

export default aiService;
