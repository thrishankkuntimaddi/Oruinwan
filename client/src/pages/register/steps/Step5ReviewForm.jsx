import React from 'react';
import { Building, User, ShieldCheck, FileText } from 'lucide-react';

/**
 * Step5ReviewForm Component
 * Summary review cards with click-to-edit functionality
 */
const Step5ReviewForm = ({
    formData,
    onEdit,
    theme
}) => {
    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Verify your information before submitting.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Organization */}
                <div
                    className={`${theme === 'dark' ? 'bg-slate-800/60 border-gray-700 hover:border-indigo-400' : 'bg-white/60 border-gray-200 hover:border-indigo-300'} p-6 rounded-3xl border transition-all cursor-pointer group`}
                    onClick={() => onEdit(1)}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                            <Building size={18} className={`${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'}`} /> Organization
                        </h3>
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            Edit
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Name</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formData.companyName}</span>
                        </div>
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Domain</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formData.companyDomain}</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Admin */}
                <div
                    className={`${theme === 'dark' ? 'bg-slate-800/60 border-gray-700 hover:border-indigo-400' : 'bg-white/60 border-gray-200 hover:border-indigo-300'} p-6 rounded-3xl border transition-all cursor-pointer group`}
                    onClick={() => onEdit(2)}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                            <User size={18} className={`${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'}`} /> Admin
                        </h3>
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            Edit
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Name</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formData.adminName}</span>
                        </div>
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Role</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formData.role === "Other" ? formData.roleOther : formData.role}</span>
                        </div>
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Contact</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} text-sm`}>
                                {formData.personalEmail}<br />{formData.phoneCode} {formData.phone}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Card 3: Account */}
                <div
                    className={`${theme === 'dark' ? 'bg-slate-800/60 border-gray-700 hover:border-indigo-400' : 'bg-white/60 border-gray-200 hover:border-indigo-300'} p-6 rounded-3xl border transition-all cursor-pointer group`}
                    onClick={() => onEdit(3)}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                            <ShieldCheck size={18} className={`${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'}`} /> Account
                        </h3>
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            Edit
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Comp. Email</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formData.companyEmail}</span>
                        </div>
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>Password</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>••••••••</span>
                        </div>
                    </div>
                </div>

                {/* Card 4: Documents */}
                <div
                    className={`${theme === 'dark' ? 'bg-slate-800/60 border-gray-700 hover:border-indigo-400' : 'bg-white/60 border-gray-200 hover:border-indigo-300'} p-6 rounded-3xl border transition-all cursor-pointer group`}
                    onClick={() => onEdit(4)}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
                            <FileText size={18} className={`${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'}`} /> Documents
                        </h3>
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            Edit
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} font-bold uppercase block`}>File</span>
                            <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{formData.documents?.name}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step5ReviewForm;
