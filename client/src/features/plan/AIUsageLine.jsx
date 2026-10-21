import React from 'react';
import { aiRemaining, aiUsageText, resetText } from './planLimit';
import './plan.css';

/**
 * "12 of 50 AI requests left today" under an AI composer. Pass the usage from
 * useAIUsage(workspaceId); renders nothing for company plans or while unknown.
 */
export default function AIUsageLine({ usage, className = '' }) {
    const text = aiUsageText(usage);
    if (!text) return null;
    const empty = aiRemaining(usage) === 0;
    const reset = empty ? resetText(usage?.resetsAt) : '';
    return (
        <p className={`pl-ai-line ${className}`} data-empty={empty ? 'true' : undefined} data-testid="ai-usage-line" aria-live="polite">
            {text}{reset ? ` · ${reset}` : ''}
        </p>
    );
}
