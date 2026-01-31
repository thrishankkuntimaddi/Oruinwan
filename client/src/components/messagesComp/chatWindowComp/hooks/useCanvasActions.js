import { useCallback } from 'react';
import api from '../../../../services/api';

/**
 * Custom hook for canvas/tab management actions
 * @param {object} chat - Chat object
 * @param {array} tabs - Current tabs array
 * @param {function} setTabs - Set tabs state
 * @param {string} activeTab - Active tab ID
 * @param {function} setActiveTab - Set active tab state
 * @param {function} showToast - Toast notification function
 * @returns {object} Canvas action handlers
 */
export default function useCanvasActions({ chat, tabs, setTabs, activeTab, setActiveTab, showToast }) {
    const fetchTabs = useCallback(async () => {
        if (!chat || chat.type !== 'channel') return;
        try {
            const res = await api.get(`/api/channels/${chat.id}/tabs`);
            setTabs(res.data.tabs || []);
        } catch (err) {
            console.error('Fetch tabs error:', err);
        }
    }, [chat, setTabs]);

    const handleAddTab = useCallback(async (name) => {
        if (tabs.length >= 5) {
            showToast('Maximum 5 canvases allowed per channel', 'error');
            return;
        }

        try {
            const tempId = 'temp-' + Date.now();
            const newTab = { _id: tempId, name, type: 'canvas', content: '' };
            setTabs(prev => [...prev, newTab]);
            setActiveTab(tempId);

            const res = await api.post(`/api/channels/${chat.id}/tabs`, { name, type: 'canvas' });

            setTabs(prev => prev.filter(t => t._id !== tempId));

            // Add the real tab from response to state if it's not already there (socket might have added it)
            if (res.data.tab) {
                setTabs(prev => {
                    if (prev.find(t => t._id === res.data.tab._id)) return prev;
                    return [...prev, res.data.tab];
                });
                setActiveTab(res.data.tab._id);
            }

            showToast(`Canvas "${name}" created`, 'success');
        } catch (err) {
            console.error('Add tab error:', err);
            showToast(err.response?.data?.message || 'Failed to create tab', 'error');
            setTabs(prev => prev.filter(t => !t._id.startsWith('temp-')));
            setActiveTab('chat');
        }
    }, [tabs.length, chat, setTabs, setActiveTab, showToast]);

    const handleDeleteTab = useCallback(async (tabId) => {
        try {
            await api.delete(`/api/channels/${chat.id}/tabs/${tabId}`);
            setTabs(prev => prev.filter(t => t._id !== tabId));
            if (activeTab === tabId) setActiveTab('chat');
            showToast('Canvas deleted successfully', 'success');
        } catch (err) {
            console.error('Delete tab error:', err);
            showToast('Failed to delete tab', 'error');
        }
    }, [chat, activeTab, setTabs, setActiveTab, showToast]);

    const handleRenameTab = useCallback(async (tabId, name) => {
        try {
            await api.put(`/api/channels/${chat.id}/tabs/${tabId}`, { name });
            setTabs(prev => prev.map(t => t._id === tabId ? { ...t, name } : t));
        } catch (err) {
            console.error('Rename tab error:', err);
            showToast('Failed to rename tab', 'error');
        }
    }, [chat, setTabs, showToast]);

    const handleSaveCanvas = useCallback(async (tabId, data) => {
        try {
            await api.put(`/api/channels/${chat.id}/tabs/${tabId}`, data);
        } catch (err) {
            console.error('Save canvas error:', err);
        }
    }, [chat]);

    const handleShareTab = useCallback((tabId) => {
        const url = `${window.location.origin}/canvas/${tabId}`;
        navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard', 'success');
    }, [showToast]);

    return {
        fetchTabs,
        handleAddTab,
        handleDeleteTab,
        handleRenameTab,
        handleSaveCanvas,
        handleShareTab
    };
}
