import React from 'react';
import { ChevronLeft, Sun, Moon, Monitor as MonitorIcon } from 'lucide-react';

/**
 * PreferencesView Component
 * User preferences: theme selection and notification settings
 */
const PreferencesView = ({ theme, setTheme, onBack }) => {
    return (
        <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
            <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Preferences</span>
                <div className="w-8"></div>
            </div>
            <div className="p-5 space-y-6">
                <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-3">Appearance</h4>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-2 border-2 rounded-xl flex flex-col items-center transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <Sun size={20} className={`mb-2 ${theme === 'light' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                            <span className={`text-[10px] font-bold ${theme === 'light' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>Light</span>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`p-2 border-2 rounded-xl flex flex-col items-center transition-all ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <Moon size={20} className={`mb-2 ${theme === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                            <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>Dark</span>
                        </button>
                        <button
                            onClick={() => setTheme('auto')}
                            className={`p-2 border-2 rounded-xl flex flex-col items-center transition-all ${theme === 'auto' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            <MonitorIcon size={20} className={`mb-2 ${theme === 'auto' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                            <span className={`text-[10px] font-bold ${theme === 'auto' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>Auto</span>
                        </button>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-3">Notifications</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">Desktop Notifications</span>
                            <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">Email Digest</span>
                            <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">Sound Effects</span>
                            <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreferencesView;
