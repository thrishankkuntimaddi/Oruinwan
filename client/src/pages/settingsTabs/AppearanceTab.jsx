import React from 'react';
import { Sun, Moon, Laptop, CheckCircle2 } from 'lucide-react';
import Card from './Card';

const THEMES = [
    {
        id: 'light',
        label: 'Light',
        description: 'Clean, bright interface',
        icon: Sun,
        preview: (
            <div className="w-full h-16 bg-white rounded-lg border border-slate-200 flex overflow-hidden">
                <div className="w-1/3 bg-slate-100 h-full" />
                <div className="flex-1 p-2 space-y-1">
                    <div className="h-2 bg-slate-200 rounded w-3/4" />
                    <div className="h-2 bg-slate-200 rounded w-1/2" />
                </div>
            </div>
        )
    },
    {
        id: 'dark',
        label: 'Dark',
        description: 'Easy on the eyes at night',
        icon: Moon,
        preview: (
            <div className="w-full h-16 bg-[#0B0F19] rounded-lg border border-white/10 flex overflow-hidden">
                <div className="w-1/3 bg-[#111827] h-full" />
                <div className="flex-1 p-2 space-y-1">
                    <div className="h-2 bg-white/10 rounded w-3/4" />
                    <div className="h-2 bg-white/10 rounded w-1/2" />
                </div>
            </div>
        )
    },
    {
        id: 'auto',
        label: 'System',
        description: 'Matches your OS setting',
        icon: Laptop,
        preview: (
            <div className="w-full h-16 rounded-lg border border-slate-200 flex overflow-hidden" style={{ background: 'linear-gradient(135deg, #fff 50%, #0B0F19 50%)' }}>
                <div className="w-1/3 h-full" style={{ background: 'linear-gradient(135deg, #f1f5f9 50%, #111827 50%)' }} />
                <div className="flex-1 p-2 space-y-1">
                    <div className="h-2 rounded w-3/4" style={{ background: 'linear-gradient(135deg, #e2e8f0 50%, #ffffff1a 50%)' }} />
                    <div className="h-2 rounded w-1/2" style={{ background: 'linear-gradient(135deg, #e2e8f0 50%, #ffffff1a 50%)' }} />
                </div>
            </div>
        )
    },
];

/**
 * AppearanceTab - Theme selection (fixed CSS variables to use concrete indigo/slate classes)
 */
const AppearanceTab = ({ theme, toggleTheme }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Interface Theme" subtitle="Customize the look and feel of Chttrix">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {THEMES.map((mode) => {
                        const isActive = theme === mode.id;
                        const Icon = mode.icon;
                        return (
                            <button
                                key={mode.id}
                                onClick={() => toggleTheme(mode.id)}
                                className={`relative p-4 border-2 rounded-2xl flex flex-col gap-3 transition-all duration-200 text-left ${isActive
                                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 ring-1 ring-indigo-500'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40'
                                    }`}
                            >
                                {/* Mini preview mockup */}
                                {mode.preview}

                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-600 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${isActive ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {mode.label}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{mode.description}</div>
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="absolute top-3 right-3 text-indigo-600 dark:text-indigo-400">
                                        <CheckCircle2 size={18} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5 p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">System</span> mode automatically switches between Light and Dark based on your operating system settings.
                    </p>
                </div>
            </Card>

            <Card title="Font Size" subtitle="Adjust text size throughout the app">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">A</span>
                    <input
                        type="range"
                        min="12"
                        max="18"
                        defaultValue="14"
                        className="flex-1 accent-indigo-600"
                        onChange={(e) => {
                            document.documentElement.style.fontSize = `${e.target.value}px`;
                        }}
                    />
                    <span className="text-lg text-slate-700 dark:text-slate-300 font-bold">A</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    Font size changes apply immediately but are not saved between sessions yet.
                </p>
            </Card>
        </div>
    );
};

export default AppearanceTab;
