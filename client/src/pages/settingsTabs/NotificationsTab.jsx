import React from 'react';
import Card from './Card';

// Toggle Component (inline for tab use)
const Toggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-4">
        <div className="pr-8">
            <div className="font-bold text-slate-800 dark:text-white text-sm">{label}</div>
            {description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</div>}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    </div>
);

/**
 * NotificationsTab - Notification preferences
 * @param {object} props - Component props
 * @param {object} props.notifications - Notification settings
 * @param {function} props.setNotifications - Update notifications handler
 */
const NotificationsTab = ({ notifications, setNotifications }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Email Notifications" subtitle="Choose what you want to receive via email">
                <div className="space-y-2">
                    <Toggle
                        label="Product Updates"
                        description="New features, improvements, and roadmap updates."
                        checked={notifications.productUpdates}
                        onChange={(v) => setNotifications({ ...notifications, productUpdates: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Security Alerts"
                        description="Important alerts about your account security."
                        checked={notifications.securityEmails}
                        onChange={(v) => setNotifications({ ...notifications, securityEmails: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Marketing Emails"
                        description="Tips, offers, and Chttrix news."
                        checked={notifications.marketingEmails}
                        onChange={(v) => setNotifications({ ...notifications, marketingEmails: v })}
                    />
                </div>
            </Card>

            <Card title="Push Notifications" subtitle="Manage mobile and desktop alerts">
                <div className="space-y-2">
                    <Toggle
                        label="Direct Messages"
                        description="Get notified when someone messages you directly."
                        checked={notifications.dmPush}
                        onChange={(v) => setNotifications({ ...notifications, dmPush: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Mentions"
                        description="Get notified when you are mentioned in a channel."
                        checked={notifications.mentionPush}
                        onChange={(v) => setNotifications({ ...notifications, mentionPush: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Thread Replies"
                        description="Get notified about replies to your threads."
                        checked={notifications.threadPush}
                        onChange={(v) => setNotifications({ ...notifications, threadPush: v })}
                    />
                </div>
            </Card>

            <Card title="App Sounds" subtitle="In-app auditory feedback">
                <Toggle
                    label="Enable Sound Effects"
                    description="Play sounds for new messages and interactions."
                    checked={notifications.soundEffects}
                    onChange={(v) => setNotifications({ ...notifications, soundEffects: v })}
                />
            </Card>
        </div>
    );
};

export default NotificationsTab;
