import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, UserMinus, Crown, Trash2, Briefcase } from 'lucide-react';
import { updateDepartment, assignUserToDepartment, removeUserFromDepartment, deleteDepartment } from '../../services/departmentService';
import { getCompanyMembers } from '../../services/companyService';
import { useToast } from '../../contexts/ToastContext';
import {
    Dialog, Btn, IconBtn, Chip, RoleChip, FilterTabs, SearchBox, Field, EmptyState, LoadingState, Avatar, errorMessage,
} from '../company-dash/dashUi';
import { idOf } from '../company-dash/dashNav';
import '../../pages/admin/admin.css';

/**
 * Manage one department: members (add / remove / set head), details, delete.
 * `department` must be the fresh object from the parent list (the parent
 * re-fetches after every change via onUpdate).
 */
const DepartmentDetailsModal = ({ isOpen, onClose, department, companyId, onUpdate, canEdit = true }) => {
    const { showToast } = useToast();
    const [tab, setTab] = useState('people');
    const [people, setPeople] = useState(null);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [form, setForm] = useState({ name: '', description: '' });
    const [confirmName, setConfirmName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen || !department) return;
        setForm({ name: department.name || '', description: department.description || '' });
        setConfirmName('');
    }, [isOpen, department]);

    useEffect(() => {
        if (!isOpen) { setTab('people'); setSearch(''); return; }
        if (!companyId || people) return;
        getCompanyMembers(companyId).then((r) => setPeople(r.members || [])).catch(() => setPeople([]));
    }, [isOpen, companyId, people]);

    const memberIds = useMemo(() => (department?.members || []).map(idOf), [department]);
    const headId = idOf(department?.head);
    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (people || []).filter((u) => !memberIds.includes(idOf(u._id))
            && (u.accountStatus || 'active') === 'active'
            && (!q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)));
    }, [people, memberIds, search]);

    if (!department) return null;

    const act = async (id, fn, ok) => {
        setBusyId(id);
        try { await fn(); showToast(ok, 'success'); await onUpdate?.(); } catch (err) { showToast(errorMessage(err, 'That did not work'), 'error'); } finally { setBusyId(null); }
    };

    const saveDetails = async () => {
        setSaving(true);
        try {
            await updateDepartment(department._id, { name: form.name.trim(), description: form.description.trim() });
            showToast('Department updated', 'success');
            await onUpdate?.();
        } catch (err) { showToast(errorMessage(err, 'Could not save'), 'error'); } finally { setSaving(false); }
    };

    const remove = async () => {
        setSaving(true);
        try {
            await deleteDepartment(department._id);
            showToast('Department deleted', 'success');
            onClose();
            onUpdate?.();
        } catch (err) { showToast(errorMessage(err, 'Could not delete'), 'error'); } finally { setSaving(false); }
    };

    const members = department.members || [];
    const workspaces = department.workspaces || [];

    return (
        <Dialog
            open={isOpen}
            size="lg"
            title={department.name}
            lead={`${members.length} ${members.length === 1 ? 'person' : 'people'} · head: ${department.head?.username || 'none'}`}
            onClose={onClose}
            busy={saving}
        >
            <FilterTabs
                value={tab}
                onChange={setTab}
                label="Department sections"
                options={[
                    { value: 'people', label: 'People', count: members.length },
                    ...(canEdit ? [{ value: 'add', label: 'Add people' }] : []),
                    { value: 'workspaces', label: 'Workspaces', count: workspaces.length },
                    ...(canEdit ? [{ value: 'settings', label: 'Settings' }] : []),
                ]}
            />

            {tab === 'people' && (members.length === 0 ? (
                <EmptyState title="No one in this department" text="Add people from the company directory." action={canEdit && <Btn size="sm" icon={UserPlus} onClick={() => setTab('add')}>Add people</Btn>} />
            ) : (
                <div className="gl-card cd-list">
                    {members.map((m) => {
                        const id = idOf(m);
                        const isHead = id === headId;
                        return (
                            <div className="cd-list-row" key={id}>
                                <Avatar user={m} size="sm" />
                                <div className="cd-grow">
                                    <div className="cd-cell-title">{m.username || m.email || 'Unknown'}</div>
                                    <div className="cd-cell-sub">{m.email}</div>
                                </div>
                                {isHead && <Chip tone="accent"><Crown size={11} /> Head</Chip>}
                                {m.companyRole && <span className="cd-hide-sm"><RoleChip role={m.companyRole} /></span>}
                                {canEdit && (
                                    <>
                                        <Btn size="sm" variant="ghost" loading={busyId === `head-${id}`} onClick={() => act(`head-${id}`, () => updateDepartment(department._id, { head: isHead ? null : id }), isHead ? 'Head cleared' : 'Head set')}>
                                            {isHead ? 'Clear head' : 'Make head'}
                                        </Btn>
                                        <IconBtn label={`Remove ${m.username || 'member'}`} disabled={busyId === `rm-${id}`} onClick={() => act(`rm-${id}`, () => removeUserFromDepartment(id, department._id), 'Removed from department')}>
                                            <UserMinus size={15} />
                                        </IconBtn>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}

            {tab === 'add' && (
                <>
                    <SearchBox value={search} onChange={setSearch} placeholder="Search company people…" />
                    {!people ? <LoadingState /> : candidates.length === 0 ? (
                        <EmptyState title={search ? 'No match' : 'Everyone is already here'} />
                    ) : (
                        <div className="gl-card cd-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {candidates.map((u) => (
                                <div className="cd-list-row" key={u._id}>
                                    <Avatar user={u} size="sm" />
                                    <div className="cd-grow">
                                        <div className="cd-cell-title">{u.username}</div>
                                        <div className="cd-cell-sub">{u.email}</div>
                                    </div>
                                    <Btn size="sm" icon={UserPlus} loading={busyId === `add-${u._id}`} onClick={() => act(`add-${u._id}`, () => assignUserToDepartment(u._id, department._id), `${u.username} added`)}>Add</Btn>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {tab === 'workspaces' && (workspaces.length === 0 ? (
                <EmptyState icon={Briefcase} title="No linked workspaces" text="Workspaces created for this department are listed here." />
            ) : (
                <div className="gl-card cd-list">
                    {workspaces.map((ws) => (
                        <div className="cd-list-row" key={idOf(ws)}>
                            <Briefcase size={14} className="cd-muted" />
                            <div className="cd-grow cd-cell-title">{ws.name || 'Workspace'}</div>
                        </div>
                    ))}
                </div>
            ))}

            {tab === 'settings' && (
                <>
                    <Field label="Name" htmlFor="ad-dd-name">
                        <input id="ad-dd-name" className="gl-input" value={form.name} maxLength={100} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </Field>
                    <Field label="Description" htmlFor="ad-dd-desc">
                        <textarea id="ad-dd-desc" className="gl-input" value={form.description} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    </Field>
                    <div>
                        <Btn variant="primary" loading={saving} disabled={!form.name.trim() || (form.name === department.name && form.description === (department.description || ''))} onClick={saveDetails}>Save changes</Btn>
                    </div>
                    <div className="gl-card cd-panel" style={{ borderColor: 'color-mix(in srgb, var(--state-danger) 40%, transparent)' }}>
                        <h3 className="cd-panel-title" style={{ marginBottom: 6 }}>Delete department</h3>
                        <p className="cd-hint" style={{ margin: '0 0 10px' }}>People stay in the company but lose this department. Type <strong>{department.name}</strong> to confirm.</p>
                        <div className="ad-row" style={{ alignItems: 'center' }}>
                            <input className="gl-input" aria-label="Department name to confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                            <Btn variant="danger" icon={Trash2} loading={saving} disabled={confirmName !== department.name} onClick={remove} style={{ flex: '0 0 auto' }}>Delete</Btn>
                        </div>
                    </div>
                </>
            )}
        </Dialog>
    );
};

export default DepartmentDetailsModal;
