import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { isOwnerUser } from '../company-dash/dashNav';
import { Dialog, Btn, Field, errorMessage } from '../company-dash/dashUi';

/**
 * Invite one person by email (POST /api/companies/:id/invite).
 * Only owners/co-owners may invite an admin; owner is never offered.
 */
const InviteUserModal = ({ isOpen, onClose, companyId, departments = [], onInvited }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const owner = isOwnerUser(user);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');
    const [departmentId, setDepartmentId] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) { setEmail(''); setRole('member'); setDepartmentId(''); setJobTitle(''); setError(null); }
    }, [isOpen]);

    const submit = async (e) => {
        e?.preventDefault();
        if (!companyId) return;
        setBusy(true);
        setError(null);
        try {
            await api.post(`/api/companies/${companyId}/invite`, {
                email: email.trim(),
                role,
                departmentId: departmentId || null,
                jobTitle: jobTitle.trim() || undefined,
            });
            showToast(`Invitation sent to ${email.trim()}`, 'success');
            onInvited?.();
            onClose();
        } catch (err) {
            setError(errorMessage(err, 'Could not send the invitation'));
        } finally {
            setBusy(false);
        }
    };

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    return (
        <Dialog
            open={isOpen}
            title="Invite a person"
            lead="They get an email with a link to join the company."
            onClose={onClose}
            busy={busy}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
                    <Btn variant="primary" icon={Send} loading={busy} disabled={!valid} onClick={submit}>Send invite</Btn>
                </>
            )}
        >
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Work email" htmlFor="ad-invite-email" error={error}>
                    <input id="ad-invite-email" className="gl-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" />
                </Field>
                <div className="ad-row">
                    <Field label="Role" htmlFor="ad-invite-role" hint={owner ? undefined : 'Only the owner can invite admins.'}>
                        <select id="ad-invite-role" className="gl-input cd-select" value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                            <option value="guest">Guest</option>
                            {owner && <option value="admin">Admin</option>}
                        </select>
                    </Field>
                    <Field label="Department" htmlFor="ad-invite-dept">
                        <select id="ad-invite-dept" className="gl-input cd-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                            <option value="">None</option>
                            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label="Job title (optional)" htmlFor="ad-invite-title">
                    <input id="ad-invite-title" className="gl-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Product designer" />
                </Field>
                <button type="submit" hidden aria-hidden="true" />
            </form>
        </Dialog>
    );
};

export default InviteUserModal;
