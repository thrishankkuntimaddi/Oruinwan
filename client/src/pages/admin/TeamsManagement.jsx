import React, { useMemo, useState } from 'react';
import { UsersRound, Plus, Pencil, Trash2, UserPlus, RefreshCw } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Grid, Toolbar, SearchBox, SelectBox, Btn, IconBtn, Chip, Avatar, Dialog, Confirm, Field,
    ErrorState, EmptyState, LoadingState, KpiGrid, Kpi, useAsync, errorMessage,
} from '../../components/company-dash/dashUi';
import { companyIdOf } from '../workspace-os/wosShared';

const idOf = (v) => String(v?._id || v || '');

function TeamForm({ open, initial, departments, employees, onClose, onSaved }) {
    const { showToast } = useToast();
    const isEdit = !!initial?._id;
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    React.useEffect(() => {
        if (open) {
            setForm({
                name: initial?.name || '',
                description: initial?.description || '',
                departmentId: initial?.department ? idOf(initial.department) : '',
                leadId: initial?.lead ? idOf(initial.lead) : '',
            });
            setError(null);
        }
    }, [open, initial]);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const save = async (e) => {
        e?.preventDefault();
        if (!form.name?.trim()) { setError('Give the team a name'); return; }
        setSaving(true);
        setError(null);
        try {
            if (isEdit) {
                // The update route takes model field names (department, lead).
                await api.patch(`/api/teams/${initial._id}`, {
                    name: form.name.trim(), description: form.description,
                    department: form.departmentId || null, lead: form.leadId || null,
                });
            } else {
                await api.post('/api/teams', {
                    name: form.name.trim(), description: form.description,
                    departmentId: form.departmentId || undefined, leadId: form.leadId || undefined,
                });
            }
            showToast(isEdit ? 'Team updated' : 'Team created', 'success');
            onSaved();
            onClose();
        } catch (err) {
            setError(errorMessage(err, isEdit ? 'Could not update the team' : 'Could not create the team'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            title={isEdit ? 'Edit team' : 'New team'}
            lead="Teams are focused groups inside a department."
            onClose={onClose}
            busy={saving}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
                    <Btn variant="primary" loading={saving} onClick={save}>{isEdit ? 'Save' : 'Create team'}</Btn>
                </>
            )}
        >
            <form onSubmit={save} style={{ display: 'contents' }}>
                <Field label="Name" htmlFor="team-name" error={error}>
                    <input id="team-name" className="gl-input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Platform squad" maxLength={80} />
                </Field>
                <Field label="Description" htmlFor="team-desc">
                    <textarea id="team-desc" className="gl-input" value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="What this team works on (optional)" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <Field label="Department">
                        <SelectBox value={form.departmentId || ''} onChange={(v) => set('departmentId', v)} label="Department">
                            <option value="">No department</option>
                            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </SelectBox>
                    </Field>
                    <Field label="Team lead">
                        <SelectBox value={form.leadId || ''} onChange={(v) => set('leadId', v)} label="Team lead">
                            <option value="">No lead</option>
                            {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.username}</option>)}
                        </SelectBox>
                    </Field>
                </div>
                <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
        </Dialog>
    );
}

function MembersDialog({ team, employees, onClose, onSaved }) {
    const { showToast } = useToast();
    const [picked, setPicked] = useState(new Set());
    const [q, setQ] = useState('');
    const [saving, setSaving] = useState(false);
    React.useEffect(() => {
        if (team) setPicked(new Set((team.members || []).map((m) => idOf(m.user)).filter(Boolean)));
        setQ('');
    }, [team]);
    const toggle = (id) => setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const list = employees.filter((e) => !q || e.username?.toLowerCase().includes(q.toLowerCase()) || e.email?.toLowerCase().includes(q.toLowerCase()));

    const save = async () => {
        setSaving(true);
        try {
            const current = new Set((team.members || []).map((m) => idOf(m.user)).filter(Boolean));
            const add = [...picked].filter((id) => !current.has(id));
            const remove = [...current].filter((id) => !picked.has(id));
            if (add.length) await api.patch(`/api/teams/${team._id}/members`, { userIds: add, action: 'add' });
            if (remove.length) await api.patch(`/api/teams/${team._id}/members`, { userIds: remove, action: 'remove' });
            showToast(add.length || remove.length ? 'Members updated' : 'No changes', 'success');
            onSaved();
            onClose();
        } catch (err) {
            showToast(errorMessage(err, 'Could not update members'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={!!team}
            title="Team members"
            lead={team ? `${team.name} · ${picked.size} selected` : undefined}
            onClose={onClose}
            busy={saving}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
                    <Btn variant="primary" loading={saving} onClick={save}>Save members</Btn>
                </>
            )}
        >
            <SearchBox value={q} onChange={setQ} placeholder="Search people…" />
            <div className="wo-pick" role="group" aria-label="Company members">
                {list.length === 0 && <p className="cd-muted" style={{ fontSize: 12, textAlign: 'center', padding: 16, margin: 0 }}>No one matches.</p>}
                {list.map((emp) => {
                    const on = picked.has(String(emp._id));
                    return (
                        <label key={emp._id} className="wo-pick-row" data-on={on ? 'true' : undefined}>
                            <input type="checkbox" checked={on} onChange={() => toggle(String(emp._id))} />
                            <Avatar user={emp} size="sm" />
                            <span style={{ minWidth: 0, flex: 1 }}>
                                <span className="cd-cell-title" style={{ display: 'block' }}>{emp.username}</span>
                                <span className="cd-cell-sub" style={{ display: 'block' }}>{emp.email}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </Dialog>
    );
}

/** Teams: sub-groups inside departments. Owners and admins create, edit, staff and delete them. */
export default function TeamsManagement() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const companyId = companyIdOf(user);
    const [dept, setDept] = useState('');
    const [q, setQ] = useState('');
    const [form, setForm] = useState(null); // {} for new, team for edit
    const [membersOf, setMembersOf] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);

    const teams = useAsync(() => api.get('/api/teams', { params: dept ? { departmentId: dept } : {} }).then((r) => r.data?.teams || []), [dept]);
    const departments = useAsync(() => api.get('/api/departments').then((r) => r.data?.departments || []));
    const employees = useAsync(
        () => api.get(`/api/companies/${companyId}/employees`, { params: { limit: 200 } }).then((r) => r.data?.employees || []),
        [companyId],
        { enabled: !!companyId },
    );

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (teams.data || []).filter((t) => !s || t.name?.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
    }, [teams.data, q]);
    const memberTotal = (teams.data || []).reduce((n, t) => n + (t.members?.length || 0), 0);

    const remove = async () => {
        setBusy(true);
        try {
            await api.delete(`/api/teams/${deleting._id}`);
            showToast(`Deleted “${deleting.name}”`, 'success');
            setDeleting(null);
            teams.reload();
        } catch (err) {
            showToast(errorMessage(err, 'Could not delete the team'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Collaboration"
                    title="Teams"
                    lead="Focused groups inside departments, each with a lead and members."
                    actions={(
                        <>
                            <Btn icon={RefreshCw} loading={teams.loading} onClick={teams.reload}>Refresh</Btn>
                            <Btn variant="primary" icon={Plus} onClick={() => setForm({})}>New team</Btn>
                        </>
                    )}
                />
            )}
        >
            {teams.error && !teams.data ? (
                <ErrorState message={teams.error} onRetry={teams.reload} />
            ) : !teams.data ? (
                <LoadingState label="Loading teams…" />
            ) : (
                <>
                    <KpiGrid>
                        <Kpi label="Teams" value={teams.data.length} icon={UsersRound} hint={dept ? 'In this department' : 'Across the company'} />
                        <Kpi label="Team memberships" value={memberTotal} />
                        <Kpi label="Without a lead" value={teams.data.filter((t) => !t.lead).length} tone="muted" />
                    </KpiGrid>
                    <Toolbar>
                        <SearchBox value={q} onChange={setQ} placeholder="Search teams…" />
                        <SelectBox value={dept} onChange={setDept} label="Department filter" style={{ maxWidth: 220 }}>
                            <option value="">All departments</option>
                            {(departments.data || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </SelectBox>
                    </Toolbar>
                    {list.length === 0 ? (
                        <EmptyState
                            icon={UsersRound}
                            title={teams.data.length === 0 ? 'No teams yet' : 'No matches'}
                            text={teams.data.length === 0 ? 'Create a team to organise people within a department.' : 'Try a different search or department.'}
                            action={teams.data.length === 0 && <Btn variant="primary" icon={Plus} onClick={() => setForm({})}>New team</Btn>}
                        />
                    ) : (
                        <Grid cols="3">
                            {list.map((t) => (
                                <article key={t._id} className="gl-card wo-card">
                                    <div className="wo-card-head">
                                        <div style={{ minWidth: 0 }}>
                                            <h3 className="wo-card-title">{t.name}</h3>
                                            <div style={{ marginTop: 4 }}>{t.department ? <Chip tone="accent">{t.department.name}</Chip> : <Chip>No department</Chip>}</div>
                                        </div>
                                        <div className="wo-card-actions">
                                            <IconBtn label={`Members of ${t.name}`} onClick={() => setMembersOf(t)}><UserPlus size={15} /></IconBtn>
                                            <IconBtn label={`Edit ${t.name}`} onClick={() => setForm(t)}><Pencil size={14} /></IconBtn>
                                            <IconBtn label={`Delete ${t.name}`} className="cd-btn-danger" onClick={() => setDeleting(t)}><Trash2 size={14} /></IconBtn>
                                        </div>
                                    </div>
                                    {t.description && <p className="wo-card-text">{t.description}</p>}
                                    <div className="wo-card-foot">
                                        <span><b>{t.members?.length || 0}</b> member{t.members?.length === 1 ? '' : 's'}</span>
                                        <span>Lead: <b>{t.lead?.username || '—'}</b></span>
                                        {(t.members || []).length > 0 && (
                                            <span className="wo-avatars" style={{ marginLeft: 'auto' }} aria-hidden="true">
                                                {t.members.slice(0, 5).map((m) => <Avatar key={idOf(m.user)} user={m.user} size="sm" />)}
                                            </span>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </Grid>
                    )}
                </>
            )}

            <TeamForm
                open={!!form}
                initial={form && form._id ? form : null}
                departments={departments.data || []}
                employees={employees.data || []}
                onClose={() => setForm(null)}
                onSaved={teams.reload}
            />
            <MembersDialog team={membersOf} employees={employees.data || []} onClose={() => setMembersOf(null)} onSaved={teams.reload} />
            <Confirm
                open={!!deleting}
                title="Delete team?"
                tone="danger"
                confirmLabel="Delete team"
                busy={busy}
                onConfirm={remove}
                onClose={() => setDeleting(null)}
            >
                “{deleting?.name}” will be removed. Its members stay in the company and their departments.
            </Confirm>
        </DashPage>
    );
}
