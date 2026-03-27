// client/src/components/search/SearchResultItem.jsx
/**
 * SearchResultItem — Renders a single search result row.
 * Handles all types: message, file, user, channel, task, note, knowledge.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

// ── Highlight matched text ────────────────────────────────────────────────────
function HighlightText({ text, highlight }) {
    if (!text) return null;
    if (!highlight || !highlight.trim()) return <span>{text}</span>;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp(`(${escaped})`, 'gi');
    const parts   = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part)
                    ? <mark key={i} className="search-highlight">{part}</mark>
                    : <span key={i}>{part}</span>
            )}
        </span>
    );
}

// ── Type icons ────────────────────────────────────────────────────────────────
const TYPE_ICON = {
    message:   '💬',
    file:      '📎',
    contact:   '👤',
    user:      '👤',
    channel:   '#',
    task:      '✅',
    note:      '📝',
    knowledge: '📚',
};

const TYPE_LABEL = {
    message:   'Message',
    file:      'File',
    contact:   'User',
    user:      'User',
    channel:   'Channel',
    task:      'Task',
    note:      'Note',
    knowledge: 'Knowledge',
};

const PRIORITY_COLOR = {
    highest: '#ef4444',
    high:    '#f97316',
    medium:  '#eab308',
    low:     '#22c55e',
    lowest:  '#94a3b8',
};

const STATUS_COLOR = {
    done:       '#22c55e',
    in_progress:'#3b82f6',
    review:     '#a855f7',
    blocked:    '#ef4444',
    todo:       '#64748b',
    backlog:    '#94a3b8',
    cancelled:  '#94a3b8',
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60)          return 'just now';
    if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7)   return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
}

function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024)           return `${bytes}B`;
    if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SearchResultItem({ result, query, onClick, compact = false }) {
    const navigate = useNavigate();

    if (!result) return null;

    const { type } = result;
    const icon     = TYPE_ICON[type] || '🔍';
    const typeLabel= TYPE_LABEL[type] || type;

    const handleClick = () => {
        if (onClick) return onClick(result);
        // Default navigation by type
        switch (type) {
            case 'channel':   navigate(`/workspace?channel=${result.id}`); break;
            case 'task':      navigate(`/workspace?task=${result.id}`);    break;
            case 'note':      navigate(`/workspace?note=${result.id}`);    break;
            case 'knowledge': navigate(`/workspace?kb=${result.id}`);      break;
            case 'file':      if (result.url) window.open(result.url, '_blank'); break;
            default: break;
        }
    };

    return (
        <div className={`search-result-item search-result-${type} ${compact ? 'compact' : ''}`} onClick={handleClick}>
            {/* Left: icon */}
            <div className="search-result-icon">
                <span className="search-result-type-icon">{type === 'knowledge' ? (result.icon || '📚') : icon}</span>
            </div>

            {/* Center: main content */}
            <div className="search-result-content">
                <div className="search-result-header">
                    <span className="search-result-title">
                        {type === 'message' ? (
                            <HighlightText text={result.preview || result.text} highlight={query} />
                        ) : (
                            <HighlightText text={result.name || result.title || result.email} highlight={query} />
                        )}
                    </span>
                    {!compact && <span className="search-result-type-badge">{typeLabel}</span>}
                </div>

                {/* Subtitle / preview */}
                {!compact && (
                    <div className="search-result-meta">
                        {type === 'message' && result.sender && (
                            <span className="search-result-sub">
                                {result.sender.name} in {result.parent?.type === 'channel' ? `#${result.parent.name}` : result.parent?.name}
                            </span>
                        )}
                        {type === 'file' && (
                            <span className="search-result-sub">
                                {result.mimeType?.split('/')[1]?.toUpperCase() || 'File'} · {formatBytes(result.size)}
                                {result.tags?.length > 0 && ` · ${result.tags.join(', ')}`}
                            </span>
                        )}
                        {type === 'channel' && (
                            <span className="search-result-sub">
                                {result.isPrivate ? '🔒 Private' : '# Public'} · {result.memberCount} members
                                {result.description && ` · ${result.description}`}
                            </span>
                        )}
                        {type === 'task' && (
                            <span className="search-result-sub">
                                <span className="search-result-status-dot" style={{ background: STATUS_COLOR[result.status] || '#94a3b8' }} />
                                {result.status?.replace('_', ' ')}
                                {result.priority && (
                                    <span className="search-result-priority" style={{ color: PRIORITY_COLOR[result.priority] }}>
                                        · {result.priority}
                                    </span>
                                )}
                                {result.assignedTo?.length > 0 && ` · ${result.assignedTo.map(u => u.name).join(', ')}`}
                            </span>
                        )}
                        {type === 'note' && (
                            <span className="search-result-sub">
                                {result.owner?.name}
                                {result.tags?.length > 0 && ` · ${result.tags.join(', ')}`}
                                {result.preview && ` — ${result.preview}`}
                            </span>
                        )}
                        {type === 'knowledge' && (
                            <span className="search-result-sub">
                                {result.snippet}
                                {result.tags?.length > 0 && (
                                    <span className="search-result-tags">
                                        {result.tags.map(t => <span key={t} className="search-tag">{t}</span>)}
                                    </span>
                                )}
                            </span>
                        )}
                        {(type === 'contact' || type === 'user') && (
                            <span className="search-result-sub">{result.email}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Right: timestamp */}
            {result.createdAt && (
                <div className="search-result-time">{formatDate(result.createdAt)}</div>
            )}

            {/* Avatar for users */}
            {(type === 'contact' || type === 'user') && (
                <div className="search-result-avatar">
                    {result.profilePicture
                        ? <img src={result.profilePicture} alt={result.name} className="search-avatar-img" />
                        : <span className="search-avatar-initials">{(result.name || '?')[0].toUpperCase()}</span>
                    }
                    {result.isOnline && <span className="search-online-dot" />}
                </div>
            )}
        </div>
    );
}
