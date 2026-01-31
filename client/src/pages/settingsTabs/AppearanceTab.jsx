import React from 'react';
import { Sun, Moon, Laptop, CheckCircle2 } from 'lucide-react';
import Card from './Card';

/**
 * AppearanceTab - Theme selection interface
 * @param {object} props - Component props
 * @param {string} props.theme - Current theme ('light', 'dark', 'auto')
 * @param {function} props.toggleTheme - Theme change handler
 */
const AppearanceTab = ({ theme, toggleTheme }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Interface Theme" subtitle="Customize the look and feel of Chttrix">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        { id: 'light', label: 'Light Mode', icon: Sun },
                        { id: 'dark', label: 'Dark Mode', icon: Moon },
                        { id: 'auto', label: 'System Default', icon: Laptop }
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => toggleTheme(mode.id)}
                            className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-4 transition-all relative overflow-hidden group ${theme === mode.id
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-600/10 dark:border-indigo-500'
                                : 'border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/30 bg-white dark:bg-[#0B0F19]'
                                }`}
                        >
                            <div className={`p-4 rounded-full ${theme === mode.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600 dark:text-white shadow-lg' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:scale-110 transition-transform'}`}>
                                <mode.icon size={24} />
                            </div>
                            <div className="text-center z-10">
                                <h4 className={`font-bold ${theme === mode.id ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{mode.label}</h4>
                            </div>
                            {theme === mode.id && <div className="absolute top-3 right-3 text-indigo-600 dark:text-indigo-400"><CheckCircle2 size={18} /></div>}
                        </button>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default AppearanceTab;
