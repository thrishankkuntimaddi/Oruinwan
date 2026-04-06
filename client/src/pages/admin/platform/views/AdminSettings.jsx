import React, { useState } from 'react';
import { User, Mail, Phone, Upload, Save, Building, Shield } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const AdminSettings = () => {
    const { showToast } = useToast();
    const [profile, setProfile] = useState({
        displayName: 'Chttrix Super Admin',
        email: 'chttrixchat@gmail.com',
        phone: '+1 (555) 123-4567',
        bio: 'We are here to help you collaborate better.',
        role: 'Platform Owner'
    });

    const handleChange = e => setProfile({ ...profile, [e.target.name]: e.target.value });
    const handleSave = () => showToast('Profile settings saved successfully', 'success');

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div>
                <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Admin Settings & Profile</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage your administrative profile and contact details visible to company admins.</p>
            </div>

            {/* Profile Card */}
            <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                {/* Avatar Row */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ position: 'relative', cursor: 'pointer' }} title="Upload avatar">
                        <div style={{ width: '64px', height: '64px', background: 'var(--bg-active)', border: '2px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
                            {profile.displayName.charAt(0)}
                        </div>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                            <Upload size={18} style={{ color: 'white' }} />
                        </div>
                    </div>
                    <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{profile.displayName}</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{profile.role}</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <Badge text="Active" color="var(--state-success)" />
                            <Badge text="Key Contact" color="var(--accent)" />
                        </div>
                    </div>
                </div>

                {/* Fields */}
                <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* Public Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <SectionHeader icon={User} label="Public Details" />
                        <Field label="Display Name" name="displayName" value={profile.displayName} onChange={handleChange} />
                        <Field label="Role Title" name="role" value={profile.role} onChange={handleChange} />
                        <div>
                            <FieldLabel text="Support Bio" />
                            <textarea
                                name="bio" value={profile.bio} onChange={handleChange} rows={3}
                                style={{ ...inputSt, resize: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <SectionHeader icon={Mail} label="Contact Information" />
                        <div>
                            <FieldLabel text="Support Email" />
                            <div style={{ position: 'relative' }}>
                                <Mail size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input name="email" value={profile.email} onChange={handleChange} style={{ ...inputSt, paddingLeft: '30px' }} />
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Visible to company admins for urgent support.</p>
                        </div>
                        <div>
                            <FieldLabel text="Emergency Phone" />
                            <div style={{ position: 'relative' }}>
                                <Phone size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input name="phone" value={profile.phone} onChange={handleChange} style={{ ...inputSt, paddingLeft: '30px' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-active)', display: 'flex', justifyContent: 'flex-end' }}>
                    <SaveBtn onClick={handleSave} />
                </div>
            </div>

            {/* Super Admin Banner */}
            <div style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-surface)', padding: '24px', display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative', overflow: 'hidden' }}>
                <Shield size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Super Admin Access</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
                        You have full control over the Chttrix Platform. Your contact details serve as the primary truth for all active companies.
                    </p>
                    <button style={{
                        padding: '7px 14px', background: 'none',
                        border: '1px solid var(--border-accent)', color: 'var(--text-secondary)',
                        fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px',
                        transition: 'all 150ms ease'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                        View Access Logs
                    </button>
                </div>
                <Building size={120} style={{ position: 'absolute', right: '-20px', bottom: '-20px', color: 'var(--border-subtle)', opacity: 0.4 }} />
            </div>
        </div>
    );
};

const inputSt = {
    width: '100%', padding: '9px 12px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
};

const SectionHeader = ({ icon: Icon, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Icon size={14} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
    </div>
);

const FieldLabel = ({ text }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{text}</label>
);

const Field = ({ label, name, value, onChange }) => (
    <div>
        <FieldLabel text={label} />
        <input name={name} value={value} onChange={onChange} style={inputSt} />
    </div>
);

const Badge = ({ text, color }) => (
    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color, padding: '2px 6px', border: `1px solid ${color}` }}>{text}</span>
);

const SaveBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 20px',
            background: hov ? 'var(--accent-hover)' : 'var(--accent)',
            border: 'none', color: 'var(--bg-base)',
            fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', borderRadius: '2px',
            transition: 'background 150ms ease'
        }}>
            <Save size={14} /> Save Changes
        </button>
    );
};

export default AdminSettings;
