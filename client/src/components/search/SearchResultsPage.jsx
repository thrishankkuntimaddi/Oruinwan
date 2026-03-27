// client/src/components/search/SearchResultsPage.jsx
/**
 * SearchResultsPage — Full-page search results.
 * Tabs: All, Messages, Files, People, Channels, Tasks, Notes, Knowledge
 * Filters: type, date range, tags
 * Pagination: load-more
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSearch } from '../../contexts/SearchContext';
import SearchResultItem from './SearchResultItem';
import './SearchBar.css';

const TABS = [
    { key: 'all',       label: 'All',       icon: '🔍' },
    { key: 'messages',  label: 'Messages',  icon: '💬' },
    { key: 'files',     label: 'Files',     icon: '📎' },
    { key: 'users',     label: 'People',    icon: '👤' },
    { key: 'channels',  label: 'Channels',  icon: '#'  },
    { key: 'tasks',     label: 'Tasks',     icon: '✅' },
    { key: 'notes',     label: 'Notes',     icon: '📝' },
    { key: 'knowledge', label: 'Knowledge', icon: '📚' },
];

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

export default function SearchResultsPage() {
    const navigate       = useNavigate();
    const [searchParams] = useSearchParams();
    const {
        query, results, loading, error, filters,
        setQuery, applyFilters, loadMore, activeTab, setActiveTab,
        workspaceId,
    } = useSearch();

    // Local filter state (apply on button click)
    const [localFilters, setLocalFilters] = useState({
        from: filters.from || '',
        to:   filters.to   || '',
        tags: (filters.tags || []).join(', '),
    });

    const inputRef = useRef(null);

    // Sync query from URL param on mount
    useEffect(() => {
        const q = searchParams.get('q');
        if (q && q !== query) setQuery(q);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Focus input on mount
    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleTabChange = (tabKey) => {
        setActiveTab(tabKey);
        applyFilters({ type: TYPE_MAP[tabKey] || 'all' });
    };

    const handleFilterApply = () => {
        const tagList = localFilters.tags
            ? localFilters.tags.split(',').map(t => t.trim()).filter(Boolean)
            : [];
        applyFilters({ from: localFilters.from, to: localFilters.to, tags: tagList });
    };

    const handleFilterReset = () => {
        setLocalFilters({ from: '', to: '', tags: '' });
        applyFilters({ from: '', to: '', tags: [] });
    };

    // Get current tab's results
    const getTabResults = (tabKey) => {
        if (tabKey === 'all') {
            return [
                ...(results.channels  || []),
                ...(results.users     || []),
                ...(results.messages  || []),
                ...(results.tasks     || []),
                ...(results.files     || []),
                ...(results.notes     || []),
                ...(results.knowledge || []),
            ];
        }
        return results[tabKey] || [];
    };

    const getTabCount = (tabKey) => {
        if (tabKey === 'all') return results.total || 0;
        return (results[tabKey] || []).length;
    };

    const currentResults = getTabResults(activeTab || 'all');
    const isSemantic = filters.semantic !== false;

    return (
        <div className="srp-page">
            {/* Header */}
            <div className="srp-header">
                <button className="srp-back-btn" onClick={() => navigate(-1)}>← Back</button>

                <div className="srp-search-wrapper">
                    <svg className="srp-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="8.5" cy="8.5" r="5.5" />
                        <line x1="13" y1="13" x2="18" y2="18" />
                    </svg>
                    <input
                        ref={inputRef}
                        className="srp-search-input"
                        type="text"
                        placeholder="Search…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoComplete="off"
                    />
                    {loading && <span className="srp-search-spinner" />}
                </div>

                <div className="srp-result-count">
                    {query && !loading && `${results.total || 0} result${results.total !== 1 ? 's' : ''}`}
                    {isSemantic && query && (
                        <span className="srp-semantic-badge" style={{ marginLeft: 8 }}>
                            🧠 AI ranked
                        </span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: '12px 24px 0', background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="srp-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`srp-tab ${(activeTab || 'all') === tab.key ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.key)}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                            {query && getTabCount(tab.key) > 0 && (
                                <span className="srp-tab-count">{getTabCount(tab.key)}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Layout */}
            <div className="srp-layout">
                {/* Sidebar */}
                <div className="srp-sidebar">
                    <div className="srp-filter-card">
                        <p className="srp-filter-title">Filters</p>

                        <div className="srp-filter-group">
                            <label className="srp-filter-label">From date</label>
                            <input
                                type="date"
                                className="srp-filter-input"
                                value={localFilters.from}
                                onChange={e => setLocalFilters(f => ({ ...f, from: e.target.value }))}
                            />
                        </div>
                        <div className="srp-filter-group">
                            <label className="srp-filter-label">To date</label>
                            <input
                                type="date"
                                className="srp-filter-input"
                                value={localFilters.to}
                                onChange={e => setLocalFilters(f => ({ ...f, to: e.target.value }))}
                            />
                        </div>
                        <div className="srp-filter-group">
                            <label className="srp-filter-label">Tags (comma separated)</label>
                            <input
                                type="text"
                                className="srp-filter-input"
                                placeholder="e.g. design, urgent"
                                value={localFilters.tags}
                                onChange={e => setLocalFilters(f => ({ ...f, tags: e.target.value }))}
                            />
                        </div>
                        <div className="srp-filter-group">
                            <label className="srp-filter-label">AI Re-ranking</label>
                            <select
                                className="srp-filter-select"
                                value={filters.semantic === false ? 'false' : 'true'}
                                onChange={e => applyFilters({ semantic: e.target.value !== 'false' })}
                            >
                                <option value="true">✅ Enabled</option>
                                <option value="false">❌ Disabled</option>
                            </select>
                        </div>

                        <button className="srp-filter-apply" onClick={handleFilterApply}>Apply Filters</button>
                        <button className="srp-filter-reset" onClick={handleFilterReset}>Reset</button>
                    </div>
                </div>

                {/* Results */}
                <div className="srp-results-col">
                    {/* Error */}
                    {error && (
                        <div className="srp-results-card">
                            <div style={{ padding: '16px', color: '#f87171', fontSize: 13 }}>⚠️ {error}</div>
                        </div>
                    )}

                    {/* No query */}
                    {!query && (
                        <div className="srp-results-card">
                            <div className="srp-empty">
                                <span className="srp-empty-icon">🔍</span>
                                <p>Enter a search term above to find messages, files, people, tasks, and more.</p>
                            </div>
                        </div>
                    )}

                    {/* Loading skeleton */}
                    {query && loading && (
                        <div className="srp-results-card">
                            <div className="gsb-loading-state" style={{ padding: '16px' }}>
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="gsb-skeleton-row">
                                        <div className="gsb-skeleton-icon" />
                                        <div className="gsb-skeleton-text">
                                            <div className="gsb-skeleton-line" style={{ width: `${50 + i * 10}%` }} />
                                            <div className="gsb-skeleton-line short" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results per category in "All" tab */}
                    {query && !loading && (activeTab === 'all' || !activeTab) && currentResults.length > 0 && (
                        (() => {
                            const sections = TABS.filter(t => t.key !== 'all');
                            return sections.map(({ key, label, icon }) => {
                                const items = results[key] || [];
                                if (items.length === 0) return null;
                                return (
                                    <div key={key} className="srp-results-card">
                                        <div className="srp-results-card-header">
                                            <span>{icon} {label}</span>
                                            <span>{items.length} result{items.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        {items.map(r => (
                                            <SearchResultItem key={r.id} result={r} query={query} />
                                        ))}
                                    </div>
                                );
                            });
                        })()
                    )}

                    {/* Single-tab results */}
                    {query && !loading && activeTab && activeTab !== 'all' && (
                        <div className="srp-results-card">
                            <div className="srp-results-card-header">
                                <span>{TABS.find(t => t.key === activeTab)?.icon} {TABS.find(t => t.key === activeTab)?.label}</span>
                                <span>{currentResults.length} result{currentResults.length !== 1 ? 's' : ''}</span>
                            </div>
                            {currentResults.length > 0
                                ? currentResults.map(r => <SearchResultItem key={r.id} result={r} query={query} />)
                                : (
                                    <div className="srp-empty">
                                        <span className="srp-empty-icon">💨</span>
                                        <p>No {activeTab} found for "<strong>{query}</strong>"</p>
                                    </div>
                                )
                            }
                            {currentResults.length > 0 && currentResults.length >= (filters.limit || 10) && (
                                <div className="srp-load-more">
                                    <button
                                        className="srp-load-more-btn"
                                        onClick={loadMore}
                                        disabled={loading}
                                    >
                                        {loading ? 'Loading…' : 'Load more'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* No results */}
                    {query && !loading && currentResults.length === 0 && !error && (
                        <div className="srp-results-card">
                            <div className="srp-empty">
                                <span className="srp-empty-icon">🔍</span>
                                <p>No results for "<strong style={{ color: 'rgba(255,255,255,0.7)' }}>{query}</strong>"</p>
                                <p style={{ fontSize: 12, opacity: 0.6 }}>Try different keywords, or broaden your filters</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
