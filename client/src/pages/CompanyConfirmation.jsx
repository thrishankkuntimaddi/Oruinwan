import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Shield, FileText, ArrowRight, Building, Sparkles } from 'lucide-react';

const CompanyConfirmation = () => {
    const { user, refreshUser } = useAuth(); // Assuming refreshUser exists, otherwise just rely on setup flow
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);

    const company = user?.company || {};

    const handleConfirm = async () => {
        if (!accepted) return;
        setIsLoading(true);
        try {
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${company.id}/start-setup`, {
                plan: "free", // Defaulting to free for now
                acceptedTerms: true
            }, { withCredentials: true });

            navigate('/company/setup');
        } catch (err) {
            console.error("Setup Start Error:", err);
            // navigate('/company/setup'); // fallback? No, better show error
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="h-screen w-full bg-white relative overflow-hidden font-sans flex flex-col items-center justify-center p-6">

            {/* Styles & Animations */}
            <style>{`
                @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
                @keyframes float-delayed { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 20px); } }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
            `}</style>

            {/* Premium Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-indigo-100/40 via-purple-50/40 to-transparent blur-[100px] animate-float"></div>
                <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-blue-100/40 via-teal-50/40 to-transparent blur-[100px] animate-float-delayed"></div>
            </div>

            <div className="max-w-4xl w-full bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/60 overflow-hidden relative z-10 flex flex-col md:flex-row transition-all animate-fadeIn">

                {/* Left Side: Summary */}
                <div className="w-full md:w-2/5 bg-gray-900 text-white p-10 flex flex-col justify-between relative overflow-hidden">
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/30 to-transparent z-0"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-lg">
                            <Building className="text-indigo-300" size={28} />
                        </div>
                        <h2 className="text-3xl font-black mb-3 tracking-tight">Welcome Aboard</h2>
                        <p className="text-gray-400 leading-relaxed font-medium">
                            Your workspace for <strong>{company.name}</strong> has been provisioned.
                        </p>
                    </div>

                    <div className="relative z-10 mt-10 space-y-4">
                        <div className="py-4 px-5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-1">
                                <Sparkles size={14} className="text-yellow-300" />
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Plan</p>
                            </div>
                            <p className="font-bold text-lg text-white">Enterprise Trial</p>
                        </div>
                        <div className="py-4 px-5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-1">
                                <Shield size={14} className="text-green-300" />
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Security</p>
                            </div>
                            <p className="font-bold text-lg text-white flex items-center gap-2">
                                {company.domain || "Standard"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Action */}
                <div className="w-full md:w-3/5 p-10 md:p-12 flex flex-col bg-white/40">
                    <div className="mb-8">
                        <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-green-100/80 text-green-700 text-xs font-bold uppercase tracking-wider mb-6 border border-green-200">
                            <CheckCircle size={12} strokeWidth={3} /> Verified
                        </span>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">One Last Step</h1>
                        <p className="text-gray-600 text-lg">
                            We need to configure your workspace preferences before you invite your team. This takes about 2 minutes.
                        </p>
                    </div>

                    <div className="flex-1 space-y-4 mb-10">
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Shield size={16} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Admin Access</h4>
                                <p className="text-sm text-gray-500 mt-0.5">You will be the primary owner of this workspace.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <FileText size={16} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Terms of Service</h4>
                                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={accepted}
                                        onChange={(e) => setAccepted(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <p className="text-sm text-gray-500">I agree to the Terms & Policies.</p>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading || !accepted}
                            className={`w-full py-4 font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 group ${isLoading || !accepted
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                                    : "bg-gray-900 hover:bg-black text-white shadow-gray-200 hover:shadow-2xl hover:scale-[1.01]"
                                }`}
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    Accept & Start Setup
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
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
