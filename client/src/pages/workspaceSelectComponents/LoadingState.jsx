import React from 'react';
import { Plus } from 'lucide-react';

/**
 * LoadingState — Skeleton that pixel-matches the WorkspaceGrid card layout.
 * Mirrors exactly: grid cols, gap, card height (200px), padding (20px), icon size (36px).
 */

const shimmer = {
    background: 'linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-hover) 50%, var(--bg-surface) 75%)',
    backgroundSize: '400% 100%',
    animation: 'ws-shimmer 1.4s ease infinite',
};

const LoadingState = ({ count = 1 }) => (
    <>
        <style>{`
            @keyframes ws-shimmer {
                0%   { background-position: 100% 0; }
                100% { background-position: -100% 0; }
            }
        `}</style>

        {/* Exact same grid as WorkspaceGrid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Workspace card skeletons — `count` matching real count */}
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{
                    height: '200px',              /* exact match */
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '2px',
                    padding: '20px',              /* exact match */
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Icon — 36×36, exact match */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '2px', marginBottom: '14px', flexShrink: 0, ...shimmer }} />

                    {/* Workspace name */}
                    <div style={{ height: '14px', width: '52%', borderRadius: '2px', marginBottom: '6px', ...shimmer }} />

                    {/* Meta: role · members */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <div style={{ height: '11px', width: '42px', borderRadius: '2px', ...shimmer }} />
                        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--border-default)' }} />
                        <div style={{ height: '11px', width: '60px', borderRadius: '2px', ...shimmer }} />
                    </div>

                    {/* Arrow row — sits at bottom */}
                    <div style={{ marginTop: 'auto', height: '12px', width: '100px', borderRadius: '2px', ...shimmer, opacity: 0.4 }} />
                </div>
            ))}

            {/* "Create New Workspace" placeholder — exact match of actual create card */}
            <div style={{
                height: '200px',
                border: '1px dashed var(--border-default)',
                borderRadius: '2px',
                background: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                opacity: 0.4,
                padding: '24px',
            }}>
                {/* 36px circle — exact match */}
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div style={{ height: '14px', width: '140px', borderRadius: '2px', ...shimmer }} />
                <div style={{ height: '11px', width: '110px', borderRadius: '2px', ...shimmer, opacity: 0.6 }} />
            </div>
        </div>
    </>
);

export default LoadingState;
