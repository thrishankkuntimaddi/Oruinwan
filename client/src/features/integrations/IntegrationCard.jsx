import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, FileDiff, GitBranch, GitCommitHorizontal, Loader2, MessageSquare, Sparkles, Ticket, User } from 'lucide-react';
import { ProviderMark, StateBadge, JiraStatus, ChecksDot, DiffCounts, plural, prState } from './ui';
import { prKey } from './prRefs';
import { requestPrReview, reviewStore } from './integrationsApi';
import useCodeReviewOpener from './useCodeReviewOpener';

const KIND_LABEL = {
    pull_request: 'Pull request', pr_review: 'Review', issue: 'Issue', push: 'Push', checks: 'Checks', jira_issue: 'Jira issue',
};

const REVIEW_LABEL = { approved: 'Approved', changes_requested: 'Changes requested', commented: 'Commented', dismissed: 'Dismissed' };

/** Linked tasks, as chips. taskIds and taskKeys line up by index when both exist. */
function TaskChips({ ids = [], keys = [], workspaceId }) {
    const navigate = useNavigate();
    const n = Math.max(ids.length, keys.length);
    if (!n) return null;
    const chips = Array.from({ length: n }, (_, i) => ({ id: ids[i] || null, key: keys[i] || null }));
    return (
        <div className="oi-card-tasks" aria-label="Linked tasks">
            {chips.map((c, i) => (
                <button
                    key={c.id || c.key || i}
                    type="button"
                    className="oi-chip"
                    title={c.key ? `Open task ${c.key}` : 'Open linked task'}
                    disabled={!workspaceId}
                    onClick={() => navigate(c.id ? `/workspace/${workspaceId}/tasks/${c.id}` : `/workspace/${workspaceId}/tasks`)}
                >
                    <Ticket size={11} aria-hidden="true" /> {c.key || `Task ${String(c.id).slice(-5)}`}
                </button>
            ))}
        </div>
    );
}

function useReview(key) {
    return useSyncExternalStore(reviewStore.subscribe, () => reviewStore.get(key), () => null);
}

/** "Reviewing… 12s" */
function Elapsed({ since }) {
    const [, tick] = useState(0);
    useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
    const s = Math.max(0, Math.round((Date.now() - (since || Date.now())) / 1000));
    return <span aria-hidden="true">{s}s</span>;
}

/**
 * A GitHub / Jira event posted in a conversation.
 * props: integration (see server contract), summary (decrypted one-liner),
 *        messageId, channelId, workspaceId, onOpenThread(), compact
 */
export default function IntegrationCard({ integration, summary, messageId, channelId, workspaceId, onOpenThread }) {
    const it = integration || {};
    const provider = it.provider || 'github';
    const kind = it.kind || 'pull_request';
    const isPr = provider === 'github' && (kind === 'pull_request' || kind === 'pr_review' || kind === 'checks') && it.number;
    const compact = kind === 'push' || kind === 'checks';
    const extra = it.extra || {};
    const siteName = { jira: 'Jira', gitlab: 'GitLab' }[provider] || 'GitHub';
    const ref = isPr ? { repo: it.repo, number: Number(it.number) } : null;
    const key = ref ? prKey(ref) : '';
    const review = useReview(key);
    const [reviewError, setReviewError] = useState(null);
    const [openReview, drawer] = useCodeReviewOpener();

    const viewChanges = () => openReview({ ...ref, messageId, channelId, workspaceId, title: it.title });
    const aiReview = async () => {
        setReviewError(null);
        try {
            await reviewStore.run(key, () => requestPrReview(workspaceId, ref.repo, ref.number, messageId));
            // The server posts the review as a thread reply on this card.
            onOpenThread?.();
        } catch (err) {
            setReviewError(err.message);
        }
    };
    const reviewing = review?.status === 'running';

    if (compact) {
        const commits = extra.commitCount ?? it.commits;
        const text = summary || (kind === 'push'
            ? `${extra.forced ? 'Force-pushed' : 'Pushed'} ${commits ? plural(commits, 'commit') : 'changes'} to ${it.branch || 'a branch'}`
            : `Checks ${it.checks?.conclusion || it.checks?.status || 'updated'}${it.checks?.name ? ` · ${it.checks.name}` : it.title ? ` · ${it.title}` : ''}`);
        const headMsg = kind === 'push' && extra.headCommit?.message ? String(extra.headCommit.message).split('\n')[0] : null;
        const link = (kind === 'push' && extra.compareUrl) || (kind === 'checks' && it.checks?.url) || it.url || (it.repo ? `https://${provider === 'gitlab' ? 'gitlab' : 'github'}.com/${it.repo}` : null);
        return (
            <div className="oi-card oi-card--compact" data-provider={provider} data-kind={kind} data-testid="integration-card">
                {kind === 'push' ? <GitCommitHorizontal size={14} className="oi-muted" aria-hidden="true" /> : <ChecksDot checks={it.checks || { status: 'completed', conclusion: it.state }} />}
                <span className="oi-compact-text">{text}{headMsg && <span className="oi-muted"> — “{headMsg}”</span>}</span>
                {it.repo && link && (
                    <a className="oi-compact-repo" href={link} target="_blank" rel="noopener noreferrer">
                        {it.repo}{it.number ? ` #${it.number}` : ''}
                    </a>
                )}
                {isPr && (
                    <button type="button" className="oi-link-btn" onClick={viewChanges}>View changes</button>
                )}
                {drawer}
            </div>
        );
    }

    const state = provider === 'jira' ? null : prState({ state: it.state, merged: it.state === 'merged', draft: it.state === 'draft' });
    const titleId = `oi-card-title-${messageId || key}`;

    return (
        <article className="oi-card" data-provider={provider} data-kind={kind} data-state={state || undefined} aria-labelledby={titleId} data-testid="integration-card">
            <header className="oi-card-head">
                <ProviderMark provider={provider} size={18} />
                <span className="oi-card-ref">
                    {provider === 'jira'
                        ? <span className="oi-mono">{it.key || it.taskKeys?.[0] || it.number || 'Jira'}</span>
                        : <><span className="oi-card-repo">{it.repo}</span>{it.number ? <span className="oi-mono"> #{it.number}</span> : null}</>}
                </span>
                {provider === 'jira'
                    ? <JiraStatus status={it.status || it.state} category={extra.statusCategory} />
                    : <StateBadge state={state} kind={kind === 'issue' ? 'issue' : 'pull_request'} size="sm" />}
                {kind === 'pr_review' && it.reviewState && (
                    <span className="oi-review-state" data-review={it.reviewState}>{REVIEW_LABEL[it.reviewState] || it.reviewState}</span>
                )}
                {it.checks && (it.checks.url
                    ? <a href={it.checks.url} target="_blank" rel="noopener noreferrer" className="oi-checks-link"><ChecksDot checks={it.checks} /></a>
                    : <ChecksDot checks={it.checks} />)}
                <span className="oi-card-kind">{provider === 'jira' && extra.issueType ? extra.issueType : (KIND_LABEL[kind] || '')}</span>
            </header>

            <h4 className="oi-card-title" id={titleId}>
                {it.url
                    ? <a href={it.url} target="_blank" rel="noopener noreferrer">{it.title || summary || 'Untitled'}</a>
                    : (it.title || summary || 'Untitled')}
            </h4>

            <div className="oi-card-meta">
                {it.author && (
                    <span className="oi-meta-item">
                        {it.authorAvatar ? <img src={it.authorAvatar} alt="" className="oi-author-avatar" /> : <User size={11} aria-hidden="true" />}{it.author}
                    </span>
                )}
                {provider === 'jira' && extra.assignee && <span className="oi-meta-item">Assignee: {extra.assignee}</span>}
                {provider === 'jira' && extra.priority && <span className="oi-meta-item">Priority: {extra.priority}</span>}
                {it.branch && (
                    <span className="oi-meta-item oi-branch" title={`${it.branch} → ${it.base || 'base'}`}>
                        <GitBranch size={11} aria-hidden="true" />
                        <code>{it.branch}</code>{it.base && <><ArrowRight size={10} aria-hidden="true" /><code>{it.base}</code></>}
                    </span>
                )}
                {(Number.isFinite(it.additions) || Number.isFinite(it.deletions)) && <DiffCounts additions={it.additions} deletions={it.deletions} />}
                {Number.isFinite(it.changedFiles) && <span className="oi-meta-item"><FileDiff size={11} aria-hidden="true" />{plural(it.changedFiles, 'file')}</span>}
            </div>

            <TaskChips ids={it.taskIds || []} keys={it.taskKeys || []} workspaceId={workspaceId} />

            <div className="oi-card-actions">
                {isPr && (
                    <button type="button" className="gl-btn gl-btn--sm oi-btn-primary" onClick={viewChanges} aria-label={`View changes in ${it.repo} #${it.number}`}>
                        <FileDiff size={13} aria-hidden="true" /> View changes
                    </button>
                )}
                {isPr && (
                    <button type="button" className="gl-btn gl-btn--sm" onClick={aiReview} disabled={reviewing || !workspaceId} aria-busy={reviewing}>
                        {reviewing ? <Loader2 size={13} className="oi-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
                        {reviewing ? <>Reviewing… <Elapsed since={review.startedAt} /></> : review?.status === 'done' ? 'AI review again' : 'AI review'}
                    </button>
                )}
                {review?.status === 'done' && onOpenThread && (
                    <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={onOpenThread}>
                        <MessageSquare size={13} aria-hidden="true" /> See review
                    </button>
                )}
                {it.url && (
                    <a className="gl-btn gl-btn--sm gl-btn--ghost" href={it.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} aria-hidden="true" /> Open on {siteName}
                    </a>
                )}
            </div>
            {reviewError && <p className="oi-error" role="alert">{reviewError}</p>}
            {drawer}
        </article>
    );
}
