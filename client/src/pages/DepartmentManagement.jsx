import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCompany } from '../contexts/CompanyContext';
import { useDepartment } from '../contexts/DepartmentContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, ArrowLeft, Building2, Pencil, Trash2, Users, Layers, Lock, ChevronRight } from 'lucide-react';
import {
    DashPage, PageHead, Panel, Toolbar, SearchBox, Btn, IconBtn, Chip, Dialog, Confirm, Field, EmptyState, LoadingState, Grid,
} from '../components/ui/page';
import './toolkit/toolkit.css';

const IDEAS = [
    { Icon: Building2, title: 'One per function', text: 'Engineering, Design, Sales: mirror how your company is organised.' },
    { Icon: Users, title: 'Group by team lead', text: 'Make a department for each manager so reports roll up cleanly.' },
    { Icon: Layers, title: 'Start small', text: 'Two or three departments are enough. You can split them later.' },
];

const memberCountOf = (d) => d.memberCount ?? d.members?.length ?? 0;

/** Company admin → Departments: create, rename and remove the departments people belong to. */
const DepartmentManagement = () => {
    const { isCompanyAdmin } = useCompany();
    const { departments, loading, createDepartment, updateDepartment, deleteDepartment, refreshDepartments } = useDepartment();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [nameError, setNameError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [query, setQuery] = useState('');

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (departments || []).filter((d) => !q || `${d.name} ${d.description || ''}`.toLowerCase().includes(q));
    }, [departments, query]);

    if (!isCompanyAdmin()) {
        return (
            <DashPage head={<PageHead eyebrow="Company" title="Departments" icon={Building2} />}>
                <Panel>
                    <EmptyState icon={Lock} title="Admins only" text="Only company admins can manage departments. Ask an admin if something needs to change."
                        action={<Btn icon={ArrowLeft} onClick={() => navigate('/workspaces')}>Back to workspaces</Btn>} />
                </Panel>
            </DashPage>
        );
    }

    const openCreate = () => { setFormData({ name: '', description: '' }); setNameError(null); setShowCreateModal(true); };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { setNameError('Give the department a name'); return; }

        setSubmitting(true);
        try {
            await createDepartment(formData.name, formData.description);
            showToast(`Created “${formData.name.trim()}”`, 'success');
            setShowCreateModal(false);
            setFormData({ name: '', description: '' });
            refreshDepartments();
        } catch (error) {
            showToast('Could not create the department', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        if (!selectedDepartment) return;
        if (!formData.name.trim()) { setNameError('Give the department a name'); return; }

        setSubmitting(true);
        try {
            await updateDepartment(selectedDepartment._id, formData);
            showToast('Department saved', 'success');
            setShowEditModal(false);
            setSelectedDepartment(null);
            setFormData({ name: '', description: '' });
            refreshDepartments();
        } catch (error) {
            showToast('Could not save the department', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const dept = confirmDelete;
        setDeleting(true);
        try {
            await deleteDepartment(dept._id);
            showToast(`Deleted “${dept.name}”`, 'success');
            setConfirmDelete(null);
            refreshDepartments();
        } catch (error) {
            showToast('Could not delete the department', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const openEditModal = (dept) => {
        setSelectedDepartment(dept);
        setFormData({ name: dept.name, description: dept.description || '' });
        setNameError(null);
        setShowEditModal(true);
    };

    const hasAny = (departments || []).length > 0;
    const formOpen = showCreateModal || showEditModal;
    const closeForm = () => { setShowCreateModal(false); setShowEditModal(false); setSelectedDepartment(null); };

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Company · People"
                    title="Departments"
                    icon={Building2}
                    lead="Group people by the part of the company they work in. Departments shape the org chart and reporting."
                    actions={(
                        <>
                            <Btn variant="ghost" icon={ArrowLeft} onClick={() => navigate('/admin/dashboard')}>Dashboard</Btn>
                            {hasAny && <Btn variant="primary" icon={Plus} onClick={openCreate}>New department</Btn>}
                        </>
                    )}
                />
            )}
        >
            {loading ? (
                <LoadingState label="Loading departments…" />
            ) : !hasAny ? (
                <>
                    <Panel>
                        <EmptyState icon={Building2} title="No departments yet"
                            text="Departments let you see who works where, and give managers a clear view of their people."
                            action={<Btn variant="primary" icon={Plus} onClick={openCreate}>Create your first department</Btn>} />
                    </Panel>
                    <Grid min={220}>
                        {IDEAS.map(({ Icon, title, text }) => (
                            <button key={title} type="button" className="gl-card gl-card--interactive tk-idea" onClick={openCreate}>
                                <span className="tk-mark" data-size="sm"><Icon size={14} /></span>
                                <strong>{title}</strong>
                                <span className="tk-idea-text">{text}</span>
                            </button>
                        ))}
                    </Grid>
                </>
            ) : (
                <>
                    <Toolbar>
                        <SearchBox value={query} onChange={setQuery} placeholder="Find a department" />
                        <span className="cd-hint">{departments.length} department{departments.length === 1 ? '' : 's'}</span>
                    </Toolbar>
                    <Panel flush>
                        {shown.length === 0 ? (
                            <EmptyState title="No departments match" text="Try a different name." />
                        ) : (
                            <ul className="tk-list">
                                {shown.map((dept) => (
                                    <li key={dept._id} className="tk-row">
                                        <button type="button" className="tk-row-main" onClick={() => navigate(`/admin/departments/${dept._id}`)}>
                                            <span className="tk-mark"><Building2 size={16} /></span>
                                            <span className="tk-row-text">
                                                <span className="tk-row-title">
                                                    {dept.name}
                                                    <Chip><Users size={11} />{memberCountOf(dept)}</Chip>
                                                    {dept.workspaceCount > 0 && <Chip>{dept.workspaceCount} workspace{dept.workspaceCount === 1 ? '' : 's'}</Chip>}
                                                </span>
                                                <span className="tk-row-sub">{dept.description || 'No description'}</span>
                                            </span>
                                            <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </button>
                                        <span className="tk-row-actions" data-reveal="true">
                                            <IconBtn label={`Edit ${dept.name}`} onClick={() => openEditModal(dept)}><Pencil size={14} /></IconBtn>
                                            <IconBtn label={`Delete ${dept.name}`} onClick={() => setConfirmDelete(dept)}><Trash2 size={14} /></IconBtn>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </>
            )}

            <Dialog
                open={formOpen}
                title={showEditModal ? 'Edit department' : 'New department'}
                lead={showEditModal ? undefined : 'You can add people to it afterwards.'}
                onClose={closeForm}
                busy={submitting}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={closeForm} disabled={submitting}>Cancel</Btn>
                        <Btn variant="primary" type="submit" form="department-form" loading={submitting}>
                            {showEditModal ? 'Save changes' : 'Create department'}
                        </Btn>
                    </>
                )}
            >
                <form id="department-form" onSubmit={showEditModal ? handleEdit : handleCreate} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Field label="Name" htmlFor="dept-name" error={nameError}>
                        <input id="dept-name" className="gl-input" value={formData.name}
                            onChange={(e) => { setNameError(null); setFormData({ ...formData, name: e.target.value }); }}
                            placeholder="Engineering, Design, Marketing…" required />
                    </Field>
                    <Field label="Description" hint="Optional" htmlFor="dept-desc">
                        <textarea id="dept-desc" className="gl-input" rows={3} value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What this department does" />
                    </Field>
                </form>
            </Dialog>

            <Confirm
                open={Boolean(confirmDelete)}
                title={`Delete “${confirmDelete?.name}”?`}
                confirmLabel="Delete department"
                tone="danger"
                busy={deleting}
                onConfirm={handleDelete}
                onClose={() => setConfirmDelete(null)}
            >
                The department is removed for everyone. People in it keep their accounts. This can’t be undone.
            </Confirm>
        </DashPage>
    );
};

export default DepartmentManagement;
