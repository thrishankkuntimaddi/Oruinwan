import api from './api';

export const aiService = {
    // Send a chat message with workspace context
    chat: async (message, history = [], workspaceId = null) => {
        try {
            const response = await api.post('/api/ai/chat', {
                message,
                history,
                workspaceId
            });
            return {
                text: response.data.text,
                actionsExecuted: response.data.actionsExecuted || null,
                hasActions: !!response.data.actionsExecuted
            };
        } catch (error) {
            console.error('AI Chat Error:', error);
            throw error;
        }
    },

    // Summarize text
    summarize: async (text) => {
        try {
            const response = await api.post('/api/ai/summarize', { text });
            return response.data;
        } catch (error) {
            console.error('AI Summarize Error:', error);
            throw error;
        }
    },

    // Generate a task from context
    generateTask: async (context) => {
        try {
            const response = await api.post('/api/ai/generate-task', { context });
            return response.data;
        } catch (error) {
            console.error('AI Task Gen Error:', error);
            throw error;
        }
    }
};
