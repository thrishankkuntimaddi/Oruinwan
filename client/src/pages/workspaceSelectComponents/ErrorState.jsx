import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

const ErrorState = ({ error, onRetry }) => (
    <div className="gl-card gl-empty gl-wsp-error" role="alert">
        <span className="gl-empty-mark"><AlertTriangle size={20} /></span>
        <h3 className="gl-empty-title" style={{ fontSize: 16 }}>Something went wrong</h3>
        <p className="gl-empty-text" style={{ maxWidth: 380, fontSize: 13 }}>
            {error || 'Failed to load workspaces. Please try again.'}
        </p>
        <button type="button" className="gl-btn gl-btn--lg" style={{ marginTop: 12 }} onClick={onRetry}>
            <RefreshCcw size={14} /> Try Again
        </button>
    </div>
);

export default ErrorState;
