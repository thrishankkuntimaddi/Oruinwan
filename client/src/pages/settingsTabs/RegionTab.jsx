import React, { useState, useEffect } from 'react';
import Card from './Card';
import api from '../../services/api';
import Button from '../../shared/components/ui/Button';
import { Check, Globe2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

/**
 * RegionTab - Language and region settings with real API integration
 */
const RegionTab = ({ region, setRegion }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [detectedTimezone, setDetectedTimezone] = useState('');

    useEffect(() => {
        try {
            setDetectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        } catch (e) { }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/region', region);
            setHasChanges(false);
            showToast('Region settings saved', 'success');
        } catch (error) {
            console.error('Failed to save region:', error);
            showToast(error.response?.data?.message || 'Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const update = (key, value) => {
        setRegion({ ...region, [key]: value });
        setHasChanges(true);
    };

    // Live date format preview
    const previewDate = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        switch (region.dateFormat) {
            case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
            case 'DD/MM/YYYY': return `${d}/${m}/${y}`;
            case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
            case 'DD MMM YYYY': return `${d} ${months[now.getMonth()]} ${y}`;
            default: return `${m}/${d}/${y}`;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Language */}
            <Card title="Language" subtitle="Select your preferred display language">
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                        Display Language
                    </label>
                    <select
                        value={region.language}
                        onChange={(e) => update('language', e.target.value)}
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
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        Only English is fully supported. Other languages are in progress.
                    </p>
                </div>
            </Card>

            {/* Timezone */}
            <Card title="Timezone" subtitle="Set your local timezone for accurate timestamps">
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
                            onChange={(e) => update('timezone', e.target.value)}
                            className="w-full max-w-md px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        >
                            <option value="auto">Auto-detect ({detectedTimezone || 'Unknown'})</option>
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="Europe/London">London (GMT/BST)</option>
                            <option value="Europe/Paris">Paris (CET)</option>
                            <option value="Europe/Berlin">Berlin (CET)</option>
                            <option value="Asia/Dubai">Dubai (GST)</option>
                            <option value="Asia/Kolkata">India (IST)</option>
                            <option value="Asia/Shanghai">Shanghai (CST)</option>
                            <option value="Asia/Tokyo">Tokyo (JST)</option>
                            <option value="Australia/Sydney">Sydney (AEDT)</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Date & Time Format */}
            <Card title="Date & Time Format" subtitle="Customize how timestamps appear throughout the app">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                            Date Format
                        </label>
                        <select
                            value={region.dateFormat}
                            onChange={(e) => update('dateFormat', e.target.value)}
                            className="w-full max-w-md px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        >
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                            <option value="DD MMM YYYY">DD MMM YYYY</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Preview:</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">{previewDate()}</span>
                    </div>
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

export default RegionTab;
