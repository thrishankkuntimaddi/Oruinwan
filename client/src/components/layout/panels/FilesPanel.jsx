import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, Upload, Search, ChevronRight, RefreshCw } from 'lucide-react';
import { useFiles } from '../../../hooks/useFiles';
import WorkspacePanel, { PanelSection, PanelEmpty } from '../WorkspacePanel';
import '../../../styles/gloss-x-panels.css';

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

const FilesPanel = ({ title }) => {
  const { workspaceId, id: fileId } = useParams();
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

  const goUpload = () => navigate(`/workspace/${workspaceId}/files`);

  return (
    <WorkspacePanel
      icon={FolderOpen}
      title="Files"
      subtitle={title}
      actions={(
        <>
          <button type="button" className="gl-icon-btn" onClick={() => listFiles(workspaceId, { folderId: 'root' })} title="Refresh" aria-label="Refresh files">
            <RefreshCw size={14} />
          </button>
          <button type="button" className="gl-icon-btn" onClick={goUpload} title="Upload" aria-label="Upload a file">
            <Upload size={15} />
          </button>
        </>
      )}
      tools={(
        <>
          <div className="gl-search">
            <Search size={12} />
            <input className="gl-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files…" aria-label="Search files" />
          </div>
          {allTags.length > 0 && (
            <div className="gl-x-chips">
              {[null, ...allTags.slice(0, 8)].map((tag, i) => (
                <button key={i} type="button" className={`gl-x-chip${activeTag === tag ? ' is-active' : ''}`} aria-pressed={activeTag === tag}
                  onClick={() => setActiveTag(tag === activeTag ? null : tag)}>
                  {tag ? `#${tag}` : 'All'}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      footer={!loading && files.length > 0 ? `${files.length} ${files.length === 1 ? 'file' : 'files'} in the root folder` : null}
    >
      {loading && <div className="gl-x-center"><div className="gl-x-spinner" /></div>}
      {!loading && filtered.length === 0 && (
        <PanelEmpty
          icon={FolderOpen}
          title={search || activeTag ? 'No matching files' : 'No files yet'}
          text={search || activeTag ? 'Try a different search or tag.' : 'Upload documents, images and more for the whole workspace.'}
          action={!search && !activeTag && (
            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={goUpload}>
              <Upload size={12} /> Upload a file
            </button>
          )}
        />
      )}
      {!loading && filtered.length > 0 && (
        <PanelSection label="Root folder">
          {filtered.map(file => (
            <button key={file._id} type="button"
              className={`gl-item gl-x-tall${fileId === file._id ? ' is-active' : ''}`}
              aria-current={fileId === file._id ? 'page' : undefined}
              onClick={() => navigate(`/workspace/${workspaceId}/files/${file._id}`)}>
              <span className="gl-x-emoji" style={{ fontSize: '14px' }}>{getMimeIcon(file.mimeType)}</span>
              <span className="gl-x-item-main">
                <span className="gl-x-item-title" style={{ display: 'block' }}>{file.name}</span>
                {file.tags?.length > 0 && <span className="gl-x-item-sub" style={{ display: 'block' }}>{file.tags.map(t => `#${t}`).join(' ')}</span>}
              </span>
              <ChevronRight size={11} className="gl-x-item-icon" style={{ alignSelf: 'center' }} />
            </button>
          ))}
        </PanelSection>
      )}
    </WorkspacePanel>
  );
};

export default FilesPanel;
