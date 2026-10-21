import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search, MessageSquare, Paperclip, User, Hash, CheckSquare, FileText, BookOpen,
    ArrowLeft, Loader2, Sparkles, AlertCircle, SearchX,
} from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import SearchResultItem from './SearchResultItem';
import SearchFilterChips from './SearchFilterChips';
import { parseSearchQuery } from '../../utils/searchQuery';
import './SearchBar.css';

const TABS = [
    { key: 'all',       label: 'All',       Icon: Search },
    { key: 'messages',  label: 'Messages',  Icon: MessageSquare },
    { key: 'files',     label: 'Files',     Icon: Paperclip },
    { key: 'users',     label: 'People',    Icon: User },
    { key: 'channels',  label: 'Channels',  Icon: Hash },
    { key: 'tasks',     label: 'Tasks',     Icon: CheckSquare },
    { key: 'notes',     label: 'Notes',     Icon: FileText },
    { key: 'knowledge', label: 'Knowledge', Icon: BookOpen },
];

// Tab key -> the server's `type` filter.
const TYPE_MAP = {
    all:       'all',
    messages:  'message',
    files:     'file',
    users:     'user',
    channels:  'channel',
    tasks:     'task',
    notes:     'note',
    knowledge: 'knowledge',
};

const keyOf = (r, i) => String(r.id || r._id || i);

export default function SearchResultsPage() {
    const navigate       = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        query, results, loading, loadingMore, error, filters,
        setQuery, applyFilters, loadMore, activeTab, setActiveTab,
    } = useSearch();

    const [localFilters, setLocalFilters] = useState({
        tags: (filters.tags || []).join(', '),
    });

    const inputRef = useRef(null);
    const urlQuery = searchParams.get('q') || '';

    // Follow ?q= (a new search from the header bar while this page is open).
    // Reads the latest query/setter through refs so it only reacts to the URL.
    const queryRef = useRef(query);
    queryRef.current = query;
    const setQueryRef = useRef(setQuery);
    setQueryRef.current = setQuery;
    useEffect(() => {
        if (urlQuery !== queryRef.current) setQueryRef.current(urlQuery, { immediate: true });
    }, [urlQuery]);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleInput = (value) => {
        setQuery(value);
        queryRef.current = value;
        // Keep the URL in step so back/forward and sharing work.
        setSearchParams(value ? { q: value } : {}, { replace: true });
    };

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        applyFilters({ type: TYPE_MAP[tabKey] || 'all' });
    };

    const handleFilterApply = () => {
        const tagList = localFilters.tags
            ? localFilters.tags.split(',').map(t => t.trim()).filter(Boolean)
            : [];
        applyFilters({ tags: tagList });
    };

    const handleFilterReset = () => {
        setLocalFilters({ tags: '' });
        applyFilters({ tags: [] });
    };

    // Chips edit the operators in the query (from:, in:, after:, type:, …); the
    // server and the local message index both read them from the raw query.
    const handleChipsChange = (next) => {
        queryRef.current = next;
        setSearchParams(next ? { q: next } : {}, { replace: true });
        setQuery(next, { immediate: true });
    };

    const tab = activeTab || 'all';
    const sectionKeys = TABS.filter(t => t.key !== 'all').map(t => t.key);
    const getTabResults = (tabKey) => (tabKey === 'all'
        ? sectionKeys.flatMap(k => results[k] || [])
        : results[tabKey] || []);
    const getTabCount = (tabKey) => (tabKey === 'all' ? (results.total || 0) : (results[tabKey] || []).length);

    const currentResults = getTabResults(tab);
    const highlight = parseSearchQuery(query).text.replace(/"/g, '');
    const total = results.total || 0;
    const hasQuery = !!query.trim();
    const settled = hasQuery && !loading;
    const isSemantic = filters.semantic !== false;
    const activeMeta = TABS.find(t => t.key === tab);
    const suggestions = useMemo(() => {
        const ch = new Set();
        const ppl = new Set();
        (results.channels || []).forEach(c => c.name && ch.add(c.name));
        (results.users || []).forEach(u => (u.username || u.name) && ppl.add(u.username || u.name));
        (results.messages || []).forEach((m) => {
            if (m.parent?.type === 'channel' && m.parent.name) ch.add(m.parent.name);
            if (m.sender?.name) ppl.add(m.sender.name);
        });
        return { channels: [...ch], people: [...ppl] };
    }, [results]);
    const canLoadMore = tab !== 'all' && currentResults.length > 0
        && (results.lastPageSize ?? currentResults.length) >= (filters.limit || 10);

    return (
        <div className="srp-page">
            <div className="srp-header">
                <button className="srp-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={14} /> Back
                </button>

                <div className="srp-search-wrapper">
                    <Search size={15} className="srp-search-icon" />
                    <input
                        ref={inputRef}
                        className="srp-search-input"
                        type="text"
                        placeholder="Search…"
                        value={query}
                        onChange={e => handleInput(e.target.value)}
                        autoComplete="off"
                        aria-label="Search"
                    />
                    {loading && <Loader2 size={14} className="srp-search-spinner" />}
                </div>

                <div className="srp-result-count">
                    {settled && !error && `${total} result${total !== 1 ? 's' : ''}`}
                    {isSemantic && settled && !error && total > 0 && (
                        <span className="srp-semantic-badge"><Sparkles size={11} /> AI ranked</span>
                    )}
                </div>
            </div>

            <div className="srp-tabs-bar">
                <div className="srp-tabs" role="tablist">
                    {TABS.map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            role="tab"
                            aria-selected={tab === key}
                            className={`srp-tab ${tab === key ? 'active' : ''}`}
                            onClick={() => handleTabChange(key)}
                        >
                            <Icon size={14} />
                            {label}
                            {hasQuery && getTabCount(key) > 0 && (
                                <span className="srp-tab-count">{getTabCount(key)}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <SearchFilterChips
                query={query}
                onChange={handleChipsChange}
                channels={suggestions.channels}
                people={suggestions.people}
            />

            <div className="srp-layout">
                <div className="srp-sidebar">
                    <div className="srp-filter-card">
                        <p className="srp-filter-title">Filters</p>

                        <div className="srp-filter-group">
                            <label className="srp-filter-label" htmlFor="srp-tags">Tags (comma separated)</label>
                            <input
                                id="srp-tags"
                                type="text"
                                className="srp-filter-input"
                                placeholder="e.g. design, urgent"
                                value={localFilters.tags}
                                onChange={e => setLocalFilters(f => ({ ...f, tags: e.target.value }))}
                            />
                        </div>
                        <div className="srp-filter-group">
                            <label className="srp-filter-label" htmlFor="srp-ai">AI re-ranking</label>
                            <select
                                id="srp-ai"
                                className="srp-filter-select"
                                value={filters.semantic === false ? 'false' : 'true'}
                                onChange={e => applyFilters({ semantic: e.target.value !== 'false' })}
                            >
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                            </select>
                        </div>

                        <button className="srp-filter-apply" onClick={handleFilterApply}>Apply filters</button>
                        <button className="srp-filter-reset" onClick={handleFilterReset}>Reset</button>
                    </div>
                </div>

                <div className="srp-results-col">
                    {error && (
                        <div className="srp-results-card" role="alert">
                            <div className="srp-error"><AlertCircle size={15} /> {error}</div>
                        </div>
                    )}

                    {!hasQuery && (
                        <div className="srp-results-card">
                            <div className="srp-empty">
                                <Search size={30} className="srp-empty-icon" />
                                <p>Enter a search term above to find messages, files, people, tasks, and more.</p>
                            </div>
                        </div>
                    )}

                    {hasQuery && loading && (
                        <div className="srp-results-card">
                            <div className="srp-skeletons">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="srp-skeleton-row">
                                        <div className="srp-skeleton-icon" />
                                        <div className="srp-skeleton-text">
                                            <div className="srp-skeleton-line" style={{ width: `${50 + i * 10}%` }} />
                                            <div className="srp-skeleton-line short" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* "All": one card per result type */}
                    {settled && tab === 'all' && currentResults.length > 0 && sectionKeys.map((key) => {
                        const items = results[key] || [];
                        if (items.length === 0) return null;
                        const { label, Icon } = TABS.find(t => t.key === key);
                        return (
                            <div key={key} className="srp-results-card">
                                <div className="srp-results-card-header">
                                    <span><Icon size={13} /> {label}</span>
                                    <span>{items.length} result{items.length !== 1 ? 's' : ''}</span>
                                </div>
                                {items.map((r, i) => (
                                    <SearchResultItem key={keyOf(r, i)} result={r} query={highlight} />
                                ))}
                            </div>
                        );
                    })}

                    {/* One type */}
                    {settled && tab !== 'all' && currentResults.length > 0 && (
                        <div className="srp-results-card">
                            <div className="srp-results-card-header">
                                <span>{activeMeta && <activeMeta.Icon size={13} />} {activeMeta?.label}</span>
                                <span>{currentResults.length} result{currentResults.length !== 1 ? 's' : ''}</span>
                            </div>
                            {currentResults.map((r, i) => <SearchResultItem key={keyOf(r, i)} result={r} query={highlight} />)}
                            {canLoadMore && (
                                <div className="srp-load-more">
                                    <button className="srp-load-more-btn" onClick={loadMore} disabled={loadingMore}>
                                        {loadingMore ? 'Loading…' : 'Load more'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Single empty state */}
                    {settled && !error && currentResults.length === 0 && (
                        <div className="srp-results-card">
                            <div className="srp-empty">
                                <SearchX size={30} className="srp-empty-icon" />
                                <p>
                                    No {tab === 'all' ? 'results' : activeMeta?.label.toLowerCase()} for "<strong>{query}</strong>"
                                </p>
                                <p className="srp-empty-hint">Try different keywords, or broaden your filters</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
