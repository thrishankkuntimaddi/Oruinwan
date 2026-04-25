import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { searchAll, saveRecentSearch, getRecentSearches } from '../services/searchService';

const SearchContext = createContext(null);

const DEBOUNCE_MS = 300;
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
    const [error,          setError]           = useState(null);
    const [recentSearches, setRecentSearches]  = useState(() => getRecentSearches());
    const [filters,        setFilters]         = useState({
        type: 'all', from: '', to: '', channelId: '', tags: [], limit: 10, offset: 0, semantic: true,
    });
    const [activeTab, setActiveTab] = useState('all');

    const debounceTimer = useRef(null);
    const abortRef      = useRef(null);

    
    const runSearch = useCallback(async (q, appliedFilters, wsId) => {
        if (!q || !q.trim() || !wsId) {
            setResults(EMPTY_RESULTS);
            setLoading(false);
            return;
        }

        
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        setError(null);
        try {
            const data = await searchAll(q, appliedFilters, wsId);
            setResults(data);
        } catch (err) {
            if (err?.code === 'ERR_CANCELED') return; 
            setError('Search failed. Please try again.');
            setResults(EMPTY_RESULTS);
        } finally {
            setLoading(false);
        }
    }, []);

    const setQuery = useCallback((q) => {
        setQueryState(q);
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            runSearch(q, filters, workspaceId);
        }, DEBOUNCE_MS);
    }, [filters, workspaceId, runSearch]);

    const applyFilters = useCallback((newFilters) => {
        const merged = { ...filters, ...newFilters, offset: 0 };
        setFilters(merged);
        if (query) runSearch(query, merged, workspaceId);
    }, [filters, query, workspaceId, runSearch]);

    const loadMore = useCallback(() => {
        const nextOffset = filters.offset + filters.limit;
        const newFilters = { ...filters, offset: nextOffset };
        setFilters(newFilters);
        if (query) runSearch(query, newFilters, workspaceId);
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
            isOpen, query, results, loading, error,
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
