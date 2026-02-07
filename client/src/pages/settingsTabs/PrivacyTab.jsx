import React, { useState } from 'react';
import Card from './Card';
import axios from 'axios';
import { Loader, Check } from 'lucide-react';

// Toggle Component
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
 * PrivacyTab - Privacy and safety settings with backend integration
 */
const PrivacyTab = ({ privacy, setPrivacy }) => {
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put('/api/auth/me/preferences/privacy', privacy, { withCredentials: true });
            setHasChanges(false);
            const event = new CustomEvent('show-toast', { detail: { message: 'Privacy settings saved', type: 'success' } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Failed to save privacy:', error);
            const event = new CustomEvent('show-toast', { detail: { message: 'Failed to save settings', type: 'error' } });
            window.dispatchEvent(event);
        } finally {
            setSaving(false);
        }
    };

    const updatePrivacy = (key, value) => {
        setPrivacy({ ...privacy, [key]: value });
        setHasChanges(true);
    };


    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Online Presence" subtitle="Control who can see your activity">
                <div className="space-y-2">
                    <Toggle
                        label="Read Receipts"
                        description="Let others know when you've read their messages."
                        checked={privacy.readReceipts}
                        onChange={(v) => updatePrivacy('readReceipts', v)}
                    />
                    <div className="border-t border-slate-100 dark:border-white/5"></div>
                    <Toggle
                        label="Typing Indicators"
                        description="Show when you're typing a message."
                        checked={privacy.typingIndicators}
                        onChange={(v) => updatePrivacy('typingIndicators', v)}
                    />
                </div>
            </Card>

            <Card title="Discovery" subtitle="Allow others to find you">
                <Toggle
                    label="Allow Discovery"
                    description="Let others find you by email or phone number."
                    checked={privacy.allowDiscovery}
                    onChange={(v) => updatePrivacy('allowDiscovery', v)}
                />
            </Card>

            <Card title="Data Sharing" subtitle="Control data usage">
                <Toggle
                    label="Share Usage Data"
                    description="Help improve Chttrix by sharing anonymous usage data."
                    checked={privacy.dataSharing}
                    onChange={(v) => updatePrivacy('dataSharing', v)}
                />
            </Card>

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
                                Save Settings
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PrivacyTab;
