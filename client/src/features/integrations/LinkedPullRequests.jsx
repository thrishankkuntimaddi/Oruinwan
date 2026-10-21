import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ProviderMark, StateBadge, JiraStatus, PROVIDER_NAME } from './ui';
import { parsePrRef } from './prRefs';
import useCodeReviewOpener from './useCodeReviewOpener';

/**
 * Task detail: pull requests, issues, files and pages linked to the task (task.externalLinks).
 * A PR opens the code-review panel next to the open conversation, or in a
 * drawer on the Tasks page; anything else opens on the provider's site.
 */
export default function LinkedPullRequests({ links = [], workspaceId }) {
    const [open, drawer] = useCodeReviewOpener();
    if (!links.length) return null;
    const sorted = [...links].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return (
        <div className="oi-linked" data-testid="task-linked-prs">
            {sorted.map((l, i) => {
                const isPr = l.provider === 'github' && (l.kind === 'pull_request' || /\/pull\/\d+/.test(l.url || ''));
                const ref = isPr ? (l.repo && l.number ? { repo: l.repo, number: Number(l.number) } : parsePrRef(l.url)) : null;
                const isDoc = l.kind === 'file' || l.kind === 'page';
                const label = isDoc ? (PROVIDER_NAME[l.provider] || l.provider)
                    : ['jira', 'linear'].includes(l.provider) ? (l.key || l.title) : `${l.repo || ''}${l.number ? `#${l.number}` : ''}`;
                const content = (
                    <>
                        <ProviderMark provider={l.provider} size={14} />
                        <span className="oi-linked-title" title={l.title}>{l.title || label}</span>
                        <span className="oi-linked-ref">{label}</span>
                        {isDoc ? null : ['jira', 'linear'].includes(l.provider)
                            ? <JiraStatus status={l.state} />
                            : <StateBadge state={['open', 'closed', 'merged', 'draft'].includes(l.state) ? l.state : 'open'} kind={l.kind === 'issue' ? 'issue' : 'pull_request'} size="sm" />}
                    </>
                );
                return ref ? (
                    <button key={l.url || i} type="button" className="oi-linked-item" onClick={() => open({ ...ref, workspaceId })} aria-label={`View changes: ${l.title || label}`}>
                        {content}
                    </button>
                ) : (
                    <a key={l.url || i} className="oi-linked-item" href={l.url} target="_blank" rel="noopener noreferrer">
                        {content}<ExternalLink size={11} aria-hidden="true" />
                    </a>
                );
            })}
            {drawer}
        </div>
    );
}
