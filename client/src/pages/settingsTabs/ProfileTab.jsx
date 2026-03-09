import React, { useState, useRef } from 'react';
import { Mail, Upload, X, Camera, User, Briefcase, Loader2 } from 'lucide-react';
import Card from './Card';
import Input from '../../shared/components/ui/Input';
import Button from '../../shared/components/ui/Button';
import Avatar from '../../shared/components/ui/Avatar';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * ProfileTab — Profile picture upload + personal info with proper toast feedback
 */
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
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be smaller than 5 MB', 'error');
            return;
        }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleUploadProfilePicture = async () => {
        if (!selectedFile) return;
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('profilePicture', selectedFile);
            const { data } = await api.post('/api/auth/me/profile-picture', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPreviewUrl(null);
            setSelectedFile(null);
            showToast('Profile photo updated!', 'success');
            // Soft-refresh user data without full page reload
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to upload profile picture', 'error');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemoveProfilePicture = async () => {
        setUploadingImage(true);
        setShowRemoveConfirm(false);
        try {
            await api.delete('/api/auth/me/profile-picture');
            showToast('Profile photo removed', 'success');
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch (error) {
            showToast('Failed to remove profile picture', 'error');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleCancelSelection = () => {
        setPreviewUrl(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const currentProfilePicture = previewUrl || user?.profilePicture;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Personal Information" subtitle="Update your photo and personal details">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar column */}
                    <div className="flex flex-col items-center gap-3 flex-shrink-0">
                        <div className="relative group">
                            <Avatar
                                src={currentProfilePicture}
                                alt={user?.username}
                                fallback={user?.username}
                                size="xl3"
                                className="w-28 h-28 text-3xl shadow-lg ring-4 ring-white dark:ring-[#0B0F19]"
                            />
                            <label
                                htmlFor="profile-picture-input"
                                className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                {uploadingImage
                                    ? <Loader2 size={22} className="text-white animate-spin" />
                                    : <>
                                        <Camera size={22} className="text-white mb-0.5" />
                                        <span className="text-white text-[10px] font-bold">Change</span>
                                    </>
                                }
                            </label>
                            <input
                                id="profile-picture-input"
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                                disabled={uploadingImage}
                            />
                        </div>

                        <div className="text-center">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{user?.username}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role || 'Member'}</p>
                        </div>

                        {/* Upload / cancel buttons when a new photo is selected */}
                        {previewUrl && selectedFile && (
                            <div className="flex gap-2 w-full">
                                <Button onClick={handleUploadProfilePicture} disabled={uploadingImage} isLoading={uploadingImage} size="sm" icon={<Upload size={13} />} className="flex-1">
                                    Save
                                </Button>
                                <Button variant="secondary" onClick={handleCancelSelection} disabled={uploadingImage} size="sm">
                                    <X size={13} />
                                </Button>
                            </div>
                        )}

                        {/* Remove button when user has a pic and hasn't selected a new one */}
                        {user?.profilePicture && !previewUrl && (
                            <button
                                onClick={() => setShowRemoveConfirm(true)}
                                disabled={uploadingImage}
                                className="text-xs text-red-500 dark:text-red-400 font-medium hover:underline disabled:opacity-40"
                            >
                                Remove Photo
                            </button>
                        )}
                    </div>

                    {/* Form column */}
                    <div className="flex-1 space-y-5 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Input
                                label="Display Name"
                                type="text"
                                value={profileData.username}
                                onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                icon={<User size={14} />}
                            />
                            <Input
                                label="Email Address"
                                value={user?.email}
                                disabled
                                icon={<Mail size={14} />}
                            />
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
                                    <option value="+44">+44 (UK)</option>
                                    <option value="+91">+91 (IN)</option>
                                    <option value="+61">+61 (AU)</option>
                                    <option value="+49">+49 (DE)</option>
                                    <option value="+33">+33 (FR)</option>
                                    <option value="+81">+81 (JP)</option>
                                    <option value="+86">+86 (CN)</option>
                                    <option value="+971">+971 (UAE)</option>
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
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                                About Bio
                            </label>
                            <textarea
                                value={profileData.about}
                                onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                                rows={4}
                                maxLength={500}
                                className="w-full px-4 py-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none dark:text-white"
                                placeholder="Tell others a bit about yourself..."
                            />
                            <div className="text-right text-xs text-slate-400 mt-1">{profileData.about?.length || 0}/500</div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button onClick={handleProfileUpdate} disabled={loading} isLoading={loading} size="lg">
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Inline remove confirmation modal */}
            {showRemoveConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#0B0F19] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                        <h3 className="font-black text-slate-900 dark:text-white mb-2">Remove Profile Photo?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Your avatar will fall back to your initials.</p>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setShowRemoveConfirm(false)} className="flex-1">Cancel</Button>
                            <Button variant="danger" onClick={handleRemoveProfilePicture} className="flex-1">Remove</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileTab;
