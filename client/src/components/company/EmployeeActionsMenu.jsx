import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, UserX, UserCheck, Trash2, Building, Award } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { isOwnerUser, idOf } from '../company-dash/dashNav';
import { Dialog, Confirm, Btn, IconBtn, Field, errorMessage } from '../company-dash/dashUi';
import '../../pages/admin/admin.css';

/**
 * Row actions for a person in the People table.
 * Role ceiling (mirrors the server): owners/co-owners may act on anyone but
 * owners; admins only on managers, members and guests, and may not grant admin.
 * Nobody acts on themselves here.
 */
const EmployeeActionsMenu = ({ employee, departments = [], onUpdate, viewerRole = 'member' }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({});
    const [dialog, setDialog] = useState(null); // 'suspend' | 'remove' | 'departments' | 'role'
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState('');
    const [deptIds, setDeptIds] = useState([]);
    const [role, setRole] = useState(employee.companyRole);
    const [managed, setManaged] = useState([]);
    const btnRef = useRef(null);

    const viewerIsOwner = viewerRole === 'owner' || isOwnerUser(user);
    const viewerIsAdmin = viewerIsOwner || viewerRole === 'admin';
    const isSelf = idOf(user?._id || user?.id) === idOf(employee._id);
    const targetIsPrivileged = ['owner', 'admin'].includes(employee.companyRole);
    const canActOn = viewerIsAdmin && !isSelf && employee.companyRole !== 'owner' && (viewerIsOwner || !targetIsPrivileged);

    const status = employee.accountStatus || 'active';
    const canSuspend = canActOn && status === 'active';
    const canActivate = canActOn && status === 'suspended';
    const canRemove = canActOn && status !== 'removed';

    useEffect(() => {
        if (!open) return undefined;
        const close = () => setOpen(false);
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        document.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!canActOn) return null;

    const toggle = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
            const up = window.innerHeight - r.bottom < 240;
            setPos({ right: Math.max(8, window.innerWidth - r.right), top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined });
        }
        setOpen((o) => !o);
    };

    const openDialog = (name) => {
        setOpen(false);
        if (name === 'departments') setDeptIds((employee.departments || []).map(idOf));
        if (name === 'role') { setRole(employee.companyRole); setManaged((employee.managedDepartments || []).map(idOf)); }
        if (name === 'suspend') setReason('');
        setDialog(name);
    };

    const run = async (fn, success) => {
        setBusy(true);
        try {
            await fn();
            showToast(success, 'success');
            setDialog(null);
            onUpdate?.();
        } catch (err) {
            showToast(errorMessage(err, 'That did not work'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleIn = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    const name = employee.username || employee.email;

    return (
        <>
            <span ref={btnRef} style={{ display: 'inline-flex' }}>
                <IconBtn label={`Actions for ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
                    <MoreVertical size={16} />
                </IconBtn>
            </span>

            {open && createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1099 }} onClick={() => setOpen(false)} aria-hidden="true" />
                    <div className="ad-menu" role="menu" style={pos}>
                        {canActivate && (
                            <button type="button" role="menuitem" data-tone="success" onClick={() => { setOpen(false); run(() => api.put(`/api/admin/employees/${employee._id}/activate`), `${name} reactivated`); }}>
                                <UserCheck size={14} /> Reactivate
                            </button>
                        )}
                        <button type="button" role="menuitem" onClick={() => openDialog('departments')}>
                            <Building size={14} /> Departments…
                        </button>
                        <button type="button" role="menuitem" onClick={() => openDialog('role')}>
                            <Award size={14} /> Change role…
                        </button>
                        {(canSuspend || canRemove) && <hr />}
                        {canSuspend && (
                            <button type="button" role="menuitem" data-tone="danger" onClick={() => openDialog('suspend')}>
                                <UserX size={14} /> Suspend…
                            </button>
                        )}
                        {canRemove && (
                            <button type="button" role="menuitem" data-tone="danger" onClick={() => openDialog('remove')}>
                                <Trash2 size={14} /> Remove from company…
                            </button>
                        )}
                    </div>
                </>,
                document.body,
            )}

            <Dialog
                open={dialog === 'suspend'}
                title={`Suspend ${name}?`}
                lead="They are signed out and can't sign in until reactivated."
                onClose={() => setDialog(null)}
                busy={busy}
                size="sm"
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setDialog(null)} disabled={busy}>Cancel</Btn>
                        <Btn variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => run(() => api.put(`/api/admin/employees/${employee._id}/suspend`, { reason: reason.trim() }), `${name} suspended`)}>Suspend</Btn>
                    </>
                )}
            >
                <Field label="Reason (recorded in the audit log)" htmlFor="ad-suspend-reason">
                    <textarea id="ad-suspend-reason" className="gl-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Left the company, security review…" />
                </Field>
            </Dialog>

            <Confirm
                open={dialog === 'remove'}
                title={`Remove ${name}?`}
                tone="danger"
                confirmLabel="Remove"
                busy={busy}
                onClose={() => setDialog(null)}
                onConfirm={() => run(() => api.delete(`/api/admin/employees/${employee._id}`), `${name} removed`)}
            >
                They lose access to every company workspace. Their messages and files stay for compliance.
            </Confirm>

            <Dialog
                open={dialog === 'departments'}
                title="Departments"
                lead={`Choose the departments ${name} belongs to.`}
                onClose={() => setDialog(null)}
                busy={busy}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setDialog(null)} disabled={busy}>Cancel</Btn>
                        <Btn variant="primary" loading={busy} onClick={() => run(() => api.put(`/api/admin/employees/${employee._id}/assign-department`, { departmentIds: deptIds }), 'Departments updated')}>Save</Btn>
                    </>
                )}
            >
                {departments.length === 0 ? <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>No departments exist yet.</p> : (
                    <div className="ad-checklist">
                        {departments.map((d) => (
                            <label key={d._id} className="ad-check">
                                <input type="checkbox" checked={deptIds.includes(idOf(d._id))} onChange={() => toggleIn(deptIds, setDeptIds, idOf(d._id))} />
                                {d.name}
                            </label>
                        ))}
                    </div>
                )}
            </Dialog>

            <Dialog
                open={dialog === 'role'}
                title="Change role"
                lead={`Company role for ${name}.`}
                onClose={() => setDialog(null)}
                busy={busy}
                footer={(
                    <>
                        <Btn variant="ghost" onClick={() => setDialog(null)} disabled={busy}>Cancel</Btn>
                        <Btn
                            variant="primary"
                            loading={busy}
                            disabled={role === employee.companyRole || (role === 'manager' && managed.length === 0)}
                            onClick={() => run(() => api.put(`/api/admin/employees/${employee._id}/change-role`, { role, managedDepartments: role === 'manager' ? managed : [] }), 'Role updated')}
                        >
                            Update role
                        </Btn>
                    </>
                )}
            >
                <Field label="Role" htmlFor="ad-role">
                    <select id="ad-role" className="gl-input cd-select" value={role} onChange={(e) => setRole(e.target.value)}>
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        <option value="guest">Guest</option>
                        {viewerIsOwner && <option value="admin">Admin</option>}
                    </select>
                </Field>
                {!viewerIsOwner && <p className="cd-hint" style={{ margin: 0 }}>Only the company owner can grant the admin role.</p>}
                {role === 'manager' && (
                    <Field label="Manages" hint="A manager needs at least one department.">
                        {departments.length === 0 ? <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>Create a department first.</p> : (
                            <div className="ad-checklist">
                                {departments.map((d) => (
                                    <label key={d._id} className="ad-check">
                                        <input type="checkbox" checked={managed.includes(idOf(d._id))} onChange={() => toggleIn(managed, setManaged, idOf(d._id))} />
                                        {d.name}
                                    </label>
                                ))}
                            </div>
                        )}
                    </Field>
                )}
            </Dialog>
        </>
    );
};

export default EmployeeActionsMenu;
