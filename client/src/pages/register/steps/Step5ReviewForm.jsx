import React from 'react';
import { Building, User, ShieldCheck, FileText, Edit3 } from 'lucide-react';

const ReviewCard = ({ icon: Icon, title, step, onEdit, children }) => (
    <div onClick={() => onEdit(step)}
        style={{ background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', cursor: 'pointer', transition: 'border-color 200ms ease', position: 'relative' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(184,149,106,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={13} style={{ color: '#b8956a' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#b8956a', fontWeight: 600 }}>
                <Edit3 size={11} />Edit
            </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {children}
        </div>
    </div>
);

const Field = ({ label, value }) => (
    <div>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{label}</span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{value || '—'}</span>
    </div>
);

const Step5ReviewForm = ({ formData, onEdit, theme }) => (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '28px' }}>
            Verify your information before submitting.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <ReviewCard icon={Building} title="Organization" step={1} onEdit={onEdit}>
                <Field label="Name" value={formData.companyName} />
                <Field label="Domain" value={formData.companyDomain} />
            </ReviewCard>

            <ReviewCard icon={User} title="Admin" step={2} onEdit={onEdit}>
                <Field label="Name" value={formData.adminName} />
                <Field label="Role" value={formData.role === 'Other' ? formData.roleOther : formData.role} />
                <Field label="Contact" value={`${formData.personalEmail} · ${formData.phoneCode} ${formData.phone}`} />
            </ReviewCard>

            <ReviewCard icon={ShieldCheck} title="Account" step={3} onEdit={onEdit}>
                <Field label="Company Email" value={formData.companyEmail} />
                <Field label="Password" value="••••••••" />
            </ReviewCard>

            <ReviewCard icon={FileText} title="Documents" step={4} onEdit={onEdit}>
                <Field label="File" value={formData.documents?.name} />
                {formData.documents && (
                    <Field label="Size" value={`${(formData.documents.size / 1024 / 1024).toFixed(2)} MB`} />
                )}
            </ReviewCard>
        </div>

        <div style={{ marginTop: '20px', padding: '14px 16px', background: 'rgba(184,149,106,0.05)', border: '1px solid rgba(184,149,106,0.15)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                By submitting, you confirm all information is accurate and you agree to Chttrix's{' '}
                <span style={{ color: '#b8956a', fontWeight: 600 }}>Terms of Service</span> and{' '}
                <span style={{ color: '#b8956a', fontWeight: 600 }}>Privacy Policy</span>.
            </p>
        </div>
    </div>
);

export default Step5ReviewForm;
