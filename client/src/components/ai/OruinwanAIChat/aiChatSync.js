// AI panel history saved to the account (/api/ai/chats), so it shows up on every device.
// The panel keeps its own message shape ({ sender: 'user' | 'ai', text }); this maps it.
import api from '../../../services/api';

export function newChatId() {
    const raw = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `ai_${raw}`;
}

/** Messages worth keeping: the person's questions and the AI's finished answers. */
export function toServerMessages(messages) {
    return (messages || [])
        .filter((m) => !(m.id === 1 && m.sender === 'ai') && !m.isError && !m.streaming && m.text && String(m.text).trim())
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', text: String(m.text), at: m.at || new Date().toISOString() }));
}

export function fromServerMessages(chat) {
    return (chat?.messages || []).map((m, i) => ({
        id: `${chat.id}-${i}`,
        sender: m.role === 'user' ? 'user' : 'ai',
        text: m.text,
        time: new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
}

export const aiChats = {
    list: async (workspaceId) => (await api.get('/api/ai/chats', { params: { workspaceId } })).data.chats || [],
    get: async (workspaceId, id) => (await api.get(`/api/ai/chats/${encodeURIComponent(id)}`, { params: { workspaceId } })).data.chat,
    save: async (workspaceId, id, body) => (await api.put(`/api/ai/chats/${encodeURIComponent(id)}`, { ...body, workspaceId })).data.chat,
    rename: async (workspaceId, id, title) => (await api.patch(`/api/ai/chats/${encodeURIComponent(id)}`, { workspaceId, title })).data.chat,
    remove: async (workspaceId, id) => { await api.delete(`/api/ai/chats/${encodeURIComponent(id)}`, { params: { workspaceId } }); },
    clear: async (workspaceId) => { await api.delete('/api/ai/chats', { params: { workspaceId } }); },
};
