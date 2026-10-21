import React, { useMemo, useState } from 'react';
import { Chip, LoadingState, ErrorState, useAsync, timeAgo } from '../../components/ui/page';
import designReviewService from '../../services/designReviewService';
import ReviewCanvas from './ReviewCanvas';
import { sortAnnotations } from './reviewGeometry';

/** Two versions of the reviewed file side by side, each with its own comments. */
export default function VersionCompare({ review }) {
    const current = review?.file?.currentVersion || review?.versionNumber || 1;
    const [to, setTo] = useState(review?.versionNumber || current);
    const [from, setFrom] = useState(Math.max(1, (review?.versionNumber || current) - 1));
    const { data, loading, error, reload } = useAsync(
        () => designReviewService.compare({ fileId: review.fileId?._id || review.fileId, from, to, reviewId: review._id }),
        [review._id, from, to],
    );
    const versions = useMemo(() => Array.from({ length: current }, (_, i) => current - i), [current]);

    if (current < 2) {
        return <ErrorState title="Only one version so far" message="Upload a new version of the file from the file library, then compare it here." />;
    }

    const col = (label, value, onChange, v) => {
        const anns = sortAnnotations(v?.annotations || []);
        const numbers = Object.fromEntries(anns.map((a, i) => [a._id, i + 1]));
        return (
            <div className="dr-compare-col">
                <div className="dr-stage-bar">
                    <strong style={{ color: 'var(--text-primary)' }}>{label}</strong>
                    <select className="gl-input cd-select" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} version`} style={{ width: 'auto' }}>
                        {versions.map((n) => <option key={n} value={n}>Version {n}{n === current ? ' (current)' : ''}</option>)}
                    </select>
                    <span className="dr-spacer" />
                    {v?.summary && <Chip tone={v.summary.open ? 'warning' : 'success'}>{v.summary.open} open · {v.summary.resolved} resolved</Chip>}
                    {v?.createdAt && <span>{timeAgo(v.createdAt)}</span>}
                </div>
                {v && <ReviewCanvas kind={data?.file?.kind || 'image'} url={v.url} annotations={anns} numbers={numbers} />}
            </div>
        );
    };

    if (loading && !data) return <LoadingState label="Loading both versions…" />;
    if (error && !data) return <ErrorState title="Couldn’t compare the versions" message={error} onRetry={reload} />;
    return (
        <div className="dr-compare">
            {col('Before', from, setFrom, data?.from)}
            {col('After', to, setTo, data?.to)}
        </div>
    );
}
