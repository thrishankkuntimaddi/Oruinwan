import React from 'react';
import { Mail, Loader } from 'lucide-react';
import Card from './Card';

/**
 * ProfileTab - User profile management
 * @param {object} props - Component props
 * @param {object} props.user - Current user object
 * @param {object} props.profileData - Profile form state
 * @param {function} props.setProfileData - Update profile form
 * @param {boolean} props.loading - Loading state
 * @param {function} props.handleProfileUpdate - Save profile handler
 */
const ProfileTab = ({ user, profileData, setProfileData, loading, handleProfileUpdate }) => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Personal Information" subtitle="Update your photo and personal details">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar Side */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-black shadow-lg ring-4 ring-white dark:ring-[#0B0F19]">
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span>{user?.username?.charAt(0)?.toUpperCase()}</span>
                                )}
                            </div>
                            <button className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="text-white text-xs font-bold">Change</span>
                            </button>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.username}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.role || 'Member'}</p>
                        </div>
                    </div>

                    {/* Form Side */}
                    <div className="flex-1 space-y-5 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Display Name</label>
                                <input
                                    type="text"
                                    value={profileData.username}
                                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Email Address</label>
                                <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed flex items-center gap-2">
                                    <Mail size={14} />
                                    {user?.email}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Phone Number</label>
                            <div className="flex gap-3">
                                <select
                                    value={profileData.phoneCode}
                                    onChange={(e) => setProfileData({ ...profileData, phoneCode: e.target.value })}
                                    className="w-28 px-3 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                >
                                    <option value="+1">+1 (US)</option>
                                    <option value="+91">+91 (IN)</option>
                                    <option value="+44">+44 (UK)</option>
                                </select>
                                <input
                                    type="tel"
                                    value={profileData.phone}
                                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                    className="flex-1 px-4 py-2.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none dark:text-white"
                                    placeholder="123-456-7890"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">About Bio</label>
                            <textarea
                                value={profileData.about}
                                onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                                rows={4}
                                maxLength={500}
                                className="w-full px-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none dark:text-white"
                                placeholder="Tell us a bit about user experience..."
                            />
                            <div className="text-right text-xs text-slate-400 mt-1">{profileData.about?.length || 0}/500</div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={handleProfileUpdate}
                                disabled={loading}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center gap-2"
                            >
                                {loading && <Loader size={16} className="animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ProfileTab;
