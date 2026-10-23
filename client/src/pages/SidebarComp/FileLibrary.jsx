import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Upload, LayoutGrid, List, Download, Trash2, FolderOpen, Loader2, MessageSquareText, Hash, MessagesSquare, Paperclip,
} from 'lucide-react';
import { useFiles, mergeFile, downloadLibraryFile } from '../../hooks/useFiles';
import { useSharedFiles, KIND_OPTIONS, SORT_OPTIONS, whereLabel, messageLink, toAttachment } from '../../hooks/useSharedFiles';
import { useToast } from '../../contexts/ToastContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import {
    DashPage, PageHead, Panel, Toolbar, SearchBox, FilterTabs, SelectBox, Btn, IconBtn, Grid,
    LoadingState, ErrorState, EmptyState, Confirm, Dialog, Field, timeAgo, errorMessage,
} from '../../components/ui/page';
import { useMediaUrl } from '../../utils/mediaUrl';
import { downloadAttachment } from '../../utils/uploadFile';
import { fileKind, formatSize, FILES_CHANGED, announceFilesChanged } from './fileKinds';
import FilePreviewPanel from './FilePreviewPanel';
import SharedFilePreview, { WhereIcon } from './SharedFilePreview';
import FileTagsInput, { FILE_TAGS_CSS } from './FileTagsInput';

const SOURCE = 'library';

/** "PDF · 2.0 KB · Ben · #general · 2h ago" */
function metaLine(item) {
    const { label } = fileKind(item.mimeType);
    return [label, formatSize(item.size), item.sharedBy?.username, whereLabel(item), timeAgo(item.sharedAt)].filter(Boolean).join(' · ');
}

function KindMark({ item, size = 16 }) {
    const { Icon } = fileKind(item.mimeType);
    return <span className="gl-empty-mark" style={{ margin: 0, flexShrink: 0 }}><Icon size={size} /></span>;
}

function ItemActions({ item, onDownload, onGoTo, onDelete }) {
    return (
        <span className="fl-actions">
            <IconBtn label={`Download ${item.name}`} onClick={() => onDownload(item)}><Download size={14} /></IconBtn>
            {item.messageId && <IconBtn label={`Go to the message with ${item.name}`} onClick={() => onGoTo(item)}><MessageSquareText size={14} /></IconBtn>}
            {item.source === 'library' && <IconBtn label={`Delete ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={14} /></IconBtn>}
        </span>
    );
}

function Thumb({ item }) {
    const isImage = item.kind === 'image' || item.mimeType?.startsWith('image/');
    const attachment = useMemo(() => (isImage ? toAttachment(item) : null), [isImage, item]);
    const { url, refresh, attempt } = useMediaUrl(attachment);
    const [broken, setBroken] = useState(false);
    const { Icon } = fileKind(item.mimeType);
    if (isImage && url && !broken) {
        return <img src={url} alt="" loading="lazy" onError={() => (attempt < 1 ? refresh() : setBroken(true))} />;
    }
    return <Icon size={28} style={{ color: 'var(--accent)' }} />;
}

function ItemCard({ item, onOpen, ...actions }) {
    return (
        <div className="gl-card gl-card--interactive fl-card">
            <button type="button" className="fl-card-main" onClick={() => onOpen(item)} aria-label={`Open ${item.name}`}>
                <span className="fl-thumb"><Thumb item={item} /></span>
                <span className="fl-card-text">
                    <strong className="fl-name">{item.name}</strong>
                    <span className="fl-meta">{formatSize(item.size)} · {timeAgo(item.sharedAt)}</span>
                    <span className="fl-meta fl-meta--where"><WhereIcon item={item} size={11} />{item.sharedBy?.username ? `${item.sharedBy.username} · ` : ''}{whereLabel(item)}</span>
                </span>
            </button>
            <span className="fl-card-actions"><ItemActions item={item} {...actions} /></span>
        </div>
    );
}

function ItemRow({ item, first, active, onOpen, ...actions }) {
    return (
        <li className="fl-row" data-active={active ? 'true' : undefined} style={{ borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
            <button type="button" className="fl-row-main" onClick={() => onOpen(item)}>
                <KindMark item={item} />
                <span style={{ flex: 1, minWidth: 0 }}>
                    <strong className="fl-name" style={{ fontSize: 14 }}>{item.name}</strong>
                    <span className="fl-meta">
                        {metaLine(item)}
                        {item.tags?.length > 0 && ` · ${item.tags.map((t) => `#${t}`).join(' ')}`}
                    </span>
                </span>
            </button>
            <ItemActions item={item} {...actions} />
        </li>
    );
}

/** Source picker value: 'all' | 'library' | 'channels' | 'dms' | 'conv:<id>'. */
function SourceSelect({ value, onChange, conversations }) {
    const channels = conversations.filter((c) => c.type === 'channel');
    const dms = conversations.filter((c) => c.type !== 'channel');
    return (
        <SelectBox value={value} onChange={onChange} label="Shared in" style={{ maxWidth: 220 }}>
            <option value="all">Everywhere</option>
            <option value="library">Uploaded to Files</option>
            <option value="channels">All channels</option>
            <option value="dms">All direct messages</option>
            {channels.length > 0 && (
                <optgroup label="Channels">
                    {channels.map((c) => <option key={c.id} value={`conv:${c.id}`}>#{c.name}</option>)}
                </optgroup>
            )}
            {dms.length > 0 && (
                <optgroup label="Direct messages">
                    {dms.map((c) => <option key={c.id} value={`conv:${c.id}`}>{c.name}</option>)}
                </optgroup>
            )}
        </SelectBox>
    );
}

const FileLibrary = () => {
    const { workspaceId, id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review');
    const itemParam = searchParams.get('item');
    // Design review notifications link here with ?review=: open the review page.
    useEffect(() => {
        if (reviewParam && workspaceId) navigate(`/workspace/${workspaceId}/reviews/${reviewParam}`, { replace: true });
    }, [reviewParam, workspaceId, navigate]);
    const { activeWorkspace } = useWorkspace();
    const filesApi = useFiles();
    const { files, listFiles, uploadFile, deleteFile, patchFile, getFile } = filesApi;

    const [kind, setKind] = useState('all');
    const [source, setSource] = useState('all');
    const [sort, setSort] = useState('newest');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const shared = useSharedFiles(workspaceId, { kind, source, q, sort });
    const { items, total, hasMore, conversations, loading, loadingMore, error, loaded, reload, loadMore, removeItem } = shared;

    const [pendingUploads, setPendingUploads] = useState(null);
    const [uploadTags, setUploadTags] = useState([]);
    const [view, setView] = useState('list');
    const [uploading, setUploading] = useState(0);
    const [selected, setSelected] = useState(null); // { type: 'library', file } | { type: 'chat', item }
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [dragging, setDragging] = useState(false);
    const dragDepth = useRef(0);
    const inputRef = useRef(null);

    // Search the server by name, a moment after typing stops.
    useEffect(() => {
        const t = setTimeout(() => setQ(search.trim()), 250);
        return () => clearTimeout(t);
    }, [search]);

    const reloadLibrary = useCallback(() => {
        if (workspaceId) listFiles(workspaceId, { folderId: 'root' });
    }, [workspaceId, listFiles]);

    useEffect(() => { reloadLibrary(); }, [reloadLibrary]);

    // The side panel uploads too: reload when it changes the list.
    useEffect(() => {
        const onChange = (e) => { if (e.detail?.source !== SOURCE) { reloadLibrary(); reload(); } };
        window.addEventListener(FILES_CHANGED, onChange);
        return () => window.removeEventListener(FILES_CHANGED, onChange);
    }, [reloadLibrary, reload]);

    // /files/:id opens a library file; ?item= (from the side panel) opens a chat attachment.
    useEffect(() => {
        if (!id) { setSelected((s) => (s?.type === 'library' ? null : s)); return; }
        const f = files.find((x) => x._id === id);
        if (f) setSelected({ type: 'library', file: f });
    }, [id, files]);
    useEffect(() => {
        if (!itemParam) return;
        const it = items.find((x) => x.id === itemParam);
        if (it && it.source !== 'library') setSelected({ type: 'chat', item: it });
    }, [itemParam, items]);

    const allTags = useMemo(() => [...new Set(files.flatMap((f) => f.tags || []))], [files]);

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
        setSelected((prev) => (prev?.type === 'library' && prev.file._id === next._id ? { type: 'library', file: mergeFile(prev.file, next) } : prev));
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
            } catch (err) {
                showToast(errorMessage(err, `Couldn’t upload ${file.name}`), 'error');
            }
        }
        setUploading(0);
        if (successCount > 0) {
            showToast(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`, 'success');
            announceFilesChanged(SOURCE);
            reload();
        }
    };

    const pickFiles = () => inputRef.current?.click();

    function closePreview() {
        setSelected(null);
        navigate(`/workspace/${workspaceId}/files`, { replace: true });
    }

    const handleDelete = async () => {
        const target = confirmDelete;
        if (!target) return;
        setDeleting(true);
        try {
            await deleteFile(target.fileId);
            removeItem(target.id);
            showToast(`Deleted “${target.name}”`, 'success');
            announceFilesChanged(SOURCE);
            if (selected?.type === 'library' && selected.file._id === target.fileId) closePreview();
            setConfirmDelete(null);
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t delete the file'), 'error');
        } finally {
            setDeleting(false);
        }
    };

    const openItem = async (item) => {
        if (item.source === 'library') {
            let file = files.find((f) => f._id === item.fileId);
            if (!file) {
                try { file = await getFile(item.fileId); } catch (err) { showToast(errorMessage(err, 'Couldn’t open the file'), 'error'); return; }
            }
            setSelected({ type: 'library', file });
            navigate(`/workspace/${workspaceId}/files/${item.fileId}`, { replace: true });
            return;
        }
        setSelected({ type: 'chat', item });
        if (id) navigate(`/workspace/${workspaceId}/files`, { replace: true });
    };

    const downloadItem = async (item) => {
        try {
            if (item.source === 'library') await downloadLibraryFile(item.fileId, { name: item.name });
            else await downloadAttachment(toAttachment(item));
        } catch (err) {
            showToast(errorMessage(err, 'Couldn’t download the file'), 'error');
        }
    };

    const goToMessage = (item) => {
        const link = messageLink(item, workspaceId);
        if (link) navigate(link);
    };

    const deleteItem = (item) => setConfirmDelete(item);
    const libraryFileAsItem = (file) => ({ id: `lib:${file._id}`, fileId: file._id, name: file.name, source: 'library' });

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

    const filtering = kind !== 'all' || source !== 'all' || Boolean(q);
    const visible = useMemo(
        () => (tagFilter ? items.filter((i) => (i.tags || []).includes(tagFilter)) : items),
        [items, tagFilter],
    );
    const nothingAtAll = loaded && !loading && !error && total === 0 && !filtering;
    const firstLoad = !loaded;
    const clearFilters = () => { setKind('all'); setSource('all'); setSearch(''); setQ(''); setTagFilter(''); };
    const actions = { onOpen: openItem, onDownload: downloadItem, onGoTo: goToMessage, onDelete: deleteItem };

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
                            lead="Every file shared with you here — in your channels, direct messages and group chats — plus files uploaded straight to the workspace."
                            actions={!nothingAtAll && (
                                <Btn variant="primary" icon={Upload} loading={uploading > 0} onClick={pickFiles}>Upload files</Btn>
                            )}
                        />
                    )}
                >
                    {firstLoad ? (
                        <LoadingState label="Loading files…" />
                    ) : error && items.length === 0 ? (
                        <ErrorState message={error} onRetry={reload} />
                    ) : nothingAtAll ? (
                        <Panel className="fl-drop" style={dragging ? { borderColor: 'var(--accent)', background: 'var(--gl-accent-soft)' } : undefined}>
                            <EmptyState
                                icon={uploading ? Loader2 : FolderOpen}
                                title={uploading ? `Uploading ${uploading} file${uploading > 1 ? 's' : ''}…` : 'Nothing shared yet'}
                                text="Files sent in your channels and direct messages appear here automatically, with who shared them and where. You can also upload specs, designs and recordings for the whole workspace — up to 100 MB each."
                                action={!uploading && <Btn variant="primary" icon={Upload} onClick={pickFiles}>Upload a file</Btn>}
                            />
                            <ul className="fl-howto" aria-label="How files get here">
                                <li><Hash size={14} /> <span><strong>Channels</strong> — attachments from channels you’re in</span></li>
                                <li><MessagesSquare size={14} /> <span><strong>Direct messages</strong> — files from your DMs and group chats</span></li>
                                <li><Paperclip size={14} /> <span><strong>Uploads</strong> — files added here, with tags, versions and comments</span></li>
                            </ul>
                        </Panel>
                    ) : (
                        <>
                            <Toolbar>
                                <SearchBox value={search} onChange={setSearch} placeholder="Find a file by name" label="Find a file" />
                                <SourceSelect value={source} onChange={(v) => { setSource(v); setTagFilter(''); }} conversations={conversations} />
                                <SelectBox value={sort} onChange={setSort} label="Sort files">
                                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </SelectBox>
                                <span className="cd-toolbar-spacer" />
                                <div className="gl-tabs" role="tablist" aria-label="Layout">
                                    <button type="button" role="tab" className="gl-tab" aria-selected={view === 'list'} aria-label="List" title="List" onClick={() => setView('list')}><List size={14} /></button>
                                    <button type="button" role="tab" className="gl-tab" aria-selected={view === 'grid'} aria-label="Grid" title="Grid" onClick={() => setView('grid')}><LayoutGrid size={14} /></button>
                                </div>
                            </Toolbar>
                            <div className="fl-filters">
                                <FilterTabs value={kind} onChange={setKind} label="File type" options={KIND_OPTIONS} />
                                {source === 'library' && allTags.length > 0 && (
                                    <FilterTabs value={tagFilter} onChange={setTagFilter} label="Tag" options={[
                                        { value: '', label: 'Any tag' },
                                        ...allTags.map((t) => ({ value: t, label: `#${t}` })),
                                    ]} />
                                )}
                                <span className="fl-count" aria-live="polite">{loading ? 'Loading…' : `${total} file${total === 1 ? '' : 's'}`}</span>
                            </div>

                            <button type="button" className="fl-strip" data-dragging={dragging ? 'true' : undefined} onClick={pickFiles} disabled={uploading > 0}>
                                {uploading
                                    ? <><Loader2 size={14} className="cd-spin" /><span>Uploading {uploading} file{uploading > 1 ? 's' : ''}…</span></>
                                    : <><Upload size={14} style={{ flexShrink: 0 }} /><span>{dragging ? 'Drop to upload' : <>Drop files anywhere here, or <span style={{ color: 'var(--accent)', fontWeight: 600 }}>browse</span> — up to 100 MB each</>}</span></>}
                            </button>

                            {visible.length === 0 ? (
                                <Panel>
                                    <EmptyState
                                        title={loading ? 'Loading…' : 'No files match'}
                                        text="Try another name, file type or place."
                                        action={!loading && <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn>}
                                    />
                                </Panel>
                            ) : view === 'grid' ? (
                                <Grid min={180}>
                                    {visible.map((item) => <ItemCard key={item.id} item={item} {...actions} />)}
                                </Grid>
                            ) : (
                                <Panel flush>
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Files">
                                        {visible.map((item, i) => (
                                            <ItemRow
                                                key={item.id}
                                                item={item}
                                                first={i === 0}
                                                active={(selected?.type === 'chat' && selected.item.id === item.id) || (selected?.type === 'library' && selected.file._id === item.fileId)}
                                                {...actions}
                                            />
                                        ))}
                                    </ul>
                                </Panel>
                            )}
                            {hasMore && (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <Btn variant="ghost" loading={loadingMore} onClick={loadMore}>Load more</Btn>
                                </div>
                            )}
                        </>
                    )}
                </DashPage>
            </div>

            {selected?.type === 'library' && (
                <FilePreviewPanel
                    file={selected.file}
                    workspaceId={workspaceId}
                    api={filesApi}
                    allTags={allTags}
                    source={SOURCE}
                    onClose={closePreview}
                    onDelete={() => setConfirmDelete(libraryFileAsItem(selected.file))}
                    onFileChange={handleFileChange}
                />
            )}
            {selected?.type === 'chat' && (
                <SharedFilePreview item={selected.item} onClose={closePreview} onGoToMessage={goToMessage} />
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
.fl-meta--where { display: flex; align-items: center; gap: 4px; }
.fl-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.fl-count { margin-left: auto; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.fl-where { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: var(--text-secondary); }
.fl-where strong { color: var(--text-primary); font-weight: 600; }
.fl-media--viewer { padding: 12px; display: flex; justify-content: center; }
.fl-media--viewer [data-testid='file-attachment'] > div:first-child { margin-top: 0; }
.fl-howto { list-style: none; margin: 4px auto 8px; padding: 0; display: grid; gap: 8px; max-width: 460px; }
.fl-howto li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; font-size: 12.5px; color: var(--text-secondary); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--gl-radius); }
.fl-howto li svg { color: var(--accent); flex-shrink: 0; }
.fl-howto strong { color: var(--text-primary); font-weight: 600; }
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
