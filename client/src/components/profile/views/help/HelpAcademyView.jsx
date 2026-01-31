import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * HelpAcademyView Component
 * Academy guides and learning resources
 */
const HelpAcademyView = ({ onBack }) => {
    return (
        <div className="w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Academy</span>
                <div className="w-8"></div>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
                {["Getting Started", "Power User Tips", "Workspace Mgmt", "Integrations"].map((guide, i) => (
                    <div key={i} className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                        <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">{guide}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Read guide →</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HelpAcademyView;
