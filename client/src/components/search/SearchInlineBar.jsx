import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, X, Clock, FileText, MessageSquare, User, Hash, CheckSquare, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { searchAll, saveRecentSearch, getRecentSearches, stripMarkdown } from '../../services/searchService';
import './SearchInlineBar.css';

const TYPE_ICON = {
  message:   <MessageSquare size={13} />,
  file:      <FileText      size={13} />,
  user:      <User          size={13} />,
  contact:   <User          size={13} />,
  channel:   <Hash          size={13} />,
  task:      <CheckSquare   size={13} />,
  note:      <FileText      size={13} />,
  knowledge: <BookOpen      size={13} />,
};

function highlight(text = '', query = '') {
  if (!query.trim() || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((p, i) =>
    regex.test(p) ? <mark key={i} className='sib-highlight'>{p}</mark> : p
  );
}

function flattenResults(results = {}) {
  const items = [];
  const order = ['messages', 'users', 'channels', 'files', 'tasks', 'notes', 'knowledge'];
  for (const key of order) {
    const arr = results[key] || [];
    // People come back as type 'contact'; everything else maps to the singular key.
    for (const r of arr.slice(0, 3)) items.push({ ...r, _type: key === 'users' ? 'user' : key.replace(/s$/, '') });
    if (items.length >= 9) break;
  }
  return items;
}

function getLabel(item) {
  if (item._type === 'message') return stripMarkdown(item.preview || item.text || '');
  return item.displayName || item.name || item.title || item.email || '';
}
function getMeta(item) {
  if (item._type === 'message') {
    const p = item.parent || {};
    const where = p.type === 'channel' ? `#${p.name || 'channel'}` : (p.id ? `DM · ${p.name || 'direct message'}` : '');
    return [item.sender?.name, where].filter(Boolean).join(' in ');
  }
  if (item._type === 'channel')  return item.description || '';
  if (item._type === 'user')     return item.email || '';
  if (item._type === 'file')     return item.mimeType || '';
  if (item._type === 'task')     return (item.status || '').replace(/_/g, ' ');
  if (item._type === 'note')     return item.preview || '';
  if (item._type === 'knowledge') return item.snippet || '';
  return '';
}

export default function SearchInlineBar({ workspaceId: propWsId }) {
  const params   = useParams();
  const navigate = useNavigate();
  const wsId     = propWsId || params?.workspaceId || '';

  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState(null);   
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [recents, setRecents] = useState(() => getRecentSearches());
  const [cursor,  setCursor]  = useState(-1);

  const inputRef   = useRef(null);
  const wrapRef    = useRef(null);
  const debounceRef = useRef(null);
  const abortRef   = useRef(null);

  
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  
  useEffect(() => {
    const fn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  
  const runSearch = useCallback((q) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim() || !wsId) { setResults(null); setLoading(false); setError(null); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    // Typeahead: keyword only (no AI re-ranking) so it stays fast.
    searchAll(q, { limit: 5, semantic: false }, wsId, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setResults(data);
        setLoading(false);
      })
      .catch(err => {
        if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) return;
        setResults(null);
        setError(err?.response?.data?.message || 'Search failed. Try again.');
        setLoading(false);
      });
  }, [wsId]);

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setCursor(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 280);
  };

  const handleFocus = () => {
    setOpen(true);
    setRecents(getRecentSearches());
  };

  const clear = () => {
    setQuery('');
    setResults(null);
    setError(null);
    setCursor(-1);
    inputRef.current?.focus();
  };

  const goToAll = (q = query) => {
    if (!q.trim()) return;
    saveRecentSearch(q);
    setRecents(getRecentSearches());
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(`/workspace/${wsId}/search?q=${encodeURIComponent(q)}`);
  };

  const handleResultClick = (item) => {
    saveRecentSearch(query);
    setRecents(getRecentSearches());
    setOpen(false);
    setQuery('');
    setResults(null);
    
    const base = `/workspace/${wsId}`;
    const id = item.id || item._id;
    const parent = item.parent || {};
    if (item._type === 'channel') navigate(`${base}/channel/${id}`);
    else if (item._type === 'message') {
      const parentId = parent.id || item.dmId || item.channelId;
      const isDm = parent.type ? parent.type === 'dm' : !!item.dmId;
      if (parentId) navigate(`${base}/${isDm ? 'dm' : 'channel'}/${parentId}`);
      else goToAll(query);
    }
    else if (item._type === 'user') navigate(`${base}/dm/new/${id}`);
    else if (item._type === 'task') navigate(`${base}/tasks/${id}`);
    else if (item._type === 'file') navigate(`${base}/files/${id}`);
    else if (item._type === 'note') navigate(`${base}/notes/${id}`);
    else if (item._type === 'knowledge') navigate(`${base}/knowledge/${id}`);
    else goToAll(query);
  };

  
  const flatItems = flattenResults(results || {});
  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'Enter') {
      if (cursor >= 0 && flatItems[cursor]) handleResultClick(flatItems[cursor]);
      else if (query.trim()) goToAll();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
  };

  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const showDropdown = open;
  const hasResults = results && flatItems.length > 0;
  const noResults  = results && flatItems.length === 0 && query.trim() && !error;

  return (
    <div className='sib-wrap' ref={wrapRef}>
      {}
      <div className={`sib-bar ${open ? 'sib-bar--active' : ''}`}>
        <Search size={14} className='sib-bar-icon' />
        <input
          ref={inputRef}
          type='text'
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder='Search…'
          className='sib-input'
          autoComplete='off'
          spellCheck={false}
        />
        {loading && <Loader2 size={13} className='sib-spinner' />}
        {query && !loading && (
          <button className='sib-clear' onClick={clear} tabIndex={-1}><X size={13} /></button>
        )}
        {!query && (
          <div className='sib-kbd'>
            <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
          </div>
        )}
      </div>

      {}
      {showDropdown && (
        <div className='sib-dropdown'>

          {}
          {!query && recents.length > 0 && (
            <>
              <div className='sib-section-header'>Recent searches</div>
              {recents.slice(0, 5).map((r, i) => (
                <button key={i} className='sib-recent-row' onClick={() => { setQuery(r); runSearch(r); }}>
                  <Clock size={12} className='sib-recent-icon' />
                  <span>{r}</span>
                </button>
              ))}
            </>
          )}

          {}
          {!query && recents.length === 0 && (
            <div className='sib-empty'>Type to search messages, files, people, tasks…</div>
          )}

          {}
          {loading && (
            <div className='sib-results-list'>
              {[1,2,3].map(i => (
                <div key={i} className='sib-skeleton-row'>
                  <div className='sib-skeleton-icon' />
                  <div className='sib-skeleton-text'>
                    <div className='sib-skeleton-line' />
                    <div className='sib-skeleton-line short' />
                  </div>
                </div>
              ))}
            </div>
          )}

          {}
          {!loading && hasResults && (
            <div className='sib-results-list'>
              {flatItems.map((item, i) => (
                <button
                  key={`${item._type}-${item.id || item._id || i}`}
                  className={`sib-result-row ${cursor === i ? 'sib-result-row--active' : ''}`}
                  onClick={() => handleResultClick(item)}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span className='sib-result-type-icon'>{TYPE_ICON[item._type] || <FileText size={13} />}</span>
                  <span className='sib-result-body'>
                    <span className='sib-result-title'>{highlight(getLabel(item).slice(0, 70), query)}</span>
                    {getMeta(item) && <span className='sib-result-meta'>{getMeta(item).slice(0, 50)}</span>}
                  </span>
                  <span className='sib-result-badge'>{item._type}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && error && query.trim() && (
            <div className='sib-empty sib-error' role='alert'><AlertCircle size={13} /> {error}</div>
          )}

          {!loading && noResults && (
            <div className='sib-empty'>No results for <strong>"{query}"</strong></div>
          )}

          {}
          {query.trim() && (
            <div className='sib-footer'>
              <span className='sib-footer-hint'>
                <kbd>↑↓</kbd> navigate &nbsp; <kbd>↵</kbd> select &nbsp; <kbd>Esc</kbd> close
              </span>
              <button className='sib-see-all' onClick={() => goToAll()}>
                See all results →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
