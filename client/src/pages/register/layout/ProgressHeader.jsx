import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * ProgressHeader Component
 * Step indicators and dynamic title for registration form
 */
const ProgressHeader = ({ currentStep, theme }) => {
    const getTitleForStep = (step) => {
        switch (step) {
            case 1: return "Start Your Organization";
            case 2: return "Administrator Profile";
            case 3: return "Secure Account";
            case 4: return "Verification";
            case 5: return "Review & Launch";
            default: return "";
        }
    };

    return (
        <div className={`shrink-0 px-8 pt-8 pb-4 border-b ${theme === 'dark' ? 'border-gray-800/50 bg-slate-900/30' : 'border-gray-100/50 bg-white/30'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-indigo-900/50 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100'} text-[10px] font-bold uppercase tracking-wider mb-2 border`}>
                        <Sparkles size={10} />
                        <span>Step {currentStep} of 5</span>
                    </div>
                    <h1 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tracking-tight`}>
                        {getTitleForStep(currentStep)}
                    </h1>
                </div>

                {/* Progress Indicators */}
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((step) => (
                        <div
                            key={step}
                            className={`h-2 rounded-full transition-all duration-500 ${currentStep >= step
                                    ? `w-8 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`
                                    : `w-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProgressHeader;
