import React from 'react';
import { ChevronLeft, Trash2, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { getAvatarUrl } from '../../../utils/avatarUtils';

/**
 * ProfileView Component
 * Profile editing form with personal info and email management
 */
const ProfileView = ({
    user,
    formData,
    setFormData,
    phoneCode,
    setPhoneCode,
    emails,
    newEmail,
    setNewEmail,
    onBack,
    onSaveProfile,
    onAddEmail,
    onDeleteEmail,
    onMakePrimary,
    onVerifyEmail,
    onResendCode
}) => {
    return (
        <div className="w-full md:w-80 max-w-sm bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
            <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
                <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
                    <ChevronLeft size={14} className="mr-1" /> Back
                </button>
                <span className="font-bold text-gray-900 dark:text-white text-sm">Edit Profile</span>
                <div className="w-8"></div>
            </div>

            <div className="p-4 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                <div className="flex justify-center">
                    <div className="relative group" title="Profile Picture Upload - Coming Soon">
                        <div className="w-20 h-20 rounded-full bg-gray-300 bg-cover bg-center shadow-md border-4 border-white" style={{ backgroundImage: `url(${getAvatarUrl(user)})` }}></div>
                        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold">Change</span>
                        </div>
                        <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-sm hover:bg-blue-700 transition-colors border-2 border-white">
                            <Plus size={12} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Full Name</label>
                        <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Date of Birth</label>
                            <input
                                type="date"
                                value={formData.dob || ""}
                                onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                max={new Date().toISOString().split("T")[0]}
                                min="1900-01-01"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
                            <div className="flex">
                                <select
                                    value={phoneCode}
                                    onChange={(e) => setPhoneCode(e.target.value)}
                                    className="border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg px-2 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                >
                                    <option value="+1">+1</option>
                                    <option value="+44">+44</option>
                                    <option value="+91">+91</option>
                                    <option value="+81">+81</option>
                                </select>
                                <input
                                    type="tel"
                                    value={formData.phone || ""}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-r-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    placeholder={
                                        phoneCode === "+91" ? "98765 43210" :
                                            phoneCode === "+44" ? "7911 123456" :
                                                phoneCode === "+81" ? "90-1234-5678" :
                                                    "123-456-7890"
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email Addresses</label>
                        <div className="space-y-3">
                            {emails.map(email => (
                                <div key={email.id || email._id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{email.email}</span>
                                            {!email.isPrimary && (
                                                <button onClick={() => onDeleteEmail(email.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap pb-1">
                                            {email.verified ? (
                                                <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                                                    <CheckCircle2 size={10} className="mr-1" /> Verified
                                                </span>
                                            ) : (
                                                <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-800">
                                                    <AlertCircle size={10} className="mr-1" /> Unverified
                                                </span>
                                            )}
                                            {email.isPrimary && (
                                                <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                                    Primary
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                                            {!email.verified && (
                                                <>
                                                    <button
                                                        onClick={() => onVerifyEmail(email.id)}
                                                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        Verify Now
                                                    </button>
                                                    <button
                                                        onClick={() => onResendCode(email.id)}
                                                        className="text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
                                                    >
                                                        Resend Code
                                                    </button>
                                                </>
                                            )}
                                            {email.verified && !email.isPrimary && (
                                                <button onClick={() => onMakePrimary(email.id)} className="text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline">Set as Primary</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Add another email..."
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <button onClick={onAddEmail} className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">About</label>
                        <textarea
                            value={formData.about || ""}
                            onChange={e => setFormData({ ...formData, about: e.target.value })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            rows="3"
                            placeholder="Tell us a bit about yourself..."
                            maxLength={500}
                        />
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
                            {(formData.about || "").length} / 500 characters
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
                <button onClick={onSaveProfile} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">Save Changes</button>
            </div>
        </div >
    );
};

export default ProfileView;
