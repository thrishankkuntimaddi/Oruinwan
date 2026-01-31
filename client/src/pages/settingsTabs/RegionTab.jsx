import React from 'react';
import { Globe } from 'lucide-react';
import Card from './Card';

// Radio Select Component (inline for tab use)
const RadioSelect = ({ options, selected, onChange }) => (
    <div className="space-y-2">
        {options.map((option) => (
            <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${selected === option.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500/50'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
            >
                <div className="flex items-center gap-3">
                    {option.icon && <option.icon size={18} className={selected === option.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />}
                    <span className={`text-sm font-medium ${selected === option.value ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {option.label}
                    </span>
                </div>
                {selected === option.value && <div className="w-4 h-4 rounded-full bg-indigo-600 border-2 border-white dark:border-indigo-900"></div>}
            </button>
        ))}
    </div>
);

/**
 * RegionTab - Language and region settings
 * @param {object} props - Component props
 * @param {object} props.region - Region settings (language, timezone, dateFormat)
 * @param {function} props.setRegion - Update region handler
 */
const RegionTab = ({ region, setRegion }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Language" subtitle="Select your preferred interface language">
                <RadioSelect
                    selected={region.language}
                    onChange={(v) => setRegion({ ...region, language: v })}
                    options={[
                        { value: 'en', label: 'English (US)', icon: Globe },
                        { value: 'es', label: 'Español', icon: Globe },
                        { value: 'fr', label: 'Français', icon: Globe },
                        { value: 'de', label: 'Deutsch', icon: Globe },
                    ]}
                />
            </Card>

            <Card title="Date & Time" subtitle="Regional formatting preferences">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Timezone</label>
                        <select
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            value={region.timezone}
                            onChange={(e) => setRegion({ ...region, timezone: e.target.value })}
                        >
                            <option value="auto">Automatic (Browser Default)</option>
                            <option value="utc">UTC</option>
                            <option value="est">Eastern Time (US)</option>
                            <option value="pst">Pacific Time (US)</option>
                            <option value="ist">Indian Standard Time</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Date Format</label>
                        <select
                            className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            value={region.dateFormat}
                            onChange={(e) => setRegion({ ...region, dateFormat: e.target.value })}
                        >
                            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                        </select>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default RegionTab;
