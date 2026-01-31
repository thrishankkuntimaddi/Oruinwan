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
 * PrivacyTab - Privacy and safety settings
 * @param {object} props - Component props
 * @param {object} props.privacy - Privacy settings (readReceipts, typingIndicators, allowDiscovery, dataSharing)
 * @param {function} props.setPrivacy - Update privacy handler
 */
const PrivacyTab = ({ privacy, setPrivacy }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Privacy" subtitle="Control who can see your activity">
                <div className="space-y-2">
                    <Toggle
                        label="Read Receipts"
                        description="Let others know when you've seen their messages."
                        checked={privacy.readReceipts}
                        onChange={(v) => setPrivacy({ ...privacy, readReceipts: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Typing Indicators"
                        description="Show others when you are writing a message."
                        checked={privacy.typingIndicators}
                        onChange={(v) => setPrivacy({ ...privacy, typingIndicators: v })}
                    />
                </div>
            </Card>

            <Card title="Data & Safety" subtitle="Manage your data footprint">
                <div className="space-y-2">
                    <Toggle
                        label="Allow Discovery"
                        description="Let people find you by your email or phone number."
                        checked={privacy.allowDiscovery}
                        onChange={(v) => setPrivacy({ ...privacy, allowDiscovery: v })}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Share Usage Data"
                        description="Help us improve Chttrix by sharing anonymous usage data."
                        checked={privacy.dataSharing}
                        onChange={(v) => setPrivacy({ ...privacy, dataSharing: v })}
                    />
                </div>
            </Card>

            <Card title="Danger Zone" className="border-red-200 dark:border-red-900/30">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-bold text-red-600 dark:text-red-400 text-sm">Delete Account</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Permanently remove your account and all data. This cannot be undone.</div>
                    </div>
                    <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20">
                        Delete Account
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default PrivacyTab;
