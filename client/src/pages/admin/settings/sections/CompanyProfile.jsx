import React, { useEffect, useState } from 'react';
import { Building, Save, Info } from 'lucide-react';
import api from '@services/api';
import { useCompany } from '../../../../contexts/CompanyContext';
import { useToast } from '../../../../contexts/ToastContext';
import { Panel, Grid, Field, Btn, Chip, errorMessage } from '../../../../components/company-dash/dashUi';
import '../../../OwnerDashboard/owner.css';

const title = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '—');

/**
 * Company profile. Only fields the server stores are editable here
 * (PUT /api/companies/:id/settings/profile keeps `name` and `website`).
 */
const CompanyProfile = () => {
    const { company, refreshCompanyData, isCompanyAdmin } = useCompany();
    const { showToast } = useToast();
    const [form, setForm] = useState({ name: '', website: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (company) setForm({ name: company.name || '', website: company.website || '' });
    }, [company]);

    const dirty = !!company && (form.name !== (company.name || '') || form.website !== (company.website || ''));
    const canEdit = isCompanyAdmin();

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { showToast('Company name is required', 'error'); return; }
        setSaving(true);
        try {
            await api.put(`/api/companies/${company._id}/settings/profile`, { name: form.name.trim(), website: form.website.trim() });
            await refreshCompanyData?.();
            showToast('Company profile saved', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not save the profile'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const limits = company?.settings || {};

    return (
        <Grid cols="2">
            <Panel title="Profile" icon={Building}>
                <form className="od-form" onSubmit={save}>
                    <Field label="Company name" htmlFor="co-name">
                        <input id="co-name" className="gl-input" value={form.name} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                    </Field>
                    <Field label="Website" htmlFor="co-web" hint="Shown to people who join your company.">
                        <input id="co-web" className="gl-input" type="url" placeholder="https://example.com" value={form.website} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                    </Field>
                    {canEdit && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Btn variant="ghost" disabled={!dirty || saving} onClick={() => setForm({ name: company?.name || '', website: company?.website || '' })}>Discard</Btn>
                            <Btn type="submit" variant="primary" icon={Save} loading={saving} disabled={!dirty}>Save</Btn>
                        </div>
                    )}
                </form>
            </Panel>
            <Panel title="Account" icon={Info}>
                <div className="od-kv">
                    <div className="od-kv-row"><span>Verification</span><span><Chip tone={company?.verificationStatus === 'verified' ? 'success' : 'warning'}>{title(company?.verificationStatus)}</Chip></span></div>
                    <div className="od-kv-row"><span>Plan</span><span>{title(company?.plan)}</span></div>
                    <div className="od-kv-row"><span>Email domain</span><span>{company?.domain ? `@${company.domain}` : 'Not set'}</span></div>
                    <div className="od-kv-row"><span>Seat limit</span><span>{limits.maxUsers ?? '—'}</span></div>
                    <div className="od-kv-row"><span>Workspace limit</span><span>{limits.maxWorkspaces ?? '—'}</span></div>
                    <div className="od-kv-row"><span>Data retention</span><span>{limits.dataRetentionDays ? `${limits.dataRetentionDays} days` : '—'}</span></div>
                    <div className="od-kv-row"><span>Created</span><span>{company?.createdAt ? new Date(company.createdAt).toLocaleDateString() : '—'}</span></div>
                </div>
            </Panel>
        </Grid>
    );
};

export default CompanyProfile;
