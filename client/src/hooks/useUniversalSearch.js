// client/src/hooks/useUniversalSearch.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Custom hook for universal search functionality
 * Provides debounced search with loading states
 */
export const useUniversalSearch = (workspaceId, debounceMs = 300) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState({ channels: [], contacts: [], messages: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Debounce the search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [query, debounceMs]);

    // Perform search when debounced query changes
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim() || !workspaceId) {
                setResults({ channels: [], contacts: [], messages: [] });
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem('accessToken');
                const response = await axios.get(`${API_BASE_URL}/search/universal`, {
                    params: {
                        workspaceId,
                        query: debouncedQuery
                    },
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                setResults(response.data);
            } catch (err) {
                console.error('Search error:', err);
                setError(err.response?.data?.message || 'Search failed');
                setResults({ channels: [], contacts: [], messages: [] });
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, workspaceId]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
        setResults({ channels: [], contacts: [], messages: [] });
        setError(null);
    }, []);

    return {
        query,
        setQuery,
        results,
        loading,
        error,
        clearSearch,
        hasResults: results.channels.length > 0 || results.contacts.length > 0 || results.messages.length > 0
    };
};
