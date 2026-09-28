import React, { useEffect, useState } from 'react';
import { createDepartment, updateDepartment } from '../../services/departmentService';
import { Dialog, Btn, Field, errorMessage } from '../company-dash/dashUi';

/** Create or rename a department. */
const DepartmentModal = ({ isOpen, onClose, companyId, department, onSuccess }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setName(department?.name || '');
        setDescription(department?.description || '');
        setError(null);
    }, [isOpen, department]);

    const submit = async (e) => {
        e?.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        try {
            if (department) await updateDepartment(department._id, { name: name.trim(), description: description.trim() });
            else await createDepartment(companyId, name.trim(), description.trim());
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the department'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            title={department ? 'Edit department' : 'New department'}
            lead={department ? undefined : 'Departments group people and give managers a scope.'}
            onClose={onClose}
            busy={busy}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
                    <Btn variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>{department ? 'Save' : 'Create'}</Btn>
                </>
            )}
        >
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Name" htmlFor="ad-dept-name" error={error}>
                    <input id="ad-dept-name" className="gl-input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" required />
                </Field>
                <Field label="Description (optional)" htmlFor="ad-dept-desc">
                    <textarea id="ad-dept-desc" className="gl-input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="What this department does" />
                </Field>
                <button type="submit" hidden aria-hidden="true" />
            </form>
        </Dialog>
    );
};

export default DepartmentModal;
