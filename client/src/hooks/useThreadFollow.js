// client/src/hooks/useThreadFollow.js
//
// Custom hook for thread follow/unfollow state management.
// Bootstraps follow status from the getThread response (passed as initialStatus),
// then provides a toggle() that calls POST or DELETE against the thread follow API.

import { useState, useCallback } from 'react';
import api from '@services/api';

/**
 * @param {string} messageId    The parent message _id
 * @param {{ following: boolean, followerCount: number }} initialStatus
 *   Pre-loaded from the getThread API response (followStatus field).
 *   Avoids a second round-trip on ThreadPanel mount.
 */
export function useThreadFollow(messageId, initialStatus = { following: false, followerCount: 0 }) {
    const [following, setFollowing] = useState(initialStatus.following);
    const [followerCount, setFollowerCount] = useState(initialStatus.followerCount ?? 0);
    const [loading, setLoading] = useState(false);

    /**
     * Toggle follow/unfollow.
     * Optimistic update first, then sync with server.
     */
    const toggle = useCallback(async () => {
        if (!messageId || loading) return;

        // Optimistic update
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
            // Roll back optimistic update on error
            console.error('[useThreadFollow] Toggle failed:', err.message);
            setFollowing(wasFollowing);
            setFollowerCount(c => wasFollowing ? c + 1 : Math.max(0, c - 1));
        } finally {
            setLoading(false);
        }
    }, [messageId, following, loading]);

    /**
     * Call this after a local reply is sent to instantly mark as following
     * without waiting for the socket event.
     */
    const markAsFollowing = useCallback(() => {
        if (!following) {
            setFollowing(true);
            setFollowerCount(c => c + 1);
        }
    }, [following]);

    return { following, followerCount, toggle, loading, markAsFollowing };
}
