import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Loader2, Sparkles, CheckCircle2, ImagePlus, Trash2 } from 'lucide-react';
import Card from './Card';
import Avatar from '../../shared/components/ui/Avatar';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

// ─── Preset Avatars (via DiceBear CDN — consistent, free, no key needed) ──────
const AVATAR_STYLES = [
    // Fun Emoji style
    { seed: 'Felix', style: 'fun-emoji', label: 'Chill' },
    { seed: 'Mimi', style: 'fun-emoji', label: 'Sparkle' },
    { seed: 'Rocky', style: 'fun-emoji', label: 'Cool' },
    { seed: 'Luna', style: 'fun-emoji', label: 'Dreamy' },
    { seed: 'Zack', style: 'fun-emoji', label: 'Fire' },
    { seed: 'Aria', style: 'fun-emoji', label: 'Sunny' },
    // Bottts (robot)
    { seed: 'Bot42', style: 'bottts', label: 'Robot' },
    { seed: 'Nexus', style: 'bottts', label: 'Nexus' },
    { seed: 'Droid', style: 'bottts', label: 'Droid' },
    { seed: 'Vector', style: 'bottts', label: 'Vector' },
    // Avataaars (cartoon faces)
    { seed: 'Alex', style: 'avataaars', label: 'Alex' },
    { seed: 'Jamie', style: 'avataaars', label: 'Jamie' },
    { seed: 'Morgan', style: 'avataaars', label: 'Morgan' },
    { seed: 'Taylor', style: 'avataaars', label: 'Taylor' },
    // Shapes (abstract)
    { seed: 'Geo1', style: 'shapes', label: 'Geo' },
    { seed: 'Orb', style: 'shapes', label: 'Orb' },
    { seed: 'Crystal', style: 'shapes', label: 'Crystal' },
    { seed: 'Nebula', style: 'shapes', label: 'Nebula' },
    // Pixel art
    { seed: 'Pixel8', style: 'pixel-art', label: 'Pixel' },
    { seed: 'Retro64', style: 'pixel-art', label: 'Retro' },
];

const dicebearUrl = (style, seed) =>
    `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=80`;

// ─── Avatar Picker Modal ───────────────────────────────────────────────────────
const AvatarPickerModal = ({ onSelect, onClose, uploading }) => {
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [styleFilter, setStyleFilter] = useState('all');

    const STYLE_LABELS = {
        all: 'All',
        'fun-emoji': 'Emoji',
        bottts: 'Robot',
        avataaars: 'Cartoon',
        shapes: 'Abstract',
        'pixel-art': 'Pixel',
    };

    const filtered = styleFilter === 'all'
        ? AVATAR_STYLES
        : AVATAR_STYLES.filter(a => a.style === styleFilter);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-600" />
                        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Choose an Avatar</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Style filter pills */}
                <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar">
                    {Object.entries(STYLE_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setStyleFilter(key)}
                            className={`flex-shrink-0 px-3 py-1 text-[11.5px] font-semibold rounded-full transition-all ${styleFilter === key
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Avatar grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-5 gap-3">
                        {filtered.map((avatar, i) => {
                            const globalIndex = AVATAR_STYLES.indexOf(avatar);
                            const isSelected = selectedIndex === globalIndex;
                            const url = dicebearUrl(avatar.style, avatar.seed);
                            return (
                                <button
                                    key={`${avatar.style}-${avatar.seed}`}
                                    onClick={() => setSelectedIndex(globalIndex)}
                                    className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border-2 ${isSelected
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20'
                                            : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <img
                                        src={url}
                                        alt={avatar.label}
                                        className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800"
                                        loading="lazy"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate w-full text-center">{avatar.label}</span>
                                    {isSelected && (
                                        <span className="absolute top-1.5 right-1.5">
                                            <CheckCircle2 size={14} className="text-blue-600" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <p className="text-[11.5px] text-gray-400">
                        {selectedIndex !== null ? `Selected: ${AVATAR_STYLES[selectedIndex]?.label}` : 'Click an avatar to select it'}
                    </p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => selectedIndex !== null && onSelect(AVATAR_STYLES[selectedIndex])}
                            disabled={selectedIndex === null || uploading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {uploading ? <><Loader2 size={13} className="animate-spin" /> Applying…</> : 'Use This Avatar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── ProfileTab ───────────────────────────────────────────────────────────────
const ProfileTab = ({ user, profileData, setProfileData, loading, handleProfileUpdate }) => {
    const { showToast } = useToast();
    const [uploadingImage, setUploadingImage] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
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

    // Fetch DiceBear SVG → Blob → upload as profile picture
    const handleAvatarSelect = useCallback(async (avatarConfig) => {
        setUploadingImage(true);
        try {
            const url = dicebearUrl(avatarConfig.style, avatarConfig.seed);
            const svgResponse = await fetch(url);
            if (!svgResponse.ok) throw new Error('Failed to fetch avatar');
            const svgBlob = await svgResponse.blob();
            const file = new File([svgBlob], `avatar-${avatarConfig.seed}.svg`, { type: 'image/svg+xml' });

            const formData = new FormData();
            formData.append('profilePicture', file);
            await api.post('/api/auth/me/profile-picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            // Set local preview so user sees the change immediately
            setPreviewUrl(url);
            setSelectedFile(null);
            setShowAvatarPicker(false);
            showToast(`Avatar "${avatarConfig.label}" set as profile photo!`, 'success');
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to set avatar', 'error');
        } finally { setUploadingImage(false); }
    }, [showToast]);

    const handleRemoveProfilePicture = async () => {
        setUploadingImage(true);
        setShowRemoveConfirm(false);
        try {
            await api.delete('/api/auth/me/profile-picture');
            setPreviewUrl(null);
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

    const currentPic = previewUrl || user?.profilePicture;

    return (
        <div className="space-y-4">
            {/* ── Photo Card ── */}
            <Card title="Profile Photo" subtitle="Your avatar across all workspaces">
                <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className="relative group flex-shrink-0">
                        {currentPic
                            ? <img src={currentPic} alt={user?.username} className="w-20 h-20 rounded-2xl object-cover ring-2 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800" />
                            : (
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-black text-3xl ring-2 ring-gray-200 dark:ring-gray-700">
                                    {user?.username?.charAt(0).toUpperCase()}
                                </div>
                            )
                        }
                        {uploadingImage && (
                            <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                                <Loader2 size={22} className="text-white animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex-1 pt-1">
                        <div className="text-[13px] font-bold text-gray-900 dark:text-white">{user?.username}</div>
                        <div className="text-[11.5px] text-gray-400 mb-4">{user?.email}</div>

                        {/* If a new local file was selected — show save/cancel */}
                        {selectedFile ? (
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
                            <div className="flex flex-wrap gap-2">
                                {/* Upload photo */}
                                <label htmlFor="profile-pic-input"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12px] font-semibold rounded-lg transition-colors cursor-pointer">
                                    <ImagePlus size={12} /> Upload Photo
                                </label>
                                {/* Choose avatar */}
                                <button onClick={() => setShowAvatarPicker(true)} disabled={uploadingImage}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[12px] font-semibold rounded-lg transition-colors">
                                    <Sparkles size={12} /> Choose Avatar
                                </button>
                                {/* Remove */}
                                {currentPic && (
                                    <button onClick={() => setShowRemoveConfirm(true)} disabled={uploadingImage}
                                        className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[12px] font-semibold rounded-lg transition-colors">
                                        <Trash2 size={12} className="inline mr-1" />Remove
                                    </button>
                                )}
                            </div>
                        )}
                        <input id="profile-pic-input" ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={uploadingImage} />
                        <p className="text-[11px] text-gray-400 mt-3">Recommended: square image, at least 200×200px. Max 5 MB.</p>
                    </div>
                </div>
            </Card>

            {/* ── Personal Info Card ── */}
            <Card title="Personal Information" subtitle="Your public profile details">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Display Name</label>
                            <input type="text" value={profileData.username} onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                className={inputClass} placeholder="Your name" />
                        </div>
                        <div>
                            <label className={labelClass}>Email Address</label>
                            <input type="email" value={user?.email || ''} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Phone Number</label>
                        <div className="flex gap-2">
                            <select value={profileData.phoneCode} onChange={e => setProfileData({ ...profileData, phoneCode: e.target.value })}
                                className="w-24 px-2 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12px] outline-none focus:border-blue-500 dark:text-white">
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
                        <textarea value={profileData.about} onChange={e => setProfileData({ ...profileData, about: e.target.value })}
                            rows={3} maxLength={500} className={`${inputClass} resize-none`}
                            placeholder="Tell others about yourself…" />
                        <div className="text-right text-[10.5px] text-gray-400 mt-1">{profileData.about?.length || 0}/500</div>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button onClick={handleProfileUpdate} disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </Card>

            {/* ── Avatar Picker Modal ── */}
            {showAvatarPicker && (
                <AvatarPickerModal
                    onSelect={handleAvatarSelect}
                    onClose={() => setShowAvatarPicker(false)}
                    uploading={uploadingImage}
                />
            )}

            {/* ── Remove Confirm Modal ── */}
            {showRemoveConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
                        <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">Remove Profile Photo?</h3>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Your avatar will show initials instead.</p>
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
