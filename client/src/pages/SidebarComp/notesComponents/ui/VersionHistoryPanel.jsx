import React from 'react';
import { RotateCcw, Clock, History } from 'lucide-react';
import SidePanelHead from './SidePanelHead';

const VersionHistoryPanel = ({ versions, currentContent, currentTitle, onRestore, onClose }) => {
  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getPreview = (content) => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed))
        return parsed.filter(b => b.type === 'text' || b.type === 'heading')
          .map(b => b.content?.replace(/<[^>]*>/g, '')).filter(Boolean).join(' ').slice(0, 80) || 'No text content';
    } catch { /* plain text */ }
    return (content || '').slice(0, 80) || 'No content';
  };

  return (
    <aside className="nt-side" aria-label="Version history">
      <SidePanelHead icon={History} title="Version history" sub={versions.length ? `${versions.length} saved version${versions.length === 1 ? '' : 's'}` : 'Saved as you edit'} onClose={onClose} />

      <div style={{ padding: '10px 16px', background: 'var(--gl-accent-soft)', borderBottom: '1px solid var(--gl-accent-line)' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
          <span className="cd-dot" data-tone="accent" /> Current version{currentTitle ? ` · ${currentTitle}` : ''}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getPreview(currentContent) || 'No content yet'}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {versions.length === 0 ? (
          <div className="cd-state">
            <span className="gl-empty-mark"><Clock size={18} /></span>
            <p className="gl-empty-title">No earlier versions yet</p>
            <p className="gl-empty-text">A version is saved when you add, move or remove blocks, so you can go back to it here.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {[...versions].reverse().map((v, idx) => (
              <li key={v._id || v.savedAt || idx} className="nt-ver-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{v.title || 'Untitled'}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 4px' }}>{formatTime(v.savedAt || v.timestamp)}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                    {getPreview(v.content)}
                  </p>
                </div>
                {onRestore && (
                  <button type="button" className="gl-btn gl-btn--sm nt-ver-restore" onClick={() => onRestore(v)} title="Restore this version">
                    <RotateCcw size={12} /> Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
        Keeps the last 50 versions. Restoring replaces the note for everyone.
      </p>
    </aside>
  );
};

export default VersionHistoryPanel;
