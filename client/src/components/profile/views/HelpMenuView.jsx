import React from 'react';
import { ChevronLeft, HelpCircle, BookOpen, Command, Bug, Sparkles, MessageCircle } from 'lucide-react';

/**
 * HelpMenuView Component
 * Help & Support menu with navigation to sub-views
 */
const HelpMenuView = ({ onBack, onNavigate }) => {
    return (
        <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
            <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 text-sm">Help & Support</span>
                <div className="w-8"></div>
            </div>
            <div className="p-2 space-y-1">
                <button onClick={() => onNavigate("help_academy")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
                    <BookOpen size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">Academy</span>
                </button>
                <button onClick={() => onNavigate("help_shortcuts")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
                    <Command size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">Keyboard Shortcuts</span>
                </button>
                <button onClick={() => onNavigate("help_bug")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
                    <Bug size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">Report a Bug</span>
                </button>
                <button onClick={() => onNavigate("help_whatsnew")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
                    <Sparkles size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">What's New</span>
                </button>
                <button onClick={() => onNavigate("help_contact")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
                    <MessageCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">Contact Support</span>
                </button>
            </div>
        </div>
    );
};

export default HelpMenuView;
