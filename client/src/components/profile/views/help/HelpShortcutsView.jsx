import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * HelpShortcutsView Component
 * Keyboard shortcuts reference
 */
const HelpShortcutsView = ({ onBack }) => {
    return (
        <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Shortcuts</span>
                <div className="w-8"></div>
            </div>
            <div className="p-4 space-y-2">
                {[
                    { label: "Quick Search", keys: "Cmd+K" },
                    { label: "New Message", keys: "Cmd+N" },
                    { label: "Toggle AI", keys: "Cmd+J" },
                    { label: "Close", keys: "Esc" }
                ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{item.keys}</kbd>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HelpShortcutsView;
