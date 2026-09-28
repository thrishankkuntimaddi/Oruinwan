import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { openCodeReview } from './codeReviewBus';

const CodeReviewPanel = lazy(() => import('./codeReview/CodeReviewPanel'));

/**
 * Opens the code-review panel next to the open conversation. When no
 * conversation window claims it (Tasks page, a conversation showing another
 * tab), the panel opens here as a right-hand drawer instead.
 * Returns [open(ref), drawerElement] — render drawerElement somewhere.
 */
export default function useCodeReviewOpener() {
    const [local, setLocal] = useState(null);
    const open = useCallback((ref) => {
        if (!ref?.repo || !ref?.number) return;
        if (!openCodeReview(ref)) setLocal(ref);
    }, []);
    const drawer = local ? <CodeReviewDrawer reviewRef={local} onClose={() => setLocal(null)} /> : null;
    return [open, drawer];
}

export function CodeReviewDrawer({ reviewRef, onClose }) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);
    return createPortal(
        <div className="oi-drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="oi-drawer" role="dialog" aria-modal="true" aria-label={`Code review for ${reviewRef.repo} #${reviewRef.number}`}>
                <Suspense fallback={<div className="oi-panel-loading">Loading…</div>}>
                    <CodeReviewPanel reviewRef={reviewRef} onClose={onClose} standalone />
                </Suspense>
            </div>
        </div>,
        document.body,
    );
}
