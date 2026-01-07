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
        <div className="flex h-full bg-gray-50 dark:bg-gray-900">
            {/* Sidebar */}
            <aside className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Settings</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your company preferences</p>
                </div>

                <nav className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-1">
                        {sections.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;

                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all ${isActive
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <Icon
                                        size={20}
                                        className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}
                                    />
                                    <span className={`font-${isActive ? 'bold' : 'medium'} text-sm`}>
                                        {section.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8">
                    {ActiveComponent && <ActiveComponent />}
                </div>
            </main>
        </div>
    );
};

export default CompanySettings;
