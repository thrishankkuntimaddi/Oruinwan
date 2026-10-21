import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, ExternalLink, FileText, Folder, Link2, Loader2, Paperclip, Search } from 'lucide-react';
import Modal from '../../shared/components/ui/Modal';
import { ProviderMark, PROVIDER_NAME, timeAgo } from './ui';
import { attachToTask, connectedTypes, connectorAction, importToKnowledge } from './integrationsApi';
import './integrations.css';

/**
 * Browse / search a connected file or wiki app (Google Drive, OneDrive,
 * Dropbox, Notion, Confluence) and pick an item:
 *   mode 'message' → resolves with the item; the caller posts its link in the
 *                    (end-to-end encrypted) message. Notion/Confluence pages
 *                    can also be imported into Knowledge from here.
 *   mode 'task'    → attaches the item to `taskId` on the server.
 */

export const FILE_TYPES = ['google_drive', 'onedrive', 'dropbox'];
export const PAGE_TYPES = ['notion', 'confluence'];
export const PICKER_TYPES = [...FILE_TYPES, ...PAGE_TYPES];

const KIND_ICON = { folder: Folder, page: FileText, database: BookOpen };

export function CloudPicker({ type, workspaceId, initialQuery = '', mode = 'message', taskId = null, onDone, onClose }) {
    const [query, setQuery] = useState(initialQuery);
    const [folder, setFolder] = useState(null); // { id, title }
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(null); // item id
    const [notice, setNotice] = useState(null);
    const seq = useRef(0);
    const name = PROVIDER_NAME[type] || type;
    const canBrowse = FILE_TYPES.includes(type);

    const load = useCallback(async (q, f) => {
        const n = ++seq.current;
        setLoading(true); setError(null);
        try {
            const r = await connectorAction(type, 'search', workspaceId, { ...(q ? { q } : {}), ...(f && !q ? { folder: f.id } : {}) });
            if (n === seq.current) setItems(r?.items || []);
        } catch (err) {
            if (n === seq.current) { setItems([]); setError(err.message); }
        } finally {
            if (n === seq.current) setLoading(false);
        }
    }, [type, workspaceId]);

    useEffect(() => {
        const t = setTimeout(() => load(query.trim(), folder), query ? 300 : 0);
        return () => clearTimeout(t);
    }, [query, folder, load]);

    const pick = async (item) => {
        if (item.kind === 'folder' && canBrowse && mode === 'task') { setFolder(item); setQuery(''); return; }
        setBusy(item.id); setError(null);
        try {
            if (mode === 'task') {
                await attachToTask(type, workspaceId, item.id, taskId);
                onDone?.(item);
            } else {
                // Dropbox search results link to the owner's view: fetch a shared link first.
                const full = type === 'dropbox' ? (await connectorAction(type, 'item', workspaceId, { id: item.id }))?.item || item : item;
                onDone?.(full);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(null);
        }
    };

    const importPage = async (item) => {
        setBusy(item.id); setError(null); setNotice(null);
        try {
            const r = await importToKnowledge(type, workspaceId, item.id);
            setNotice({ title: r?.page?.title || item.title, id: r?.page?.id });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(null);
        }
    };

    return (
        <Modal isOpen onClose={onClose} size="md" title={(
            <span className="oi-picker-title"><ProviderMark provider={type} size={18} /> {mode === 'task' ? `Attach from ${name}` : `Share from ${name}`}</span>
        )}>
            <div className="oi-picker" data-testid="cloud-picker">
                <label className="gl-search oi-picker-search">
                    <Search size={14} aria-hidden="true" />
                    <input
                        className="gl-input"
                        type="search"
                        autoFocus
                        value={query}
                        placeholder={`Search ${name}`}
                        aria-label={`Search ${name}`}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </label>
                {folder && !query && (
                    <button type="button" className="oi-link-btn" onClick={() => setFolder(null)}>← Back to all files</button>
                )}
                {notice && (
                    <p className="oi-picker-notice" role="status">
                        “{notice.title}” was imported into Knowledge.{' '}
                        {notice.id && workspaceId && <a href={`/workspace/${workspaceId}/knowledge/${notice.id}`}>Open it</a>}
                    </p>
                )}
                {error && <p className="oi-error" role="alert">{error}</p>}
                {loading ? (
                    <p className="oi-muted oi-picker-state"><Loader2 size={13} className="oi-spin" aria-hidden="true" /> Loading…</p>
                ) : !error && items.length === 0 ? (
                    <p className="oi-muted oi-picker-state">{query ? `Nothing in ${name} matches “${query}”.` : `Nothing to show. ${PAGE_TYPES.includes(type) ? `Share pages with the integration in ${name} first.` : ''}`}</p>
                ) : (
                    <ul className="oi-picker-list">
                        {items.map((it) => {
                            const Icon = KIND_ICON[it.kind] || FileText;
                            return (
                                <li key={it.id} className="oi-picker-item">
                                    <button type="button" className="oi-picker-main" onClick={() => pick(it)} disabled={!!busy} title={mode === 'task' ? 'Attach to the task' : 'Share the link'}>
                                        <Icon size={15} aria-hidden="true" className="oi-muted" />
                                        <span className="oi-picker-name">{it.title || 'Untitled'}</span>
                                        <span className="oi-picker-meta">{[it.path, it.owner, it.modifiedAt && timeAgo(it.modifiedAt)].filter(Boolean).join(' · ')}</span>
                                    </button>
                                    {busy === it.id ? <Loader2 size={14} className="oi-spin" aria-label="Working" /> : (
                                        <span className="oi-picker-actions">
                                            {PAGE_TYPES.includes(type) && mode === 'message' && it.kind === 'page' && (
                                                <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={() => importPage(it)} disabled={!!busy}>
                                                    <BookOpen size={12} aria-hidden="true" /> Import to Knowledge
                                                </button>
                                            )}
                                            <button type="button" className="gl-btn gl-btn--sm" onClick={() => pick(it)} disabled={!!busy}>
                                                {mode === 'task' ? <><Paperclip size={12} aria-hidden="true" /> Attach</> : <><Link2 size={12} aria-hidden="true" /> Share</>}
                                            </button>
                                            {it.url && (
                                                <a className="gl-icon-btn" href={it.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${it.title} in ${name}`}>
                                                    <ExternalLink size={13} />
                                                </a>
                                            )}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Modal>
    );
}

/** Open the picker outside any React tree; resolves with the picked item or null. */
export function openCloudPicker(props) {
    return new Promise((resolve) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        const close = (value) => {
            setTimeout(() => { root.unmount(); host.remove(); }, 0);
            resolve(value);
        };
        root.render(<CloudPicker {...props} onDone={(item) => close(item)} onClose={() => close(null)} />);
    });
}

/** Markdown for a shared link (goes into the encrypted message). */
export function itemMarkdown(type, item) {
    const icon = PAGE_TYPES.includes(type) ? '📄' : item.kind === 'folder' ? '📁' : '📎';
    const title = String(item.title || 'Untitled').replace(/([[\]])/g, '\\$1');
    return `${icon} [${title}](${item.url}) · ${PROVIDER_NAME[type] || type}`;
}

/** Task detail: "Attach from Drive / Notion / …" for the connected apps. */
/** Connected file / wiki apps of a workspace (for "Attach from …"). */
export function usePickerTypes(workspaceId) {
    const [types, setTypes] = useState([]);
    useEffect(() => {
        let alive = true;
        if (!workspaceId) { setTypes([]); return undefined; }
        connectedTypes(workspaceId).then((set) => { if (alive) setTypes(PICKER_TYPES.filter((t) => set.has(t))); });
        return () => { alive = false; };
    }, [workspaceId]);
    return types;
}

export function AttachFromApps({ workspaceId, taskId, onAttached, types: given }) {
    const own = usePickerTypes(given ? null : workspaceId);
    const types = given || own;
    const [open, setOpen] = useState(null);
    if (!types.length || !taskId) return null;
    return (
        <div className="oi-attach-apps" data-testid="attach-from-apps">
            {types.map((t) => (
                <button key={t} type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={() => setOpen(t)}>
                    <ProviderMark provider={t} size={13} /> Attach from {PROVIDER_NAME[t]}
                </button>
            ))}
            {open && (
                <CloudPicker
                    type={open}
                    workspaceId={workspaceId}
                    mode="task"
                    taskId={taskId}
                    onDone={(item) => { setOpen(null); onAttached?.(item); }}
                    onClose={() => setOpen(null)}
                />
            )}
        </div>
    );
}
