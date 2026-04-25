import api from './api';

export const aiService = {
    
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

    
    summarize: async (text) => {
        try {
            const response = await api.post('/api/ai/summarize', { text });
            return response.data;
        } catch (error) {
            console.error('AI Summarize Error:', error);
            throw error;
        }
    },

    
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
