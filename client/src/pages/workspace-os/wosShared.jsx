import React from 'react';
import './wos.css';

/** The signed-in user's company id as a string (companyId may be populated). */
export const companyIdOf = (user) => {
    const raw = user?.companyId;
    if (!raw) return null;
    return typeof raw === 'object' ? String(raw._id || raw.id || '') || null : String(raw);
};

/** Accessible on/off switch in the gloss style. */
export function Switch({ checked, onChange, label, disabled, title }) {
    return (
        <button
            type="button"
            role="switch"
            className="wo-switch"
            aria-checked={!!checked}
            aria-label={label}
            title={title || label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
        />
    );
}

/** Download rows (first row = header) as a CSV file. */
export function downloadCsv(filename, rows) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "3 Oct 2026, 14:05" */
export const fullDate = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
