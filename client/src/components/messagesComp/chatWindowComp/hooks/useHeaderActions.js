import { useCallback } from 'react';
import api from '@services/api';

export default function useHeaderActions({ chat, showToast, onClose, onDeleteChat }) {

    
    const handleShowThreadsView = useCallback(() => {
        showToast('Threads view coming soon!', 'info');
    }, [showToast]);

    const handleShowMemberList = useCallback(() => true, []);

    
    const handleExitChannel = useCallback(async () => {
        if (!window.confirm('Are you sure you want to exit this channel?')) return;
        try {
            await api.post(`/api/channels/${chat.id}/exit`);
            showToast('Exited channel successfully', 'success');
            onClose?.();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to exit channel', 'error');
        }
    }, [chat, onClose, showToast]);

    
    const handleDeleteChannel = useCallback(async () => {
        if (!window.confirm('Are you sure you want to permanently delete this channel? This cannot be undone.')) return;
        try {
            await api.delete(`/api/channels/${chat.id}`);
            showToast('Channel deleted successfully', 'success');
            onClose?.();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete channel', 'error');
        }
    }, [chat, onClose, showToast]);

    
    
    const handleClearChat = useCallback(async () => {
        try {
            await api.post(`/api/v2/dm/${chat.id}/clear`);
            showToast('Chat cleared', 'success');
            
            window.location.reload();
        } catch (err) {
            console.error('Clear chat error:', err);
            showToast('Failed to clear chat', 'error');
        }
    }, [chat, showToast]);

    
    
    const handleDeleteChat = useCallback(async () => {
        try {
            await api.delete(`/api/v2/dm/${chat.id}`);
            showToast('Chat deleted', 'success');
            onClose?.();
            if (onDeleteChat) onDeleteChat();
        } catch (err) {
            console.error('Delete chat error:', err);
            
            onClose?.();
            if (onDeleteChat) onDeleteChat();
        }
    }, [chat, onClose, onDeleteChat, showToast]);

    
    const handleBlockToggle = useCallback(async (currentlyBlocked) => {
        try {
            if (currentlyBlocked) {
                await api.delete(`/api/v2/dm/${chat.id}/block`);
                showToast('User unblocked', 'success');
                return false;
            } else {
                await api.post(`/api/v2/dm/${chat.id}/block`);
                showToast('User blocked', 'success');
                return true;
            }
        } catch (err) {
            console.error('Block toggle error:', err);
            showToast('Action failed', 'error');
            return currentlyBlocked;
        }
    }, [chat, showToast]);

    
    const handleMuteToggle = useCallback(async (currentlyMuted) => {
        try {
            if (currentlyMuted) {
                await api.delete(`/api/v2/dm/${chat.id}/mute`);
                showToast('Notifications unmuted', 'success');
                return false;
            } else {
                await api.post(`/api/v2/dm/${chat.id}/mute`);
                showToast('Notifications muted', 'success');
                return true;
            }
        } catch (err) {
            console.error('Mute toggle error:', err);
            showToast('Action failed', 'error');
            return currentlyMuted;
        }
    }, [chat, showToast]);

    return {
        handleShowThreadsView,
        handleShowMemberList,
        handleExitChannel,
        handleDeleteChannel,
        handleClearChat,
        handleDeleteChat,
        handleBlockToggle,
        handleMuteToggle,
    };
}
