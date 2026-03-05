// client/src/hooks/useChannels.js
import { useState, useEffect, useCallback } from 'react';
import { channelService } from '../services/channelService';

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

            const response = await channelService.getMyChannels(workspaceId);

            // Transform to expected format
            const formattedChannels = response.data.channels.map(channel => ({
                id: channel._id,
                type: 'channel',
                label: channel.name,
                path: `/channels/${channel._id}`,
                isFavorite: false, // Can add favorite logic later
                isPrivate: channel.isPrivate,
                description: channel.description,
                memberCount: channel.members?.length || 0
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
            const response = await channelService.createChannel(channelData);
            const newChannel = {
                id: response.data.channel._id,
                type: 'channel',
                label: response.data.channel.name,
                path: `/channels/${response.data.channel._id}`,
                isFavorite: false,
                isPrivate: response.data.channel.isPrivate
            };
            setChannels(prev => [...prev, newChannel]);
            return newChannel;
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Failed to create channel');
        }
    };

    const joinChannel = async (channelId) => {
        try {
            await channelService.joinChannel(channelId);
            await loadChannels(); // Refresh list
        } catch (err) {
            throw new Error(err.response?.data?.message || 'Failed to join channel');
        }
    };

    // Join a discoverable public channel — optimistic update, no full refetch
    const joinDiscoverableChannel = async (channelId) => {
        const response = await channelService.joinDiscoverableChannel(channelId);
        const { channelId: id, channelName } = response.data;
        const joined = {
            id: id || channelId,
            type: 'channel',
            label: channelName || channelId,
            path: `/channels/${id || channelId}`,
            isFavorite: false,
            isPrivate: false,
        };
        setChannels(prev => {
            // Guard against duplicate if socket already added it
            if (prev.some(ch => ch.id === joined.id)) return prev;
            return [...prev, joined];
        });
        return joined;
    };

    // Leave (exit) a channel — optimistic removal so sidebar updates instantly
    const exitChannel = async (channelId) => {
        // Remove from state immediately
        setChannels(prev => prev.filter(ch => ch.id !== channelId));
        try {
            await channelService.exitChannel(channelId);
        } catch (err) {
            // Rollback: re-fetch if API failed
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
