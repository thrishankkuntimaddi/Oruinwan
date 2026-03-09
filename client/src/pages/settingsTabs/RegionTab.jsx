import React, { useState, useEffect } from 'react';
import Card from './Card';
import api from '../../services/api';
import { Check, Globe2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const RegionTab = ({ region, setRegion }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [detectedTimezone, setDetectedTimezone] = useState('');

    useEffect(() => {
        try { setDetectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/region', region);
            setHasChanges(false);
            showToast('Region settings saved', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save settings', 'error');
        } finally { setSaving(false); }
    };

    const update = (key, value) => {
        setRegion({ ...region, [key]: value });
        setHasChanges(true);
    };

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

    const selectClass = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12.5px] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
    const labelClass = "block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5";

    return (
        <div className="space-y-4">
            <Card title="Language" subtitle="Display language for the interface">
                <label className={labelClass}>Display Language</label>
                <select value={region.language} onChange={e => update('language', e.target.value)} className={`${selectClass} max-w-xs`}>
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
                    <option value="hi">हिन्दी</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-2">Only English is fully supported. Others coming soon.</p>
            </Card>

            <Card title="Timezone" subtitle="Set your local timezone for accurate timestamps">
                {detectedTimezone && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <Globe2 size={12} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="text-[12px] text-blue-700 dark:text-blue-300 font-medium">Detected: {detectedTimezone}</span>
                    </div>
                )}
                <label className={labelClass}>Timezone</label>
                <select value={region.timezone} onChange={e => update('timezone', e.target.value)} className={`${selectClass} max-w-xs`}>
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
            </Card>

            <Card title="Date Format" subtitle="Customize timestamps across the app">
                <label className={labelClass}>Format</label>
                <select value={region.dateFormat} onChange={e => update('dateFormat', e.target.value)} className={`${selectClass} max-w-xs`}>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                </select>
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg inline-flex">
                    <span className="text-[11px] text-gray-400">Preview:</span>
                    <span className="text-[12.5px] font-bold text-gray-800 dark:text-gray-100 font-mono">{previewDate()}</span>
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

export default RegionTab;
