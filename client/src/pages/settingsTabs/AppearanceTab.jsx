import React from 'react';
import { Sun, Moon, Laptop, CheckCircle2 } from 'lucide-react';
import Card from './Card';

const THEMES = [
    {
        id: 'light',
        label: 'Light',
        description: 'Clean & bright',
        icon: Sun,
        preview: (
            <div className="w-full h-14 bg-white rounded-lg border border-gray-200 flex overflow-hidden">
                <div className="w-1/3 bg-gray-100 h-full border-r border-gray-200" />
                <div className="flex-1 p-2 space-y-1.5">
                    <div className="h-1.5 bg-gray-200 rounded w-3/4" />
                    <div className="h-1.5 bg-gray-200 rounded w-1/2" />
                    <div className="h-1.5 bg-gray-100 rounded w-2/3" />
                </div>
            </div>
        )
    },
    {
        id: 'dark',
        label: 'Dark',
        description: 'Easy at night',
        icon: Moon,
        preview: (
            <div className="w-full h-14 bg-gray-950 rounded-lg border border-gray-700 flex overflow-hidden">
                <div className="w-1/3 bg-gray-900 h-full border-r border-gray-800" />
                <div className="flex-1 p-2 space-y-1.5">
                    <div className="h-1.5 bg-gray-700 rounded w-3/4" />
                    <div className="h-1.5 bg-gray-800 rounded w-1/2" />
                    <div className="h-1.5 bg-gray-800 rounded w-2/3" />
                </div>
            </div>
        )
    },
    {
        id: 'auto',
        label: 'System',
        description: 'Follows OS setting',
        icon: Laptop,
        preview: (
            <div className="w-full h-14 rounded-lg border border-gray-300 flex overflow-hidden" style={{ background: 'linear-gradient(90deg, #fff 50%, #030712 50%)' }}>
                <div className="w-1/3 h-full border-r border-gray-300" style={{ background: 'linear-gradient(90deg, #f3f4f6 50%, #111827 50%)' }} />
                <div className="flex-1 p-2 space-y-1.5">
                    <div className="h-1.5 rounded w-3/4" style={{ background: 'linear-gradient(90deg, #e5e7eb 50%, #374151 50%)' }} />
                    <div className="h-1.5 rounded w-1/2" style={{ background: 'linear-gradient(90deg, #e5e7eb 50%, #374151 50%)' }} />
                </div>
            </div>
        )
    },
];

const AppearanceTab = ({ theme, toggleTheme }) => {
    return (
        <div className="space-y-4">
            <Card title="Interface Theme" subtitle="Choose your preferred color scheme">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {THEMES.map((mode) => {
                        const isActive = theme === mode.id;
                        const Icon = mode.icon;
                        return (
                            <button
                                key={mode.id}
                                onClick={() => toggleTheme(mode.id)}
                                className={`relative p-3 border rounded-xl flex flex-col gap-2.5 text-left transition-all ${isActive
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-500'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                            >
                                {mode.preview}
                                <div className="flex items-center gap-2">
                                    <div className={`p-1 rounded-lg ${isActive ? 'bg-blue-100 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                        <Icon size={13} />
                                    </div>
                                    <div>
                                        <div className={`text-[12.5px] font-bold ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{mode.label}</div>
                                        <div className="text-[11px] text-gray-400">{mode.description}</div>
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="absolute top-2.5 right-2.5">
                                        <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                    <strong className="text-gray-600 dark:text-gray-400">System</strong> mode follows your OS light/dark preference automatically.
                </p>
            </Card>

            <Card title="Font Size" subtitle="Adjust text density across the app">
                <div className="flex items-center gap-4">
                    <span className="text-[11px] text-gray-400 w-4 text-center">A</span>
                    <input
                        type="range"
                        min="12"
                        max="18"
                        defaultValue="14"
                        className="flex-1 accent-blue-600 h-1.5"
                        onChange={(e) => { document.documentElement.style.fontSize = `${e.target.value}px`; }}
                    />
                    <span className="text-base text-gray-700 dark:text-gray-300 font-bold w-4 text-center">A</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Changes apply immediately but reset on refresh.</p>
            </Card>
        </div>
    );
};

export default AppearanceTab;
