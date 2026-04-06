import React from 'react';
import { ChevronRight, Plus } from 'lucide-react';

const SectionHeader = ({ label, isOpen, onClick, onAdd }) => (
    <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px', cursor: 'default', fontFamily: 'var(--font)' }}
        className="group"
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1 }} onClick={onClick}>
            <ChevronRight
                size={11}
                style={{ color: 'var(--text-muted)', transition: 'transform 150ms ease', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
            />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', userSelect: 'none' }}>
                {label}
            </span>
        </div>
        {onAdd && (
            <button
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                style={{
                    width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(228,228,228,0.4)',
                    borderRadius: '2px', flexShrink: 0,
                    transition: 'color 150ms ease, background 150ms ease',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.color = '#b8956a';
                    e.currentTarget.style.background = 'rgba(184,149,106,0.1)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(228,228,228,0.4)';
                    e.currentTarget.style.background = 'none';
                }}
                title={`Add ${label}`}
            >
                <Plus size={12} strokeWidth={2.5} />
            </button>
        )}
    </div>
);

export default SectionHeader;
