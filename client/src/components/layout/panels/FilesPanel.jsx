import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, Upload, Search, ChevronRight, RefreshCw } from 'lucide-react';
import { useFiles } from '../../../hooks/useFiles';

const S = {
  panel:  { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' },
  header: { padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 },
  label:  { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' },
  input:  { width: '100%', paddingLeft: '28px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px', fontSize: '12px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' },
};

const FilesPanel = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { files, loading, listFiles } = useFiles();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);

  useEffect(() => {
    if (workspaceId) listFiles(workspaceId, { folderId: 'root' });
  }, [workspaceId, listFiles]);

  const allTags = [...new Set(files.flatMap(f => f.tags || []))];
  const filtered = files.filter(f => {
    const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !activeTag || (f.tags || []).includes(activeTag);
    return matchesSearch && matchesTag;
  });

  const getMimeIcon = (mimeType = '') => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    return '📎';
  };

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={S.label}>
            <FolderOpen size={12} /> Files
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => listFiles(workspaceId, { folderId: 'root' })} title="Refresh"
              style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.35)'}
            ><RefreshCw size={12} /></button>
            <button onClick={() => navigate(`/workspace/${workspaceId}/files`)} title="Upload"
              style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.35)'}
            ><Upload size={12} /></button>
          </div>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." style={S.input} />
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '1px solid var(--border-subtle)' }}>
          {[null, ...allTags.slice(0, 8)].map((tag, i) => (
            <button key={i} onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              style={{ fontSize: '10px', padding: '2px 8px', background: activeTag === tag ? 'rgba(184,149,106,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activeTag === tag ? 'rgba(184,149,106,0.3)' : 'rgba(255,255,255,0.08)'}`, color: activeTag === tag ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}>
              {tag ? `#${tag}` : 'All'}
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid #b8956a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', textAlign: 'center' }}>
            <FolderOpen size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif' }}>No files yet</p>
            <button onClick={() => navigate(`/workspace/${workspaceId}/files`)}
              style={{ marginTop: '10px', fontSize: '12px', color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
              Upload a file
            </button>
          </div>
        )}
        {filtered.map(file => (
          <button key={file._id} onClick={() => navigate(`/workspace/${workspaceId}/files/${file._id}`)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', transition: 'background 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>{getMimeIcon(file.mimeType)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif', margin: 0 }}>{file.name}</p>
              {file.tags?.length > 0 && (
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{file.tags.map(t => `#${t}`).join(' ')}</p>
              )}
            </div>
            <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilesPanel;
