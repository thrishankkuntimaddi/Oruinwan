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
                            className={`p-6 border rounded-2xl flex flex-col items-center gap-4 transition-all relative overflow-hidden group ${theme === mode.id
                                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10 dark:border-primary-500 ring-1 ring-primary-600 dark:ring-primary-500'
                                : 'border-secondary-200 dark:border-secondary-800 hover:border-primary-300 dark:hover:border-secondary-600 bg-white dark:bg-secondary-900/50'
                                }`}
                        >
                            <div className={`p-4 rounded-full transition-colors ${theme === mode.id
                                ? 'bg-primary-100 text-primary-600 dark:bg-primary-600 dark:text-white shadow-sm'
                                : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400 group-hover:scale-110 transition-transform'
                                }`}>
                                <mode.icon size={24} />
                            </div>
                            <div className="text-center z-10">
                                <h4 className={`font-bold ${theme === mode.id ? 'text-primary-900 dark:text-white' : 'text-secondary-700 dark:text-secondary-300'}`}>{mode.label}</h4>
                            </div>
                            {theme === mode.id && <div className="absolute top-3 right-3 text-primary-600 dark:text-primary-400"><CheckCircle2 size={18} /></div>}
                        </button>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default AppearanceTab;
