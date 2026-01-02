// client/src/components/workspace/ProfileQuickSettings.jsx
// Quick profile settings widget for workspaces page

import React, { useState, useEffect } from 'react';
import {
    User, X, Mail, Phone, Calendar, MapPin, Camera, Save,
    Settings, Shield, LogOut, Sun, Moon, Monitor, Edit3,
    Check, ChevronRight, Building
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';

const ProfileQuickSettings = ({ onClose }) => {
    const { user, updateProfile, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { showToast } = useToast();
    const { company } = useCompany();

    const [view, setView] = useState('main'); // main, edit, theme, security
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        username: user?.username || '',
        phone: user?.phone || '',
        phoneCode: user?.phoneCode || '+1',
        address: user?.address || '',
        dob: user?.profile?.dob ? new Date(user.profile.dob).toISOString().split('T')[0] : '',
        about: user?.profile?.about || ''
    });

    // Reset form when user changes
    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                phone: user.phone || '',
                phoneCode: user.phoneCode || '+1',
                address: user.address || '',
                dob: user.profile?.dob ? new Date(user.profile.dob).toISOString().split('T')[0] : '',
                about: user.profile?.about || ''
            });
        }
    }, [user]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateProfile(formData);
            showToast('Profile updated successfully!', 'success');
            setIsEditing(false);
            setView('main');
        } catch (err) {
            showToast(err.message || 'Failed to update profile', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    // Main View
    const renderMainView = () => (
        <div className="space-y-4">
            {/* User Header */}
            <div className="text-center">
                <div className="relative inline-block mb-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                        {user?.profilePicture ? (
                            <img
                                src={user.profilePicture}
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span>{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                        )}
                    </div>
                    <button
                        onClick={() => setView('edit')}
                        className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors border-2 border-gray-100"
                    >
                        <Edit3 size={14} className="text-gray-600" />
                    </button>
                </div>
                <h3 className="text-lg font-black text-gray-900">{user?.username}</h3>
                <p className="text-sm text-gray-500">{user?.email}</p>

                {/* Role Badge */}
                <div className="mt-2 flex items-center justify-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${user?.companyRole === 'owner' ? 'bg-purple-100 text-purple-700' :
                            user?.companyRole === 'admin' ? 'bg-blue-100 text-blue-700' :
                                user?.companyRole === 'manager' ? 'bg-green-100 text-green-700' :
                                    'bg-slate-100 text-slate-700'
                        }`}>
                        {user?.companyRole?.charAt(0).toUpperCase() + user?.companyRole?.slice(1) || 'Member'}
                    </span>
                    {company?.name && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Building size={12} />
                            {company.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Quick Info Cards */}
            <div className="space-y-2">
                {user?.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone size={16} className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Phone</p>
                            <p className="text-sm font-semibold text-gray-900">{user.phoneCode} {user.phone}</p>
                        </div>
                    </div>
                )}

                {formData.dob && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar size={16} className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Birthday</p>
                            <p className="text-sm font-semibold text-gray-900">
                                {new Date(formData.dob).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {user?.createdAt && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar size={16} className="text-gray-400" />
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Member Since</p>
                            <p className="text-sm font-semibold text-gray-900">
                                {new Date(user.createdAt).toLocaleDateString('en-US', {
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
                <button
                    onClick={() => setView('edit')}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <User size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        <span className="text-sm font-medium text-gray-700">Edit Profile</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </button>

                <button
                    onClick={() => setView('theme')}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <Settings size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        <span className="text-sm font-medium text-gray-700">Appearance</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </button>

                {(user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
                    <>
                        <div className="border-t border-gray-100 my-2"></div>
                        <button
                            onClick={() => window.location.href = '/admin/dashboard'}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-indigo-50 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <Shield size={18} className="text-indigo-600" />
                                <span className="text-sm font-bold text-indigo-600">Admin Dashboard</span>
                            </div>
                            <ChevronRight size={16} className="text-indigo-600" />
                        </button>
                    </>
                )}

                <div className="border-t border-gray-100 my-2"></div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    );

    // Edit Profile View
    const renderEditView = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <button
                    onClick={() => setView('main')}
                    className="text-sm text-gray-500 hover:text-gray-900 font-medium"
                >
                    ← Back
                </button>
                <h4 className="text-sm font-bold text-gray-900">Edit Profile</h4>
                <div className="w-12"></div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {/* Profile Picture */}
                <div className="flex justify-center">
                    <div className="relative group">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black">
                            {user?.profilePicture ? (
                                <img src={user.profilePicture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span>{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <button className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={20} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Form Fields */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Full Name</label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Email</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-500">{user?.email}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Phone Number</label>
                    <div className="flex gap-2">
                        <select
                            value={formData.phoneCode}
                            onChange={(e) => setFormData({ ...formData, phoneCode: e.target.value })}
                            className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                            <option value="+1">+1</option>
                            <option value="+44">+44</option>
                            <option value="+91">+91</option>
                        </select>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            placeholder="123-456-7890"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Date of Birth</label>
                    <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Address</label>
                    <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                        placeholder="123 Main St, City, State, ZIP"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">About</label>
                    <textarea
                        value={formData.about}
                        onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                        placeholder="Tell us about yourself..."
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{formData.about?.length || 0}/500</p>
                </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                    onClick={() => setView('main')}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={16} /> Save Changes
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    // Theme View
    const renderThemeView = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <button
                    onClick={() => setView('main')}
                    className="text-sm text-gray-500 hover:text-gray-900 font-medium"
                >
                    ← Back
                </button>
                <h4 className="text-sm font-bold text-gray-900">Appearance</h4>
                <div className="w-12"></div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => {
                            setTheme('light');
                            showToast('Theme changed to Light', 'success');
                        }}
                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${theme === 'light'
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <Sun size={24} className={theme === 'light' ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className={`text-xs font-bold ${theme === 'light' ? 'text-indigo-600' : 'text-gray-600'}`}>
                            Light
                        </span>
                        {theme === 'light' && <Check size={16} className="text-indigo-600" />}
                    </button>

                    <button
                        onClick={() => {
                            setTheme('dark');
                            showToast('Theme changed to Dark', 'success');
                        }}
                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${theme === 'dark'
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <Moon size={24} className={theme === 'dark' ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-indigo-600' : 'text-gray-600'}`}>
                            Dark
                        </span>
                        {theme === 'dark' && <Check size={16} className="text-indigo-600" />}
                    </button>

                    <button
                        onClick={() => {
                            setTheme('auto');
                            showToast('Theme set to Auto', 'success');
                        }}
                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${theme === 'auto'
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <Monitor size={24} className={theme === 'auto' ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className={`text-xs font-bold ${theme === 'auto' ? 'text-indigo-600' : 'text-gray-600'}`}>
                            Auto
                        </span>
                        {theme === 'auto' && <Check size={16} className="text-indigo-600" />}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <h3 className="text-lg font-black text-gray-900">My Profile</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                        <X size={18} className="text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {view === 'main' && renderMainView()}
                    {view === 'edit' && renderEditView()}
                    {view === 'theme' && renderThemeView()}
                </div>
            </div>
        </div>
    );
};

export default ProfileQuickSettings;
