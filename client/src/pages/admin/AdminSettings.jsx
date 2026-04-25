import React, { useState } from 'react';
import {
    Building, Shield, Bell, CreditCard, Users, Globe,
    Palette, Database, Download, Upload, Check,
    AlertCircle, ExternalLink, Key, Zap, Loader
} from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import AdminSidebar from '../../components/admin/AdminSidebar';
import DomainSettings from '../../components/company/DomainSettings';

const inputSt = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    color: 'var(--text-primary)', fontSize: '13px',
    outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box'
};

const AdminSettings = () => {
    const { company } = useCompany();
    const { } = useAuth();
    const [activeTab, setActiveTab] = useState('company');
    const [isSaving, setIsSaving] = useState(false);

    const [settings, setSettings] = useState({
        companyName: company?.name || '',
        companyEmail: company?.email || '',
        companyPhone: '',
        companyAddress: '',
        companyWebsite: '',
        companyLogo: '',
        require2FA: false,
        passwordMinLength: 8,
        sessionTimeout: 60,
        ssoEnabled: false,
        emailOnNewUser: true,
        emailOnWorkspaceCreate: true,
        weeklyDigest: true,
        defaultRole: 'member',
        autoApproveJoin: false,
        primaryColor: '#b8956a',
        accentColor: '#5aba8a',
    });

    const tabs = [
        { id: 'company', label: 'Company Profile', icon: Building },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'domain', label: 'Domain & SSO', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
        { id: 'users', label: 'User Defaults', icon: Users },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'data', label: 'Data & Privacy', icon: Database },
    ];

    const handleSave = async () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
            <AdminSidebar />

            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {}
                <header style={{ height: '56px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>Company Settings</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure your organization</p>
                    </div>
                    <SaveHeaderBtn isSaving={isSaving} onClick={handleSave} />
                </header>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {}
                    <div style={{ width: '220px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', flexShrink: 0 }} className="custom-scrollbar">
                        <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {tabs.map(tab => (
                                <TabBtn key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
                            ))}
                        </nav>
                    </div>

                    {}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }} className="custom-scrollbar">
                        <div style={{ maxWidth: '640px' }}>
                            {activeTab === 'company' && <CompanyTab settings={settings} setSettings={setSettings} />}
                            {activeTab === 'security' && <SecurityTab settings={settings} setSettings={setSettings} />}
                            {activeTab === 'domain' && <DomainTab company={company} settings={settings} setSettings={setSettings} />}
                            {activeTab === 'notifications' && <NotificationsTab settings={settings} setSettings={setSettings} />}
                            {activeTab === 'billing' && <BillingTab />}
                            {activeTab === 'users' && <UsersTab settings={settings} setSettings={setSettings} />}
                            {activeTab === 'branding' && <BrandingTab settings={settings} setSettings={setSettings} />}
                            {activeTab === 'data' && <DataTab />}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const CompanyTab = ({ settings, setSettings }) => (
    <Section title="Company Profile" desc="Manage your organization's basic information">
        <Card>
            <Field label="Company Name">
                <div style={{ position: 'relative' }}>
                    <Building size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" value={settings.companyName} disabled style={{ ...inputSt, paddingLeft: '30px', opacity: 0.5, cursor: 'not-allowed' }} />
                </div>
                <Hint text="Contact support to change company name" />
            </Field>
            <Field label="Company Email">
                <input type="email" value={settings.companyEmail} onChange={e => setSettings({ ...settings, companyEmail: e.target.value })} placeholder="contact@company.com" style={inputSt} />
            </Field>
            <Field label="Phone Number">
                <input type="tel" value={settings.companyPhone} onChange={e => setSettings({ ...settings, companyPhone: e.target.value })} placeholder="+1 (555) 123-4567" style={inputSt} />
            </Field>
            <Field label="Address">
                <textarea value={settings.companyAddress} onChange={e => setSettings({ ...settings, companyAddress: e.target.value })} rows={3} placeholder="123 Main St, City, State, ZIP" style={{ ...inputSt, resize: 'none' }} />
            </Field>
            <Field label="Website">
                <input type="url" value={settings.companyWebsite} onChange={e => setSettings({ ...settings, companyWebsite: e.target.value })} placeholder="https://www.company.com" style={inputSt} />
            </Field>
            <Field label="Company Logo">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '52px', height: '52px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', borderRadius: '2px' }}>
                        <Upload size={13} /> Upload Logo
                    </button>
                </div>
                <Hint text="Recommended: 512x512px, PNG or SVG" />
            </Field>
        </Card>
    </Section>
);

const SecurityTab = ({ settings, setSettings }) => (
    <Section title="Security Settings" desc="Configure authentication and access controls">
        <Card>
            <ToggleRow label="Two-Factor Authentication (2FA)" desc="Require all users to enable 2FA" icon={Key}
                checked={settings.require2FA} onChange={v => setSettings({ ...settings, require2FA: v })} />
            <Divider />
            <Field label="Minimum Password Length">
                <input type="number" min="6" max="32" value={settings.passwordMinLength}
                    onChange={e => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })}
                    style={{ ...inputSt, width: '100px' }} />
                <Hint text="Characters (minimum 6, recommended 12+)" />
            </Field>
            <Field label="Session Timeout">
                <select value={settings.sessionTimeout} onChange={e => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })} style={inputSt}>
                    {[{ v: 15, l: '15 minutes' }, { v: 30, l: '30 minutes' }, { v: 60, l: '1 hour' }, { v: 120, l: '2 hours' }, { v: 480, l: '8 hours' }, { v: 1440, l: '24 hours' }].map(o => (
                        <option key={o.v} value={o.v}>{o.l}</option>
                    ))}
                </select>
                <Hint text="Automatically log out inactive users" />
            </Field>
        </Card>
        <InfoBanner icon={AlertCircle} color="var(--accent)" title="Security Recommendation"
            text="Enable 2FA for all admin accounts and set a minimum password length of 12 characters for enhanced security." />
    </Section>
);

const DomainTab = ({ company, settings, setSettings }) => (
    <Section title="Domain & SSO" desc="Verify your domain and enable Single Sign-On">
        {company?._id && <DomainSettings companyId={company._id} />}
        <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Zap size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Single Sign-On (SSO)</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', padding: '2px 5px', border: '1px solid var(--accent)' }}>Enterprise</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enable SAML/OAuth SSO for your organization</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        SSO is available on Enterprise plans. <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500, padding: 0 }}>Upgrade now</button>
                    </p>
                </div>
                <Toggle checked={settings.ssoEnabled} disabled onChange={() => {}} />
            </div>
        </Card>
    </Section>
);

const NotificationsTab = ({ settings, setSettings }) => (
    <Section title="Notification Preferences" desc="Control what emails you receive as an admin">
        <Card noPad>
            <ToggleRowBordered label="New User Joined" desc="Get notified when someone joins your company"
                checked={settings.emailOnNewUser} onChange={v => setSettings({ ...settings, emailOnNewUser: v })} border />
            <ToggleRowBordered label="Workspace Created" desc="Get notified when a new workspace is created"
                checked={settings.emailOnWorkspaceCreate} onChange={v => setSettings({ ...settings, emailOnWorkspaceCreate: v })} border />
            <ToggleRowBordered label="Weekly Digest" desc="Receive a weekly summary of company activity"
                checked={settings.weeklyDigest} onChange={v => setSettings({ ...settings, weeklyDigest: v })} />
        </Card>
    </Section>
);

const BillingTab = () => (
    <Section title="Billing & Subscription" desc="Manage your plan and payment methods">
        <div style={{ padding: '24px', background: 'var(--bg-surface)', border: '1px solid var(--accent)', position: 'relative', overflow: 'hidden', marginBottom: '16px' }}>
            <CreditCard size={52} style={{ position: 'absolute', right: '-8px', bottom: '-8px', color: 'var(--border-accent)', opacity: 0.5 }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                    <h4 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '4px' }}>Pro Plan</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active subscription</p>
                </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '36px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.02em' }}>$49</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' }}>/month</span>
            </div>
            <button style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--bg-base)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--accent)'; }}>
                Upgrade to Enterprise
            </button>
        </div>
        <Card>
            <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Payment Method</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                <CreditCard size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>•••• •••• •••• 4242</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expires 12/2025</p>
                </div>
                <button style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>Update</button>
            </div>
        </Card>
        <Card>
            <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Billing History</h4>
            {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Dec {i}, 2026</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pro Plan - Monthly</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>$49.00</span>
                        <button style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Download size={11} /> PDF
                        </button>
                    </div>
                </div>
            ))}
        </Card>
    </Section>
);

const UsersTab = ({ settings, setSettings }) => (
    <Section title="User Defaults" desc="Set default settings for new users">
        <Card>
            <Field label="Default Role for New Users">
                <select value={settings.defaultRole} onChange={e => setSettings({ ...settings, defaultRole: e.target.value })} style={inputSt}>
                    <option value="member">Member (Standard)</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Guest (Limited)</option>
                </select>
                <Hint text="New users will be assigned this role by default" />
            </Field>
            <Divider />
            <ToggleRow label="Auto-Approve Domain Join" desc="Automatically approve users with verified domain email"
                checked={settings.autoApproveJoin} onChange={v => setSettings({ ...settings, autoApproveJoin: v })} />
        </Card>
    </Section>
);

const BrandingTab = ({ settings, setSettings }) => (
    <Section title="Branding & Appearance" desc="Customize the look and feel">
        <Card>
            <Field label="Primary Color">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="color" value={settings.primaryColor} onChange={e => setSettings({ ...settings, primaryColor: e.target.value })} style={{ width: '40px', height: '40px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', cursor: 'pointer', padding: '2px' }} />
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{settings.primaryColor}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Used for buttons, links, and highlights</p>
                    </div>
                </div>
            </Field>
            <Field label="Accent Color">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="color" value={settings.accentColor} onChange={e => setSettings({ ...settings, accentColor: e.target.value })} style={{ width: '40px', height: '40px', border: '1px solid var(--border-default)', background: 'var(--bg-input)', cursor: 'pointer', padding: '2px' }} />
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{settings.accentColor}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Used for success states and notifications</p>
                    </div>
                </div>
            </Field>
        </Card>
        <InfoBanner icon={Palette} color="var(--text-secondary)" title="Branding Preview"
            text="Changes will apply to your workspace after saving. Some elements may require a page refresh." />
    </Section>
);

const DataTab = () => (
    <Section title="Data & Privacy" desc="Manage your company data and privacy settings">
        <Card>
            <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>Export Data</h4>
            <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-active)'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Download size={16} style={{ color: 'var(--text-secondary)' }} />
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Export All Company Data</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Download a complete backup of your data</p>
                    </div>
                </div>
                <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
            <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Data Retention</h4>
                <select style={inputSt}>
                    <option>Keep all data indefinitely</option>
                    <option>Delete after 1 year</option>
                    <option>Delete after 2 years</option>
                    <option>Delete after 5 years</option>
                </select>
                <Hint text="How long to retain deleted messages and files" />
            </div>
        </Card>
        <div style={{ padding: '20px', border: '1px solid var(--state-danger)', background: 'var(--bg-surface)', borderRadius: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <AlertCircle size={14} style={{ color: 'var(--state-danger)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--state-danger)' }}>Danger Zone</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Permanent actions that cannot be undone</p>
            <button style={{ padding: '8px 16px', background: 'var(--state-danger)', border: 'none', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px' }}>
                Delete Company Account
            </button>
        </div>
    </Section>
);

const Section = ({ title, desc, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ marginBottom: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '4px' }}>{title}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{desc}</p>
        </div>
        {children}
    </div>
);

const Card = ({ children, noPad }) => (
    <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', padding: noPad ? '0' : '20px', display: noPad ? undefined : 'flex', flexDirection: noPad ? undefined : 'column', gap: noPad ? undefined : '16px' }}>
        {children}
    </div>
);

const Field = ({ label, children }) => (
    <div>
        <FieldLabel text={label} />
        {children}
    </div>
);

const FieldLabel = ({ text }) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{text}</label>
);

const Hint = ({ text }) => (
    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{text}</p>
);

const Divider = () => (
    <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
);

const ToggleRow = ({ label, desc, icon: Icon, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                {Icon && <Icon size={13} style={{ color: 'var(--text-muted)' }} />}
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
    </div>
);

const ToggleRowBordered = ({ label, desc, checked, onChange, border }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', borderBottom: border ? '1px solid var(--border-subtle)' : 'none' }}>
        <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
    </div>
);

const Toggle = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
            width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0,
            background: checked ? 'var(--accent)' : 'var(--border-accent)',
            border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'relative', transition: 'background 200ms ease',
            opacity: disabled ? 0.4 : 1
        }}
    >
        <span style={{
            position: 'absolute', top: '3px',
            left: checked ? '21px' : '3px',
            width: '16px', height: '16px', borderRadius: '50%',
            background: checked ? 'var(--bg-base)' : 'var(--text-muted)',
            transition: 'left 200ms ease'
        }} />
    </button>
);

const InfoBanner = ({ icon: Icon, color, title, text }) => (
    <div style={{ padding: '14px 16px', border: `1px solid ${color}`, background: 'var(--bg-surface)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <Icon size={14} style={{ color, flexShrink: 0, marginTop: '1px' }} />
        <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{title}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>{text}</p>
        </div>
    </div>
);

const TabBtn = ({ tab, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    const Icon = tab.icon;
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                padding: '9px 12px',
                background: active ? 'var(--bg-active)' : hov ? 'var(--bg-hover)' : 'transparent',
                border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--accent)' : hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: active ? 600 : 400,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 150ms ease', borderRadius: '2px'
            }}
        >
            <Icon size={14} style={{ flexShrink: 0 }} />
            {tab.label}
        </button>
    );
};

const SaveHeaderBtn = ({ isSaving, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} disabled={isSaving} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: hov ? 'var(--accent-hover)' : 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', borderRadius: '2px', opacity: isSaving ? 0.7 : 1, transition: 'background 150ms ease' }}>
            {isSaving ? <><Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : <><Check size={13} /> Save Changes</>}
        </button>
    );
};

export default AdminSettings;
