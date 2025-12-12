// client/src/hooks/useChannels.js
import { useState, useEffect, useCallback } from 'react';
import { channelService } from '../services/channelService';

export const useChannels = () => {
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadChannels = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await channelService.getMyChannels();

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
    }, []);

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

    return {
        channels,
        loading,
        error,
        createChannel,
        joinChannel,
        refreshChannels: loadChannels
    };
};
