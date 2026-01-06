// client/src/pages/admin/AdminProfile.jsx
// Personal profile page for admin users

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import AdminSidebar from '../../components/admin/AdminSidebar';
import {
    User, Mail, Phone, MapPin, Calendar, Building, Shield,
    Camera, Save, X, Check
} from 'lucide-react';

const AdminProfile = () => {
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
        // TODO: Call backend API to update user profile
        setTimeout(() => {
            setIsSaving(false);
            setIsEditing(false);
            // Show success toast
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

    // Get role badge
    const getRoleBadge = () => {
        const role = user?.companyRole;
        const badgeColors = {
            owner: 'bg-purple-100 text-purple-700',
            admin: 'bg-blue-100 text-blue-700',
            manager: 'bg-green-100 text-green-700',
            member: 'bg-slate-100 text-slate-700'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColors[role] || badgeColors.member}`}>
                {role?.charAt(0).toUpperCase() + role?.slice(1) || 'Member'}
            </span>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 relative">
                {/* Header */}
                <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">My Profile</h2>
                        <p className="text-xs text-slate-500 font-medium">Manage your personal information</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                                >
                                    <X size={16} /> Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={16} /> Save Changes
                                        </>
                                    )}
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
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Profile Header Card */}
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-6">
                                    {/* Profile Picture */}
                                    <div className="relative group">
                                        <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-black border-4 border-white/30">
                                            {profileData.profilePicture ? (
                                                <img
                                                    src={profileData.profilePicture}
                                                    alt="Profile"
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                <span>{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <button className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="w-6 h-6 text-white" />
                                            </button>
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div>
                                        <h3 className="text-2xl font-black mb-2">{user?.username || 'User'}</h3>
                                        <div className="flex items-center gap-3 mb-3">
                                            {getRoleBadge()}
                                            <div className="flex items-center gap-1 text-sm text-indigo-100">
                                                <Building size={14} />
                                                {company?.name || 'Company'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-sm text-indigo-100">
                                            <Mail size={14} />
                                            {user?.email}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Personal Information */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <User size={20} className="text-indigo-600" />
                                Personal Information
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={profileData.username}
                                            onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="Enter your name"
                                        />
                                    ) : (
                                        <div className="px-4 py-2 bg-slate-50 rounded-lg text-slate-900 font-medium">
                                            {user?.username || 'Not set'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            value={profileData.email}
                                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="email@example.com"
                                        />
                                    ) : (
                                        <div className="px-4 py-2 bg-slate-50 rounded-lg text-slate-900 font-medium">
                                            {user?.email || 'Not set'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                                    {isEditing ? (
                                        <input
                                            type="tel"
                                            value={profileData.phone}
                                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    ) : (
                                        <div className="px-4 py-2 bg-slate-50 rounded-lg text-slate-900 font-medium">
                                            {user?.phone || 'Not set'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Member Since</label>
                                    <div className="px-4 py-2 bg-slate-50 rounded-lg text-slate-500 font-medium flex items-center gap-2">
                                        <Calendar size={16} />
                                        {user?.createdAt
                                            ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })
                                            : 'Unknown'}
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Address</label>
                                    {isEditing ? (
                                        <textarea
                                            value={profileData.address}
                                            onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                            placeholder="123 Main St, City, State, ZIP"
                                        />
                                    ) : (
                                        <div className="px-4 py-2 bg-slate-50 rounded-lg text-slate-900 font-medium min-h-[80px]">
                                            {user?.address || 'Not set'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Account Security */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Shield size={20} className="text-indigo-600" />
                                Account Security
                            </h4>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                    <div>
                                        <p className="font-bold text-slate-900">Password</p>
                                        <p className="text-sm text-slate-500">Last changed 30 days ago</p>
                                    </div>
                                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors">
                                        Change Password
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                    <div>
                                        <p className="font-bold text-slate-900">Two-Factor Authentication</p>
                                        <p className="text-sm text-slate-500">Add an extra layer of security</p>
                                    </div>
                                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                                        Enable 2FA
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminProfile;
