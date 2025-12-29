// client/src/hooks/useUniversalSearch.js
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Custom hook for universal search functionality
 * Provides debounced search with loading states
 */
export const useUniversalSearch = (workspaceId, debounceMs = 300) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState({ channels: [], contacts: [], messages: [], tasks: [], notes: [] });
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
            console.log('🔍 SEARCH HOOK - Query:', debouncedQuery, 'WorkspaceId:', workspaceId);

            if (!debouncedQuery.trim() || !workspaceId) {
                console.log('🔍 SEARCH HOOK - Empty query or no workspace, skipping search');
                setResults({ channels: [], contacts: [], messages: [], tasks: [], notes: [] });
                setLoading(false);
                return;
            }

            console.log('🔍 SEARCH HOOK - Starting search...');
            setLoading(true);
            setError(null);

            try {
                console.log('🔍 SEARCH HOOK - Calling API with params:', { workspaceId, query: debouncedQuery });

                // Using the configured api instance which automatically adds auth headers
                const response = await api.get('/api/search/universal', {
                    params: {
                        workspaceId,
                        query: debouncedQuery
                    }
                });

                console.log('🔍 SEARCH HOOK - API Response:', response.data);
                setResults(response.data);
            } catch (err) {
                console.error('🔍 SEARCH HOOK - Error:', err);
                console.error('🔍 SEARCH HOOK - Error details:', err.response?.data);
                setError(err.response?.data?.message || 'Search failed');
                setResults({ channels: [], contacts: [], messages: [], tasks: [], notes: [] });
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, workspaceId]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setDebouncedQuery('');
        setResults({ channels: [], contacts: [], messages: [], tasks: [], notes: [] });
        setError(null);
    }, []);

    return {
        query,
        setQuery,
        results,
        loading,
        error,
        clearSearch,
        hasResults: results.channels.length > 0 || results.contacts.length > 0 || results.messages.length > 0 || results.tasks.length > 0 || results.notes.length > 0
    };
};
