import { useCallback } from 'react';
import api from '@services/api';

/**
 * Custom hook for header action handlers
 * Handles all 5 DM contact options + channel actions
 */
export default function useHeaderActions({ chat, showToast, onClose, onDeleteChat }) {

    // ── Channel: Threads view ─────────────────────────────────────────────────
    const handleShowThreadsView = useCallback(() => {
        showToast('Threads view coming soon!', 'info');
    }, [showToast]);

    const handleShowMemberList = useCallback(() => true, []);

    // ── Channel: Exit channel ─────────────────────────────────────────────────
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

    // ── Channel: Delete channel ───────────────────────────────────────────────
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

    // ── DM: Clear chat ────────────────────────────────────────────────────────
    // Sets a per-user clearedAt watermark — messages before it are hidden for this user only
    const handleClearChat = useCallback(async () => {
        try {
            await api.post(`/api/v2/dm/${chat.id}/clear`);
            showToast('Chat cleared', 'success');
            // Reload page so the cleared messages disappear from the list
            window.location.reload();
        } catch (err) {
            console.error('Clear chat error:', err);
            showToast('Failed to clear chat', 'error');
        }
    }, [chat, showToast]);

    // ── DM: Delete chat ───────────────────────────────────────────────────────
    // Hides the DM session from this user's list (soft-delete, other user unaffected)
    const handleDeleteChat = useCallback(async () => {
        try {
            await api.delete(`/api/v2/dm/${chat.id}`);
            showToast('Chat deleted', 'success');
            onClose?.();
            if (onDeleteChat) onDeleteChat();
        } catch (err) {
            console.error('Delete chat error:', err);
            // Fallback: still close the window even if API fails
            onClose?.();
            if (onDeleteChat) onDeleteChat();
        }
    }, [chat, onClose, onDeleteChat, showToast]);

    // ── DM: Block / Unblock ───────────────────────────────────────────────────
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

    // ── DM: Mute / Unmute ─────────────────────────────────────────────────────
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
