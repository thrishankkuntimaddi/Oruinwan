import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Upload, LayoutGrid, List, Download, Trash2, FolderOpen, Loader2,
} from 'lucide-react';
import { useFiles, mergeFile } from '../../hooks/useFiles';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import {
    DashPage, PageHead, Panel, Toolbar, SearchBox, FilterTabs, Btn, IconBtn, Grid,
    LoadingState, ErrorState, EmptyState, Confirm, Dialog, Field, timeAgo,
} from '../../components/ui/page';
import { fileKind, formatSize, FILES_CHANGED, announceFilesChanged } from './fileKinds';
import FilePreviewPanel from './FilePreviewPanel';
import FileTagsInput, { FILE_TAGS_CSS } from './FileTagsInput';

const SOURCE = 'library';

/** Square mark with the file-kind icon (or a thumbnail for images in the grid). */
function KindMark({ file, size = 16 }) {
    const { Icon } = fileKind(file.mimeType);
    return <span className="gl-empty-mark" style={{ margin: 0, flexShrink: 0 }}><Icon size={size} /></span>;
}

function FileCard({ file, onOpen, onDelete }) {
    const { Icon, label } = fileKind(file.mimeType);
    const [broken, setBroken] = useState(false);
    const isImage = file.mimeType?.startsWith('image/') && !broken;
    return (
        <div className="gl-card gl-card--interactive fl-card">
            <button type="button" className="fl-card-main" onClick={() => onOpen(file)} aria-label={`Open ${file.name}`}>
                <span className="fl-thumb">
                    {isImage
                        ? <img src={file.url} alt="" onError={() => setBroken(true)} />
                        : <Icon size={28} style={{ color: 'var(--accent)' }} />}
                </span>
                <span className="fl-card-text">
                    <strong className="fl-name">{file.name}</strong>
                    <span className="fl-meta">{label} · {formatSize(file.size)} · {timeAgo(file.createdAt)}</span>
                </span>
            </button>
            <span className="fl-actions fl-card-actions">
                <IconBtn label={`Download ${file.name}`} onClick={() => window.open(file.url, '_blank')}><Download size={14} /></IconBtn>
                <IconBtn label={`Delete ${file.name}`} onClick={() => onDelete(file)}><Trash2 size={14} /></IconBtn>
            </span>
        </div>
    );
}

function FileRow({ file, first, active, onOpen, onDelete }) {
    const { label } = fileKind(file.mimeType);
    return (
        <li className="fl-row" data-active={active ? 'true' : undefined} style={{ borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
            <button type="button" className="fl-row-main" onClick={() => onOpen(file)}>
                <KindMark file={file} />
                <span style={{ flex: 1, minWidth: 0 }}>
                    <strong className="fl-name" style={{ fontSize: 14 }}>{file.name}</strong>
                    <span className="fl-meta">
                        {label} · {formatSize(file.size)} · {timeAgo(file.createdAt)}
                        {file.tags?.length > 0 && ` · ${file.tags.map((t) => `#${t}`).join(' ')}`}
                    </span>
                </span>
            </button>
            <span className="fl-actions">
                <IconBtn label={`Download ${file.name}`} onClick={() => window.open(file.url, '_blank')}><Download size={14} /></IconBtn>
                <IconBtn label={`Delete ${file.name}`} onClick={() => onDelete(file)}><Trash2 size={14} /></IconBtn>
            </span>
        </li>
    );
}

const FileLibrary = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { activeWorkspace } = useWorkspace();
    const filesApi = useFiles();
    const { files, loading, error, listFiles, uploadFile, deleteFile, patchFile } = filesApi;
    const [pendingUploads, setPendingUploads] = useState(null);
    const [uploadTags, setUploadTags] = useState([]);
    const [view, setView] = useState('grid');
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [uploading, setUploading] = useState(0);
    const [selectedFile, setSelectedFile] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const dragDepth = useRef(0);
    const inputRef = useRef(null);

    const reload = useCallback(async () => {
        if (!workspaceId) return;
        await listFiles(workspaceId, { folderId: 'root' });
        setLoaded(true);
    }, [workspaceId, listFiles]);

    useEffect(() => { reload(); }, [reload]);

    // The side panel uploads too: reload when it changes the list.
    useEffect(() => {
        const onChange = (e) => { if (e.detail?.source !== SOURCE) reload(); };
        window.addEventListener(FILES_CHANGED, onChange);
        return () => window.removeEventListener(FILES_CHANGED, onChange);
    }, [reload]);

    useEffect(() => {
        if (!id) { setSelectedFile(null); return; }
        if (files.length) {
            const f = files.find((x) => x._id === id);
            if (f) setSelectedFile(f);
        }
    }, [id, files]);

    // Picking or dropping files opens a short step to tag them before they upload.
    const queueUpload = (fileList) => {
        const list = [...(fileList || [])];
        if (!list.length) return;
        setUploadTags(tagFilter ? [tagFilter] : []);
        setPendingUploads(list);
    };

    const confirmUpload = () => {
        const list = pendingUploads;
        const tags = uploadTags;
        setPendingUploads(null);
        handleUpload(list, tags);
    };

    const handleFileChange = useCallback((next) => {
        patchFile(next);
        setSelectedFile((prev) => (prev && prev._id === next._id ? mergeFile(prev, next) : prev));
    }, [patchFile]);

    const handleUpload = async (fileList, tags = []) => {
        const list = [...(fileList || [])];
        if (!list.length) return;
        setUploading(list.length);
        let successCount = 0;
        for (const file of list) {
            try {
                await uploadFile(workspaceId, file, { tags });
                successCount++;
            } catch {
                showToast(`Couldn’t upload ${file.name}`, 'error');
            }
        }
        setUploading(0);
        if (successCount > 0) {
            showToast(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`, 'success');
            announceFilesChanged(SOURCE);
        }
    };

    const pickFiles = () => inputRef.current?.click();

    const handleDelete = async () => {
        const file = confirmDelete;
        if (!file) return;
        setDeleting(true);
        try {
            await deleteFile(file._id);
            showToast(`Deleted “${file.name}”`, 'success');
            announceFilesChanged(SOURCE);
            if (selectedFile?._id === file._id) closePreview();
            setConfirmDelete(null);
        } catch {
            showToast('Couldn’t delete the file', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleFileClick = (file) => {
        setSelectedFile(file);
        navigate(`/workspace/${workspaceId}/files/${file._id}`, { replace: true });
    };

    function closePreview() {
        setSelectedFile(null);
        navigate(`/workspace/${workspaceId}/files`, { replace: true });
    }

    // Drop anywhere on the page to upload.
    const dropHandlers = {
        onDragEnter: (e) => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth.current += 1; setDragging(true); } },
        onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
        onDragOver: (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); },
        onDrop: (e) => {
            if (!e.dataTransfer?.files?.length) return;
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            queueUpload(e.dataTransfer.files);
        },
    };

    const allTags = useMemo(() => [...new Set(files.flatMap((f) => f.tags || []))], [files]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return files.filter((f) => (!q || f.name.toLowerCase().includes(q)) && (!tagFilter || (f.tags || []).includes(tagFilter)));
    }, [files, search, tagFilter]);

    const hasAny = files.length > 0;
    const firstLoad = loading && !loaded;

    return (
        <div className="fl-wrap" {...dropHandlers}>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => { queueUpload(e.target.files); e.target.value = ''; }} />
            <div className="fl-main">
                <DashPage
                    wide
                    head={(
                        <PageHead
                            eyebrow={activeWorkspace?.name ? `${activeWorkspace.name} · Files` : 'Files'}
                            title="Files"
                            icon={FolderOpen}
                            lead="Documents, images and recordings the whole workspace can find, preview and discuss."
                            actions={hasAny && (
                                <Btn variant="primary" icon={Upload} loading={uploading > 0} onClick={pickFiles}>Upload files</Btn>
                            )}
                        />
                    )}
                >
                    {firstLoad ? (
                        <LoadingState label="Loading files…" />
                    ) : error && !hasAny ? (
                        <ErrorState message={error} onRetry={reload} />
                    ) : !hasAny ? (
                        <Panel className="fl-drop" style={dragging ? { borderColor: 'var(--accent)', background: 'var(--gl-accent-soft)' } : undefined}>
                            <EmptyState
                                icon={uploading ? Loader2 : FolderOpen}
                                title={uploading ? `Uploading ${uploading} file${uploading > 1 ? 's' : ''}…` : 'No files yet'}
                                text="Keep specs, designs and recordings in one place so everyone works from the same copy. Drop files here or pick them from your device — up to 50 MB each."
                                action={!uploading && <Btn variant="primary" icon={Upload} onClick={pickFiles}>Upload your first file</Btn>}
                            />
                        </Panel>
                    ) : (
                        <>
                            <Toolbar>
                                <SearchBox value={search} onChange={setSearch} placeholder="Find a file" label="Find a file" />
                                {allTags.length > 0 && (
                                    <FilterTabs value={tagFilter} onChange={setTagFilter} label="Tag" options={[
                                        { value: '', label: 'All', count: files.length },
                                        ...allTags.map((t) => ({ value: t, label: `#${t}` })),
                                    ]} />
                                )}
                                <span className="cd-toolbar-spacer" />
                                <div className="gl-tabs" role="tablist" aria-label="Layout">
                                    <button type="button" role="tab" className="gl-tab" aria-selected={view === 'grid'} aria-label="Grid" title="Grid" onClick={() => setView('grid')}><LayoutGrid size={14} /></button>
                                    <button type="button" role="tab" className="gl-tab" aria-selected={view === 'list'} aria-label="List" title="List" onClick={() => setView('list')}><List size={14} /></button>
                                </div>
                            </Toolbar>

                            <button type="button" className="fl-strip" data-dragging={dragging ? 'true' : undefined} onClick={pickFiles} disabled={uploading > 0}>
                                {uploading
                                    ? <><Loader2 size={14} className="cd-spin" /><span>Uploading {uploading} file{uploading > 1 ? 's' : ''}…</span></>
                                    : <><Upload size={14} style={{ flexShrink: 0 }} /><span>{dragging ? 'Drop to upload' : <>Drop files anywhere here, or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>browse</span> — up to 50 MB each</>}</span></>}
                            </button>

                            {filtered.length === 0 ? (
                                <Panel><EmptyState title="No files match" text="Try a different name or tag." /></Panel>
                            ) : view === 'grid' ? (
                                <Grid min={170}>
                                    {filtered.map((file) => <FileCard key={file._id} file={file} onOpen={handleFileClick} onDelete={setConfirmDelete} />)}
                                </Grid>
                            ) : (
                                <Panel flush>
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                        {filtered.map((file, i) => (
                                            <FileRow key={file._id} file={file} first={i === 0} active={selectedFile?._id === file._id} onOpen={handleFileClick} onDelete={setConfirmDelete} />
                                        ))}
                                    </ul>
                                </Panel>
                            )}
                        </>
                    )}
                </DashPage>
            </div>

            {selectedFile && (
                <FilePreviewPanel
                    file={selectedFile}
                    workspaceId={workspaceId}
                    api={filesApi}
                    allTags={allTags}
                    source={SOURCE}
                    onClose={closePreview}
                    onDelete={() => setConfirmDelete(selectedFile)}
                    onFileChange={handleFileChange}
                />
            )}

            <Confirm
                open={Boolean(confirmDelete)}
                title={`Delete “${confirmDelete?.name}”?`}
                confirmLabel="Delete file"
                tone="danger"
                busy={deleting}
                onConfirm={handleDelete}
                onClose={() => setConfirmDelete(null)}
            >
                The file, its versions and comments are removed for everyone in the workspace. This can’t be undone.
            </Confirm>
            <Dialog
                open={Boolean(pendingUploads)}
                title={pendingUploads?.length > 1 ? `Upload ${pendingUploads.length} files` : 'Upload a file'}
                lead="Tags help people find files later. You can change them any time."
                onClose={() => setPendingUploads(null)}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setPendingUploads(null)}>Cancel</Btn>
                        <Btn variant="primary" icon={Upload} onClick={confirmUpload} data-autofocus="true">Upload</Btn>
                    </>
                )}
            >
                <ul className="fl-upload-list">
                    {(pendingUploads || []).slice(0, 6).map((f, i) => (
                        <li key={`${f.name}-${i}`}><span className="fl-name">{f.name}</span><span className="fl-meta" style={{ marginTop: 0 }}>{formatSize(f.size)}</span></li>
                    ))}
                    {pendingUploads?.length > 6 && <li className="fl-meta">and {pendingUploads.length - 6} more</li>}
                </ul>
                <Field label="Tags (optional)">
                    <FileTagsInput value={uploadTags} onChange={setUploadTags} suggestions={allTags} label="Tags for the upload" placeholder="Add a tag and press Enter" />
                </Field>
            </Dialog>
            <style>{FILES_CSS + FILE_TAGS_CSS}</style>
        </div>
    );
};

const FILES_CSS = `
.fl-wrap { display: flex; height: 100%; min-height: 0; background: var(--bg-base); position: relative; }
.fl-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.fl-name { display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-meta { display: block; margin-top: 3px; font-size: 11.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-drop { border-style: dashed; transition: border-color 150ms ease, background 150ms ease; }
.fl-strip { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px 16px; font: inherit; font-size: 12.5px; color: var(--text-secondary); background: transparent; border: 1px dashed var(--border-default); border-radius: var(--gl-radius); cursor: pointer; transition: border-color 150ms ease, background 150ms ease, color 150ms ease; }
.fl-strip:hover:not(:disabled), .fl-strip[data-dragging='true'] { border-color: var(--gl-accent-line); background: var(--gl-accent-soft); color: var(--text-primary); }
.fl-strip:disabled { cursor: progress; }
.fl-card { position: relative; padding: 0; display: flex; flex-direction: column; overflow: hidden; }
.fl-card-main { display: flex; flex-direction: column; width: 100%; padding: 0; background: none; border: 0; text-align: left; cursor: pointer; color: inherit; font: inherit; }
.fl-thumb { height: 110px; display: flex; align-items: center; justify-content: center; background: var(--bg-hover); border-bottom: 1px solid var(--border-subtle); overflow: hidden; }
.fl-thumb img { width: 100%; height: 100%; object-fit: cover; }
.fl-card-text { display: block; padding: 10px 12px 12px; min-width: 0; }
.fl-card-actions { position: absolute; top: 6px; right: 6px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--gl-radius); }
.fl-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.fl-row { display: flex; align-items: center; gap: 8px; padding: 2px 12px 2px 4px; }
.fl-row:hover, .fl-row[data-active='true'] { background: var(--bg-hover); }
.fl-row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: none; border: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; }
@media (hover: hover) and (pointer: fine) {
  .fl-actions { opacity: 0; transition: opacity 150ms ease; }
  .fl-row:hover .fl-actions, .fl-row:focus-within .fl-actions, .fl-card:hover .fl-actions, .fl-card:focus-within .fl-actions { opacity: 1; }
}
.fl-preview { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; min-height: 0; background: var(--bg-surface); border-left: 1px solid var(--border-subtle); }
.fl-preview-head { height: 52px; flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 0 10px 0 14px; border-bottom: 1px solid var(--border-subtle); min-width: 0; }
.fl-preview-tabs { padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); }
.fl-preview-tabs .gl-tabs { display: flex; }
.fl-preview-tabs .gl-tab { flex: 1; justify-content: center; }
.fl-preview-body { flex: 1; min-height: 0; overflow-y: auto; }
.fl-media { background: var(--bg-hover); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); overflow: hidden; }
.fl-media img, .fl-media video { display: block; width: 100%; max-height: 300px; object-fit: contain; }
.fl-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 0; background: var(--border-subtle); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); overflow: hidden; }
.fl-facts > div { padding: 10px 12px; background: var(--bg-surface); min-width: 0; }
.fl-facts dt { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
.fl-facts dd { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-compose { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border-subtle); }
.fl-avatar { width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--accent); background: var(--gl-accent-soft); border: 1px solid var(--gl-accent-line); border-radius: var(--gl-radius); }
.fl-upload-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.fl-upload-list li { display: flex; align-items: center; gap: 8px; justify-content: space-between; min-width: 0; }
.fl-version { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border-default); border-radius: var(--gl-radius); }
.fl-version[data-current='true'] { border-color: var(--gl-accent-line); background: var(--gl-accent-soft); }
.fl-vnum { width: 34px; height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); background: var(--bg-hover); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); }
.fl-version[data-current='true'] .fl-vnum { color: var(--accent); border-color: var(--gl-accent-line); }
@media (max-width: 1180px) {
  .fl-preview { position: absolute; inset: 0; width: auto; z-index: 30; border-left: 0; }
}
`;

export default FileLibrary;
