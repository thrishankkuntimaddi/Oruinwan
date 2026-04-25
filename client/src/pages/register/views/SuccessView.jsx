import React from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';

const SuccessView = ({ formData, theme, onNavigate }) => {
    return (
        <div className={`h-screen w-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'} relative overflow-hidden font-sans flex flex-col items-center justify-center p-4 transition-colors duration-300`}>
            <style>{`
        @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
        .animate-float { animation: float 10s ease-in-out infinite; }
      `}</style>

            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className={`absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full ${theme === 'dark' ? 'bg-gradient-to-br from-indigo-900/30 via-purple-900/30 to-transparent' : 'bg-gradient-to-br from-blue-100/50 via-purple-50/50 to-transparent'} blur-[100px] animate-float`}></div>
            </div>

            <div className={`relative z-10 w-full max-w-lg ${theme === 'dark' ? 'bg-slate-800/70 border-white/10' : 'bg-white/70 border-white/50'} backdrop-blur-xl rounded-[2rem] shadow-2xl p-10 text-center border animate-fadeIn`}>
                <div className={`w-20 h-20 ${theme === 'dark' ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                    <CheckCircle size={40} />
                </div>

                <h1 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4 tracking-tight`}>
                    Application Submitted!
                </h1>

                <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-8 text-lg leading-relaxed`}>
                    Your company <strong>{formData.companyName}</strong> has been registered and is currently <strong>Pending Verification</strong>.
                </p>

                <div className={`${theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-800/50' : 'bg-blue-50 text-blue-800'} p-4 rounded-xl text-sm mb-8 text-left border`}>
                    <p className="font-bold mb-1 flex items-center gap-2">
                        <Sparkles size={16} /> What happens next?
                    </p>
                    <p>Our team will review your documents and domain. You will receive an activation email once your workspace is ready (usually within 24 hours).</p>
                </div>

                <button
                    onClick={() => onNavigate("/login")}
                    className={`w-full py-4 ${theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-900 hover:bg-gray-800'} text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all`}
                >
                    Return to Login
                </button>
            </div>
        </div>
    );
};

export default SuccessView;
