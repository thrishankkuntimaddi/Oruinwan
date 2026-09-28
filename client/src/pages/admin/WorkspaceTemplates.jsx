import React, { useMemo, useState } from 'react';
import { LayoutTemplate, Plus, Trash2, Hash, Lock, X, RefreshCw, Download } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Grid, Toolbar, FilterTabs, Btn, IconBtn, Chip, Dialog, Confirm, Field, SelectBox,
    ErrorState, EmptyState, LoadingState, useAsync, errorMessage,
} from '../../components/company-dash/dashUi';
import '../workspace-os/wos.css';

const CATEGORIES = ['general', 'engineering', 'design', 'marketing', 'sales', 'hr', 'finance', 'support', 'product', 'custom'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const newForm = () => ({
    name: '', description: '', category: 'general', isPublic: false,
    defaultChannels: [{ name: 'general', description: 'General discussion', isPrivate: false, isDefault: true }],
});

/** Workspace blueprints (channels + settings) that admins can apply to a workspace. */
export default function WorkspaceTemplates() {
    const { showToast } = useToast();
    const [cat, setCat] = useState('all');
    const [form, setForm] = useState(null);
    const [formError, setFormError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [applying, setApplying] = useState(null);
    const [targetWs, setTargetWs] = useState('');
    const [busy, setBusy] = useState(false);

    const templates = useAsync(() => api.get('/api/workspace-templates').then((r) => r.data?.templates || []));
    const workspaces = useAsync(
        () => api.get('/api/workspaces/my').then((r) => (r.data?.workspaces || []).filter((w) => ['owner', 'admin'].includes(w.role))),
    );

    const counts = useMemo(() => (templates.data || []).reduce((m, t) => ({ ...m, [t.category]: (m[t.category] || 0) + 1 }), {}), [templates.data]);
    const list = (templates.data || []).filter((t) => cat === 'all' || t.category === cat);

    const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const setCh = (i, k, v) => setForm((f) => ({ ...f, defaultChannels: f.defaultChannels.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));

    const create = async (e) => {
        e?.preventDefault();
        if (!form.name.trim()) { setFormError('Give the template a name'); return; }
        const channels = form.defaultChannels.map((c) => ({ ...c, name: c.name.trim().toLowerCase().replace(/\s+/g, '-') })).filter((c) => c.name);
        if (!channels.length) { setFormError('Add at least one channel'); return; }
        setSaving(true);
        setFormError(null);
        try {
            await api.post('/api/workspace-templates', { ...form, name: form.name.trim(), defaultChannels: channels });
            showToast('Template created', 'success');
            setForm(null);
            templates.reload();
        } catch (err) {
            setFormError(errorMessage(err, 'Could not create the template'));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            await api.delete(`/api/workspace-templates/${deleting._id}`);
            showToast(`Deleted “${deleting.name}”`, 'success');
            setDeleting(null);
            templates.reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not delete the template'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const openApply = (t) => { setApplying(t); setTargetWs(workspaces.data?.[0]?.id || ''); };
    const apply = async () => {
        setBusy(true);
        try {
            const r = await api.post(`/api/workspace-templates/${applying._id}/import`, { workspaceId: targetWs });
            showToast(r.data?.message || 'Template applied', 'success');
            setApplying(null);
            templates.reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not apply the template'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Collaboration"
                    title="Workspace templates"
                    lead="Reusable blueprints: default channels and settings you can apply to a workspace."
                    actions={(
                        <>
                            <Btn icon={RefreshCw} loading={templates.loading} onClick={templates.reload}>Refresh</Btn>
                            <Btn variant="primary" icon={Plus} onClick={() => { setForm(newForm()); setFormError(null); }}>New template</Btn>
                        </>
                    )}
                />
            )}
        >
            {templates.error && !templates.data ? (
                <ErrorState message={templates.error} onRetry={templates.reload} />
            ) : !templates.data ? (
                <LoadingState label="Loading templates…" />
            ) : templates.data.length === 0 ? (
                <EmptyState
                    icon={LayoutTemplate}
                    title="No templates yet"
                    text="Create a template with the channels a new team should start with."
                    action={<Btn variant="primary" icon={Plus} onClick={() => setForm(newForm())}>New template</Btn>}
                />
            ) : (
                <>
                    <Toolbar>
                        <FilterTabs
                            value={cat}
                            onChange={setCat}
                            label="Category"
                            options={[{ value: 'all', label: 'All', count: templates.data.length }, ...CATEGORIES.filter((c) => counts[c]).map((c) => ({ value: c, label: cap(c), count: counts[c] }))]}
                        />
                    </Toolbar>
                    <Grid cols="3">
                        {list.map((t) => (
                            <article key={t._id} className="gl-card wo-card">
                                <div className="wo-card-head">
                                    <div style={{ minWidth: 0 }}>
                                        <h3 className="wo-card-title">{t.name}</h3>
                                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                            <Chip tone="accent">{cap(t.category || 'general')}</Chip>
                                            {t.isPublic && <Chip tone="success">Public</Chip>}
                                            {!t.company && <Chip>Oruinwan</Chip>}
                                        </div>
                                    </div>
                                    {t.company && (
                                        <IconBtn label={`Delete ${t.name}`} className="cd-btn-danger" onClick={() => setDeleting(t)}><Trash2 size={14} /></IconBtn>
                                    )}
                                </div>
                                {t.description && <p className="wo-card-text">{t.description}</p>}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {(t.defaultChannels || []).slice(0, 6).map((c) => (
                                        <Chip key={c.name}>{c.isPrivate ? <Lock size={10} /> : <Hash size={10} />}{c.name}</Chip>
                                    ))}
                                </div>
                                <div className="wo-card-foot">
                                    <span><b>{(t.defaultChannels || []).length}</b> channels</span>
                                    <span><b>{t.usageCount || 0}</b> uses</span>
                                    <Btn size="sm" icon={Download} style={{ marginLeft: 'auto' }} onClick={() => openApply(t)}>Apply</Btn>
                                </div>
                            </article>
                        ))}
                    </Grid>
                </>
            )}

            <Dialog
                open={!!form}
                title="New template"
                onClose={() => setForm(null)}
                busy={saving}
                size="lg"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancel</Btn>
                        <Btn variant="primary" loading={saving} onClick={create}>Create template</Btn>
                    </>
                )}
            >
                {form && (
                    <form onSubmit={create} style={{ display: 'contents' }}>
                        <Field label="Name" htmlFor="tpl-name" error={formError}>
                            <input id="tpl-name" className="gl-input" value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="e.g. Engineering squad" maxLength={80} />
                        </Field>
                        <Field label="Description" htmlFor="tpl-desc">
                            <textarea id="tpl-desc" className="gl-input" value={form.description} onChange={(e) => setF('description', e.target.value)} placeholder="When to use this template (optional)" />
                        </Field>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 180px' }}>
                                <Field label="Category">
                                    <SelectBox value={form.category} onChange={(v) => setF('category', v)} label="Category">
                                        {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
                                    </SelectBox>
                                </Field>
                            </div>
                            <label className="wo-check" style={{ paddingBottom: 8 }}>
                                <input type="checkbox" checked={form.isPublic} onChange={(e) => setF('isPublic', e.target.checked)} />
                                Share with other companies
                            </label>
                        </div>
                        <Field label="Default channels">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {form.defaultChannels.map((c, i) => (
                                    <div key={i} className="wo-channel-row">
                                        <Hash size={13} className="cd-muted" />
                                        <input className="gl-input" value={c.name} onChange={(e) => setCh(i, 'name', e.target.value)} placeholder="channel-name" aria-label={`Channel ${i + 1} name`} maxLength={60} />
                                        <label className="wo-check"><input type="checkbox" checked={c.isPrivate} onChange={(e) => setCh(i, 'isPrivate', e.target.checked)} /><Lock size={11} /> Private</label>
                                        {form.defaultChannels.length > 1 && (
                                            <IconBtn label={`Remove channel ${c.name || i + 1}`} onClick={() => setForm((f) => ({ ...f, defaultChannels: f.defaultChannels.filter((_, j) => j !== i) }))}><X size={14} /></IconBtn>
                                        )}
                                    </div>
                                ))}
                                <div>
                                    <Btn size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, defaultChannels: [...f.defaultChannels, { name: '', description: '', isPrivate: false, isDefault: false }] }))}>Add channel</Btn>
                                </div>
                            </div>
                        </Field>
                        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
                    </form>
                )}
            </Dialog>

            <Dialog
                open={!!applying}
                title="Apply template"
                lead={applying ? `Adds the channels and settings of “${applying.name}” to a workspace. Existing channels are kept.` : undefined}
                onClose={() => setApplying(null)}
                busy={busy}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setApplying(null)} disabled={busy}>Cancel</Btn>
                        <Btn variant="primary" loading={busy} disabled={!targetWs} onClick={apply}>Apply</Btn>
                    </>
                )}
            >
                {(workspaces.data || []).length === 0 ? (
                    <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>
                        {workspaces.loading ? 'Loading your workspaces…' : "You aren't an admin of any workspace, so there's nowhere to apply it."}
                    </p>
                ) : (
                    <Field label="Workspace">
                        <SelectBox value={targetWs} onChange={setTargetWs} label="Workspace">
                            {workspaces.data.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </SelectBox>
                    </Field>
                )}
            </Dialog>

            <Confirm open={!!deleting} title="Delete template?" tone="danger" confirmLabel="Delete" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}>
                “{deleting?.name}” will no longer be offered. Workspaces already created from it are not changed.
            </Confirm>
        </DashPage>
    );
}
