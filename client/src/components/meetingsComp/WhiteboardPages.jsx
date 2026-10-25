// A meeting's whiteboard with pages: page 1 is the meeting's board, + adds another. Arrows
// move between pages; each page syncs live on its own (server: collaboration.routes pages).
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import Whiteboard from './Whiteboard';

const chip = (on) => ({
    height: 28, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
    background: on ? 'var(--gl-accent-soft, rgba(184,149,106,0.14))' : 'var(--bg-surface)',
    color: on ? 'var(--accent)' : 'var(--text-secondary)',
});
const iconBtn = { width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' };

export default function WhiteboardPages({ meetingId }) {
    const { showToast } = useToast();
    const [pages, setPages] = useState([{ id: meetingId, title: 'Page 1' }]);
    const [current, setCurrent] = useState(meetingId);
    const load = useCallback(() => api.get(`/api/v2/collaboration/whiteboard/${meetingId}/pages`)
        .then((r) => setPages(r.data?.pages?.length ? r.data.pages : [{ id: meetingId, title: 'Page 1' }]))
        .catch(() => {}), [meetingId]);
    useEffect(() => { load(); }, [load]);
    const index = Math.max(0, pages.findIndex((p) => p.id === current));
    const page = pages[index] || pages[0];

    const add = async () => {
        try {
            const r = await api.post(`/api/v2/collaboration/whiteboard/${meetingId}/pages`, {});
            const created = r.data?.page;
            if (created) { setPages((l) => [...l, created]); setCurrent(created.id); }
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not add a page', 'error');
        }
    };
    const remove = async () => {
        if (!window.confirm(`Delete ${page.title || 'this page'}? Its drawing is deleted for everyone.`)) return;
        try {
            await api.delete(`/api/v2/collaboration/whiteboard/${meetingId}/pages/${page.id}`);
            setPages((l) => l.filter((p) => p.id !== page.id));
            setCurrent(pages[index - 1]?.id || meetingId);
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not delete the page', 'error');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
            <div data-testid="whiteboard-pages" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button type="button" aria-label="Previous page" style={iconBtn} disabled={index === 0} onClick={() => setCurrent(pages[index - 1].id)}><ChevronLeft size={14} /></button>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, minWidth: 0 }}>
                    {pages.map((p, i) => (
                        <button key={p.id} type="button" aria-current={p.id === page.id ? 'page' : undefined} style={chip(p.id === page.id)} onClick={() => setCurrent(p.id)}>
                            {p.title || `Page ${i + 1}`}
                        </button>
                    ))}
                </div>
                <button type="button" aria-label="Next page" style={iconBtn} disabled={index >= pages.length - 1} onClick={() => setCurrent(pages[index + 1].id)}><ChevronRight size={14} /></button>
                <button type="button" aria-label="Add a page" title="Add a page" style={iconBtn} onClick={add} data-testid="whiteboard-add-page"><Plus size={14} /></button>
                {page.id !== meetingId && <button type="button" aria-label="Delete this page" title="Delete this page" style={iconBtn} onClick={remove}><Trash2 size={14} /></button>}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <Whiteboard key={page.id} meetingId={meetingId} boardId={page.id} />
            </div>
        </div>
    );
}
