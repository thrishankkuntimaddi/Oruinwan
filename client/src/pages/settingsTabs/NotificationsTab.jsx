import React, { useState } from 'react';
import Card from './Card';
import api from '../../services/api';
import Button from '../../shared/components/ui/Button';
import { Check, Bell, MessageSquare, AtSign, Layers, Volume2, Mail, Shield } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const Toggle = ({ label, description, checked, onChange, disabled }) => (
    <div className="flex items-center justify-between py-3">
        <div className="pr-6">
            <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{label}</div>
            {description && <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</div>}
        </div>
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative flex-shrink-0 inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    </div>
);

const SectionLabel = ({ children }) => (
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2 mt-1">{children}</p>
);

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
            showToast(error.response?.data?.message || 'Failed to save preferences', 'error');
        } finally { setSaving(false); }
    };

    const update = (key, value) => {
        setNotifications({ ...notifications, [key]: value });
        setHasChanges(true);
    };

    return (
        <div className="space-y-4">
            <Card title="Push Notifications" subtitle="In-app & browser alerts">
                <SectionLabel>Messages</SectionLabel>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <Toggle label="Direct Messages" description="Alert when someone messages you directly." checked={notifications.dmPush} onChange={v => update('dmPush', v)} />
                    <Toggle label="Mentions" description="Alert when you're @mentioned in a channel." checked={notifications.mentionPush} onChange={v => update('mentionPush', v)} />
                    <Toggle label="Thread Replies" description="Alert when someone replies to your thread." checked={notifications.threadPush} onChange={v => update('threadPush', v)} />
                </div>
            </Card>

            <Card title="Email Notifications" subtitle="Delivered to your inbox">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <Toggle label="Security Alerts" description="Critical account security notices (recommended)." checked={notifications.securityEmails} onChange={v => update('securityEmails', v)} />
                    <Toggle label="Product Updates" description="New features and improvement announcements." checked={notifications.productUpdates} onChange={v => update('productUpdates', v)} />
                    <Toggle label="Marketing Emails" description="Tips, offers, and Chttrix news." checked={notifications.marketingEmails} onChange={v => update('marketingEmails', v)} />
                </div>
            </Card>

            <Card title="Sounds" subtitle="Auditory feedback">
                <Toggle label="Sound Effects" description="Play notification sounds for messages." checked={notifications.soundEffects} onChange={v => update('soundEffects', v)} />
            </Card>

            {hasChanges && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Check size={13} />
                        {saving ? 'Saving…' : 'Save Preferences'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationsTab;
