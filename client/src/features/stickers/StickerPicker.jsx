import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X, Loader2, BookmarkPlus } from 'lucide-react';
import { fromGiphy, groupByPack, removeSticker, searchGiphy, useStickers } from './stickerStore';
import { useMediaUrl } from '../../utils/mediaUrl';
import { useToast } from '../../contexts/ToastContext';
import StickerMakerDialog from './StickerMakerDialog';

const TILE = 68;

function LibraryTile({ sticker, onPick, onRemove, busy }) {
    const { url, refresh, attempt } = useMediaUrl(sticker.attachment);
    return (
        <div className="sticker-tile" style={{ position: 'relative', width: TILE, height: TILE }}>
            <button type="button" onClick={() => onPick(sticker)} disabled={busy} title="Send sticker" aria-label={`Send sticker ${sticker.name || ''}`}
                style={{ width: '100%', height: '100%', padding: 4, border: 'none', borderRadius: 'var(--r-sm)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                {url
                    ? <img src={url} alt="" loading="lazy" draggable={false} onError={() => attempt < 1 && refresh()} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    : <span className="skeleton" style={{ width: '80%', height: '80%', borderRadius: 'var(--r-sm)', background: 'var(--bg-hover)' }} />}
            </button>
            <button type="button" className="sticker-tile-remove" aria-label="Remove from my stickers" title="Remove from my stickers"
                onClick={(e) => { e.stopPropagation(); onRemove(sticker); }}
                style={{ position: 'absolute', top: 0, right: 0, width: 18, height: 18, padding: 0, borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={10} />
            </button>
        </div>
    );
}

function MyStickers({ onSend, onCreate }) {
    const { status, stickers, error } = useStickers();
    const { showToast } = useToast();
    const packs = useMemo(() => groupByPack(stickers), [stickers]);

    const remove = async (s) => {
        try { await removeSticker(s.id); } catch (err) { showToast(err.message, 'error'); }
    };

    if (status === 'loading' || status === 'idle') {
        return <div style={{ padding: 24, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Loader2 size={16} className="animate-spin" /></div>;
    }
    if (status === 'error') return <p style={{ padding: 16, fontSize: 12, color: 'var(--state-danger)' }}>{error}</p>;
    if (!stickers.length) {
        return (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No stickers yet</p>
                <p style={{ margin: '6px 0 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Make one from a photo, add a GIF, or save one someone sent you (message menu → Save as sticker).
                </p>
                <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={onCreate}><Plus size={13} /> Create sticker</button>
            </div>
        );
    }
    return (
        <div>
            {packs.map((p) => (
                <section key={p.name} aria-label={p.name} style={{ padding: '4px 8px 8px' }}>
                    <h4 style={{ margin: '4px 4px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{p.name}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TILE}px)`, gap: 4 }}>
                        {p.items.map((s) => <LibraryTile key={s.id} sticker={s} onPick={() => onSend(s.attachment)} onRemove={remove} />)}
                    </div>
                </section>
            ))}
        </div>
    );
}

function GiphyTab({ kind, onSend }) {
    const { showToast } = useToast();
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [next, setNext] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setQuery(q.trim()), 350);
        return () => clearTimeout(t);
    }, [q]);

    const load = (offset, ctrl) => {
        setLoading(true);
        setError(null);
        return searchGiphy(query, kind, offset, ctrl?.signal)
            .then((data) => {
                setResults((prev) => (offset ? [...prev, ...data.results] : data.results));
                setNext(data.next);
            })
            .catch((err) => { if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') setError(err.message); })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const ctrl = new AbortController();
        setResults([]);
        load(0, ctrl);
        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, kind]);

    const pick = async (r, save) => {
        setBusyId(r.id);
        try {
            const data = await fromGiphy(r.id, kind, { save });
            if (save) showToast('Added to your stickers', 'success');
            else onSend(data.attachment);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const isStickers = kind === 'stickers';
    return (
        <div>
            <div style={{ position: 'sticky', top: 0, padding: 8, background: 'var(--bg-surface)', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--r-sm)', background: 'var(--bg-active)' }}>
                    <Search size={13} style={{ color: 'var(--text-muted)' }} />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={isStickers ? 'Search GIPHY stickers' : 'Search GIFs'}
                        aria-label={isStickers ? 'Search GIPHY stickers' : 'Search GIFs'}
                        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font)' }} />
                </div>
            </div>
            {error && <p role="alert" style={{ padding: '0 12px', fontSize: 12, color: 'var(--state-danger)' }}>{error}</p>}
            {!loading && !error && results.length === 0 && (
                <p style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Nothing found</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isStickers ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 4, padding: '0 8px 8px' }}>
                {results.map((r) => (
                    <div key={r.id} className="sticker-tile" style={{ position: 'relative', height: isStickers ? TILE : 96 }}>
                        <button type="button" onClick={() => pick(r, false)} disabled={!!busyId} title={r.title || 'Send'} aria-label={`Send ${r.title || (isStickers ? 'sticker' : 'GIF')}`}
                            style={{ width: '100%', height: '100%', padding: 0, border: 'none', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: isStickers ? 'transparent' : 'var(--bg-active)', cursor: 'pointer', opacity: busyId && busyId !== r.id ? 0.5 : 1 }}>
                            <img src={r.preview.url} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer"
                                style={{ width: '100%', height: '100%', objectFit: isStickers ? 'contain' : 'cover', display: 'block' }} />
                            {busyId === r.id && (
                                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--o-shade, 0,0,0), 0.25)' }}>
                                    <Loader2 size={16} className="animate-spin" />
                                </span>
                            )}
                        </button>
                        <button type="button" className="sticker-tile-remove" aria-label="Save to my stickers" title="Save to my stickers"
                            onClick={(e) => { e.stopPropagation(); pick(r, true); }} disabled={!!busyId}
                            style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, padding: 0, borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BookmarkPlus size={11} />
                        </button>
                    </div>
                ))}
            </div>
            {loading && <div style={{ padding: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Loader2 size={16} className="animate-spin" /></div>}
            {!loading && next != null && (
                <div style={{ padding: '0 8px 8px' }}>
                    <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" style={{ width: '100%' }} onClick={() => load(next)}>Load more</button>
                </div>
            )}
        </div>
    );
}

/**
 * The composer's sticker panel: the person's own stickers (by pack), GIPHY GIFs and GIPHY
 * stickers. onSend(attachment) sends one as a message right away.
 */
export default function StickerPicker({ onSend, onClose }) {
    const { giphy } = useStickers();
    const [tab, setTab] = useState('mine');
    const [makerFile, setMakerFile] = useState(null);
    const fileRef = useRef(null);

    const tabs = [
        { id: 'mine', label: 'My stickers' },
        giphy && { id: 'gifs', label: 'GIFs' },
        giphy && { id: 'stickers', label: 'GIPHY' },
    ].filter(Boolean);

    const send = (attachment) => { onSend?.(attachment); onClose?.(); };

    return (
        <div onClick={(e) => e.stopPropagation()} className="gl-liquid gl-liquid--strong" data-testid="sticker-picker"
            style={{ borderRadius: 'var(--gl-radius-md)', width: 340, maxWidth: 'calc(100vw - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font)', zIndex: 50 }}>
            <style>{'.sticker-tile .sticker-tile-remove{opacity:0;transition:opacity 120ms ease}.sticker-tile:hover .sticker-tile-remove,.sticker-tile .sticker-tile-remove:focus-visible{opacity:1}@media (hover:none){.sticker-tile .sticker-tile-remove{opacity:1}}'}</style>
            <div role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-active)' }}>
                {tabs.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                        style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'var(--font)', background: tab === t.id ? 'var(--accent-subtle, var(--bg-hover))' : 'transparent', color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {t.label}
                    </button>
                ))}
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => fileRef.current?.click()} title="Make a sticker from a photo or add a GIF" aria-label="Create sticker"
                    className="gl-btn gl-btn--ghost gl-btn--sm" style={{ padding: '3px 8px', fontSize: 11 }}>
                    <Plus size={12} /> Create
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-testid="sticker-file"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setMakerFile(f); }} />
            </div>
            <div className="custom-scrollbar" style={{ height: 300, overflowY: 'auto' }}>
                {tab === 'mine' && <MyStickers onSend={send} onCreate={() => fileRef.current?.click()} />}
                {tab !== 'mine' && <GiphyTab key={tab} kind={tab} onSend={send} />}
            </div>
            {tab !== 'mine' && (
                <div style={{ padding: '4px 10px', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                    Powered by GIPHY
                </div>
            )}
            {makerFile && createPortal(
                <StickerMakerDialog
                    file={makerFile}
                    canSend={!!onSend}
                    onCancel={() => setMakerFile(null)}
                    onDone={(sticker, { send: andSend }) => {
                        setMakerFile(null);
                        setTab('mine');
                        if (andSend) send(sticker.attachment);
                    }}
                />,
                document.body,
            )}
        </div>
    );
}
