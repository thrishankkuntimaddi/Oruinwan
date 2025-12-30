import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Shield, FileText, ArrowRight, Building } from 'lucide-react';

const CompanyConfirmation = () => {
    const { user } = useAuth(); // Removed 'login'
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    // In a real app, we might fetch company details here if not in user object
    // For now, rely on user.company object

    const company = user?.company || {};

    const handleConfirm = async () => {
        setIsLoading(true);
        // We don't necessarily need an API call here if it's just a "Read & Accept" 
        // that leads to the Setup Wizard. The Setup Wizard step 1 will update the backend.
        // However, we can mark step 0 -> 1 here if we want granular tracking.

        setTimeout(() => {
            navigate('/company/setup');
            setIsLoading(false);
        }, 800);
    };

    if (!user) return null;

    return (
        <div className="h-screen w-full bg-slate-50 relative overflow-hidden font-sans flex flex-col items-center justify-center p-6">

            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-64 h-64 bg-indigo-100 rounded-full blur-[80px] opacity-60"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-50 rounded-full blur-[100px] opacity-60"></div>
            </div>

            <div className="max-w-3xl w-full bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/60 overflow-hidden relative z-10 flex flex-col md:flex-row">

                {/* Left Side: Summary */}
                <div className="w-full md:w-2/5 bg-slate-900 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/20 to-transparent"></div>

                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 border border-white/10">
                            <Building className="text-indigo-300" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Welcome Aboard</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Your company registration has been verified. Please review the details before configuring your workspace.
                        </p>
                    </div>

                    <div className="relative z-10 mt-8 space-y-4">
                        <div className="py-3 px-4 bg-white/5 rounded-lg border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Company Name</p>
                            <p className="font-semibold text-lg">{company.name}</p>
                        </div>
                        <div className="py-3 px-4 bg-white/5 rounded-lg border border-white/5">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Verified Domain</p>
                            <p className="font-semibold text-blue-300 flex items-center gap-2">
                                <Shield size={14} /> {company.domain || "N/A"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Action */}
                <div className="w-full md:w-3/5 p-8 md:p-10 flex flex-col">
                    <div className="mb-6">
                        <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wider mb-4 border border-green-100">
                            <CheckCircle size={12} /> Verified
                        </span>
                        <h1 className="text-3xl font-black text-gray-900 mb-2">Confirmation</h1>
                        <p className="text-gray-500">
                            You are becoming the <strong>Primary Owner</strong> of this workspace. This action cannot be undone.
                        </p>
                    </div>

                    <div className="flex-1 bg-gray-50 rounded-xl p-5 border border-gray-100 mb-8 overflow-y-auto max-h-48 text-sm text-gray-600 space-y-3">
                        <div className="flex items-start gap-3">
                            <FileText size={18} className="mt-0.5 text-gray-400 shrink-0" />
                            <p>By proceeding, you agree to the <span className="text-indigo-600 underline cursor-pointer">Terms of Service</span> and <span className="text-indigo-600 underline cursor-pointer">Privacy Policy</span>.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Shield size={18} className="mt-0.5 text-gray-400 shrink-0" />
                            <p>You confirm that you have the authority to manage the workspace for <strong>{company.name}</strong>.</p>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2 group"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    Accept & Continue Setup
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyConfirmation;
