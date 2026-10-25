// "Remind me" on a note (web): quick choices or any date and time. The server sends a
// notification (and a phone alert) then; it also shows in Activity → Calendar.
import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../../contexts/ToastContext';

const at = (days, h) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, 0, 0, 0);
    return d;
};
const localInput = (d) => {
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmt = (d) => d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function RemindNoteModal({ noteId, title, onClose }) {
    const { showToast } = useToast();
    const [custom, setCustom] = useState(localInput(new Date(Date.now() + 2 * 3600_000)));
    const [busy, setBusy] = useState(false);
    const choices = [
        { label: 'In 1 hour', when: new Date(Date.now() + 3600_000) },
        { label: 'Tomorrow morning', when: at(1, 9) },
        { label: 'Next week', when: at(7, 9) },
    ];
    const save = async (when) => {
        if (!(when instanceof Date) || when.getTime() <= Date.now() + 30_000) { showToast('Pick a time in the future', 'error'); return; }
        setBusy(true);
        try {
            await api.post(`/api/v2/notes/${noteId}/remind`, { remindAt: when.toISOString() });
            showToast(`I'll remind you ${fmt(when)}`, 'success');
            onClose();
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not set the reminder', 'error');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div role="dialog" aria-label="Remind me about this note" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
            <div className="gl-card" style={{ width: 'min(380px, 92vw)', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BellRing size={16} style={{ color: 'var(--accent)' }} />
                    <strong style={{ flex: 1 }}>Remind me about “{title || 'Untitled'}”</strong>
                    <button type="button" aria-label="Close" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={onClose}><X size={15} /></button>
                </div>
                {choices.map((c) => (
                    <button key={c.label} type="button" className="gl-btn" disabled={busy} onClick={() => save(c.when)} style={{ justifyContent: 'space-between', display: 'flex' }}>
                        <span>{c.label}</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmt(c.when)}</span>
                    </button>
                ))}
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Or pick a date and time
                    <input type="datetime-local" className="gl-input" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <button type="button" className="gl-btn gl-btn--primary gl-btn--block" disabled={busy} onClick={() => save(new Date(custom))} data-testid="note-remind-save">Remind me</button>
            </div>
        </div>
    );
}
