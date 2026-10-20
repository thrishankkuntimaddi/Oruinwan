import React from 'react';
import { X } from 'lucide-react';

/** Head of a note side panel (AI, version history): mark, title, one line, close. */
export default function SidePanelHead({ icon: Icon, title, sub, onClose }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 0 16px', height: '52px', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="gl-empty-mark" style={{ margin: 0, width: 28, height: 28 }}><Icon size={14} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font)', margin: 0 }}>{title}</h3>
                {sub && <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>{sub}</p>}
            </div>
            <button type="button" className="gl-icon-btn" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} title="Close"><X size={15} /></button>
        </div>
    );
}
