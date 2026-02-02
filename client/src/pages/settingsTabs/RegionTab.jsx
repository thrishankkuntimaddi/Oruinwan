import React, { useState, useEffect } from 'react';
import Card from './Card';
import axios from 'axios';
import { Loader, Check, Globe2 } from 'lucide-react';

/**
 * RegionTab - Language and region settings with backend integration
 */
const RegionTab = ({ region, setRegion }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [detectedTimezone, setDetectedTimezone] = useState('');

    useEffect(() => {
        loadPreferences();
        detectTimezone();
    }, []);

    const detectTimezone = () => {
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setDetectedTimezone(timezone);
            if (region.timezone === 'auto') {
                setRegion({ ...region, timezone });
            }
        } catch (error) {
            console.error('Failed to detect timezone:', error);
        }
    };

    const loadPreferences = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/auth/me/preferences/region', { withCredentials: true });
            if (response.data) {
                setRegion(response.data);
            }
        } catch (error) {
            console.log('Region preferences not available yet');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put('/api/auth/me/preferences/region', region, { withCredentials: true });
            setHasChanges(false);
            const event = new CustomEvent('show-toast', { detail: { message: 'Region settings saved', type: 'success' } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Failed to save region:', error);
            const event = new CustomEvent('show-toast', { detail: { message: 'Failed to save settings', type: 'error' } });
            window.dispatchEvent(event);
        } finally {
            setSaving(false);
        }
    };

    const updateRegion = (key, value) => {
        setRegion({ ...region, [key]: value });
        setHasChanges(true);
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
            <Card title="Language" subtitle="Select your preferred language">
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                        Display Language
                    </label>
                    <select
                        value={region.language}
                        onChange={(e) => updateRegion('language', e.target.value)}
                        className="w-full max-w-md px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="en">English (US)</option>
                        <option value="en-gb">English (UK)</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="it">Italiano</option>
                        <option value="pt">Português</option>
                        <option value="ru">Русский</option>
                        <option value="zh">中文 (简体)</option>
                        <option value="ja">日本語</option>
                        <option value="ko">한국어</option>
                        <option value="ar">العربية</option>
                        <option value="hi">हिन्दी</option>
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Note: Only English is fully supported. Other languages coming soon.
                    </p>
                </div>
            </Card>

            <Card title="Timezone" subtitle="Set your local timezone">
                <div className="space-y-4">
                    {detectedTimezone && (
                        <div className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <Globe2 className="text-indigo-600 dark:text-indigo-400 mt-0.5" size={16} />
                            <div>
                                <div className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Detected Timezone</div>
                                <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">{detectedTimezone}</div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Timezone
                        </label>
                        <select
                            value={region.timezone}
                            onChange={(e) => updateRegion('timezone', e.target.value)}
                            className="w-full max-w-md px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        >
                            <option value="auto">Auto-detect ({detectedTimezone || 'Unknown'})</option>
                            <option value="America/New_York">Eastern Time (US & Canada)</option>
                            <option value="America/Chicago">Central Time (US & Canada)</option>
                            <option value="America/Denver">Mountain Time (US & Canada)</option>
                            <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                            <option value="Europe/London">London</option>
                            <option value="Europe/Paris">Paris</option>
                            <option value="Europe/Berlin">Berlin</option>
                            <option value="Asia/Dubai">Dubai</option>
                            <option value="Asia/Kolkata">India (IST)</option>
                            <option value="Asia/Shanghai">Shanghai</option>
                            <option value="Asia/Tokyo">Tokyo</option>
                            <option value="Australia/Sydney">Sydney</option>
                        </select>
                    </div>
                </div>
            </Card>

            <Card title="Date & Time Format" subtitle="Customize how dates are displayed">
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                        Date Format
                    </label>
                    <select
                        value={region.dateFormat}
                        onChange={(e) => updateRegion('dateFormat', e.target.value)}
                        className="w-full max-w-md px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    >
                        <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                        <option value="DD MMM YYYY">DD MMM YYYY (31 Dec 2024)</option>
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Preview: {new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: region.dateFormat.includes('MMM') ? 'short' : '2-digit',
                            day: '2-digit'
                        })}
                    </p>
                </div>
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

export default RegionTab;
