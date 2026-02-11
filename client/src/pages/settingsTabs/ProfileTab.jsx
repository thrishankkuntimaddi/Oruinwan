import React, { useState } from 'react';
import { Mail, Upload, X, Camera } from 'lucide-react';
import Card from './Card';
import Input from '../../shared/components/ui/Input';
import Button from '../../shared/components/ui/Button';
import Avatar from '../../shared/components/ui/Avatar';
import axios from 'axios';

/**
 * ProfileTab - User profile management with profile picture upload
 * @param {object} props - Component props
 * @param {object} props.user - Current user object
 * @param {object} props.profileData - Profile form state
 * @param {function} props.setProfileData - Update profile form
 * @param {boolean} props.loading - Loading state
 * @param {function} props.handleProfileUpdate - Save profile handler
 */
const ProfileTab = ({ user, profileData, setProfileData, loading, handleProfileUpdate }) => {
    const [uploadingImage, setUploadingImage] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Handle image file selection
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Image size must be less than 5MB');
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Upload profile picture
    const handleUploadProfilePicture = async () => {
        if (!selectedFile) return;

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('profilePicture', selectedFile);

            const response = await axios.post('/api/auth/me/profile-picture', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });

            // Update local preview
            if (response.data?.profilePicture) {
                setPreviewUrl(null);
                setSelectedFile(null);
                // Refresh user data
                window.location.reload(); // Simple refresh to update all components
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert(error.response?.data?.message || 'Failed to upload profile picture');
        } finally {
            setUploadingImage(false);
        }
    };

    // Remove profile picture
    const handleRemoveProfilePicture = async () => {
        if (!window.confirm('Are you sure you want to remove your profile picture?')) return;

        setUploadingImage(true);
        try {
            await axios.delete('/api/auth/me/profile-picture', { withCredentials: true });
            window.location.reload();
        } catch (error) {
            console.error('Remove failed:', error);
            alert('Failed to remove profile picture');
        } finally {
            setUploadingImage(false);
        }
    };

    // Cancel image selection
    const handleCancelSelection = () => {
        setPreviewUrl(null);
        setSelectedFile(null);
    };

    const currentProfilePicture = previewUrl || user?.profilePicture;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <Card title="Personal Information" subtitle="Update your photo and personal details">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar Side */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative group">
                            <Avatar
                                src={currentProfilePicture}
                                alt={user?.username}
                                fallback={user?.username}
                                size="xl3"
                                className="w-32 h-32 text-4xl shadow-lg ring-4 ring-white dark:ring-[#0B0F19]"
                            />

                            {/* Hover overlay for change picture */}
                            <label
                                htmlFor="profile-picture-input"
                                className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                <Camera size={24} className="text-white mb-1" />
                                <span className="text-white text-xs font-bold">Change Photo</span>
                            </label>
                            <input
                                id="profile-picture-input"
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                                disabled={uploadingImage}
                            />
                        </div>

                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.username}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.role || 'Member'}</p>
                        </div>

                        {/* Image action buttons */}
                        {previewUrl && selectedFile && (
                            <div className="flex gap-2 w-full">
                                <Button
                                    onClick={handleUploadProfilePicture}
                                    disabled={uploadingImage}
                                    isLoading={uploadingImage}
                                    className="flex-1"
                                    size="sm"
                                    icon={<Upload size={14} />}
                                >
                                    Save
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleCancelSelection}
                                    disabled={uploadingImage}
                                    size="sm"
                                >
                                    <X size={14} />
                                </Button>
                            </div>
                        )}

                        {user?.profilePicture && !previewUrl && (
                            <button
                                onClick={handleRemoveProfilePicture}
                                disabled={uploadingImage}
                                className="text-sm text-red-600 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
                            >
                                Remove Picture
                            </button>
                        )}
                    </div>

                    {/* Form Side */}
                    <div className="flex-1 space-y-5 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <Input
                                    label="Display Name"
                                    type="text"
                                    value={profileData.username}
                                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <Input
                                    label="Email Address"
                                    value={user?.email}
                                    disabled
                                    icon={<Mail size={14} />}
                                />
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
                                placeholder="Tell us a bit about yourself..."
                            />
                            <div className="text-right text-xs text-slate-400 mt-1">{profileData.about?.length || 0}/500</div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button
                                onClick={handleProfileUpdate}
                                disabled={loading}
                                isLoading={loading}
                                size="lg"
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ProfileTab;
