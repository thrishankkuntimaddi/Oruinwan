import React, { useCallback, useEffect, useState } from 'react';
import { Brain, Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { aiErrorMessage } from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';
import {
    Badge, Button, ConfirmDialog, EmptyState, ErrorState, IconButton, Input, LoadingState, Section, Select,
} from './settingsUi';
import './stg-ws.css';

/**
 * Settings → Oruinwan AI → Memory: everything the assistant remembers about the
 * signed-in user. Private to the user and used only in their own assistant chats
 * (never in AI replies posted to shared conversations). Works without a workspace.
 */
export default function AIMemorySection({ workspaceId }) {
    const { showToast } = useToast();
    const [items, setItems] = useState([]);
    const [max, setMax] = useState(100);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [draft, setDraft] = useState('');
    const [scope, setScope] = useState('everywhere');
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null); // { id, text }
    const [savingEdit, setSavingEdit] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [clearing, setClearing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const { data } = await api.get('/api/ai/memories', { params: workspaceId ? { workspaceId } : {} });
            setItems(data.memories || []);
            setMax(data.max || 100);
        } catch (err) {
            setLoadError(aiErrorMessage(err, 'Could not load AI memory'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!workspaceId) setScope('everywhere'); }, [workspaceId]);

    const add = async (e) => {
        e.preventDefault();
        if (!draft.trim() || saving) return;
        setSaving(true);
        try {
            const body = { text: draft.trim(), scope: workspaceId ? scope : 'everywhere' };
            if (workspaceId) body.workspaceId = workspaceId;
            const { data } = await api.post('/api/ai/memories', body);
            setItems((prev) => [data.memory, ...prev.filter((m) => m.id !== data.memory.id)]);
            setDraft('');
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not save that memory'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveEdit = async () => {
        if (!editing?.text.trim() || savingEdit) return;
        setSavingEdit(true);
        try {
            const { data } = await api.patch(`/api/ai/memories/${editing.id}`, { text: editing.text.trim() });
            setItems((prev) => prev.map((m) => (m.id === data.memory.id ? data.memory : m)));
            setEditing(null);
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not update that memory'), 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const remove = async (id) => {
        const before = items;
        setItems((prev) => prev.filter((m) => m.id !== id));
        try {
            await api.delete(`/api/ai/memories/${id}`);
        } catch (err) {
            setItems(before);
            showToast(aiErrorMessage(err, 'Could not delete that memory'), 'error');
        }
    };

    const clearAll = async () => {
        setClearing(true);
        try {
            await api.delete('/api/ai/memories');
            setItems([]);
            setConfirmClear(false);
            showToast('Oruinwan AI forgot everything about you', 'success');
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not clear AI memory'), 'error');
        } finally {
            setClearing(false);
        }
    };

    const full = items.length >= max;

    return (
        <Section
            title="Memory"
            description="What Oruinwan AI remembers about you. Private to you and used only in your own assistant chats. You can also say “remember that…” or “forget…” to the assistant."
            action={items.length > 0 ? (
                <Button size="sm" variant="danger-soft" icon={Trash2} onClick={() => setConfirmClear(true)}>Clear all</Button>
            ) : null}
        >
            <form onSubmit={add} className="stg-ws-inline" style={{ padding: '14px 0' }}>
                <div className="stg-ws-grow">
                    <label htmlFor="ai-memory-new" className="stg-ws-sr-only">New memory</label>
                    <Input
                        id="ai-memory-new"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={500}
                        disabled={full}
                        placeholder="e.g. I lead the design team · Keep answers short"
                    />
                </div>
                <div className="stg-ws-fixed">
                    <label htmlFor="ai-memory-scope" className="stg-ws-sr-only">Where it applies</label>
                    <Select id="ai-memory-scope" value={scope} onChange={(e) => setScope(e.target.value)} disabled={!workspaceId}>
                        <option value="everywhere">All workspaces</option>
                        <option value="workspace">This workspace only</option>
                    </Select>
                </div>
                <div className="stg-ws-fixed">
                    <Button type="submit" variant="primary" icon={Plus} loading={saving} disabled={!draft.trim() || full}>Remember</Button>
                </div>
            </form>

            {loading ? (
                <LoadingState label="Loading memory…" inline />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : items.length === 0 ? (
                <EmptyState icon={Brain}>Nothing yet. The assistant will remember what you ask it to.</EmptyState>
            ) : (
                <ul className="stg-list" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {items.map((m) => (
                        <li key={m.id} className="stg-list-item stg-ws-item-wrap">
                            {editing?.id === m.id ? (
                                <>
                                    <div className="stg-ws-item-main">
                                        <Input
                                            aria-label="Edit memory"
                                            value={editing.text}
                                            autoFocus
                                            maxLength={500}
                                            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                                                if (e.key === 'Escape') setEditing(null);
                                            }}
                                        />
                                    </div>
                                    <div className="stg-ws-item-actions">
                                        <IconButton label="Save memory" onClick={saveEdit} disabled={savingEdit || !editing.text.trim()}><Check size={14} /></IconButton>
                                        <IconButton label="Cancel editing" onClick={() => setEditing(null)} disabled={savingEdit}><X size={14} /></IconButton>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="stg-ws-item-main">
                                        <div className="stg-ws-item-title">{m.text}</div>
                                        <div className="stg-ws-item-meta">
                                            <Badge>{m.scope === 'workspace' ? 'This workspace' : 'All workspaces'}</Badge>
                                            {m.source === 'assistant' && <Badge tone="accent"><Sparkles size={10} /> Saved by the assistant</Badge>}
                                        </div>
                                    </div>
                                    <div className="stg-ws-item-actions">
                                        <IconButton label={`Edit “${m.text}”`} onClick={() => setEditing({ id: m.id, text: m.text })}><Pencil size={13} /></IconButton>
                                        <IconButton label={`Delete “${m.text}”`} tone="danger" onClick={() => remove(m.id)}><Trash2 size={13} /></IconButton>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {!loading && !loadError && items.length > 0 && (
                <div className="stg-ws-footnote">
                    {items.length} of {max} memories{full ? ' · Delete some to add more.' : ''}
                </div>
            )}

            <ConfirmDialog
                open={confirmClear}
                title="Clear all memories?"
                tone="danger"
                confirmLabel="Forget everything"
                loading={clearing}
                onConfirm={clearAll}
                onCancel={() => setConfirmClear(false)}
            >
                Oruinwan AI will forget everything it remembers about you, including memories tied to your other workspaces. This can’t be undone.
            </ConfirmDialog>
        </Section>
    );
}
