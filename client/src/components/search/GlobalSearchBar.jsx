import React, { useEffect, useRef } from 'react';
import { useSearch } from '../../contexts/SearchContext';
import SearchResultItem from './SearchResultItem';
import './SearchBar.css';

const SECTIONS = [
    { key: 'channels',  label: 'Channels',  icon: '#'  },
    { key: 'users',     label: 'People',    icon: '👤' },
    { key: 'messages',  label: 'Messages',  icon: '💬' },
    { key: 'tasks',     label: 'Tasks',     icon: '✅' },
    { key: 'files',     label: 'Files',     icon: '📎' },
    { key: 'notes',     label: 'Notes',     icon: '📝' },
    { key: 'knowledge', label: 'Knowledge', icon: '📚' },
];

export default function GlobalSearchBar() {
    const {
        isOpen, query, results, loading, error,
        recentSearches, workspaceId,
        setQuery, closeSearch, goToResults,
        openSearch,
    } = useSearch();

    const inputRef    = useRef(null);
    const overlayRef  = useRef(null);

    
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen]);

    
    useEffect(() => {
        const handler = (e) => {
            if (overlayRef.current && !overlayRef.current.contains(e.target)) {
                closeSearch();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return ()  => document.removeEventListener('mousedown', handler);
    }, [isOpen, closeSearch]);

    const handleKey = (e) => {
        if (e.key === 'Enter' && query.trim()) {
            goToResults(query);
        }
        if (e.key === 'Escape') {
            closeSearch();
        }
    };

    const totalResults = query
        ? Object.values(results).filter(Array.isArray).reduce((s, a) => s + a.length, 0)
        : 0;

    
    return (
        <>
            {}
            <button
                className="gsb-trigger"
                onClick={openSearch}
                title="Search (⌘K)"
                aria-label="Open global search"
            >
                <svg className="gsb-trigger-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <line x1="13" y1="13" x2="18" y2="18" />
                </svg>
                <span className="gsb-trigger-text">Search…</span>
                <kbd className="gsb-trigger-kbd">⌘K</kbd>
            </button>

            {}
            {isOpen && (
                <div className="gsb-backdrop" role="dialog" aria-modal="true" aria-label="Global Search">
                    <div className="gsb-modal" ref={overlayRef}>
                        {}
                        <div className="gsb-input-row">
                            <svg className="gsb-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="8.5" cy="8.5" r="5.5" />
                                <line x1="13" y1="13" x2="18" y2="18" />
                            </svg>
                            <input
                                ref={inputRef}
                                className="gsb-input"
                                type="text"
                                placeholder="Search messages, files, people, tasks…"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKey}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            {loading && <span className="gsb-spinner" aria-label="Searching…" />}
                            {query && (
                                <button className="gsb-clear-btn" onClick={() => setQuery('')} title="Clear">✕</button>
                            )}
                        </div>

                        {}
                        <div className="gsb-body">
                            {}
                            {error && <div className="gsb-error">⚠️ {error}</div>}

                            {}
                            {!query && !loading && (
                                <div className="gsb-recents">
                                    {recentSearches.length > 0 ? (
                                        <>
                                            <p className="gsb-section-label">Recent Searches</p>
                                            {recentSearches.map((term, i) => (
                                                <button key={i} className="gsb-recent-item" onClick={() => setQuery(term)}>
                                                    <span className="gsb-recent-icon">🕐</span>
                                                    <span>{term}</span>
                                                </button>
                                            ))}
                                        </>
                                    ) : (
                                        <p className="gsb-empty">Start typing to search across Chttrix</p>
                                    )}
                                </div>
                            )}

                            {}
                            {query && loading && (
                                <div className="gsb-loading-state">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="gsb-skeleton-row">
                                            <div className="gsb-skeleton-icon" />
                                            <div className="gsb-skeleton-text">
                                                <div className="gsb-skeleton-line" style={{ width: `${60 + i * 15}%` }} />
                                                <div className="gsb-skeleton-line short" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {}
                            {query && !loading && totalResults > 0 && (
                                <>
                                    {SECTIONS.map(({ key, label, icon }) => {
                                        const items = results[key] || [];
                                        if (items.length === 0) return null;
                                        const preview = items.slice(0, 3);
                                        return (
                                            <div key={key} className="gsb-section">
                                                <p className="gsb-section-label">
                                                    <span>{icon}</span> {label}
                                                    <span className="gsb-section-count">{items.length}</span>
                                                </p>
                                                {preview.map(result => (
                                                    <SearchResultItem
                                                        key={result.id}
                                                        result={result}
                                                        query={query}
                                                        compact
                                                        onClick={() => goToResults(query)}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {}
                            {query && !loading && totalResults === 0 && !error && (
                                <div className="gsb-no-results">
                                    <span className="gsb-no-results-icon">🔍</span>
                                    <p>No results for <strong>"{query}"</strong></p>
                                    <p className="gsb-no-results-hint">Try different keywords or check spelling</p>
                                </div>
                            )}
                        </div>

                        {}
                        {query && (
                            <div className="gsb-footer">
                                <span className="gsb-footer-hint">
                                    {totalResults > 0 ? `${totalResults} result${totalResults !== 1 ? 's' : ''}` : ''}
                                </span>
                                <button
                                    className="gsb-see-all-btn"
                                    onClick={() => goToResults(query)}
                                    disabled={!workspaceId}
                                >
                                    See all results →
                                </button>
                            </div>
                        )}

                        {}
                        <div className="gsb-keys-hint">
                            <kbd>↑↓</kbd> navigate&nbsp;
                            <kbd>↵</kbd> confirm&nbsp;
                            <kbd>Esc</kbd> close
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
