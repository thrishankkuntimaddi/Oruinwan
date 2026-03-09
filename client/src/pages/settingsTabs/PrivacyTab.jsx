import React, { useState } from 'react';
import Card from './Card';
import api from '../../services/api';
import Button from '../../shared/components/ui/Button';
import { Check, Eye, EyeOff, Search, Share2, Info } from 'lucide-react';
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

/**
 * PrivacyTab - Privacy and safety settings with real API integration
 */
const PrivacyTab = ({ privacy, setPrivacy }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/privacy', privacy);
            setHasChanges(false);
            showToast('Privacy settings saved', 'success');
        } catch (error) {
            console.error('Failed to save privacy:', error);
            showToast(error.response?.data?.message || 'Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const update = (key, value) => {
        setPrivacy({ ...privacy, [key]: value });
        setHasChanges(true);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Online Presence */}
            <Card title="Messaging Visibility" subtitle="Control what others can see when you interact">
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    <Toggle
                        label="Read Receipts"
                        description="Let others see when you've read their messages (and vice versa)."
                        checked={privacy.readReceipts}
                        onChange={(v) => update('readReceipts', v)}
                    />
                    <Toggle
                        label="Typing Indicators"
                        description="Show a '…' animation when you're composing a message."
                        checked={privacy.typingIndicators}
                        onChange={(v) => update('typingIndicators', v)}
                    />
                </div>
            </Card>

            {/* Discovery */}
            <Card title="Account Discovery" subtitle="Control how others can find you on Chttrix">
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    <Toggle
                        label="Allow Discovery by Email"
                        description="Allow others to find and invite you using your email address."
                        checked={privacy.allowDiscovery}
                        onChange={(v) => update('allowDiscovery', v)}
                    />
                </div>
            </Card>

            {/* Data */}
            <Card title="Data & Privacy" subtitle="Control how your data is used to improve Chttrix">
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    <Toggle
                        label="Share Anonymous Usage Data"
                        description="Help improve Chttrix by sharing aggregated, anonymized usage statistics."
                        checked={privacy.dataSharing}
                        onChange={(v) => update('dataSharing', v)}
                    />
                </div>

                <div className="mt-4 flex items-start gap-2 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <Info size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        We never sell personal data. Usage data is aggregated and never linked to your identity.
                        Read our{' '}
                        <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</a>.
                    </p>
                </div>
            </Card>

            {hasChanges && (
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving} isLoading={saving} icon={<Check size={16} />}>
                        Save Settings
                    </Button>
                </div>
            )}
        </div>
    );
};

export default PrivacyTab;
