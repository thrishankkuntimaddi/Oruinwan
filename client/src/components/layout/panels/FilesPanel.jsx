import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FolderOpen, Upload, Search, RefreshCw, Loader2 } from 'lucide-react';
import { useFiles } from '../../../hooks/useFiles';
import { useSharedFiles, KIND_OPTIONS, whereLabel } from '../../../hooks/useSharedFiles';
import { useToast } from '../../../contexts/ToastContext';
import WorkspacePanel, { PanelSection, PanelEmpty } from '../WorkspacePanel';
import { fileKind, formatSize, FILES_CHANGED, announceFilesChanged } from '../../../pages/SidebarComp/fileKinds';
import '../../../styles/gloss-x-panels.css';

const SOURCE = 'panel';

const FilesPanel = ({ title }) => {
  const { workspaceId, id: fileId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const openItem = searchParams.get('item');
  const { uploadFile } = useFiles();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  // Everything shared with the person: channel / DM attachments and library uploads.
  const { items, total, loading, reload } = useSharedFiles(workspaceId, { kind, source: 'all', q, sort: 'newest' });

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

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
      reload();
      if (ok === 1 && last?._id) navigate(`/workspace/${workspaceId}/files/${last._id}`);
    }
  };

  const pickFiles = () => inputRef.current?.click();

  const filtering = Boolean(q) || kind !== 'all';
  const open = (item) => {
    if (item.source === 'library') navigate(`/workspace/${workspaceId}/files/${item.fileId}`);
    else navigate(`/workspace/${workspaceId}/files?item=${encodeURIComponent(item.id)}`);
  };

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
            <input className="gl-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a file by name…" aria-label="Find a file" />
          </div>
          <div className="gl-x-chips">
            {KIND_OPTIONS.map((o) => (
              <button key={o.value} type="button" className={`gl-x-chip${kind === o.value ? ' is-active' : ''}`} aria-pressed={kind === o.value}
                onClick={() => setKind(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
      footer={!loading && total > 0 ? `${total} ${total === 1 ? 'file' : 'files'} shared with you` : null}
    >
      {loading && items.length === 0 && <div className="gl-x-center"><div className="gl-x-spinner" /></div>}
      {!loading && items.length === 0 && (
        <PanelEmpty
          icon={FolderOpen}
          title={filtering ? 'No matching files' : 'Nothing shared yet'}
          text={filtering ? 'Try a different name or type.' : 'Files sent in your channels and DMs show up here, along with uploads for the whole workspace.'}
          action={!filtering && (
            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={pickFiles} disabled={uploading}>
              <Upload size={12} /> Upload files
            </button>
          )}
        />
      )}
      {items.length > 0 && (
        <PanelSection label={filtering ? 'Results' : 'Recent'}>
          {items.map(item => {
            const { Icon } = fileKind(item.mimeType);
            const active = item.source === 'library' ? fileId === item.fileId : openItem === item.id;
            return (
              <button key={item.id} type="button"
                className={`gl-item gl-x-tall${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => open(item)}>
                <Icon size={14} className="gl-x-item-icon" style={{ flexShrink: 0, marginTop: 2 }} />
                <span className="gl-x-item-main">
                  <span className="gl-x-item-title" style={{ display: 'block' }}>{item.name}</span>
                  <span className="gl-x-item-sub" style={{ display: 'block' }}>
                    {formatSize(item.size)} · {whereLabel(item)}
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
