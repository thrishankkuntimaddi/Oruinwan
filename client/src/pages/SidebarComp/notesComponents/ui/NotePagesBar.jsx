// A note's pages (web): a strip under the title — click a page to open it, + to add one.
// Each page is its own note; the first page is the note in the list (server: notes.service).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../../contexts/ToastContext';

export default function NotePagesBar({ noteId, workspaceId, canEdit, title }) {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [pages, setPages] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let gone = false;
        api.get(`/api/v2/notes/${noteId}`)
            .then((res) => { if (!gone) setPages(res.data?.note?.pages || null); })
            .catch(() => { if (!gone) setPages(null); });
        return () => { gone = true; };
    }, [noteId]);

    const list = (pages && pages.length ? pages : [{ _id: noteId, title }]).map((p) => ({ id: String(p._id || p.id), title: p.title }));
    // The page being edited shows its live title.
    const shown = list.map((p) => (p.id === String(noteId) ? { ...p, title: title || p.title } : p));
    const rootId = shown[0]?.id || noteId;

    const add = async () => {
        setBusy(true);
        try {
            const res = await api.post('/api/v2/notes', { workspaceId, parentNoteId: rootId });
            const page = res.data?.note;
            if (page?._id) navigate(`/workspace/${workspaceId}/notes/${page._id}`);
        } catch (err) {
            showToast(err?.response?.data?.message || 'Could not add a page', 'error');
        } finally {
            setBusy(false);
        }
    };

    if (shown.length < 2 && !canEdit) return null;
    return (
        <div data-testid="note-pages" role="tablist" aria-label="Pages" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '-4px 0 16px' }}>
            {shown.map((p, i) => {
                const on = p.id === String(noteId);
                return (
                    <button key={p.id} type="button" role="tab" aria-selected={on}
                        onClick={() => !on && navigate(`/workspace/${workspaceId}/notes/${p.id}`)}
                        style={{ height: 28, maxWidth: 200, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, background: on ? 'var(--gl-accent-soft, rgba(184,149,106,0.14))' : 'var(--bg-surface)', color: on ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: on ? 'default' : 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i + 1} · {p.title || (i === 0 ? 'Untitled' : `Page ${i + 1}`)}
                    </button>
                );
            })}
            {canEdit && (
                <button type="button" onClick={add} disabled={busy} aria-label="Add a page" title="Add a page" data-testid="note-add-page"
                    style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px dashed var(--border-accent)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Plus size={14} />
                </button>
            )}
        </div>
    );
}
