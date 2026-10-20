import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, Upload, Search, RefreshCw, Loader2 } from 'lucide-react';
import { useFiles } from '../../../hooks/useFiles';
import { useToast } from '../../../contexts/ToastContext';
import WorkspacePanel, { PanelSection, PanelEmpty } from '../WorkspacePanel';
import { fileKind, formatSize, FILES_CHANGED, announceFilesChanged } from '../../../pages/SidebarComp/fileKinds';
import '../../../styles/gloss-x-panels.css';

const SOURCE = 'panel';

const FilesPanel = ({ title }) => {
  const { workspaceId, id: fileId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { files, loading, listFiles, uploadFile } = useFiles();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const reload = useCallback(() => {
    if (workspaceId) listFiles(workspaceId, { folderId: 'root' });
  }, [workspaceId, listFiles]);

  useEffect(() => { reload(); }, [reload]);

  // The Files page uploads and deletes too: stay in step with it.
  useEffect(() => {
    const onChange = (e) => { if (e.detail?.source !== SOURCE) reload(); };
    window.addEventListener(FILES_CHANGED, onChange);
    return () => window.removeEventListener(FILES_CHANGED, onChange);
  }, [reload]);

  const handleUpload = async (fileList) => {
    const list = [...(fileList || [])];
    if (!list.length || !workspaceId) return;
    setUploading(true);
    let ok = 0;
    let last = null;
    for (const file of list) {
      try {
        last = await uploadFile(workspaceId, file, { tags: [] });
        ok++;
      } catch {
        showToast(`Couldn’t upload ${file.name}`, 'error');
      }
    }
    setUploading(false);
    if (ok) {
      showToast(`${ok} file${ok > 1 ? 's' : ''} uploaded`, 'success');
      announceFilesChanged(SOURCE);
      if (ok === 1 && last?._id) navigate(`/workspace/${workspaceId}/files/${last._id}`);
    }
  };

  const pickFiles = () => inputRef.current?.click();

  const allTags = [...new Set(files.flatMap(f => f.tags || []))];
  const filtered = files.filter(f => {
    const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !activeTag || (f.tags || []).includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <WorkspacePanel
      icon={FolderOpen}
      title="Files"
      subtitle={title}
      actions={(
        <>
          <button type="button" className="gl-icon-btn" onClick={reload} title="Refresh" aria-label="Refresh files">
            <RefreshCw size={14} />
          </button>
          <button type="button" className="gl-icon-btn" onClick={pickFiles} disabled={uploading} title="Upload files" aria-label="Upload files">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={15} />}
          </button>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }} />
        </>
      )}
      tools={(
        <>
          <div className="gl-search">
            <Search size={12} />
            <input className="gl-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a file…" aria-label="Find a file" />
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
      footer={!loading && files.length > 0 ? `${files.length} ${files.length === 1 ? 'file' : 'files'} in the workspace` : null}
    >
      {loading && files.length === 0 && <div className="gl-x-center"><div className="gl-x-spinner" /></div>}
      {!loading && filtered.length === 0 && (
        <PanelEmpty
          icon={FolderOpen}
          title={search || activeTag ? 'No matching files' : 'No files yet'}
          text={search || activeTag ? 'Try a different name or tag.' : 'Upload documents, images and recordings for the whole workspace.'}
          action={!search && !activeTag && (
            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={pickFiles} disabled={uploading}>
              <Upload size={12} /> Upload files
            </button>
          )}
        />
      )}
      {filtered.length > 0 && (
        <PanelSection label={search || activeTag ? 'Results' : 'All files'}>
          {filtered.map(file => {
            const { Icon } = fileKind(file.mimeType);
            const active = fileId === file._id;
            return (
              <button key={file._id} type="button"
                className={`gl-item gl-x-tall${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(`/workspace/${workspaceId}/files/${file._id}`)}>
                <Icon size={14} className="gl-x-item-icon" style={{ flexShrink: 0, marginTop: 2 }} />
                <span className="gl-x-item-main">
                  <span className="gl-x-item-title" style={{ display: 'block' }}>{file.name}</span>
                  <span className="gl-x-item-sub" style={{ display: 'block' }}>
                    {formatSize(file.size)}
                    {file.tags?.length > 0 && ` · ${file.tags.map(t => `#${t}`).join(' ')}`}
                  </span>
                </span>
              </button>
            );
          })}
        </PanelSection>
      )}
    </WorkspacePanel>
  );
};

export default FilesPanel;
