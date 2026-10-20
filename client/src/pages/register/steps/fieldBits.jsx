import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/** Availability mark shown inside the input while we check the name / domain. */
export const StatusIcon = ({ s }) => {
    if (s === 'checking') return <Loader2 size={15} className="orw-spin" style={{ color: 'var(--o-text-3)' }} aria-label="Checking" />;
    if (s === 'available') return <CheckCircle2 size={15} style={{ color: 'var(--o-good)' }} aria-label="Available" />;
    if (s === 'taken') return <AlertCircle size={15} style={{ color: 'var(--o-bad)' }} aria-label="Already taken" />;
    return null;
};

export const FieldError = ({ id, msg }) => (msg
    ? <p id={id} className="orw-error-text orw-error-line" role="alert"><AlertCircle size={12} aria-hidden="true" />{msg}</p>
    : null);
