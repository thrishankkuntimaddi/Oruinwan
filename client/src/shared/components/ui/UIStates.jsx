// client/src/shared/components/ui/UIStates.jsx
//
// Shared loading / error / empty state primitives.
// Import and use across any feature — no external dependencies beyond Lucide.

import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
/**
 * Animated pulse skeleton rows — drop-in for any list or board view.
 *
 * @param {number} rows     Number of skeleton rows (default 5)
 * @param {boolean} avatar  Show an avatar placeholder on the left (default true)
 */
export function LoadingSkeleton({ rows = 5, avatar = true, className = '' }) {
    const widths = [72, 56, 88, 48, 64, 80, 52];
    return (
        <div className={`animate-pulse space-y-4 p-4 ${className}`} aria-busy="true" aria-label="Loading…">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                    {avatar && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-2">
                        <div className="flex gap-2 items-baseline">
                            <div className="h-2.5 rounded bg-gray-300 dark:bg-gray-600"
                                style={{ width: `${widths[i % widths.length] * 0.6}px` }} />
                            <div className="h-2 w-10 rounded bg-gray-100 dark:bg-gray-700" />
                        </div>
                        <div className="h-3.5 rounded bg-gray-200 dark:bg-gray-700"
                            style={{ width: `${widths[i % widths.length]}%` }} />
                        {i % 3 === 0 && (
                            <div className="h-3 rounded bg-gray-100 dark:bg-gray-700/60"
                                style={{ width: `${widths[(i + 2) % widths.length] * 0.7}%` }} />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
/**
 * Friendly error message with an optional Retry button.
 *
 * @param {string}   message   Error message to display (default: generic)
 * @param {function} onRetry   If provided, a Retry button is rendered
 * @param {string}   className Additional CSS classes
 */
export function ErrorBanner({ message = 'Something went wrong. Please try again.', onRetry, className = '' }) {
    return (
        <div
            role="alert"
            className={`flex flex-col items-center justify-center gap-3 py-10 px-6 text-center ${className}`}
        >
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle size={22} className="text-red-500" />
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
                    Failed to load
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                    {message}
                </p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-semibold transition-colors"
                >
                    <RefreshCw size={13} />
                    Retry
                </button>
            )}
        </div>
    );
}

// ─── Empty Banner ─────────────────────────────────────────────────────────────
/**
 * Centered empty state with an icon, title, subtitle, and optional CTA.
 *
 * @param {ReactNode} icon     Lucide icon component (passed as element)
 * @param {string}   title
 * @param {string}   subtitle
 * @param {{ label: string, onClick: function }} action   Optional CTA button
 * @param {string}   className
 */
export function EmptyBanner({ icon, title, subtitle, action, className = '' }) {
    return (
        <div className={`flex flex-col items-center justify-center gap-3 py-16 px-6 text-center ${className}`}>
            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-1">
                {icon ?? <Inbox size={24} className="text-gray-300 dark:text-gray-600" />}
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{title}</p>
                {subtitle && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">{subtitle}</p>
                )}
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
