// client/src/shared/components/ui/UIStates.jsx
//
// Shared loading / error / empty state primitives — Monolith Flow design system.
// Zero Tailwind, pure inline styles with CSS var tokens.

import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

// ─── Shimmer keyframe (injected once) ──────────────────────────────────────────
const SHIMMER_STYLE = `
  @keyframes mf-shimmer {
    0%   { opacity: 0.35; }
    50%  { opacity: 0.75; }
    100% { opacity: 0.35; }
  }
  .mf-shimmer { animation: mf-shimmer 1.6s ease-in-out infinite; }
`;

// ─── Loading Skeleton ──────────────────────────────────────────────────────────
/**
 * Animated shimmer skeleton rows — Monolith Flow dark palette.
 *
 * @param {number}  rows    Number of skeleton rows (default 5)
 * @param {boolean} avatar  Show an avatar placeholder on the left (default true)
 * @param {string}  className  Extra CSS class (optional, for layout overrides only)
 */
export function LoadingSkeleton({ rows = 5, avatar = true, className = '' }) {
    const widths = [72, 56, 88, 48, 64, 80, 52];
    return (
        <>
            <style>{SHIMMER_STYLE}</style>
            <div
                className={`mf-shimmer ${className}`}
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}
                aria-busy="true"
                aria-label="Loading…"
            >
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        {avatar && (
                            <div style={{
                                width: '30px', height: '30px', borderRadius: '50%',
                                background: i === 0 ? 'rgba(184,149,106,0.15)' : 'rgba(255,255,255,0.06)',
                                flexShrink: 0, marginTop: '2px',
                            }} />
                        )}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                <div style={{ height: '9px', background: 'rgba(255,255,255,0.1)', width: `${widths[i % widths.length] * 0.6}px` }} />
                                <div style={{ height: '7px', background: 'rgba(255,255,255,0.04)', width: '36px' }} />
                            </div>
                            <div style={{ height: '13px', background: 'rgba(255,255,255,0.06)', width: `${widths[i % widths.length]}%` }} />
                            {i % 3 === 0 && (
                                <div style={{ height: '11px', background: 'rgba(255,255,255,0.04)', width: `${widths[(i + 2) % widths.length] * 0.7}%` }} />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// ─── Error Banner ──────────────────────────────────────────────────────────────
/**
 * Friendly error message with optional Retry button.
 *
 * @param {string}   message   Error message (default: generic)
 * @param {function} onRetry   If provided, a Retry button is rendered
 */
export function ErrorBanner({ message = 'Something went wrong. Please try again.', onRetry, className = '' }) {
    return (
        <div
            role="alert"
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '12px', padding: '40px 24px', textAlign: 'center',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}
            className={className}
        >
            <div style={{ width: '44px', height: '44px', background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={20} style={{ color: '#e05252' }} />
            </div>
            <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #e4e4e4)', marginBottom: '4px' }}>
                    Failed to load
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, rgba(228,228,228,0.4))', maxWidth: '260px' }}>
                    {message}
                </p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px',
                        background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.2)',
                        color: '#e05252', fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <RefreshCw size={12} />
                    Retry
                </button>
            )}
        </div>
    );
}

// ─── Empty Banner ──────────────────────────────────────────────────────────────
/**
 * Centered empty state with icon, title, subtitle, and optional CTA.
 *
 * @param {ReactNode} icon
 * @param {string}   title
 * @param {string}   subtitle
 * @param {{ label: string, onClick: function }} action   Optional CTA
 */
export function EmptyBanner({ icon, title, subtitle, action, className = '' }) {
    return (
        <div
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '12px', padding: '56px 24px', textAlign: 'center',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}
            className={className}
        >
            <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                {icon ?? <Inbox size={22} style={{ color: 'rgba(228,228,228,0.2)' }} />}
            </div>
            <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #e4e4e4)', marginBottom: '4px' }}>{title}</p>
                {subtitle && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted, rgba(228,228,228,0.4))', maxWidth: '260px' }}>{subtitle}</p>
                )}
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    style={{
                        marginTop: '4px', padding: '7px 16px',
                        background: '#b8956a', border: 'none',
                        color: '#0c0c0c', fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
