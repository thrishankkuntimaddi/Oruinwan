import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { searchAll, saveRecentSearch, getRecentSearches } from '../services/searchService';

const SearchContext = createContext(null);

const DEBOUNCE_MS = 300;
const RESULT_KEYS = ['messages', 'files', 'users', 'channels', 'tasks', 'notes', 'knowledge'];
const EMPTY_RESULTS = {
    messages: [], files: [], users: [], channels: [],
    tasks: [], notes: [], knowledge: [], total: 0, query: '',
};

export function SearchProvider({ children }) {
    const navigate    = useNavigate();
    const params      = useParams();

    
    const workspaceId = params?.workspaceId || null;

    const [isOpen,         setIsOpen]         = useState(false);
    const [query,          setQueryState]      = useState('');
    const [results,        setResults]         = useState(EMPTY_RESULTS);
    const [loading,        setLoading]         = useState(false);
    const [loadingMore,    setLoadingMore]     = useState(false);
    const [error,          setError]           = useState(null);
    const [recentSearches, setRecentSearches]  = useState(() => getRecentSearches());
    const [filters,        setFilters]         = useState({
        type: 'all', from: '', to: '', channelId: '', tags: [], limit: 10, offset: 0, semantic: true,
    });
    const [activeTab, setActiveTab] = useState('all');

    const debounceTimer = useRef(null);
    const abortRef      = useRef(null);

    
    const runSearch = useCallback(async (q, appliedFilters, wsId, { append = false } = {}) => {
        if (!q || !q.trim() || !wsId) {
            if (abortRef.current) abortRef.current.abort();
            setResults(EMPTY_RESULTS);
            setLoading(false);
            setLoadingMore(false);
            return;
        }

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (append) setLoadingMore(true); else setLoading(true);
        setError(null);
        try {
            const data = await searchAll(q, appliedFilters, wsId, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (append) {
                // "Load more": add the next page to what is already shown.
                setResults(prev => {
                    const merged = { ...prev, query: data.query };
                    let added = 0;
                    for (const key of RESULT_KEYS) {
                        const have = prev[key] || [];
                        const seen = new Set(have.map(r => String(r.id || r._id)));
                        const fresh = (data[key] || []).filter(r => !seen.has(String(r.id || r._id)));
                        added += fresh.length;
                        merged[key] = [...have, ...fresh];
                    }
                    merged.total = (prev.total || 0) + added;
                    merged.lastPageSize = RESULT_KEYS.reduce((n, k) => n + (data[k] || []).length, 0);
                    return merged;
                });
            } else {
                setResults({ ...data, lastPageSize: RESULT_KEYS.reduce((n, k) => n + (data[k] || []).length, 0) });
            }
        } catch (err) {
            if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) return;
            setError(err?.response?.data?.message || 'Search failed. Please try again.');
            if (!append) setResults(EMPTY_RESULTS);
        } finally {
            if (abortRef.current === controller) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, []);

    const setQuery = useCallback((q, { immediate = false } = {}) => {
        setQueryState(q);
        clearTimeout(debounceTimer.current);
        const fresh = { ...filters, offset: 0 };
        if (filters.offset) setFilters(fresh);
        if (immediate) { runSearch(q, fresh, workspaceId); return; }
        debounceTimer.current = setTimeout(() => {
            runSearch(q, fresh, workspaceId);
        }, DEBOUNCE_MS);
    }, [filters, workspaceId, runSearch]);

    useEffect(() => () => {
        clearTimeout(debounceTimer.current);
        if (abortRef.current) abortRef.current.abort();
    }, []);

    const applyFilters = useCallback((newFilters) => {
        const merged = { ...filters, ...newFilters, offset: 0 };
        setFilters(merged);
        if (query) runSearch(query, merged, workspaceId);
    }, [filters, query, workspaceId, runSearch]);

    const loadMore = useCallback(() => {
        const nextOffset = filters.offset + filters.limit;
        const newFilters = { ...filters, offset: nextOffset };
        setFilters(newFilters);
        if (query) runSearch(query, newFilters, workspaceId, { append: true });
    }, [filters, query, workspaceId, runSearch]);

    
    const openSearch = useCallback(() => setIsOpen(true), []);
    const closeSearch = useCallback(() => {
        setIsOpen(false);
        setQueryState('');
        setResults(EMPTY_RESULTS);
        setFilters(f => ({ ...f, offset: 0 }));
    }, []);

    
    const goToResults = useCallback((q) => {
        const term = q || query;
        if (!term.trim()) return;
        saveRecentSearch(term);
        setRecentSearches(getRecentSearches());
        closeSearch();
        
        const base = workspaceId ? `/workspace/${workspaceId}/search` : '/search';
        navigate(`${base}?q=${encodeURIComponent(term)}`);
    }, [query, navigate, closeSearch, workspaceId]);

    
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) closeSearch();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, closeSearch]);

    return (
        <SearchContext.Provider value={{
            isOpen, query, results, loading, loadingMore, error,
            filters, activeTab, recentSearches, workspaceId,
            setQuery, applyFilters, loadMore,
            openSearch, closeSearch, goToResults,
            setActiveTab,
            setRecentSearches,
        }}>
            {children}
        </SearchContext.Provider>
    );
}

export function useSearch() {
    const ctx = useContext(SearchContext);
    if (!ctx) throw new Error('useSearch must be used inside <SearchProvider>');
    return ctx;
}

export default SearchContext;
