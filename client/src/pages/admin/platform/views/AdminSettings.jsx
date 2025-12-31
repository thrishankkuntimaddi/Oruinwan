import React, { useState } from 'react';
import { User, Mail, Phone, Upload, Save, Building, Shield } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

const AdminSettings = () => {
    const { showToast } = useToast();
    const [profile, setProfile] = useState({
        displayName: "Chttrix Super Admin",
        email: "support@chttrix.com",
        phone: "+1 (555) 123-4567",
        bio: "We are here to help you collaborate better.",
        role: "Platform Owner"
    });

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        // Mock save
        showToast("Profile settings saved successfully", "success");
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Admin Settings & Profile</h2>
            <p className="text-gray-500 dark:text-gray-400">Manage your administrative profile and contact details visible to company admins.</p>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex items-center gap-6">
                    <div className="relative group cursor-pointer">
                        <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl font-bold border-4 border-white dark:border-gray-700 shadow-lg shadow-indigo-100 dark:shadow-none">
                            {profile.displayName.charAt(0)}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="text-white" size={24} />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{profile.displayName}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{profile.role}</p>
                        <div className="flex gap-2 mt-3">
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wide">Active</span>
                            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wide">Key Contact</span>
                        </div>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <User size={18} /> Public Details
                        </h4>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Display Name</label>
                            <input
                                name="displayName"
                                value={profile.displayName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Role Title</label>
                            <input
                                name="role"
                                value={profile.role}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Support Bio</label>
                            <textarea
                                name="bio"
                                value={profile.bio}
                                onChange={handleChange}
                                rows="3"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-600 dark:text-gray-300 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors resize-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Mail size={18} /> Contact Information
                        </h4>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Support Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    name="email"
                                    value={profile.email}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">This email will be visible to company admins for urgent support.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Emergency Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    name="phone"
                                    value={profile.phone}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-gray-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-indigo-700 shadow-lg shadow-gray-300 dark:shadow-none flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <Save size={18} /> Save Changes
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-lg p-8 text-white relative overflow-hidden">
                <div className="relative z-10 flex items-start gap-4">
                    <Shield size={32} className="text-white/80" />
                    <div>
                        <h3 className="text-xl font-black mb-1">Super Admin Access</h3>
                        <p className="text-indigo-100 text-sm max-w-lg mb-4">
                            You have full control over the Chttrix Platform. Your contact details serve as the primary truth for all 85+ active companies.
                        </p>
                        <button className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-bold transition-colors">
                            View Access Logs
                        </button>
                    </div>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10">
                    <Building size={200} />
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
