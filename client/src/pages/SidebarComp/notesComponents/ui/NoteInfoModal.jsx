import React from 'react';
import { Clock } from 'lucide-react';
import { Dialog, Btn, Chip, Meter } from '../../../../components/ui/page';
import { formatDateTime } from '../../../../utils/userDateFormat';
import { getUserPreferences } from '../../../../hooks/useUserPreferences';

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
            } catch { /* not a checklist */ }
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

    const createdFull = formatDateTime(note.createdAt, getUserPreferences().region);
    const editedFull = formatDateTime(note.updatedAt, getUserPreferences().region);

    const close = () => setShowInfoModal(false);
    const sectionLabel = { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px' };

    return (
        <Dialog
            open
            title="Note details"
            lead={note.title || 'Untitled'}
            onClose={close}
            size="sm"
            footer={<Btn variant="ghost" onClick={close}>Close</Btn>}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[{ val: wordCount, label: 'Words' }, { val: blocks.length, label: 'Blocks' }, { val: `${sizeKb} KB`, label: 'Size' }].map(({ val, label }) => (
                    <div key={label} className="gl-card" style={{ padding: '10px', textAlign: 'center' }}>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{val}</p>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>{label}</p>
                    </div>
                ))}
            </div>

            {blockSummary.length > 0 && (
                <div>
                    <p style={sectionLabel}>Most used blocks</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {blockSummary.map(({ type, count }) => (
                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{type}</span>
                                <span style={{ width: '96px' }}><Meter value={(count / blocks.length) * 100} label={`${type} blocks`} /></span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', width: '20px', textAlign: 'right' }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {note.tags && note.tags.length > 0 && (
                <div>
                    <p style={sectionLabel}>Tags</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {note.tags.map(tag => <Chip key={tag} tone="accent">#{tag}</Chip>)}
                    </div>
                </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[{ label: 'Created', val: createdFull }, { label: 'Last edited', val: editedFull }].map(({ label, val }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} /> {label}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{val}</span>
                    </div>
                ))}
            </div>
        </Dialog>
    );
};

export default NoteInfoModal;
