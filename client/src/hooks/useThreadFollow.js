import { useState, useCallback } from 'react';
import api from '@services/api';

export function useThreadFollow(messageId, initialStatus = { following: false, followerCount: 0 }) {
    const [following, setFollowing] = useState(initialStatus.following);
    const [followerCount, setFollowerCount] = useState(initialStatus.followerCount ?? 0);
    const [loading, setLoading] = useState(false);

    
    const toggle = useCallback(async () => {
        if (!messageId || loading) return;

        
        const wasFollowing = following;
        setFollowing(!wasFollowing);
        setFollowerCount(c => wasFollowing ? Math.max(0, c - 1) : c + 1);
        setLoading(true);

        try {
            if (wasFollowing) {
                await api.delete(`/api/threads/${messageId}/follow`);
            } else {
                await api.post(`/api/threads/${messageId}/follow`);
            }
        } catch (err) {
            
            console.error('[useThreadFollow] Toggle failed:', err.message);
            setFollowing(wasFollowing);
            setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
        } finally {
            setLoading(false);
        }
    }, [messageId, following, loading]);

    
    const markAsFollowing = useCallback(() => {
        if (!following) {
            setFollowing(true);
            setFollowerCount(c => c + 1);
        }
    }, [following]);

    return { following, followerCount, toggle, loading, markAsFollowing };
}
