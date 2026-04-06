import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ErrorState — Error display with retry button.
 * Pure presentational component — delegates retry action to parent via props.
 */
const ErrorState = ({ error, onRetry }) => (
    <div style={{ textAlign: 'center', padding: '80px 24px', fontFamily: 'var(--font)' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--state-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--state-danger)' }}>
            <AlertTriangle size={22} />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Something went wrong
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
            {error || 'Failed to load workspaces. Please try again.'}
        </p>
        <button
            onClick={onRetry}
            style={{ padding: '8px 20px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
        >
            Try Again
        </button>
    </div>
);

export default ErrorState;
