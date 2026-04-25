import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';

const EMPTY = { channels: [], contacts: [], messages: [], tasks: [], notes: [], files: [], knowledge: [] };

export const useUniversalSearch = (workspaceId, debounceMs = 300) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState(EMPTY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [query, debounceMs]);

    
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim() || !workspaceId) {
                setResults(EMPTY);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await api.get('/api/search/universal', {
                    params: { workspaceId, query: debouncedQuery }
                });
                
                setResults({ ...EMPTY, ...response.data });
            } catch (err) {
                setError(err.response?.data?.message || 'Search failed');
                setResults(EMPTY);
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, workspaceId]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
        setResults(EMPTY);
        setError(null);
    }, []);

    const hasResults = Object.values(results).some(arr => Array.isArray(arr) && arr.length > 0);

    return { query, setQuery, results, loading, error, clearSearch, hasResults };
};
