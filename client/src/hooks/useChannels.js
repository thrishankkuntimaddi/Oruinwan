import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';

export const useChannels = (workspaceId) => {
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadChannels = useCallback(async () => {
        if (!workspaceId) {
            console.warn('No workspaceId provided to useChannels hook');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            
            const response = await api.get(`/api/workspaces/${workspaceId}/channels`);

            const formattedChannels = (response.data.channels || []).map(channel => ({
                id: channel._id,
                type: 'channel',
                label: channel.name,
                path: `/workspace/${workspaceId}/channel/${channel._id}`,
                isFavorite: channel.isDefault || false,
                isPrivate: channel.isPrivate || false,
                isDefault: channel.isDefault || false,
                isDiscoverable: channel.isDiscoverable ?? true,
                isMember: channel.isMember ?? true,
                description: channel.description || '',
                memberCount: channel.members?.length || 0,
            }));

            setChannels(formattedChannels);
        } catch (err) {
            console.error('Error loading channels:', err);
            setError(err.response?.data?.message || 'Failed to load channels');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        loadChannels();
    }, [loadChannels]);

    const createChannel = async (channelData) => {
        try {
            const response = await api.post('/api/channels', channelData);
            const newChannel = {
                id: response.data.channel._id,
                type: 'channel',
                label: response.data.channel.name,
                path: `/workspace/${workspaceId}/channel/${response.data.channel._id}`,
                isFavorite: false,
                isPrivate: response.data.channel.isPrivate || false,
                isDefault: false,
                isDiscoverable: response.data.channel.isDiscoverable ?? true,
                isMember: true, 
                description: response.data.channel.description || '',
            };
            setChannels(prev => [...prev, newChannel]);
            return newChannel;
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Failed to create channel');
        }
    };

    const joinChannel = async (channelId) => {
        try {
            await api.post(`/api/channels/${channelId}/join`);
            await loadChannels(); 
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Failed to join channel');
        }
    };

    
    const joinDiscoverableChannel = async (channelId) => {
        const response = await api.post(`/api/channels/${channelId}/join-discoverable`);
        const { channelId: id, channelName } = response.data;
        const joined = {
            id: id || channelId,
            type: 'channel',
            label: channelName || channelId,
            path: `/workspace/${workspaceId}/channel/${id || channelId}`,
            isFavorite: false,
            isPrivate: false,
            isDiscoverable: true,
            isMember: true,
        };
        setChannels(prev => {
            if (prev.some(ch => ch.id === joined.id)) return prev;
            return [...prev, joined];
        });
        return joined;
    };

    
    const exitChannel = async (channelId) => {
        setChannels(prev => prev.filter(ch => ch.id !== channelId));
        try {
            await api.post(`/api/channels/${channelId}/exit`);
        } catch (err) {
            await loadChannels(); 
            throw new Error(err.response?.data?.message || 'Failed to leave channel');
        }
    };

    return {
        channels,
        loading,
        error,
        createChannel,
        joinChannel,
        joinDiscoverableChannel,
        exitChannel,
        refreshChannels: loadChannels
    };
};
