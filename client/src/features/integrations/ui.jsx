import React from 'react';
import { GitPullRequest, GitPullRequestDraft, GitMerge, GitPullRequestClosed, CircleDot, CircleCheck, CircleSlash } from 'lucide-react';
import './integrations.css';

/**
 * Small monogram marks for the providers (plain geometric glyphs, not the
 * vendors' artwork). The same shapes live in /public/integrations/*.svg for
 * bot avatars.
 */
export function ProviderMark({ provider, size = 20, title }) {
    const label = title || { github: 'GitHub', gitlab: 'GitLab', jira: 'Jira', zoom: 'Zoom' }[provider] || provider;
    const common = { width: size, height: size, viewBox: '0 0 32 32', role: 'img', 'aria-label': label, className: 'oi-mark', focusable: 'false' };
    if (provider === 'jira') {
        return (
            <svg {...common}>
                <rect width="32" height="32" rx="7" fill="#1868DB" />
                <path d="M19.5 8v11.2a4.7 4.7 0 0 1-9.4 0" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
            </svg>
        );
    }
    if (provider === 'gitlab') {
        return (
            <svg {...common}>
                <rect width="32" height="32" rx="7" fill="#E24329" />
                <path d="M16 24.5 8 13l2.2-6 2.6 6h6.4l2.6-6L24 13z" fill="#fff" />
            </svg>
        );
    }
    if (provider === 'zoom') {
        return (
            <svg {...common}>
                <rect width="32" height="32" rx="7" fill="#2D6CF6" />
                <rect x="6.5" y="11" width="13" height="10" rx="2.5" fill="#fff" />
                <path d="M20.5 14.6 25.5 11.5v9l-5-3.1z" fill="#fff" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <rect width="32" height="32" rx="7" fill="#24292F" />
            <circle cx="11" cy="9.5" r="2.6" fill="none" stroke="#fff" strokeWidth="2.2" />
            <circle cx="11" cy="22.5" r="2.6" fill="none" stroke="#fff" strokeWidth="2.2" />
            <circle cx="21.5" cy="22.5" r="2.6" fill="none" stroke="#fff" strokeWidth="2.2" />
            <path d="M11 12.1v7.8M21.5 19.9v-6.4a3 3 0 0 0-3-3H15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <path d="m16.6 8.4-2.1 2.1 2.1 2.1" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export const PROVIDER_AVATAR = { github: '/integrations/github.svg', gitlab: '/integrations/gitlab.svg', jira: '/integrations/jira.svg', zoom: '/integrations/zoom.svg' };

const STATE_META = {
    open: { label: 'Open', Icon: GitPullRequest },
    draft: { label: 'Draft', Icon: GitPullRequestDraft },
    merged: { label: 'Merged', Icon: GitMerge },
    closed: { label: 'Closed', Icon: GitPullRequestClosed },
};

/** Normalise a PR's state from the various shapes the server can send. */
export function prState(pr) {
    if (!pr) return 'open';
    if (pr.merged || pr.state === 'merged') return 'merged';
    if (pr.state === 'closed') return 'closed';
    if (pr.draft || pr.state === 'draft') return 'draft';
    return 'open';
}

export function StateBadge({ state = 'open', kind = 'pull_request', size = 'md' }) {
    const s = STATE_META[state] ? state : 'open';
    const { label } = STATE_META[s];
    let Icon = STATE_META[s].Icon;
    if (kind === 'issue') Icon = s === 'closed' ? CircleCheck : CircleDot;
    return (
        <span className="oi-state" data-state={s} data-size={size}>
            <Icon size={size === 'sm' ? 11 : 12} aria-hidden="true" />
            {kind === 'issue' && s === 'closed' ? 'Closed' : label}
        </span>
    );
}

/** Jira statuses are free text: colour by status category keywords. */
export function JiraStatus({ status, category }) {
    const t = String(status || 'To do');
    const c = String(category || '').toLowerCase();
    const tone = c === 'done' ? 'merged' : c === 'indeterminate' ? 'open' : c === 'new' ? 'draft'
        : /done|closed|resolved|complete/i.test(t) ? 'merged' : /progress|review|testing|doing/i.test(t) ? 'open' : 'draft';
    return <span className="oi-state" data-state={tone} data-size="sm">{t}</span>;
}

/** Checks: success / failure / pending, as a dot with a label for screen readers. */
export function checksTone(checks) {
    if (!checks) return null;
    const c = String(checks.conclusion || '').toLowerCase();
    const st = String(checks.status || '').toLowerCase();
    if (c === 'success') return 'success';
    if (['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(c)) return 'failure';
    if (c === 'neutral' || c === 'skipped') return 'neutral';
    if (st && st !== 'completed') return 'pending';
    return c ? 'neutral' : 'pending';
}

const CHECK_LABEL = { success: 'Checks passed', failure: 'Checks failed', pending: 'Checks running', neutral: 'Checks finished' };

export function ChecksDot({ checks, showLabel = false }) {
    const tone = checksTone(checks);
    if (!tone) return null;
    let label = CHECK_LABEL[tone];
    if (checks?.total) label += tone === 'failure' && checks.failed ? ` (${checks.failed}/${checks.total} failed)` : ` (${checks.total})`;
    const Icon = tone === 'success' ? CircleCheck : tone === 'failure' ? CircleSlash : CircleDot;
    return (
        <span className="oi-checks" data-tone={tone} title={label}>
            {showLabel ? <Icon size={12} aria-hidden="true" /> : <span className="oi-checks-dot" aria-hidden="true" />}
            {showLabel ? label : <span className="oi-sr">{label}</span>}
        </span>
    );
}

export function DiffCounts({ additions, deletions }) {
    if (!Number.isFinite(additions) && !Number.isFinite(deletions)) return null;
    return (
        <span className="oi-counts" aria-label={`${additions || 0} additions, ${deletions || 0} deletions`}>
            <span className="oi-add">+{additions || 0}</span>
            <span className="oi-del">−{deletions || 0}</span>
        </span>
    );
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function timeAgo(date) {
    const t = new Date(date).getTime();
    if (!Number.isFinite(t)) return '';
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
}
