import React, { useState } from 'react';
import Card from './Card';
import api from '../../services/api';
import Button from '../../shared/components/ui/Button';
import { Check, Bell, MessageSquare, AtSign, Layers, Volume2, Mail, Shield, Settings2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

// Toggle Component
const Toggle = ({ label, description, checked, onChange, disabled }) => (
    <div className="flex items-center justify-between py-4">
        <div className="pr-8">
            <div className="font-semibold text-slate-800 dark:text-white text-sm">{label}</div>
            {description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</div>}
        </div>
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);

const SectionHeader = ({ icon: Icon, label }) => (
    <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="text-indigo-500" />
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{label}</span>
    </div>
);

/**
 * NotificationsTab - Notification preferences with real API integration
 */
const NotificationsTab = ({ notifications, setNotifications }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/notifications', notifications);
            setHasChanges(false);
            showToast('Notification preferences saved', 'success');
        } catch (error) {
            console.error('Failed to save preferences:', error);
            showToast(error.response?.data?.message || 'Failed to save preferences', 'error');
        } finally {
            setSaving(false);
        }
    };

    const update = (key, value) => {
        setNotifications({ ...notifications, [key]: value });
        setHasChanges(true);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Push / In-App */}
            <Card title="Push Notifications" subtitle="Control alerts for activity inside Chttrix">
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    <SectionHeader icon={MessageSquare} label="Messages" />
                    <Toggle
                        label="Direct Messages"
                        description="Get notified when someone sends you a direct message."
                        checked={notifications.dmPush}
                        onChange={(v) => update('dmPush', v)}
                    />
                    <Toggle
                        label="Mentions (@you)"
                        description="Get notified when you are @mentioned in a channel."
                        checked={notifications.mentionPush}
                        onChange={(v) => update('mentionPush', v)}
                    />
                    <Toggle
                        label="Thread Replies"
                        description="Get notified when someone replies to your thread."
                        checked={notifications.threadPush}
                        onChange={(v) => update('threadPush', v)}
                    />
                </div>
            </Card>

            {/* Email Notifications */}
            <Card title="Email Notifications" subtitle="Choose what you receive in your inbox">
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    <Toggle
                        label="Security Alerts"
                        description="Critical alerts about your account — recommended."
                        checked={notifications.securityEmails}
                        onChange={(v) => update('securityEmails', v)}
                    />
                    <Toggle
                        label="Product Updates"
                        description="New features, improvements, and roadmap updates."
                        checked={notifications.productUpdates}
                        onChange={(v) => update('productUpdates', v)}
                    />
                    <Toggle
                        label="Marketing Emails"
                        description="Tips, special offers, and Chttrix news."
                        checked={notifications.marketingEmails}
                        onChange={(v) => update('marketingEmails', v)}
                    />
                </div>
            </Card>

            {/* Sound */}
            <Card title="App Sounds" subtitle="Auditory feedback for in-app interactions">
                <Toggle
                    label="Enable Sound Effects"
                    description="Play notification sounds for new messages and activity."
                    checked={notifications.soundEffects}
                    onChange={(v) => update('soundEffects', v)}
                />
            </Card>

            {hasChanges && (
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} isLoading={saving} icon={<Check size={16} />}>
                        Save Preferences
                    </Button>
                </div>
            )}
        </div>
    );
};

export default NotificationsTab;
