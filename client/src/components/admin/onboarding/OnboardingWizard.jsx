import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Send, Check } from 'lucide-react';
import api from '@services/api';
import { useCompany } from '../../../contexts/CompanyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { getDepartments } from '../../../services/departmentService';
import { isOwnerUser } from '../../company-dash/dashNav';
import { Dialog, Btn, Field, FilterTabs, errorMessage } from '../../company-dash/dashUi';
import '../../../pages/admin/admin.css';

const JOB_TITLES = ['Software Engineer', 'Product Manager', 'Designer', 'Sales Representative', 'HR Specialist', 'Accountant', 'Marketing Manager', 'Customer Support'];
const STEPS = ['Person', 'Access', 'Review'];
const EMPTY = {
    firstName: '', lastName: '', personalEmail: '', jobTitle: '', customJobTitle: '',
    joiningDate: new Date().toISOString().split('T')[0], workLocal: '', workEmail: '',
    role: 'member', departmentIds: [], workspaceIds: [],
};

/**
 * Invite one employee (POST /api/company/onboarding/individual). The account is
 * created as "invited" and the person sets their own password from the email.
 * Rendered as a glass dialog: <OnboardingWizard open onClose onComplete />.
 */
const OnboardingWizard = ({ open = true, onClose, onComplete }) => {
    const { company } = useCompany();
    const { user } = useAuth();
    const { showToast } = useToast();
    const owner = isOwnerUser(user);
    const domain = (company?.domain || '').replace(/^@/, '');
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(EMPTY);
    const [departments, setDepartments] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setStep(0); setForm(EMPTY); setError(null);
        if (company?._id) getDepartments(company._id).then((r) => setDepartments(r.departments || [])).catch(() => setDepartments([]));
        api.get('/api/admin-dashboard/workspaces').then((r) => setWorkspaces((r.data.workspaces || []).filter((w) => w.status !== 'archived'))).catch(() => setWorkspaces([]));
    }, [open, company?._id]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggle = (k, id) => setForm((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }));
    const email = domain ? (form.workLocal.trim() ? `${form.workLocal.trim().toLowerCase()}@${domain}` : '') : form.workEmail.trim().toLowerCase();
    const title = form.jobTitle === 'Custom' ? form.customJobTitle.trim() : form.jobTitle;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const stepValid = useMemo(() => [
        !!(form.firstName.trim() && title),
        emailOk && !(form.role === 'admin' && !owner),
        true,
    ], [form, title, emailOk, owner]);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await api.post('/api/company/onboarding/individual', {
                email,
                personalEmail: form.personalEmail.trim() || undefined,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                companyRole: form.role,
                departmentIds: form.departmentIds,
                additionalWorkspaceIds: form.workspaceIds,
                jobTitle: title,
                joiningDate: form.joiningDate || undefined,
            });
            showToast(`Invite sent to ${email}`, 'success');
            onComplete?.();
        } catch (err) {
            const d = err?.response?.data;
            setError(d?.errors?.map((e) => e.message).join(', ') || errorMessage(err, 'Could not onboard this person'));
        } finally {
            setBusy(false);
        }
    };

    const close = onClose || onComplete;
    const summary = [
        ['Name', `${form.firstName} ${form.lastName}`.trim()],
        ['Job title', title || '—'],
        ['Work email', email || '—'],
        ['Role', form.role],
        ['Departments', form.departmentIds.map((id) => departments.find((d) => d._id === id)?.name).filter(Boolean).join(', ') || 'None'],
        ['Workspaces', form.workspaceIds.map((id) => workspaces.find((w) => w._id === id)?.name).filter(Boolean).join(', ') || 'Default only'],
        ['Joining', form.joiningDate || '—'],
    ];

    return (
        <Dialog
            open={open}
            size="lg"
            title="Onboard an employee"
            lead="They get an email invite and set their own password."
            onClose={close}
            busy={busy}
            footer={(
                <>
                    {step > 0 && <Btn variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} disabled={busy}>Back</Btn>}
                    <span style={{ flex: 1 }} />
                    {step < 2
                        ? <Btn variant="primary" onClick={() => setStep((s) => s + 1)} disabled={!stepValid[step]}>Continue <ArrowRight size={13} /></Btn>
                        : <Btn variant="primary" icon={Send} loading={busy} onClick={submit}>Send invite</Btn>}
                </>
            )}
        >
            <div className="ad-steps" aria-label="Steps">
                {STEPS.map((s, i) => (
                    <span key={s} className="ad-step" data-state={i === step ? 'current' : i < step ? 'done' : undefined} aria-current={i === step ? 'step' : undefined}>
                        {i < step ? <Check size={12} /> : <span className="ad-step-num">{i + 1}</span>} {s}
                    </span>
                ))}
            </div>

            {step === 0 && (
                <>
                    <div className="ad-row">
                        <Field label="First name *" htmlFor="ow-first"><input id="ow-first" className="gl-input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" /></Field>
                        <Field label="Last name" htmlFor="ow-last"><input id="ow-last" className="gl-input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Doe" /></Field>
                    </div>
                    <div className="ad-row">
                        <Field label="Job title *" htmlFor="ow-title">
                            <select id="ow-title" className="gl-input cd-select" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)}>
                                <option value="">Select…</option>
                                {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                                <option value="Custom">Other…</option>
                            </select>
                        </Field>
                        <Field label="Joining date" htmlFor="ow-join"><input id="ow-join" type="date" className="gl-input" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} /></Field>
                    </div>
                    {form.jobTitle === 'Custom' && (
                        <Field label="Custom title" htmlFor="ow-custom"><input id="ow-custom" className="gl-input" value={form.customJobTitle} onChange={(e) => set('customJobTitle', e.target.value)} /></Field>
                    )}
                    <Field label="Personal email (optional)" htmlFor="ow-personal" hint="Kept on the profile for recovery.">
                        <input id="ow-personal" type="email" className="gl-input" value={form.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} placeholder="jane@gmail.com" />
                    </Field>
                </>
            )}

            {step === 1 && (
                <>
                    {domain ? (
                        <Field label="Work email *" htmlFor="ow-local" hint="The invite goes to this address; it becomes their sign-in.">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input id="ow-local" className="gl-input" style={{ flex: 1 }} value={form.workLocal} onChange={(e) => set('workLocal', e.target.value.replace(/@.*/, ''))} placeholder="jane.doe" />
                                <span className="cd-muted" style={{ fontSize: 13 }}>@{domain}</span>
                            </div>
                        </Field>
                    ) : (
                        <Field label="Work email *" htmlFor="ow-email" hint="The invite goes to this address; it becomes their sign-in.">
                            <input id="ow-email" type="email" className="gl-input" value={form.workEmail} onChange={(e) => set('workEmail', e.target.value)} placeholder="jane@company.com" />
                        </Field>
                    )}
                    <Field label="Company role" hint={owner ? undefined : 'Only the owner can onboard admins.'}>
                        <FilterTabs
                            value={form.role}
                            onChange={(v) => set('role', v)}
                            label="Company role"
                            options={[{ value: 'member', label: 'Member' }, { value: 'manager', label: 'Manager' }, { value: 'guest', label: 'Guest' }, ...(owner ? [{ value: 'admin', label: 'Admin' }] : [])]}
                        />
                    </Field>
                    <Field label="Departments">
                        {departments.length === 0 ? <p className="cd-hint" style={{ margin: 0 }}>No departments yet — you can assign later.</p> : (
                            <div className="ad-checklist">
                                {departments.map((d) => (
                                    <label key={d._id} className="ad-check">
                                        <input type="checkbox" checked={form.departmentIds.includes(d._id)} onChange={() => toggle('departmentIds', d._id)} />
                                        {d.name}
                                        <span className="ad-check-sub">{d.members?.length || 0} people</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </Field>
                    <Field label="Additional workspaces">
                        {workspaces.length === 0 ? <p className="cd-hint" style={{ margin: 0 }}>No workspaces available.</p> : (
                            <div className="ad-checklist">
                                {workspaces.map((w) => (
                                    <label key={w._id} className="ad-check">
                                        <input type="checkbox" checked={form.workspaceIds.includes(w._id)} onChange={() => toggle('workspaceIds', w._id)} />
                                        {w.name}
                                        <span className="ad-check-sub">{w.memberCount ?? 0} members</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </Field>
                </>
            )}

            {step === 2 && (
                <>
                    <dl className="ad-kv" style={{ margin: 0 }}>
                        {summary.map(([k, v]) => (
                            <React.Fragment key={k}><dt>{k}</dt><dd style={{ textTransform: k === 'Role' ? 'capitalize' : undefined }}>{v}</dd></React.Fragment>
                        ))}
                    </dl>
                    {error && <div className="cd-error-text" role="alert">{error}</div>}
                </>
            )}
        </Dialog>
    );
};

export default OnboardingWizard;
