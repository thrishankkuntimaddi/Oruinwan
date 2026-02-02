import React, { useState, useEffect } from 'react';
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
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState([]);

    useEffect(() => {
        loadPreferences();
        loadBlockedUsers();
    }, []);

    const loadPreferences = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/auth/me/preferences/privacy', { withCredentials: true });
            if (response.data) {
                setPrivacy(response.data);
            }
        } catch (error) {
            console.log('Privacy preferences not available yet');
        } finally {
            setLoading(false);
        }
    };

    const loadBlockedUsers = async () => {
        try {
            const response = await axios.get('/api/auth/me/blocked-users', { withCredentials: true });
            if (response.data) {
                setBlockedUsers(response.data);
            }
        } catch (error) {
            console.log('Blocked users list not available yet');
        }
    };

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

    const handleUnblockUser = async (userId) => {
        try {
            await axios.delete(`/api/auth/me/blocked-users/${userId}`, { withCredentials: true });
            setBlockedUsers(blockedUsers.filter(u => u._id !== userId));
            const event = new CustomEvent('show-toast', { detail: { message: 'User unblocked', type: 'success' } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Failed to unblock user:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

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

            {blockedUsers.length > 0 && (
                <Card title="Blocked Users" subtitle="Manage your blocked users list">
                    <div className="space-y-3">
                        {blockedUsers.map(user => (
                            <div key={user._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white font-bold">
                                        {user.username?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{user.username}</div>
                                        <div className="text-xs text-slate-500">{user.email}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnblockUser(user._id)}
                                    className="px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

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
