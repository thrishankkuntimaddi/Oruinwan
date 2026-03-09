import React, { useState, useRef } from 'react';
import { Mail, Upload, X, Camera, User, Loader2 } from 'lucide-react';
import Card from './Card';
import Avatar from '../../shared/components/ui/Avatar';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const ProfileTab = ({ user, profileData, setProfileData, loading, handleProfileUpdate }) => {
    const { showToast } = useToast();
    const [uploadingImage, setUploadingImage] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
        if (file.size > 5 * 1024 * 1024) { showToast('Image must be smaller than 5 MB', 'error'); return; }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleUploadProfilePicture = async () => {
        if (!selectedFile) return;
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('profilePicture', selectedFile);
            await api.post('/api/auth/me/profile-picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPreviewUrl(null); setSelectedFile(null);
            showToast('Profile photo updated', 'success');
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch (error) {
            showToast(error.response?.data?.message || 'Upload failed', 'error');
        } finally { setUploadingImage(false); }
    };

    const handleRemoveProfilePicture = async () => {
        setUploadingImage(true);
        setShowRemoveConfirm(false);
        try {
            await api.delete('/api/auth/me/profile-picture');
            showToast('Profile photo removed', 'success');
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch { showToast('Failed to remove photo', 'error'); }
        finally { setUploadingImage(false); }
    };

    const handleCancel = () => {
        setPreviewUrl(null); setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const inputClass = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12.5px] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
    const labelClass = "block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5";

    return (
        <div className="space-y-4">
            <Card title="Profile Photo" subtitle="Your avatar across all workspaces">
                <div className="flex items-center gap-5">
                    <div className="relative group flex-shrink-0">
                        <Avatar
                            src={previewUrl || user?.profilePicture}
                            alt={user?.username}
                            fallback={user?.username}
                            size="xl3"
                            className="w-20 h-20 text-2xl ring-2 ring-gray-200 dark:ring-gray-700"
                        />
                        <label
                            htmlFor="profile-pic-input"
                            className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                            {uploadingImage
                                ? <Loader2 size={18} className="text-white animate-spin" />
                                : <Camera size={18} className="text-white" />
                            }
                        </label>
                        <input id="profile-pic-input" ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={uploadingImage} />
                    </div>

                    <div className="flex-1">
                        <div className="text-[13px] font-bold text-gray-900 dark:text-white">{user?.username}</div>
                        <div className="text-[11.5px] text-gray-400 mb-3">{user?.role || 'Member'}</div>

                        {previewUrl ? (
                            <div className="flex gap-2">
                                <button onClick={handleUploadProfilePicture} disabled={uploadingImage}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                                    <Upload size={12} /> Save Photo
                                </button>
                                <button onClick={handleCancel} disabled={uploadingImage}
                                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-[12px] font-semibold rounded-lg transition-colors">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <label htmlFor="profile-pic-input"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-[12px] font-semibold rounded-lg transition-colors cursor-pointer">
                                    <Camera size={12} /> Change Photo
                                </label>
                                {user?.profilePicture && (
                                    <button onClick={() => setShowRemoveConfirm(true)}
                                        className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[12px] font-semibold rounded-lg transition-colors">
                                        Remove
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card title="Personal Information" subtitle="Your public profile details">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Display Name</label>
                            <input
                                type="text"
                                value={profileData.username}
                                onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                className={inputClass}
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Email Address</label>
                            <input type="email" value={user?.email || ''} disabled
                                className={`${inputClass} opacity-60 cursor-not-allowed`} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Phone Number</label>
                        <div className="flex gap-2">
                            <select
                                value={profileData.phoneCode}
                                onChange={e => setProfileData({ ...profileData, phoneCode: e.target.value })}
                                className="w-24 px-2 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12px] outline-none focus:border-blue-500 dark:text-white"
                            >
                                <option value="+1">+1 US</option>
                                <option value="+44">+44 UK</option>
                                <option value="+91">+91 IN</option>
                                <option value="+61">+61 AU</option>
                                <option value="+49">+49 DE</option>
                                <option value="+33">+33 FR</option>
                                <option value="+81">+81 JP</option>
                                <option value="+86">+86 CN</option>
                                <option value="+971">+971 UAE</option>
                            </select>
                            <input type="tel" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                                className={`${inputClass} flex-1`} placeholder="123-456-7890" />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Bio</label>
                        <textarea
                            value={profileData.about}
                            onChange={e => setProfileData({ ...profileData, about: e.target.value })}
                            rows={3}
                            maxLength={500}
                            className={`${inputClass} resize-none`}
                            placeholder="Tell others about yourself…"
                        />
                        <div className="text-right text-[10.5px] text-gray-400 mt-1">{profileData.about?.length || 0}/500</div>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button
                            onClick={handleProfileUpdate}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </Card>

            {/* Remove photo confirm modal */}
            {showRemoveConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
                        <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">Remove Profile Photo?</h3>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Your avatar will display your initials instead.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowRemoveConfirm(false)}
                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleRemoveProfilePicture}
                                className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-[12.5px] font-semibold rounded-lg transition-colors">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileTab;
