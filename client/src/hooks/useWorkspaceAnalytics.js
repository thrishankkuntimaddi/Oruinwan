// client/src/hooks/useWorkspaceAnalytics.js
// Hook for fetching workspace analytics data
import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';

export function useWorkspaceAnalytics(workspaceId, range = 30) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetch = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/workspace-os/${workspaceId}/analytics`, { params: { range } });
            setData(res.data.analytics);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, range]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
}
