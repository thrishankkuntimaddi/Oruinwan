// client/src/components/manager/ManagerSettings.jsx
// Personal profile page for manager users - Simplified version of AdminProfile

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
    User, Mail, Camera, X, Check, Building
} from 'lucide-react';

const ManagerSettings = () => {
    const { user } = useAuth();
    const { company } = useCompany();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [profileData, setProfileData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        profilePicture: user?.profilePicture || ''
    });

    const handleSave = async () => {
        setIsSaving(true);
        // TODO: Call backend API to update user profile (reuse existing user update endpoint)
        setTimeout(() => {
            setIsSaving(false);
            setIsEditing(false);
            // Show success toast (need to import toast context if we want to show it)
        }, 1000);
    };

    const handleCancel = () => {
        setProfileData({
            username: user?.username || '',
            email: user?.email || '',
            phone: user?.phone || '',
            address: user?.address || '',
            profilePicture: user?.profilePicture || ''
        });
        setIsEditing(false);
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">My Settings</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage your profile and preferences</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                    <X size={16} /> Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : <><Check size={16} /> Save Changes</>}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Profile Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-600" />
                                Personal Information
                            </h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Avatar Section */}
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <div className="relative group">
                                    <div className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center text-4xl font-black text-indigo-600 border-4 border-white shadow-md">
                                        {profileData.username?.charAt(0)?.toUpperCase()}
                                    </div>
                                    {isEditing && (
                                        <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-transform hover:scale-110">
                                            <Camera size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-4 text-center">
                                    <p className="text-sm font-bold text-gray-900 capitalize">{user?.companyRole || 'Manager'}</p>
                                    <p className="text-xs text-gray-500">{company?.name}</p>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={profileData.username}
                                            onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                            disabled={!isEditing}
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="email"
                                            value={profileData.email}
                                            disabled={true} // Email usually not editable directly
                                            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value="Design (Head)" // Placeholder - normally fetched dynamically
                                            disabled={true}
                                            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerSettings;
