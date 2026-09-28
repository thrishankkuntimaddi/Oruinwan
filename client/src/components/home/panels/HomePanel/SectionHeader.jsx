import React from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import '../../../layout/shell.css';

/** Collapsible section heading in the Home panel (Channels, Direct Messages…). */
const SectionHeader = ({ label, isOpen, onClick, onAdd, count }) => (
    <div className="gl-section-label gl-shell-section">
        <button type="button" className="gl-shell-section-toggle" onClick={onClick} aria-expanded={!!isOpen}>
            <ChevronRight size={11} />
            <span>{label}</span>
            {typeof count === 'number' && count > 0 && <span className="gl-shell-section-count">{count}</span>}
        </button>
        {onAdd && (
            <button
                type="button"
                className="gl-icon-btn"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                title={`Add ${label}`}
                aria-label={`Add ${label}`}
            >
                <Plus size={12} strokeWidth={2.5} />
            </button>
        )}
    </div>
);

export default SectionHeader;
