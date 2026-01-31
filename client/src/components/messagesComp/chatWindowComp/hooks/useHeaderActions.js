import { useCallback } from 'react';
import api from '../../../../services/api';

/**
 * Custom hook for header action handlers
 * @param {object} chat - Chat object
 * @param {function} showToast - Toast notification function
 * @param {function} onClose - Close callback
 * @param {function} onDeleteChat - Delete chat callback
 * @returns {object} Header action handlers
 */
export default function useHeaderActions({ chat, showToast, onClose, onDeleteChat }) {
    const handleShowThreadsView = useCallback(() => {
        showToast('Threads view coming soon!', 'info');
    }, [showToast]);

    const handleShowMemberList = useCallback(() => {
        // This will be handled by parent setting state
        // Just a placeholder for future direct implementation
        return true;
    }, []);

    const handleExitChannel = useCallback(async () => {
        if (!window.confirm('Are you sure you want to exit this channel?')) return;
        try {
            await api.post(`/api/channels/${chat.id}/exit`);
            showToast('Exited channel successfully', 'success');
            onClose?.();
        } catch (err) {
            console.error('Exit channel error:', err);
            showToast(err.response?.data?.message || 'Failed to exit channel', 'error');
        }
    }, [chat, onClose, showToast]);

    const handleDeleteChannel = useCallback(async () => {
        if (!window.confirm('Are you sure you want to permanently delete this channel? This action cannot be undone.')) return;
        try {
            await api.delete(`/api/channels/${chat.id}`);
            showToast('Channel deleted successfully', 'success');
            onClose?.();
        } catch (err) {
            console.error('Delete channel error:', err);
            showToast(err.response?.data?.message || 'Failed to delete channel', 'error');
        }
    }, [chat, onClose, showToast]);

    const handleClearChat = useCallback(async () => {
        try {
            await api.post(`/api/dm/${chat.id}/clear`);
            showToast('Chat cleared successfully', 'success');
        } catch (err) {
            console.error('Clear chat error:', err);
            showToast('Failed to clear chat', 'error');
        }
    }, [chat, showToast]);

    const handleDeleteChat = useCallback(() => {
        if (onDeleteChat) {
            onDeleteChat();
        } else {
            onClose?.();
        }
    }, [onDeleteChat, onClose]);

    return {
        handleShowThreadsView,
        handleShowMemberList,
        handleExitChannel,
        handleDeleteChannel,
        handleClearChat,
        handleDeleteChat
    };
}
