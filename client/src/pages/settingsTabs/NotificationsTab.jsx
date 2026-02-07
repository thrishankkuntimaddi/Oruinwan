import React, { useState } from 'react';
import Card from './Card';
import axios from 'axios';
import { Loader, Check } from 'lucide-react';

// Toggle Component (inline for tab use)
const Toggle = ({ label, description, checked, onChange, disabled }) => (
    <div className="flex items-center justify-between py-4">
        <div className="pr-8">
            <div className="font-bold text-slate-800 dark:text-white text-sm">{label}</div>
            {description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</div>}
        </div>
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''
                } ${checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    </div>
);

/**
 * NotificationsTab - Notification preferences with backend integration
 */
const NotificationsTab = ({ notifications, setNotifications }) => {
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Save notification preferences
    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put('/api/auth/me/preferences/notifications', notifications, { withCredentials: true });
            setHasChanges(false);
            // Show success feedback
            const event = new CustomEvent('show-toast', { detail: { message: 'Notification preferences saved', type: 'success' } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Failed to save preferences:', error);
            const event = new CustomEvent('show-toast', { detail: { message: 'Failed to save preferences', type: 'error' } });
            window.dispatchEvent(event);
        } finally {
            setSaving(false);
        }
    };

    const updateNotification = (key, value) => {
        setNotifications({ ...notifications, [key]: value });
        setHasChanges(true);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Email Notifications" subtitle="Choose what you want to receive via email">
                <div className="space-y-2">
                    <Toggle
                        label="Product Updates"
                        description="New features, improvements, and roadmap updates."
                        checked={notifications.productUpdates}
                        onChange={(v) => updateNotification('productUpdates', v)}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Security Alerts"
                        description="Important alerts about your account security."
                        checked={notifications.securityEmails}
                        onChange={(v) => updateNotification('securityEmails', v)}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Marketing Emails"
                        description="Tips, offers, and Chttrix news."
                        checked={notifications.marketingEmails}
                        onChange={(v) => updateNotification('marketingEmails', v)}
                    />
                </div>
            </Card>

            <Card title="Push Notifications" subtitle="Manage mobile and desktop alerts">
                <div className="space-y-2">
                    <Toggle
                        label="Direct Messages"
                        description="Get notified when someone messages you directly."
                        checked={notifications.dmPush}
                        onChange={(v) => updateNotification('dmPush', v)}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Mentions"
                        description="Get notified when you are mentioned in a channel."
                        checked={notifications.mentionPush}
                        onChange={(v) => updateNotification('mentionPush', v)}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Thread Replies"
                        description="Get notified about replies to your threads."
                        checked={notifications.threadPush}
                        onChange={(v) => updateNotification('threadPush', v)}
                    />
                </div>
            </Card>

            <Card title="App Sounds" subtitle="In-app auditory feedback">
                <Toggle
                    label="Enable Sound Effects"
                    description="Play sounds for new messages and interactions."
                    checked={notifications.soundEffects}
                    onChange={(v) => updateNotification('soundEffects', v)}
                />
            </Card>

            {/* Save Button */}
            {hasChanges && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                Save Preferences
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationsTab;
