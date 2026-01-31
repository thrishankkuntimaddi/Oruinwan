import React from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import ProgressHeader from './ProgressHeader';

/**
 * RegisterLayout Component
 * Shared layout wrapper for all registration steps
 * 
 * Features:
 * - Animated background orbs
 * - Navbar with logo, theme toggle, login link
 * - Glass card wrapper with progress header
 * - Footer navigation buttons (Back/Continue/Submit)
 */
const RegisterLayout = ({
    children,
    theme,
    toggleTheme,
    onNavigate,
    currentStep,
    onBack,
    onNext,
    onSubmit,
    isLoading,
    showBackButton = true,
    showNextButton = true,
    showSubmitButton = false
}) => {
    return (
        <div className={`h-screen w-full ${theme === 'dark' ? 'bg-[#030712]' : 'bg-white'} relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col transition-colors duration-500`}>
            {/* Styles & Animations */}
            <style>{`
        @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
        @keyframes float-delayed { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 20px); } }
        .animate-float { animation: float 10s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(99, 102, 241, 0.2); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(99, 102, 241, 0.4); }
        .tooltip-trigger:hover + .tooltip-content { opacity: 1; visibility: visible; transform: translateY(0); }
      `}</style>

            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className={`absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full ${theme === 'dark' ? 'bg-gradient-to-br from-indigo-900/30 via-purple-900/30 to-transparent' : 'bg-gradient-to-br from-blue-100/50 via-purple-50/50 to-transparent'} blur-[100px] animate-float`}></div>
                <div className={`absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full ${theme === 'dark' ? 'bg-gradient-to-bl from-purple-900/30 via-pink-900/30 to-transparent' : 'bg-gradient-to-bl from-indigo-100/50 via-pink-50/50 to-transparent'} blur-[100px] animate-float-delayed`}></div>
            </div>

            {/* Navbar */}
            <nav className="relative z-50 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full shrink-0">
                <div onClick={() => onNavigate("/")} className="flex items-center gap-3 cursor-pointer group">
                    <img src="/chttrix-logo.jpg" alt="Logo" className="w-10 h-10 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300" />
                    <span className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} tracking-tight`}>Chttrix</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                        )}
                    </button>
                    <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Already have an account? <button onClick={() => onNavigate("/login")} className={`${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'} font-semibold ml-1`}>Sign in</button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden">
                {/* Glass Card */}
                <div className={`w-full max-w-4xl h-full max-h-[85vh] ${theme === 'dark' ? 'bg-slate-900/70 border-white/10' : 'bg-white/70 border-white/50'} backdrop-blur-xl rounded-[2.5rem] shadow-2xl ${theme === 'dark' ? 'shadow-none' : 'shadow-indigo-100/50'} border flex flex-col overflow-hidden transition-all duration-500`}>

                    {/* Progress Header */}
                    <ProgressHeader currentStep={currentStep} theme={theme} />

                    {/* Scrollable Form Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        {children}
                    </div>

                    {/* Footer Actions */}
                    <div className={`shrink-0 px-8 py-6 border-t ${theme === 'dark' ? 'border-gray-800/20 bg-slate-900/30' : 'border-gray-100/50 bg-white/30'} flex items-center justify-between`}>
                        {showBackButton && currentStep > 1 ? (
                            <button onClick={onBack} className={`${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'} font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-lg transition-colors`}>
                                <ArrowLeft size={16} /> Back
                            </button>
                        ) : <div></div>}

                        {showNextButton && currentStep < 5 ? (
                            <button
                                onClick={onNext}
                                className={`group relative px-6 py-3 ${theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-gray-900 hover:bg-black shadow-xl'} text-white font-bold rounded-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
                            >
                                <span className="relative flex items-center gap-2">
                                    Continue <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>
                        ) : showSubmitButton ? (
                            <button
                                onClick={onSubmit}
                                disabled={isLoading}
                                className="group relative px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                <span className="relative flex items-center gap-2">
                                    {isLoading ? "Submitting..." : "Submit Registration"}
                                    {!isLoading && <Sparkles size={18} className="animate-pulse" />}
                                </span>
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterLayout;
