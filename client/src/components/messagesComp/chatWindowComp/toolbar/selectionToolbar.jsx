import React, { useState } from "react";
import { X, Trash2 } from "lucide-react";

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function SelectionToolbar({ selectedCount, onCancel, onDelete }) {
    return (
        <div style={{
            borderTop: '1px solid var(--border-default)',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: FONT,
        }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: FONT }}>
                {selectedCount} selected
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
                <CancelBtn onClick={onCancel}>Cancel</CancelBtn>
                <DeleteBtn onClick={onDelete}><Trash2 size={13} />Delete</DeleteBtn>
            </div>
        </div>
    );
}

function CancelBtn({ onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px 12px', fontSize: '12px', fontWeight: 500,
                color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
                border: '1px solid var(--border-default)', borderRadius: '2px',
                cursor: 'pointer', outline: 'none', transition: '100ms', fontFamily: FONT,
            }}>
            {children}
        </button>
    );
}

function DeleteBtn({ onClick, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px 12px', fontSize: '12px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px',
                color: hov ? '#fff' : 'var(--state-danger)',
                backgroundColor: hov ? 'var(--state-danger)' : 'rgba(255,80,80,0.10)',
                border: '1px solid var(--state-danger)', borderRadius: '2px',
                cursor: 'pointer', outline: 'none', transition: '100ms', fontFamily: FONT,
            }}>
            {children}
        </button>
    );
}
