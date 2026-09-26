import React, { useCallback, useEffect, useState } from 'react';
import { AlarmClock, X } from 'lucide-react';
import api from '@services/api';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

/** Upcoming "remind me" reminders across all conversations, with cancel. */
export default function RemindersPanel({ onClose }) {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/api/v2/messages/reminders');
            const list = data.reminders || [];
            // The reminded message is end-to-end encrypted: decrypt its preview here.
            const { decryptTextOrNull } = await import('../../../../services/messageEncryptionService');
            const withText = await Promise.all(list.map(async (r) => {
                const m = r.messageId || {};
                let text = m.text || '';
                if (!text && m.payload?.ciphertext) {
                    const convId = String(m.channel || m.dm || '');
                    text = (await decryptTextOrNull(m.payload.ciphertext, m.payload.messageIv, convId, m.channel ? 'channel' : 'dm')) || '🔒 Encrypted message';
                }
                if (!text && m.type && m.type !== 'message') text = `(${m.type})`;
                return { ...r, text };
            }));
            setReminders(withText);
        } catch {
            setError('Failed to load reminders.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const cancel = async (id) => {
        try {
            await api.delete(`/api/v2/messages/reminders/${id}`);
            setReminders(prev => prev.filter(r => r._id !== id));
        } catch {
            setError('Could not cancel that reminder.');
        }
    };

    return (
        <div data-testid="reminders-panel" style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: 320, zIndex: 900,
            background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-accent)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', fontFamily: FONT,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    <AlarmClock size={16} style={{ color: 'var(--accent)' }} /> Reminders
                </span>
                <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {loading && <p style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>}
                {error && <p style={{ padding: 20, fontSize: 13, color: 'var(--state-danger)' }}>{error}</p>}
                {!loading && !error && reminders.length === 0 && (
                    <p style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>No upcoming reminders. Use “Remind me” on any message.</p>
                )}
                {reminders.map(r => (
                    <div key={r._id} data-testid="reminder-item" style={{ margin: '4px 12px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <span>{r.messageId?.sender?.username || 'Message'}</span>
                            <span>{new Date(r.remindAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{r.text}</p>
                        {r.note && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Note: {r.note}</p>}
                        <button onClick={() => cancel(r._id)}
                            style={{ marginTop: 8, background: 'none', border: '1px solid var(--border-default)', color: 'var(--state-danger)', borderRadius: 2, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Cancel reminder
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
