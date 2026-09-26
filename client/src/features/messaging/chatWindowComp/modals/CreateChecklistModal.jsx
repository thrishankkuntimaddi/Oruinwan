import React, { useState } from 'react';
import { X, ListChecks } from 'lucide-react';

const FONT = 'Inter, system-ui, sans-serif';
const MAX_ITEMS = 50;

/** Title + one item per line. The whole checklist is sent end-to-end encrypted. */
export default function CreateChecklistModal({ onCreate, onClose }) {
    const [title, setTitle] = useState('');
    const [itemsText, setItemsText] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const items = itemsText.split('\n').map(s => s.trim()).filter(Boolean);

    const submit = async (e) => {
        e.preventDefault();
        if (items.length === 0) { setError('Add at least one item.'); return; }
        if (items.length > MAX_ITEMS) { setError(`A checklist can have up to ${MAX_ITEMS} items.`); return; }
        setSaving(true);
        try {
            await onCreate({ title: title.trim(), items });
            onClose();
        } catch {
            setError('Could not send the checklist. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const input = { width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 2, fontFamily: FONT, outline: 'none', boxSizing: 'border-box' };

    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <form data-testid="checklist-modal" onSubmit={submit}
                style={{ width: 380, background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: 2, padding: 18, fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}><ListChecks size={16} /> New checklist</span>
                    <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                </div>
                <input style={input} placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
                <textarea style={{ ...input, minHeight: 120, resize: 'vertical' }} placeholder={'One item per line\nBook the room\nSend the agenda'}
                    value={itemsText} onChange={e => { setItemsText(e.target.value); setError(''); }} />
                <div style={{ fontSize: 11, color: error ? 'var(--state-danger)' : 'var(--text-muted)' }}>
                    {error || `${items.length} item${items.length === 1 ? '' : 's'}`}
                </div>
                <button type="submit" disabled={saving}
                    style={{ padding: '9px 0', fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#0c0c0c', border: 'none', borderRadius: 2, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Sending…' : 'Send checklist'}
                </button>
            </form>
        </div>
    );
}
