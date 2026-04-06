import React from 'react';
import { X, FileText, Clock } from 'lucide-react';

const NoteInfoModal = ({ note, blocks, showInfoModal, setShowInfoModal }) => {
    if (!showInfoModal || !note) return null;

    const wordCount = blocks.reduce((acc, b) => {
        if (b.type === 'text' || b.type === 'heading') {
            const plain = (b.content || '').replace(/<[^>]*>/g, '').trim();
            return acc + (plain ? plain.split(/\s+/).length : 0);
        }
        if (b.type === 'checklist') {
            try {
                const items = JSON.parse(b.content);
                if (Array.isArray(items))
                    return acc + items.reduce((s, it) => s + (it.text?.split(/\s+/).length || 0), 0);
            } catch { }
        }
        return acc;
    }, 0);

    const blockCounts = blocks.reduce((acc, b) => {
        acc[b.type] = (acc[b.type] || 0) + 1;
        return acc;
    }, {});

    const blockSummary = Object.entries(blockCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([type, count]) => ({ type, count }));

    const sizeKb = (JSON.stringify(blocks).length / 1024).toFixed(2);

    const createdFull = new Date(note.createdAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const editedFull = new Date(note.updatedAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
            onClick={e => e.target === e.currentTarget && setShowInfoModal(false)}
        >
            <div style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.1)', width: '384px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={15} style={{ color: '#b8956a' }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '1px' }}>Note Info</h3>
                            <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                {note.title || 'Untitled Note'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowInfoModal(false)}
                        style={{ padding: '5px', background: 'transparent', border: 'none', color: 'rgba(228,228,228,0.35)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Stats */}
                <div style={{ padding: '18px' }}>
                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '18px' }}>
                        {[{ val: wordCount, label: 'Words' }, { val: blocks.length, label: 'Blocks' }, { val: sizeKb, label: 'KB' }].map(({ val, label }) => (
                            <div key={label} style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 10px', textAlign: 'center' }}>
                                <p style={{ fontSize: '20px', fontWeight: 700, color: '#e4e4e4', fontFamily: 'monospace', marginBottom: '3px' }}>{val}</p>
                                <p style={{ fontSize: '10px', color: 'rgba(228,228,228,0.35)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Block breakdown */}
                    {blockSummary.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(228,228,228,0.3)', marginBottom: '10px', fontFamily: 'monospace' }}>Block breakdown</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {blockSummary.map(({ type, count }) => (
                                    <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '12px', color: 'rgba(228,228,228,0.5)', textTransform: 'capitalize', fontFamily: 'Inter, system-ui, sans-serif' }}>{type}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ height: '4px', width: '80px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', background: '#b8956a', width: `${Math.round((count / blocks.length) * 100)}%`, transition: 'width 400ms ease' }} />
                                            </div>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(228,228,228,0.45)', width: '16px', textAlign: 'right', fontFamily: 'monospace' }}>{count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(228,228,228,0.3)', marginBottom: '8px', fontFamily: 'monospace' }}>Tags</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {note.tags.map(tag => (
                                    <span key={tag} style={{ padding: '3px 10px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.2)', color: '#b8956a', fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dates */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                        {[{ label: 'Created', val: createdFull }, { label: 'Last edited', val: editedFull }].map(({ label, val }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.35)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={11} /> {label}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(228,228,228,0.6)', fontFamily: 'monospace' }}>{val}</span>
                            </div>
                        ))}
                    </div>

                    {/* Close */}
                    <button onClick={() => setShowInfoModal(false)}
                        style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600, color: 'rgba(228,228,228,0.5)', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NoteInfoModal;
