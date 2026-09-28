import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, GitBranch, GitCommitHorizontal, Loader2,
    RefreshCw, Sparkles, Ticket, X, AlertTriangle, ListTree,
} from 'lucide-react';
import AIMarkdown from '../../../components/ai/AIMarkdown';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPullRequest, getRepoFile, requestPrReview, reviewStore } from '../integrationsApi';
import { prKey, prUrl } from '../prRefs';
import { StateBadge, ChecksDot, DiffCounts, plural, prState, timeAgo } from '../ui';
import { DiffFile, FileStatusIcon, FullFile } from './DiffView';
import { diffStats, groupByDirectory } from './diffParse';
import './codeReview.css';

const WIDTH_KEY = 'oruinwan:code-review-width';
const readWidth = () => { try { const v = Number(localStorage.getItem(WIDTH_KEY)); return v >= 360 ? v : null; } catch { return null; } };
const saveWidth = (v) => { try { localStorage.setItem(WIDTH_KEY, String(Math.round(v))); } catch { /* storage blocked */ } };

const fileAnchor = (i) => `oi-file-${i}`;

function useIsDark() {
    const theme = useTheme?.();
    if (theme?.resolvedTheme) return theme.resolvedTheme === 'dark';
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function useWorkspaceId(explicit) {
    const ws = useWorkspace?.();
    if (explicit) return explicit;
    const fromCtx = ws?.activeWorkspace?.id || ws?.activeWorkspace?._id;
    if (fromCtx) return String(fromCtx);
    const m = typeof window !== 'undefined' && window.location.pathname.match(/\/workspace\/([^/]+)/);
    return m ? m[1] : null;
}

/* ── AI review tab ─────────────────────────────────────────────────────── */

function ElapsedSeconds({ since }) {
    const [, tick] = useState(0);
    useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
    return <>{Math.max(0, Math.round((Date.now() - (since || Date.now())) / 1000))}s</>;
}

const RISK_TONE = { low: 'open', medium: 'draft', high: 'closed' };

function AIReviewTab({ reviewKey, onRun, canPostToThread }) {
    const review = useSyncExternalStore(reviewStore.subscribe, () => reviewStore.get(reviewKey), () => null);
    const running = review?.status === 'running';
    const result = review?.status === 'done' ? review.result : null;
    return (
        <div className="oi-cr-ai">
            {!result && !running && (
                <div className="oi-cr-ai-intro">
                    <Sparkles size={22} className="oi-accent" aria-hidden="true" />
                    <h3>Ask Oruinwan AI to review</h3>
                    <p>
                        Oruinwan AI reads the changed files and points out bugs, risky changes and missing tests.
                        {canPostToThread ? ' The review is also posted in this pull request’s thread so the team sees it.' : ''}
                    </p>
                    <button type="button" className="gl-btn gl-btn--primary" onClick={onRun} data-testid="cr-run-review">
                        <Sparkles size={14} aria-hidden="true" /> Ask Oruinwan AI to review
                    </button>
                    {review?.status === 'error' && <p className="oi-error" role="alert">{review.error?.message || 'The review failed.'}</p>}
                </div>
            )}
            {running && (
                <div className="oi-cr-ai-running" role="status" aria-live="polite">
                    <Loader2 size={18} className="oi-spin" aria-hidden="true" />
                    <div>
                        <strong>Reviewing the changes…</strong>
                        <span className="oi-muted"> <ElapsedSeconds since={review.startedAt} /> — large pull requests can take a minute.</span>
                    </div>
                </div>
            )}
            {result && (
                <div className="oi-cr-ai-result" data-testid="cr-review-result">
                    <div className="oi-cr-ai-meta">
                        {result.risk && <span className="oi-state" data-state={RISK_TONE[String(result.risk).toLowerCase()] || 'draft'} data-size="sm">Risk: {String(result.risk)}</span>}
                        {Number.isFinite(result.filesReviewed) && <span className="oi-muted">{plural(result.filesReviewed, 'file')} reviewed</span>}
                        {canPostToThread && <span className="oi-muted">· Posted to the thread</span>}
                        <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost oi-push-right" onClick={onRun}>
                            <RefreshCw size={12} aria-hidden="true" /> Review again
                        </button>
                    </div>
                    {result.skipped && <p className="oi-cr-note">{typeof result.skipped === 'string' ? result.skipped : 'Oruinwan AI skipped part of this pull request (generated, binary or very large files).'}</p>}
                    {result.summary && <p className="oi-cr-ai-summary">{result.summary}</p>}
                    <div className="oi-cr-md"><AIMarkdown text={result.review || ''} /></div>
                </div>
            )}
        </div>
    );
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

/**
 * Pull request viewer shown next to a conversation (or in a drawer).
 * reviewRef: { repo, number, messageId?, workspaceId?, tab? }
 */
export default function CodeReviewPanel({ reviewRef, onClose, standalone = false }) {
    const { repo, number, messageId } = reviewRef || {};
    const workspaceId = useWorkspaceId(reviewRef?.workspaceId);
    const dark = useIsDark();
    const navigate = useNavigate();
    const key = prKey({ repo, number });

    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(reviewRef?.tab || 'files');
    const [collapsed, setCollapsed] = useState({});
    const [showTree, setShowTree] = useState(true);
    const [fullFile, setFullFile] = useState(null); // { path, ref, text?, error?, loading }
    const [width, setWidth] = useState(readWidth);
    const rootRef = useRef(null);
    const bodyRef = useRef(null);

    const load = useCallback(async () => {
        if (!repo || !number || !workspaceId) { setLoading(false); setError(workspaceId ? 'Missing pull request.' : 'Open a workspace first.'); return; }
        setLoading(true); setError(null);
        try {
            const d = await getPullRequest(workspaceId, repo, number);
            setData(d);
            const files = d?.files || [];
            // Very large PRs start collapsed so the panel opens fast.
            if (files.length > 25) setCollapsed(Object.fromEntries(files.map((f) => [f.filename, true])));
            else setCollapsed(Object.fromEntries(files.filter((f) => (f.changes || 0) > 800).map((f) => [f.filename, true])));
            setShowTree(files.length > 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [repo, number, workspaceId]);

    useEffect(() => { setData(null); setFullFile(null); setTab(reviewRef?.tab || 'files'); load(); }, [load, reviewRef?.tab]);

    // Esc closes (the full-file view first) when focus is in the panel or nowhere in particular.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            const t = e.target;
            const inPanel = rootRef.current?.contains(t);
            const idle = !t || t === document.body || t === document.documentElement;
            if (!inPanel && !idle) return;
            if (fullFile) { setFullFile(null); e.preventDefault(); return; }
            e.preventDefault();
            onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [fullFile, onClose]);

    useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, [repo, number]);

    const pr = data?.pr || null;
    const files = useMemo(() => data?.files || [], [data]);
    const stats = useMemo(() => (pr && Number.isFinite(pr.additions)
        ? { additions: pr.additions, deletions: pr.deletions, files: pr.changedFiles ?? files.length }
        : diffStats(files)), [pr, files]);
    const tree = useMemo(() => groupByDirectory(files), [files]);
    const state = prState(pr);
    const url = pr?.url || prUrl(repo, number);

    const runReview = useCallback(() => {
        setTab('ai');
        reviewStore.run(key, () => requestPrReview(workspaceId, repo, number, messageId)).catch(() => { /* shown in the tab */ });
    }, [key, workspaceId, repo, number, messageId]);

    const jumpTo = (i, filename) => {
        setCollapsed((c) => ({ ...c, [filename]: false }));
        setTab('files');
        requestAnimationFrame(() => document.getElementById(fileAnchor(i))?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    };

    const allCollapsed = files.length > 0 && files.every((f) => collapsed[f.filename]);
    const toggleAll = () => setCollapsed(allCollapsed ? {} : Object.fromEntries(files.map((f) => [f.filename, true])));

    const viewFile = useCallback(async (file) => {
        const ref = file.status === 'removed' ? (pr?.base || 'HEAD') : (pr?.headSha || pr?.branch || 'HEAD');
        setFullFile({ path: file.filename, ref, loading: true });
        try {
            const res = await getRepoFile(workspaceId, repo, ref, file.filename);
            setFullFile({ path: file.filename, ref, text: res.text, language: res.language, truncated: res.truncated });
        } catch (err) {
            setFullFile({ path: file.filename, ref, error: err.message });
        }
    }, [workspaceId, repo, pr]);

    // Drag the left edge to resize (inline panel only).
    const startResize = (e) => {
        if (standalone) return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = rootRef.current?.getBoundingClientRect().width || 600;
        const max = Math.max(420, window.innerWidth * 0.75);
        const onMove = (ev) => setWidth(Math.min(max, Math.max(360, startW + (startX - ev.clientX))));
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.body.style.cursor = '';
            setWidth((w) => { if (w) saveWidth(w); return w; });
        };
        document.body.style.cursor = 'col-resize';
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    };
    const resizeByKey = (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const cur = rootRef.current?.getBoundingClientRect().width || 600;
        const next = Math.min(window.innerWidth * 0.75, Math.max(360, cur + (e.key === 'ArrowLeft' ? 40 : -40)));
        setWidth(next); saveWidth(next);
    };

    const panelStyle = standalone ? undefined : { width: width ? `${width}px` : undefined };

    return (
        <aside
            ref={rootRef}
            tabIndex={-1}
            className="oi-cr"
            data-standalone={standalone ? 'true' : undefined}
            style={panelStyle}
            aria-label={`Code review: ${repo} #${number}`}
            data-testid="code-review-panel"
        >
            {!standalone && (
                <div
                    className="oi-cr-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize code review panel"
                    tabIndex={0}
                    onPointerDown={startResize}
                    onKeyDown={resizeByKey}
                    onDoubleClick={() => { setWidth(null); try { localStorage.removeItem(WIDTH_KEY); } catch { /* ignore */ } }}
                />
            )}

            <header className="oi-cr-head">
                <div className="oi-cr-head-top">
                    <span className="oi-cr-ref"><span className="oi-cr-repo">{repo}</span> <span className="oi-mono">#{number}</span></span>
                    {pr && <StateBadge state={state} size="sm" />}
                    {pr?.checks && <ChecksDot checks={pr.checks} showLabel />}
                    <span className="oi-push-right" />
                    <a className="gl-icon-btn" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub" title="Open on GitHub">
                        <ExternalLink size={14} />
                    </a>
                    <button type="button" className="gl-icon-btn" onClick={load} aria-label="Reload" title="Reload" disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'oi-spin' : undefined} />
                    </button>
                    <button type="button" className="gl-icon-btn" onClick={onClose} aria-label="Close code review (Esc)" title="Close (Esc)" data-testid="code-review-close">
                        <X size={15} />
                    </button>
                </div>
                <h2 className="oi-cr-title">{pr?.title || reviewRef?.title || (loading ? 'Loading pull request…' : `${repo} #${number}`)}</h2>
                {pr && (
                    <div className="oi-cr-meta">
                        {pr.authorAvatar ? <img src={pr.authorAvatar} alt="" className="oi-cr-avatar" /> : null}
                        <span><strong>{pr.author || 'someone'}</strong> wants to merge</span>
                        <span className="oi-branch">
                            <GitBranch size={11} aria-hidden="true" /><code>{pr.branch}</code>
                            <ArrowRight size={10} aria-hidden="true" /><code>{pr.base}</code>
                        </span>
                        <DiffCounts additions={stats.additions} deletions={stats.deletions} />
                        <span className="oi-muted">{plural(stats.files, 'file')}</span>
                        {Number.isFinite(pr.commits) && <span className="oi-muted"><GitCommitHorizontal size={11} aria-hidden="true" /> {plural(pr.commits, 'commit')}</span>}
                        {pr.updatedAt && <span className="oi-muted">updated {timeAgo(pr.updatedAt)}</span>}
                    </div>
                )}
                <div className="gl-tabs oi-cr-tabs" role="tablist" aria-label="Pull request views">
                    {[['files', `Files${files.length ? ` ${files.length}` : ''}`], ['overview', 'Overview'], ['ai', 'AI review']].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            id={`oi-cr-tab-${id}`}
                            aria-controls={`oi-cr-pane-${id}`}
                            aria-selected={tab === id}
                            className="gl-tab"
                            onClick={() => setTab(id)}
                        >
                            {id === 'ai' && <Sparkles size={12} aria-hidden="true" />}{label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="oi-cr-body" ref={bodyRef}>
                {loading && !data ? (
                    <div className="oi-cr-state" role="status"><Loader2 size={16} className="oi-spin" aria-hidden="true" /> Loading the changes…</div>
                ) : error && !data ? (
                    <div className="oi-cr-state oi-cr-state--error" role="alert">
                        <AlertTriangle size={18} aria-hidden="true" />
                        <p>{error}</p>
                        <div className="oi-row">
                            <button type="button" className="gl-btn gl-btn--sm" onClick={load}>Try again</button>
                            <a className="gl-btn gl-btn--sm gl-btn--ghost" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Open on GitHub</a>
                        </div>
                    </div>
                ) : tab === 'files' ? (
                    <div id="oi-cr-pane-files" role="tabpanel" aria-labelledby="oi-cr-tab-files" className="oi-cr-files">
                        <div className="oi-cr-toolbar">
                            <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={() => setShowTree((s) => !s)} aria-expanded={showTree} aria-controls="oi-cr-tree">
                                <ListTree size={13} aria-hidden="true" /> {showTree ? 'Hide files' : 'Show files'}
                            </button>
                            <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={toggleAll} disabled={!files.length}>
                                {allCollapsed ? <ChevronsUpDown size={13} aria-hidden="true" /> : <ChevronsDownUp size={13} aria-hidden="true" />}
                                {allCollapsed ? 'Expand all' : 'Collapse all'}
                            </button>
                        </div>
                        {showTree && files.length > 0 && (
                            <nav id="oi-cr-tree" className="oi-cr-tree" aria-label="Changed files">
                                {tree.map(({ dir, files: list }) => (
                                    <div key={dir || '/'} className="oi-cr-tree-group">
                                        {dir && <div className="oi-cr-tree-dir" title={dir}>{dir}/</div>}
                                        <ul>
                                            {list.map((f) => {
                                                const i = files.indexOf(f);
                                                return (
                                                    <li key={f.filename}>
                                                        <button type="button" className="oi-cr-tree-file" onClick={() => jumpTo(i, f.filename)} title={f.filename}>
                                                            <FileStatusIcon status={f.status} size={12} />
                                                            <span className="oi-cr-tree-name">{f.filename.split('/').pop()}</span>
                                                            <DiffCounts additions={f.additions} deletions={f.deletions} />
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </nav>
                        )}
                        {files.length === 0 ? (
                            <p className="oi-cr-state">No file changes in this pull request.</p>
                        ) : files.map((f, i) => (
                            <DiffFile
                                key={f.filename}
                                id={fileAnchor(i)}
                                file={f}
                                dark={dark}
                                collapsed={!!collapsed[f.filename]}
                                onToggle={() => setCollapsed((c) => ({ ...c, [f.filename]: !c[f.filename] }))}
                                onViewFile={viewFile}
                            />
                        ))}
                    </div>
                ) : tab === 'overview' ? (
                    <div id="oi-cr-pane-overview" role="tabpanel" aria-labelledby="oi-cr-tab-overview" className="oi-cr-overview">
                        {pr?.createdAt && <p className="oi-muted oi-small">Opened {timeAgo(pr.createdAt)} by {pr.author}</p>}
                        <div className="oi-cr-md">
                            {pr?.body ? <AIMarkdown text={pr.body} /> : <p className="oi-muted"><em>No description provided.</em></p>}
                        </div>
                        {data?.linkedTasks?.length > 0 && (
                            <section className="oi-cr-linked">
                                <h3>Linked tasks</h3>
                                <ul>
                                    {data.linkedTasks.map((t) => (
                                        <li key={t.id}>
                                            <button type="button" className="oi-cr-task" onClick={() => workspaceId && navigate(`/workspace/${workspaceId}/tasks/${t.id}`)}>
                                                <Ticket size={12} aria-hidden="true" />
                                                {t.issueKey && <span className="oi-mono">{t.issueKey}</span>}
                                                <span className="oi-cr-task-title">{t.title}</span>
                                                {t.status && <span className="oi-muted oi-small">{String(t.status).replace(/_/g, ' ')}</span>}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {pr?.checks && (
                            <section className="oi-cr-linked">
                                <h3>Checks</h3>
                                <ChecksDot checks={pr.checks} showLabel />
                            </section>
                        )}
                    </div>
                ) : (
                    <div id="oi-cr-pane-ai" role="tabpanel" aria-labelledby="oi-cr-tab-ai">
                        <AIReviewTab reviewKey={key} onRun={runReview} canPostToThread={!!messageId} />
                    </div>
                )}

                {fullFile && (
                    <div className="oi-cr-fullfile" role="dialog" aria-label={`File ${fullFile.path}`}>
                        <div className="oi-cr-fullfile-head">
                            <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={() => setFullFile(null)}>
                                <ArrowLeft size={13} aria-hidden="true" /> Back to changes
                            </button>
                            <span className="oi-diff-name" title={fullFile.path}>{fullFile.path}</span>
                            <span className="oi-muted oi-small oi-mono">@{String(fullFile.ref).slice(0, 12)}</span>
                        </div>
                        {fullFile.loading ? (
                            <div className="oi-cr-state" role="status"><Loader2 size={16} className="oi-spin" aria-hidden="true" /> Loading file…</div>
                        ) : fullFile.error ? (
                            <div className="oi-cr-state oi-cr-state--error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {fullFile.error}</div>
                        ) : (
                            <>
                                {fullFile.truncated && <p className="oi-cr-note">Only the start of this file is shown (it is very large). <a href={`https://github.com/${repo}/blob/${fullFile.ref}/${fullFile.path}`} target="_blank" rel="noopener noreferrer">Open it on GitHub</a>.</p>}
                                <FullFile path={fullFile.path} text={fullFile.text} language={fullFile.language} dark={dark} />
                            </>
                        )}
                    </div>
                )}
            </div>

            {tab !== 'ai' && data && (
                <footer className="oi-cr-foot">
                    <button type="button" className="gl-btn gl-btn--sm gl-btn--primary" onClick={runReview} data-testid="cr-ask-ai">
                        <Sparkles size={13} aria-hidden="true" /> Ask Oruinwan AI to review
                    </button>
                </footer>
            )}
        </aside>
    );
}
