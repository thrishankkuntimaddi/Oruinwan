import React, { useState } from 'react';
import {
    Building, Shield, Globe, Bell, CreditCard,
    Users as UsersIcon, Palette, Database
} from 'lucide-react';
import CompanyProfile from './sections/CompanyProfile';
import Security from './sections/Security';
import DomainSSO from './sections/DomainSSO';
import Notifications from './sections/Notifications';
import BillingPlan from './sections/BillingPlan';
import UserDefaults from './sections/UserDefaults';
import Branding from './sections/Branding';
import DataPrivacy from './sections/DataPrivacy';

const CompanySettings = () => {
    const [activeSection, setActiveSection] = useState('profile');

    const sections = [
        { id: 'profile', label: 'Company Profile', icon: Building, component: CompanyProfile },
        { id: 'security', label: 'Security', icon: Shield, component: Security },
        { id: 'domain-sso', label: 'Domain & SSO', icon: Globe, component: DomainSSO },
        { id: 'notifications', label: 'Notifications', icon: Bell, component: Notifications },
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard, component: BillingPlan },
        { id: 'user-defaults', label: 'User Defaults', icon: UsersIcon, component: UserDefaults },
        { id: 'branding', label: 'Branding', icon: Palette, component: Branding },
        { id: 'data-privacy', label: 'Data & Privacy', icon: Database, component: DataPrivacy },
    ];

    const ActiveComponent = sections.find(s => s.id === activeSection)?.component;

    return (
        <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {/* Sidebar */}
            <aside style={{ width: '220px', flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', marginBottom: '3px' }}>Settings</h1>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage your company preferences</p>
                </div>
                <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }} className="custom-scrollbar">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {sections.map(section => (
                            <SidebarBtn
                                key={section.id}
                                section={section}
                                active={activeSection === section.id}
                                onClick={() => setActiveSection(section.id)}
                            />
                        ))}
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                <div style={{ maxWidth: '680px', padding: '28px 32px' }}>
                    {ActiveComponent && <ActiveComponent />}
                </div>
            </main>
        </div>
    );
};

const SidebarBtn = ({ section, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    const Icon = section.icon;
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
            {section.label}
        </button>
    );
};

export default CompanySettings;
