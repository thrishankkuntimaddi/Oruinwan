import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { isOwnerUser } from '../company-dash/dashNav';
import { Dialog, Btn, Field, errorMessage } from '../company-dash/dashUi';

/**
 * Invite one person (POST /api/company/onboarding/individual): the same flow as the Onboard
 * page, so the person shows up as pending in People, Onboard and the dashboard, and the invite
 * can be re-sent from there. Only owners/co-owners may invite an admin; owner is never offered.
 */
const InviteUserModal = ({ isOpen, onClose, companyId, departments = [], onInvited }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { company } = useCompany() || {};
    const companyWs = company?.defaultWorkspace?._id || company?.defaultWorkspace || null;
    const owner = isOwnerUser(user);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');
    const [departmentId, setDepartmentId] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) { setName(''); setEmail(''); setRole('member'); setDepartmentId(''); setJobTitle(''); setError(null); }
    }, [isOpen]);

    const submit = async (e) => {
        e?.preventDefault();
        if (!companyId) return;
        setBusy(true);
        setError(null);
        try {
            const [firstName, ...rest] = name.trim().split(/\s+/);
            await api.post('/api/company/onboarding/individual', {
                email: email.trim(),
                firstName,
                lastName: rest.join(' '),
                companyRole: role,
                departmentIds: departmentId ? [departmentId] : [],
                // They join the company-wide workspace, like everyone invited at setup.
                additionalWorkspaceIds: companyWs ? [String(companyWs)] : [],
                jobTitle: jobTitle.trim() || undefined,
            });
            showToast(`Invitation sent to ${email.trim()}`, 'success');
            onInvited?.();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.errors?.[0]?.message || errorMessage(err, 'Could not send the invitation'));
        } finally {
            setBusy(false);
        }
    };

    const valid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
                <Field label="Full name" htmlFor="ad-invite-name">
                    <input id="ad-invite-name" className="gl-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marcus Lee" autoComplete="off" />
                </Field>
                <Field label="Work email" htmlFor="ad-invite-email" error={error}>
                    <input id="ad-invite-email" className="gl-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />
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
