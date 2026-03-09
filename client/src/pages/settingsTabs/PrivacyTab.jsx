import React, { useState } from 'react';
import Card from './Card';
import api from '../../services/api';
import { Check, Info } from 'lucide-react';
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
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    </div>
);

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
            showToast(error.response?.data?.message || 'Failed to save settings', 'error');
        } finally { setSaving(false); }
    };

    const update = (key, value) => {
        setPrivacy({ ...privacy, [key]: value });
        setHasChanges(true);
    };

    return (
        <div className="space-y-4">
            <Card title="Messaging Visibility" subtitle="What others can see when chatting with you">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <Toggle label="Read Receipts" description="Let others see when you've read their messages." checked={privacy.readReceipts} onChange={v => update('readReceipts', v)} />
                    <Toggle label="Typing Indicators" description="Show '…' while composing a message." checked={privacy.typingIndicators} onChange={v => update('typingIndicators', v)} />
                </div>
            </Card>

            <Card title="Discovery & Data" subtitle="How others find you and how data is used">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <Toggle label="Allow Discovery by Email" description="Others can find you via your email address." checked={privacy.allowDiscovery} onChange={v => update('allowDiscovery', v)} />
                    <Toggle label="Share Anonymous Usage Data" description="Help improve Chttrix with aggregated, anonymized stats." checked={privacy.dataSharing} onChange={v => update('dataSharing', v)} />
                </div>
                <div className="flex items-start gap-2 mt-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <Info size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
                        We never sell personal data. Read our{' '}
                        <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>.
                    </p>
                </div>
            </Card>

            {hasChanges && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Check size={13} />
                        {saving ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PrivacyTab;
