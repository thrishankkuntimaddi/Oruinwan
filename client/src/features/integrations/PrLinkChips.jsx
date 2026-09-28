import React, { useMemo } from 'react';
import { FileDiff } from 'lucide-react';
import { findPrUrls } from './prRefs';
import useCodeReviewOpener from './useCodeReviewOpener';
import './integrations.css';

/**
 * "View changes" buttons under a message that contains GitHub pull request
 * links. Renders nothing when the text has none.
 */
export default function PrLinkChips({ text, messageId, workspaceId }) {
    const refs = useMemo(() => findPrUrls(text), [text]);
    const [open, drawer] = useCodeReviewOpener();
    if (!refs.length) return null;
    return (
        <div className="oi-prlinks" data-testid="pr-link-chips">
            {refs.map((r) => (
                <button
                    key={`${r.repo}#${r.number}`}
                    type="button"
                    className="oi-prlink"
                    onClick={() => open({ ...r, messageId, workspaceId })}
                    aria-label={`View changes in ${r.repo} pull request ${r.number}`}
                >
                    <FileDiff size={12} aria-hidden="true" />
                    <strong>View changes</strong> {r.repo}#{r.number}
                </button>
            ))}
            {drawer}
        </div>
    );
}
