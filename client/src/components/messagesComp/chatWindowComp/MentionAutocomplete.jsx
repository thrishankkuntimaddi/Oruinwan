// client/src/components/messagesComp/chatWindowComp/MentionAutocomplete.jsx
// Phase-8: @mention autocomplete dropdown for the chat composer
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

/**
 * MentionAutocomplete
 *
 * Usage: Mount this adjacent to your textarea or rich-text input.
 *
 * Props:
 *  query            — the text after @ (e.g. "ali" from "@ali")
 *  workspaceId      — for scoping member search
 *  onSelect(user)   — called with { _id, username, profilePicture }
 *  onDismiss()      — user pressed Escape or clicked outside
 *  anchorRef        — ref to the input element (for positioning)
 */
export default function MentionAutocomplete({ query = '', workspaceId, onSelect, onDismiss, anchorRef }) {
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef  = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!query && query !== '') { setResults([]); return; }
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    axios.get(`${API}/api/v2/messages/workspace-members`, {
      params: { workspaceId, search: query, limit: 8 },
      withCredentials: true,
      signal: ctrl.signal,
    })
      .then(res => {
        setResults(res.data?.members || []);
        setHighlighted(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [query, workspaceId]);

  // Keyboard navigation
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') { onDismiss?.(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    }
    if (e.key === 'Enter' && results[highlighted]) {
      e.preventDefault();
      onSelect?.(results[highlighted]);
    }
  }, [results, highlighted, onDismiss, onSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Scroll highlighted item into view
  useEffect(() => {
    listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  if (results.length === 0 && !loading) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        width: 260,
        background: '#1e2124',
        border: '1px solid #3a3d42',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        zIndex: 1000,
        fontFamily: 'Inter, sans-serif',
        marginBottom: 4,
      }}
    >
      {loading && (
        <div style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>Searching…</div>
      )}
      <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: '4px 0', maxHeight: 240, overflowY: 'auto' }}>
        {results.map((user, idx) => (
          <li
            key={user._id}
            onMouseEnter={() => setHighlighted(idx)}
            onClick={() => onSelect?.(user)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', cursor: 'pointer',
              background: idx === highlighted ? '#2d3035' : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            {user.profilePicture ? (
              <img src={user.profilePicture} alt={user.username}
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#5865f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#fff', fontWeight: 600, flexShrink: 0,
              }}>
                {(user.username?.[0] || '?').toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                {highlightMatch(user.username || '', query)}
              </div>
              {user.role && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>{user.role}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div style={{ padding: '4px 12px 6px', borderTop: '1px solid #2d3035' }}>
        <span style={{ fontSize: 10, color: '#6b7280' }}>↑↓ navigate · Enter to select · Esc to dismiss</span>
      </div>
    </div>
  );
}

/** Wraps matched portion in a highlighted span */
function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: '#5865f2' }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}
