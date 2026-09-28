import React from 'react';

const Bar = ({ w, h = 12, style }) => <span className="gl-wsp-skel__bar" style={{ width: w, height: h, ...style }} />;

/** Skeleton cards in the same shape as the workspace grid. */
const LoadingState = ({ count = 1 }) => (
    <div className="gl-wsp-grid" role="status" aria-live="polite" aria-label="Loading workspaces">
        {Array.from({ length: Math.max(1, count) }).map((_, i) => (
            <div key={i} className="gl-card gl-wsp-card gl-wsp-skel" aria-hidden="true">
                <div className="gl-wsp-card__top">
                    <Bar w={44} h={44} />
                    <Bar w={64} h={22} style={{ borderRadius: 999 }} />
                </div>
                <Bar w="58%" h={16} style={{ marginTop: 20 }} />
                <Bar w="40%" h={11} style={{ marginTop: 12 }} />
                <div className="gl-wsp-card__foot">
                    <Bar w={96} h={11} />
                    <Bar w={44} h={11} />
                </div>
            </div>
        ))}
        <div className="gl-wsp-create gl-wsp-skel" aria-hidden="true" style={{ opacity: 0.5 }}>
            <Bar w={44} h={44} style={{ borderRadius: '50%', marginBottom: 8 }} />
            <Bar w={150} h={14} />
            <Bar w={110} h={11} />
        </div>
    </div>
);

export default LoadingState;
