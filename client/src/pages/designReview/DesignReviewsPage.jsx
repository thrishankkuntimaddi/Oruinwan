import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PenTool, Plus, MessageSquare, Image as ImageIcon, FileText, Video, RefreshCcw } from 'lucide-react';
import {
    DashPage, PageHead, Panel, Toolbar, FilterTabs, SearchBox, Btn, IconBtn, Chip, EmptyState, LoadingState, ErrorState, useAsync, timeAgo,
} from '../../components/ui/page';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import designReviewService from '../../services/designReviewService';
import StartReviewDialog from './StartReviewDialog';
import { REVIEW_STATUS } from './reviewGeometry';
import './designReview.css';

const KIND_ICON = { image: ImageIcon, pdf: FileText, video: Video };

/** Filter + search for the reviews list (exported for tests). */
export function filterReviews(reviews = [], { status = 'all', query = '' } = {}) {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => (status === 'all' || r.status === status) && (!q || String(r.title || '').toLowerCase().includes(q)));
}

export default function DesignReviewsPage() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace() || {};
    const socket = useOptionalSocket()?.socket;
    const [status, setStatus] = useState('all');
    const [mine, setMine] = useState(false);
    const [query, setQuery] = useState('');
    const [starting, setStarting] = useState(false);

    const { data, loading, error, reload } = useAsync(
        () => designReviewService.list({ workspaceId, ...(mine ? { mine: 'true' } : {}) }),
        [workspaceId, mine],
    );
    const reviews = useMemo(() => data || [], [data]);

    useEffect(() => {
        if (!socket) return undefined;
        socket.on('design-review:created', reload);
        return () => socket.off('design-review:created', reload);
    }, [socket, reload]);

    const counts = useMemo(() => {
        const c = { all: reviews.length, open: 0, changes_requested: 0, approved: 0 };
        reviews.forEach((r) => { if (c[r.status] !== undefined) c[r.status] += 1; });
        return c;
    }, [reviews]);
    const shown = filterReviews(reviews, { status, query });
    const open = (r) => navigate(`/workspace/${workspaceId}/reviews/${r._id}`);

    const head = (
        <PageHead
            eyebrow={activeWorkspace?.name || 'Workspace'}
            title="Design reviews"
            icon={PenTool}
            lead="Feedback pinned to images, PDFs and videos, with approvals from the people you ask."
            actions={(
                <>
                    <IconBtn label="Refresh" onClick={reload} style={{ width: 32, height: 32, border: '1px solid var(--border-default)' }}>
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </IconBtn>
                    <Btn variant="primary" icon={Plus} onClick={() => setStarting(true)}>Start review</Btn>
                </>
            )}
        />
    );

    let body;
    if (loading && !data) body = <LoadingState label="Loading reviews…" />;
    else if (error && !data) body = <ErrorState title="Couldn’t load reviews" message={error} onRetry={reload} />;
    else if (shown.length === 0) {
        body = (
            <Panel>
                <EmptyState
                    icon={PenTool}
                    title={reviews.length === 0 ? (mine ? 'Nothing for you to review' : 'No design reviews yet') : 'No reviews match'}
                    text={reviews.length === 0 ? 'Open an image, PDF or video in Files and choose “Start review”, or start one here.' : 'Try another filter.'}
                    action={reviews.length === 0 ? <Btn variant="primary" icon={Plus} onClick={() => setStarting(true)}>Start review</Btn> : null}
                />
            </Panel>
        );
    } else {
        body = (
            <Panel flush>
                {shown.map((r) => {
                    const st = REVIEW_STATUS[r.status] || REVIEW_STATUS.open;
                    const decided = (r.reviewers || []).filter((x) => x.decision !== 'pending').length;
                    const Icon = KIND_ICON[r.file?.kind] || PenTool;
                    return (
                        <button key={r._id} type="button" className="dr-row" onClick={() => open(r)}>
                            <span className="gl-empty-mark" style={{ margin: 0, width: 30, height: 30, flexShrink: 0 }}><Icon size={15} /></span>
                            <span className="dr-row-main">
                                <strong>{r.title}</strong>
                                <span>v{r.versionNumber} · by {r.createdBy?.username || 'someone'} · {timeAgo(r.updatedAt || r.createdAt)}</span>
                            </span>
                            <span className="dr-row-meta">
                                {r.annotationCounts && <span title="Open comments"><MessageSquare size={12} /> {r.annotationCounts.open}/{r.annotationCounts.total}</span>}
                                <span>{decided}/{(r.reviewers || []).length} decided</span>
                                <Chip tone={st.tone}>{st.label}</Chip>
                            </span>
                        </button>
                    );
                })}
            </Panel>
        );
    }

    return (
        <DashPage head={head}>
            <Toolbar>
                <FilterTabs label="Status" value={status} onChange={setStatus} options={[
                    { value: 'all', label: 'All', count: counts.all },
                    { value: 'open', label: 'In review', count: counts.open },
                    { value: 'changes_requested', label: 'Changes requested', count: counts.changes_requested },
                    { value: 'approved', label: 'Approved', count: counts.approved },
                ]} />
                <FilterTabs label="Whose" value={mine ? 'mine' : 'everyone'} onChange={(v) => setMine(v === 'mine')} options={[
                    { value: 'everyone', label: 'Everyone' }, { value: 'mine', label: 'Mine' },
                ]} />
                <SearchBox value={query} onChange={setQuery} placeholder="Search reviews…" />
            </Toolbar>
            {body}
            <StartReviewDialog
                open={starting}
                workspaceId={workspaceId}
                onClose={() => setStarting(false)}
                onCreated={(r) => { setStarting(false); open(r); }}
            />
        </DashPage>
    );
}
