import React, { useState, useEffect } from 'react';
import {
    User, Mail, Briefcase, Calendar,
    Check, ChevronDown, Smartphone, CheckCircle2, X, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@services/api';
import { useCompany } from '../../../contexts/CompanyContext';
import { getDepartments } from '../../../services/departmentService';

// ─── Shared input style ────────────────────────────────────────────────────────
const inputBase = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px',
    transition: 'border-color 150ms ease',
};

const OnboardingWizard = ({ onComplete }) => {
    const { company } = useCompany();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [workspacesByDept, setWorkspacesByDept] = useState({});

    const [formData, setFormData] = useState({
        firstName: '', lastName: '', personalEmail: '',
        phone: '', countryCode: '+91', jobTitle: '', customJobTitle: '',
        joiningDate: new Date().toISOString().split('T')[0],
        employeeCategory: 'Full-time',
        companyEmail: '', role: 'member',
        managedDepartments: [], assignedDepartments: [], assignedWorkspaces: [],
        hardware: [], checklist: true
    });

    const commonJobTitles = [
        "Software Engineer", "Product Manager", "Designer", "Sales Representative",
        "HR Specialist", "Accountant", "Marketing Manager", "Customer Support", "Custom"
    ];
    const countryCodes = [
        { code: '+91', label: '🇮🇳 +91' }, { code: '+1', label: '🇺🇸 +1' },
        { code: '+44', label: '🇬🇧 +44' }, { code: '+61', label: '🇦🇺 +61' },
        { code: '+81', label: '🇯🇵 +81' }, { code: '+49', label: '🇩🇪 +49' },
    ];

    useEffect(() => {
        if (company?._id) {
            getDepartments(company._id)
                .then(res => setDepartments(res.departments || []))
                .catch(() => setDepartments([]));
        }
    }, [company?._id]);

    useEffect(() => {
        const fetchWorkspaces = async () => {
            if (step === 2 && formData.assignedDepartments.length > 0) {
                const fetchPromises = formData.assignedDepartments.map(async (deptId) => {
                    if (!workspacesByDept[deptId]) {
                        try {
                            const res = await api.get(`/api/admin/departments/${deptId}/workspaces`);
                            return { deptId, workspaces: res.data || [] };
                        } catch {
                            return { deptId, workspaces: [] };
                        }
                    }
                    return null;
                });
                const results = await Promise.all(fetchPromises);
                const updates = {};
                results.forEach(r => { if (r) updates[r.deptId] = r.workspaces; });
                if (Object.keys(updates).length > 0)
                    setWorkspacesByDept(prev => ({ ...prev, ...updates }));
            }
        };
        fetchWorkspaces();
    }, [step, formData.assignedDepartments]);

    const set = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const toggle = (field, id) => setFormData(p => {
        const list = p[field] || [];
        return { ...p, [field]: list.includes(id) ? list.filter(i => i !== id) : [...list, id] };
    });

    const validateStep = () => {
        if (step === 1) return formData.firstName && formData.lastName && formData.personalEmail && formData.jobTitle;
        if (step === 2) {
            if (!formData.companyEmail) return false;
            if (departments.length > 0 && formData.assignedDepartments.length === 0) return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateStep()) return;
        setLoading(true);
        try {
            await api.post('/api/admin/onboard-employee', {
                ...formData,
                companyEmail: `${formData.companyEmail}@${company?.domain}`,
                phone: `${formData.countryCode} ${formData.phone}`,
                jobTitle: formData.jobTitle === 'Custom' ? formData.customJobTitle : formData.jobTitle,
                departments: formData.assignedDepartments,
                workspaces: formData.assignedWorkspaces
            });
            toast.success('Employee onboarded successfully!');
            onComplete();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to onboard employee');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { num: 1, label: 'Basic Info' },
        { num: 2, label: 'Company & Role' },
        { num: 3, label: 'Assignment' },
    ];

    return (
        <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            width: '100%', maxWidth: '860px', height: '90vh', maxHeight: '640px',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif', position: 'relative',
        }}>
            {/* Accent top bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
                marginTop: '2px', flexShrink: 0,
            }}>
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        Onboard New Employee
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure profile, access, and permissions.</p>
                </div>
                <button onClick={onComplete} style={{ padding: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', transition: 'color 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Steps Sidebar */}
                <div style={{
                    width: '200px', background: 'var(--bg-active)', borderRight: '1px solid var(--border-subtle)',
                    padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0,
                }}>
                    {steps.map((s, idx) => {
                        const active = step === s.num;
                        const done = step > s.num;
                        return (
                            <div key={s.num} style={{ position: 'relative' }}>
                                {idx < steps.length - 1 && (
                                    <div style={{
                                        position: 'absolute', left: '15px', top: '32px',
                                        width: '1px', height: '24px',
                                        background: done ? 'var(--accent)' : 'var(--border-accent)',
                                        zIndex: 0,
                                    }} />
                                )}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '7px 8px',
                                    borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                                    background: active ? 'var(--bg-surface)' : 'transparent',
                                    transition: 'all 150ms ease',
                                    position: 'relative', zIndex: 1,
                                }}>
                                    <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px', fontWeight: 700,
                                        background: done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--bg-surface)',
                                        color: (done || active) ? 'var(--bg-base)' : 'var(--text-muted)',
                                        border: `1px solid ${(done || active) ? 'var(--accent)' : 'var(--border-accent)'}`,
                                        transition: 'all 150ms ease',
                                    }}>
                                        {done ? <Check size={12} strokeWidth={3} /> : s.num}
                                    </div>
                                    <span style={{
                                        fontSize: '13px', fontWeight: active ? 600 : 400,
                                        color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-muted)',
                                        transition: 'color 150ms ease',
                                    }}>{s.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Form Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }} className="custom-scrollbar">

                    {/* Step 1 — Basic Info */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <WField label="First Name *" icon={<User size={13} />}>
                                    <input style={inputBase} value={formData.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" />
                                </WField>
                                <WField label="Last Name *" icon={<User size={13} />}>
                                    <input style={inputBase} value={formData.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Doe" />
                                </WField>
                            </div>

                            <WField label="Personal Email *" icon={<Mail size={13} />}>
                                <input style={inputBase} type="email" value={formData.personalEmail} onChange={e => set('personalEmail', e.target.value)} placeholder="jane.doe@gmail.com" />
                            </WField>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <WField label="Job Title *" icon={<Briefcase size={13} />}>
                                    <div style={{ position: 'relative' }}>
                                        <select style={{ ...inputBase, paddingRight: '28px', appearance: 'none', cursor: 'pointer' }}
                                            value={formData.jobTitle} onChange={e => set('jobTitle', e.target.value)}>
                                            <option value="">Select...</option>
                                            {commonJobTitles.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                        <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    </div>
                                </WField>
                                <WField label="Joining Date" icon={<Calendar size={13} />}>
                                    <input style={inputBase} type="date" value={formData.joiningDate} onChange={e => set('joiningDate', e.target.value)} />
                                </WField>
                            </div>

                            {formData.jobTitle === 'Custom' && (
                                <WField label="Custom Title">
                                    <input style={inputBase} value={formData.customJobTitle} onChange={e => set('customJobTitle', e.target.value)} placeholder="Specific role name" autoFocus />
                                </WField>
                            )}

                            <WField label="Mobile Number" icon={<Smartphone size={13} />}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ position: 'relative', width: '110px', flexShrink: 0 }}>
                                        <select style={{ ...inputBase, paddingRight: '24px', appearance: 'none', cursor: 'pointer', width: '100%' }}
                                            value={formData.countryCode} onChange={e => set('countryCode', e.target.value)}>
                                            {countryCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                        </select>
                                        <ChevronDown size={11} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    </div>
                                    <input style={{ ...inputBase, flex: 1 }} value={formData.phone} onChange={e => set('phone', e.target.value)} placeholder="98765 43210" />
                                </div>
                            </WField>
                        </div>
                    )}

                    {/* Step 2 — Company & Role */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}>
                            {/* Corporate Email */}
                            <div style={{ padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Corporate Identity
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ position: 'relative' }}>
                                            <Mail size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                            <input style={{ ...inputBase, paddingLeft: '30px' }} value={formData.companyEmail} onChange={e => set('companyEmail', e.target.value)} placeholder="jane.doe" />
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>@{company?.domain}</span>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>System Role</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                    {['member', 'manager', 'admin', 'guest'].map(r => {
                                        const active = formData.role === r;
                                        return (
                                            <button key={r} onClick={() => set('role', r)}
                                                style={{
                                                    padding: '8px', background: active ? 'var(--accent)' : 'var(--bg-active)',
                                                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                                                    color: active ? 'var(--bg-base)' : 'var(--text-secondary)',
                                                    fontSize: '12px', fontWeight: active ? 700 : 400,
                                                    textTransform: 'capitalize', cursor: 'pointer',
                                                    borderRadius: '2px', transition: 'all 150ms ease',
                                                }}>
                                                {r}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Departments */}
                            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Department Access</label>
                                {departments.length === 0 ? (
                                    <div style={{ padding: '20px', background: 'var(--bg-active)', border: '1px dashed var(--border-accent)', textAlign: 'center' }}>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No departments found. Can be assigned later.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }} className="custom-scrollbar">
                                        {departments.map(dept => {
                                            const isSel = formData.assignedDepartments.includes(dept._id);
                                            return (
                                                <div key={dept._id} style={{ border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border-subtle)'}`, background: isSel ? 'rgba(184,149,106,0.05)' : 'var(--bg-active)', overflow: 'hidden', transition: 'all 150ms ease' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={isSel} onChange={() => toggle('assignedDepartments', dept._id)}
                                                            style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '13px', fontWeight: 500, color: isSel ? 'var(--accent)' : 'var(--text-primary)' }}>{dept.name}</span>
                                                    </label>
                                                    {isSel && workspacesByDept[dept._id] && (
                                                        <div style={{ paddingLeft: '36px', paddingBottom: '10px', paddingRight: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {workspacesByDept[dept._id].length > 0 ? workspacesByDept[dept._id].map(ws => (
                                                                <label key={ws._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                                    <input type="checkbox" checked={formData.assignedWorkspaces.includes(ws._id)} onChange={() => toggle('assignedWorkspaces', ws._id)}
                                                                        style={{ width: '12px', height: '12px', accentColor: 'var(--accent)', flexShrink: 0 }} />
                                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ws.name}</span>
                                                                </label>
                                                            )) : (
                                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No workspaces</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3 — Review */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: '20px', maxWidth: '420px', margin: '0 auto' }}>
                            <div style={{ width: '64px', height: '64px', background: 'var(--bg-active)', border: '1px solid var(--state-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle2 size={28} style={{ color: 'var(--state-success)' }} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Ready to Launch!</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                    An invite will be sent to <strong style={{ color: 'var(--accent)' }}>{formData.personalEmail}</strong>
                                </p>
                            </div>
                            <div style={{ width: '100%', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
                                {[
                                    { label: 'Name', value: `${formData.firstName} ${formData.lastName}` },
                                    { label: 'Role', value: formData.jobTitle === 'Custom' ? formData.customJobTitle : formData.jobTitle },
                                    { label: 'Email', value: `${formData.companyEmail}@${company?.domain}`, accent: true },
                                    { label: 'Access', value: `${formData.role} · ${formData.assignedDepartments.length} Dept(s)` },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}
                                        className="last-child-no-border">
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.label}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: row.accent ? 'var(--accent)' : 'var(--text-primary)' }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div style={{
                padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-surface)', flexShrink: 0,
            }}>
                <button onClick={() => setStep(p => p - 1)} disabled={step === 1}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                        background: 'none', border: '1px solid var(--border-default)',
                        color: step === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontSize: '12px', fontWeight: 600, cursor: step === 1 ? 'not-allowed' : 'pointer',
                        borderRadius: '2px', opacity: step === 1 ? 0 : 1, transition: 'all 150ms ease',
                    }}>
                    <ArrowLeft size={12} /> Back
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Step dots */}
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {steps.map(s => (
                            <div key={s.num} style={{ width: '6px', height: '6px', borderRadius: '50%', background: step >= s.num ? 'var(--accent)' : 'var(--border-accent)', transition: 'background 150ms ease' }} />
                        ))}
                    </div>
                    <button
                        onClick={step === 3 ? handleSubmit : () => setStep(s => s + 1)}
                        disabled={loading || !validateStep()}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px',
                            background: loading || !validateStep() ? 'var(--bg-active)' : 'var(--accent)',
                            border: 'none',
                            color: loading || !validateStep() ? 'var(--text-muted)' : 'var(--bg-base)',
                            fontSize: '12px', fontWeight: 700, cursor: loading || !validateStep() ? 'not-allowed' : 'pointer',
                            borderRadius: '2px', transition: 'all 150ms ease',
                        }}>
                        {loading ? 'Sending Invite...' : step === 3 ? 'Confirm & Invite' : 'Continue →'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Field wrapper
const WField = ({ label, icon, children }) => (
    <div>
        {label && (
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {label}
            </label>
        )}
        {icon ? (
            <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
                    {icon}
                </div>
                {React.cloneElement(children, { style: { ...children.props.style, paddingLeft: '30px' } })}
            </div>
        ) : children}
    </div>
);

export default OnboardingWizard;
