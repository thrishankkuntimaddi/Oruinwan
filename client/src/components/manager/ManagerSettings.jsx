import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound, Building, Settings, ArrowUpRight } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Panel, Grid, Btn, Field, SelectBox, Avatar, RoleChip, Chip, errorMessage,
} from '../company-dash/dashUi';
import { useDepartment } from './managerScope';

/** Manager console settings: display name, which department opens first, and links. */
export default function ManagerSettings() {
    const { user, setUser } = useAuth();
    const { company } = useCompany();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { departments = [], department, selectDepartment, departmentsLoading } = useDepartment();
    const [name, setName] = useState(user?.username || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => { setName(user?.username || ''); }, [user?.username]);
    const dirty = name.trim() !== (user?.username || '');

    const save = async (e) => {
        e?.preventDefault();
        const next = name.trim();
        if (next.length < 2 || next.length > 50) { setError('Name must be between 2 and 50 characters'); return; }
        setSaving(true);
        setError(null);
        try {
            await api.put('/api/auth/me', { username: next });
            setUser?.((u) => (u ? { ...u, username: next } : u));
            showToast('Name updated', 'success');
        } catch (err) {
            setError(errorMessage(err, 'Could not save your name'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashPage
            head={<PageHead eyebrow="Manager console" title="Settings" lead="Your profile and how the manager console opens." />}
        >
            <Grid cols="2">
                <Panel title="Profile" icon={UserRound}>
                    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="cd-cell-user">
                            <Avatar user={user} size="lg" />
                            <div>
                                <div className="cd-cell-title">{user?.username}</div>
                                <div className="cd-cell-sub" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                                    <RoleChip role={user?.companyRole} /> {company?.name}
                                </div>
                            </div>
                        </div>
                        <Field label="Display name" htmlFor="mg-name" error={error}>
                            <input id="mg-name" className="gl-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
                        </Field>
                        <Field label="Email" htmlFor="mg-email" hint="Your work email is managed by your company admin.">
                            <input id="mg-email" className="gl-input" value={user?.email || ''} disabled readOnly />
                        </Field>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {dirty && <Btn variant="ghost" onClick={() => { setName(user?.username || ''); setError(null); }} disabled={saving}>Discard</Btn>}
                            <Btn type="submit" variant="primary" loading={saving} disabled={!dirty}>Save</Btn>
                        </div>
                    </form>
                </Panel>

                <Panel title="Departments" icon={Building}>
                    {departmentsLoading ? (
                        <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>Loading…</p>
                    ) : departments.length === 0 ? (
                        <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>You don't manage a department yet. A company admin can assign you from Departments.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {departments.map((d) => <Chip key={d._id} tone={d._id === department?._id ? 'accent' : undefined}>{d.name}</Chip>)}
                            </div>
                            {departments.length > 1 && (
                                <Field label="Open the console on" hint="Saved on this device. You can also switch from the top bar.">
                                    <SelectBox value={department?._id || ''} onChange={(v) => { selectDepartment?.(v); showToast('Default department saved', 'success'); }} label="Default department">
                                        {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </SelectBox>
                                </Field>
                            )}
                        </div>
                    )}
                </Panel>

                <Panel title="More settings" icon={Settings}>
                    <p className="cd-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                        Password, notifications, appearance and sessions live in your account settings.
                    </p>
                    <Btn icon={ArrowUpRight} onClick={() => navigate('/settings')}>Account settings</Btn>
                </Panel>
            </Grid>
        </DashPage>
    );
}
