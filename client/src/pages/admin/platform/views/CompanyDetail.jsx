import React, { useState, useEffect } from 'react';
import api from '../../../../../services/api';
import { ArrowLeft, Shield, AlertTriangle, Save, Trash2, Globe, Mail } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const CompanyDetail = ({ companyId, onBack }) => {
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState("");
    const [isSuspended, setIsSuspended] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (companyId) fetchCompany();
    }, [companyId]);

    const fetchCompany = async () => {
        try {
            // Reusing get active companies for now and filtering client side or fetch specific if endpoint exists
            // Ideally should have GET /api/admin/companies/:id
            // For hackathon speed, I'll filter from the list or assume I can get it.
            // Actually, let's just use the active-companies list and find it, OR implement the endpoint.
            // Implementing a fetch logic here assuming endpoint exists or using simpler approach:

            // Let's rely on the parent ActiveCompanies passing the data OR fetch fresh. 
            // I'll assume endpoint GET /api/admin/company/:id needs to be created or I use the existing list approach.
            // Let's try to fetch active-companies and find.
            const res = await api.get(`/api/admin/active-companies`);
            const found = res.data.find(c => c._id === companyId);
            if (found) {
                setCompany(found);
                setPlan(found.plan || 'free');
                // setIsSuspended(found.isActive === false);
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            // Need endpoint to update company plan/status. 
            // Mocking for UI demo or adding to backend if I have time.
            // await api.put(...)
            showToast("Company updated successfully (Mock)", "success");
        } catch (err) {
            showToast("Failed to update", "error");
        }
    };

    if (loading) return (
    <div className="p-8 animate-pulse space-y-6">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-2">
                <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="h-3 w-56 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700" />)}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-3">
            {[70,50,80,60].map((w,i) => <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{width:`${w}%`}} />)}
        </div>
    </div>
);
    if (!company) return <div className="p-8">Company not found</div>;

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <ArrowLeft size={18} /> Back to List
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-700/30">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none">
                            {company.logo ? <img src={company.logo} alt="" className="w-full h-full object-cover rounded-2xl" /> : company.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{company.name}</h1>
                            <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <span className="flex items-center gap-1"><Globe size={14} /> {company.domain || "No domain"}</span>
                                <span className="flex items-center gap-1"><Mail size={14} /> {company.billingEmail}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Settings */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Shield size={20} className="text-indigo-600 dark:text-indigo-400" /> Subscription & Status
                        </h3>

                        <div className="bg-gray-50 dark:bg-gray-700/30 p-6 rounded-2xl border border-gray-100 dark:border-gray-600">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Subscription Plan</label>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {['free', 'starter', 'professional', 'enterprise'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPlan(p)}
                                        className={`py-2 px-4 rounded-xl text-sm font-bold capitalize border-2 transition-all
                                            ${plan === p
                                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                                                : 'border-transparent bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                            <h4 className="font-bold text-red-900 dark:text-red-400 mb-2 flex items-center gap-2">
                                <AlertTriangle size={18} /> Danger Zone
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-4">Suspend access for this company. Users will not be able to log in.</p>
                            <div className="flex items-center gap-4">
                                <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20">
                                    Suspend Company
                                </button>
                                <button className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md">
                                    Delete Data
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Usage Statistics</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl">
                                <p className="text-xs font-bold text-gray-400 uppercase">Total Users</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">24</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl">
                                <p className="text-xs font-bold text-gray-400 uppercase">Storage Used</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">4.2 GB</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl">
                                <p className="text-xs font-bold text-gray-400 uppercase">Workspaces</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">3</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl">
                                <p className="text-xs font-bold text-gray-400 uppercase">Last Active</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">2h ago</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex justify-end gap-3">
                    <button onClick={onBack} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-8 py-3 bg-gray-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-indigo-700 shadow-lg shadow-gray-200 dark:shadow-none flex items-center gap-2 transition-colors">
                        <Save size={18} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyDetail;
