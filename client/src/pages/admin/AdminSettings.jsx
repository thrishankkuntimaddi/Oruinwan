
import React from 'react';
import { Settings, Shield, Globe, Lock } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import AdminSidebar from '../../components/admin/AdminSidebar';
import DomainSettings from '../../components/company/DomainSettings';

const AdminSettings = () => {
    const { company } = useCompany();

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
                <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Settings</h2>
                        <p className="text-xs text-slate-500 font-medium">Configuration & Security</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar space-y-8">

                    {/* General Settings Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Company Profile</h3>
                            <p className="text-sm text-slate-500">Manage your company details and visibility.</p>
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Company Name</label>
                                        <input
                                            disabled
                                            value={company?.name || ''}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 font-medium cursor-not-allowed"
                                        />
                                        <p className="text-xs text-slate-400 mt-1">Contact support to change company name.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-200" />

                    {/* Domain Settings Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Domain & Security</h3>
                            <p className="text-sm text-slate-500">Verify your domain to enable auto-join and enhance security.</p>
                        </div>
                        <div className="lg:col-span-2">
                            {company?._id && <DomainSettings companyId={company._id} />}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default AdminSettings;
