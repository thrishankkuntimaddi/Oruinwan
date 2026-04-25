import React from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';

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
    } catch { }
    return (content || '').slice(0, 80) || 'No content';
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-surface)', borderLeft: '1px solid rgba(255,255,255,0.07)',
      width: '288px', flexShrink: 0,
    }}>
      {}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'rgba(184,149,106,0.15)', border: '1px solid rgba(184,149,106,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={13} style={{ color: '#b8956a' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '1px' }}>Version History</h3>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{versions.length} saved versions</p>
          </div>
        </div>
        <button onClick={onClose}
          style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={14} />
        </button>
      </div>

      {}
      <div style={{ padding: '8px 14px', background: 'rgba(184,149,106,0.06)', borderBottom: '1px solid rgba(184,149,106,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', background: '#b8956a', borderRadius: '50%', flexShrink: 0 }} />
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#b8956a', fontFamily: 'monospace' }}>Current version</p>
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(184,149,106,0.5)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '14px' }}>
          {getPreview(currentContent) || 'No content yet'}
        </p>
      </div>

      {}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {versions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', textAlign: 'center' }}>
            <Clock size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>No saved versions yet</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Versions are saved automatically as you edit</p>
          </div>
        ) : (
          [...versions].reverse().map((v, idx) => (
            <div key={v._id || v.savedAt || idx}
              style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <div style={{ width: '5px', height: '5px', background: 'rgba(228,228,228,0.2)', borderRadius: '50%', flexShrink: 0 }} />
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>{v.title || 'Untitled'}</p>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '11px', fontFamily: 'monospace' }}>{formatTime(v.savedAt || v.timestamp)}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '11px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                    {getPreview(v.content)}
                  </p>
                </div>
                <button onClick={() => onRestore(v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease', opacity: 0, fontFamily: 'Inter, system-ui, sans-serif' }}
                  className="version-restore-btn"
                  title="Restore this version"
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#b8956a'; e.currentTarget.style.borderColor = 'rgba(184,149,106,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                >
                  <RotateCcw size={11} /> Restore
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'monospace' }}>
          Last 50 auto-saves · Stored in database
        </p>
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
