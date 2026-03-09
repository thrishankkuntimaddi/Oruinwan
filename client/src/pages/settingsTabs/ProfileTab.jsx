import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ImagePlus, X, Loader2, Sparkles, CheckCircle2, Trash2, Upload } from 'lucide-react';
import Card from './Card';
import ImageCropEditor from './ImageCropEditor';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';


// ─────────────────────────────────────────────────────────────────────────────
// 100 Professional Avatars across 7 DiceBear styles suited for B2B workspaces
// Styles chosen for professionalism:
//   notionists-neutral — Notion-style clean strokes
//   lorelei-neutral    — editorial illustration, gender-neutral
//   micah              — minimal vector faces
//   identicon          — GitHub-style geometric (used in dev tools)
//   rings              — architectural rings (abstract, premium)
//   shapes             — clean geometric blocks
//   miniavs            — compact professional faces
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_CATEGORIES = {
    'Illustrated': { style: 'lorelei-neutral', color: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400' },
    'Notion-style': { style: 'notionists-neutral', color: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300' },
    'Minimal': { style: 'micah', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' },
    'Geometric': { style: 'identicon', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' },
    'Abstract': { style: 'rings', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' },
    'Shapes': { style: 'shapes', color: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400' },
    'Classic': { style: 'miniavs', color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' },
};

// 100 unique professional seeds spread across all 7 categories (~14–15 each)
const AVATAR_LIBRARY = [
    // ── Illustrated (lorelei-neutral) ─────────────────────────────────────────
    { cat: 'Illustrated', seed: 'Alexandra' }, { cat: 'Illustrated', seed: 'Jordan' },
    { cat: 'Illustrated', seed: 'Morgan' }, { cat: 'Illustrated', seed: 'Cameron' },
    { cat: 'Illustrated', seed: 'Avery' }, { cat: 'Illustrated', seed: 'Quinn' },
    { cat: 'Illustrated', seed: 'Riley' }, { cat: 'Illustrated', seed: 'Reese' },
    { cat: 'Illustrated', seed: 'Sage' }, { cat: 'Illustrated', seed: 'Emery' },
    { cat: 'Illustrated', seed: 'Parker' }, { cat: 'Illustrated', seed: 'Hayden' },
    { cat: 'Illustrated', seed: 'Finley' }, { cat: 'Illustrated', seed: 'River' },
    { cat: 'Illustrated', seed: 'Kendall' },

    // ── Notion-style (notionists-neutral) ─────────────────────────────────────
    { cat: 'Notion-style', seed: 'Atlas' }, { cat: 'Notion-style', seed: 'Cleo' },
    { cat: 'Notion-style', seed: 'Darwin' }, { cat: 'Notion-style', seed: 'Elliot' },
    { cat: 'Notion-style', seed: 'Fable' }, { cat: 'Notion-style', seed: 'Glen' },
    { cat: 'Notion-style', seed: 'Haven' }, { cat: 'Notion-style', seed: 'Inigo' },
    { cat: 'Notion-style', seed: 'Jules' }, { cat: 'Notion-style', seed: 'Knox' },
    { cat: 'Notion-style', seed: 'Lael' }, { cat: 'Notion-style', seed: 'Maren' },
    { cat: 'Notion-style', seed: 'Noel' }, { cat: 'Notion-style', seed: 'Orion' },
    { cat: 'Notion-style', seed: 'Piper' },

    // ── Minimal (micah) ───────────────────────────────────────────────────────
    { cat: 'Minimal', seed: 'Adam' }, { cat: 'Minimal', seed: 'Benjamin' },
    { cat: 'Minimal', seed: 'Charles' }, { cat: 'Minimal', seed: 'Daniel' },
    { cat: 'Minimal', seed: 'Edward' }, { cat: 'Minimal', seed: 'Francis' },
    { cat: 'Minimal', seed: 'George' }, { cat: 'Minimal', seed: 'Hannah' },
    { cat: 'Minimal', seed: 'Isabelle' }, { cat: 'Minimal', seed: 'Julian' },
    { cat: 'Minimal', seed: 'Katrina' }, { cat: 'Minimal', seed: 'Leonard' },
    { cat: 'Minimal', seed: 'Margaret' }, { cat: 'Minimal', seed: 'Nathan' },
    { cat: 'Minimal', seed: 'Olivia' },

    // ── Geometric (identicon) ─────────────────────────────────────────────────
    { cat: 'Geometric', seed: 'Alpha01' }, { cat: 'Geometric', seed: 'Beta02' },
    { cat: 'Geometric', seed: 'Gamma03' }, { cat: 'Geometric', seed: 'Delta04' },
    { cat: 'Geometric', seed: 'Epsilon05' }, { cat: 'Geometric', seed: 'Zeta06' },
    { cat: 'Geometric', seed: 'Eta07' }, { cat: 'Geometric', seed: 'Theta08' },
    { cat: 'Geometric', seed: 'Iota09' }, { cat: 'Geometric', seed: 'Kappa10' },
    { cat: 'Geometric', seed: 'Lambda11' }, { cat: 'Geometric', seed: 'Mu12' },
    { cat: 'Geometric', seed: 'Nu13' }, { cat: 'Geometric', seed: 'Xi14' },
    { cat: 'Geometric', seed: 'Omicron15' },

    // ── Abstract Rings (rings) ────────────────────────────────────────────────
    { cat: 'Abstract', seed: 'Cobalt' }, { cat: 'Abstract', seed: 'Crimson' },
    { cat: 'Abstract', seed: 'Dune' }, { cat: 'Abstract', seed: 'Eclipse' },
    { cat: 'Abstract', seed: 'Flux' }, { cat: 'Abstract', seed: 'Granite' },
    { cat: 'Abstract', seed: 'Horizon' }, { cat: 'Abstract', seed: 'Indigo' },
    { cat: 'Abstract', seed: 'Jasper' }, { cat: 'Abstract', seed: 'Lunar' },
    { cat: 'Abstract', seed: 'Marble' }, { cat: 'Abstract', seed: 'Nordic' },
    { cat: 'Abstract', seed: 'Onyx' }, { cat: 'Abstract', seed: 'Prism' },

    // ── Shapes ────────────────────────────────────────────────────────────────
    { cat: 'Shapes', seed: 'Apex' }, { cat: 'Shapes', seed: 'Bolt' },
    { cat: 'Shapes', seed: 'Core' }, { cat: 'Shapes', seed: 'Drive' },
    { cat: 'Shapes', seed: 'Edge' }, { cat: 'Shapes', seed: 'Forge' },
    { cat: 'Shapes', seed: 'Grid' }, { cat: 'Shapes', seed: 'Hub' },
    { cat: 'Shapes', seed: 'Ion' }, { cat: 'Shapes', seed: 'Jolt' },
    { cat: 'Shapes', seed: 'Key' }, { cat: 'Shapes', seed: 'Link' },
    { cat: 'Shapes', seed: 'Matrix' }, { cat: 'Shapes', seed: 'Node' },

    // ── Classic (miniavs) ─────────────────────────────────────────────────────
    { cat: 'Classic', seed: 'Prof1' }, { cat: 'Classic', seed: 'Prof2' },
    { cat: 'Classic', seed: 'Prof3' }, { cat: 'Classic', seed: 'Prof4' },
    { cat: 'Classic', seed: 'Prof5' }, { cat: 'Classic', seed: 'Prof6' },
    { cat: 'Classic', seed: 'Prof7' }, { cat: 'Classic', seed: 'Prof8' },
    { cat: 'Classic', seed: 'Prof9' }, { cat: 'Classic', seed: 'Prof10' },
    { cat: 'Classic', seed: 'Prof11' }, { cat: 'Classic', seed: 'Prof12' },
    { cat: 'Classic', seed: 'Prof13' }, { cat: 'Classic', seed: 'Prof14' },
    { cat: 'Classic', seed: 'Prof15' }, { cat: 'Classic', seed: 'Prof16' },
];

const avatarUrl = (cat, seed) => {
    const style = AVATAR_CATEGORIES[cat]?.style || 'identicon';
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=80&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f8f8f8`;
};

// ─── Avatar Picker Modal ───────────────────────────────────────────────────────
const AvatarPickerModal = ({ onSelect, onClose, uploading }) => {
    const [activeCategory, setActiveCategory] = useState('All');
    const [selectedKey, setSelectedKey] = useState(null); // "cat|seed"

    const filtered = useMemo(() => {
        if (activeCategory === 'All') return AVATAR_LIBRARY;
        return AVATAR_LIBRARY.filter(a => a.cat === activeCategory);
    }, [activeCategory]);

    const selectedAvatar = useMemo(() => {
        if (!selectedKey) return null;
        const [cat, seed] = selectedKey.split('|');
        return AVATAR_LIBRARY.find(a => a.cat === cat && a.seed === seed) || null;
    }, [selectedKey]);

    const CATEGORIES = ['All', ...Object.keys(AVATAR_CATEGORIES)];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <div>
                        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Choose a Profile Avatar</h3>
                        <p className="text-[11.5px] text-gray-400 mt-0.5">100 professionally designed avatars across 7 categories</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Category filter */}
                <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar flex-shrink-0">
                    {CATEGORIES.map((cat) => {
                        const isAll = cat === 'All';
                        const isActive = activeCategory === cat;
                        const catConfig = AVATAR_CATEGORIES[cat];
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`flex-shrink-0 px-3.5 py-1.5 text-[11.5px] font-semibold rounded-full border transition-all ${isActive
                                    ? isAll
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                                        : `${catConfig?.color} border-current`
                                    : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                {cat}
                                <span className={`ml-1.5 text-[10px] font-bold ${isActive && !isAll ? 'opacity-70' : 'text-gray-400'}`}>
                                    {cat === 'All' ? AVATAR_LIBRARY.length : AVATAR_LIBRARY.filter(a => a.cat === cat).length}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Avatar grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-8 gap-2">
                        {filtered.map((avatar) => {
                            const key = `${avatar.cat}|${avatar.seed}`;
                            const isSelected = selectedKey === key;
                            const url = avatarUrl(avatar.cat, avatar.seed);
                            const catConfig = AVATAR_CATEGORIES[avatar.cat];
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedKey(isSelected ? null : key)}
                                    title={`${avatar.cat} — ${avatar.seed}`}
                                    className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all border-2 group ${isSelected
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20 shadow-sm'
                                        : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <img
                                        src={url}
                                        alt={avatar.seed}
                                        className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex-shrink-0"
                                        loading="lazy"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling?.classList?.remove('hidden');
                                        }}
                                    />
                                    {/* Fallback if image fails */}
                                    <div className="hidden w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 items-center justify-center text-white text-sm font-bold">
                                        {avatar.seed?.charAt(0)}
                                    </div>
                                    {isSelected && (
                                        <span className="absolute top-1 right-1 bg-blue-600 rounded-full">
                                            <CheckCircle2 size={12} className="text-white" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {filtered.length === 0 && (
                        <div className="py-16 text-center text-gray-400 text-sm">No avatars in this category</div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {selectedAvatar ? (
                            <>
                                <img
                                    src={avatarUrl(selectedAvatar.cat, selectedAvatar.seed)}
                                    alt={selectedAvatar.seed}
                                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800"
                                />
                                <div>
                                    <div className="text-[12.5px] font-bold text-gray-900 dark:text-white">{selectedAvatar.seed}</div>
                                    <div className="text-[11px] text-gray-400">{selectedAvatar.cat}</div>
                                </div>
                            </>
                        ) : (
                            <p className="text-[12px] text-gray-400">Select an avatar from the grid above</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => selectedAvatar && onSelect(selectedAvatar)}
                            disabled={!selectedAvatar || uploading}
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
    const [previewUrl, setPreviewUrl] = useState(null);      // used for live preview
    const [selectedFile, setSelectedFile] = useState(null);  // cropped File ready to upload
    const [cropSrc, setCropSrc] = useState(null);            // raw src passed to crop editor
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const fileInputRef = useRef(null);

    // Step 1: user picks a file → open crop editor
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
        if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10 MB', 'error'); return; }
        // Reset input so the same file can be selected again later
        if (fileInputRef.current) fileInputRef.current.value = '';
        const objectUrl = URL.createObjectURL(file);
        setCropSrc(objectUrl); // opens crop editor
    };

    // Step 2: crop editor confirms → store blob as File, show preview
    const handleCropConfirm = (blob) => {
        const file = new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setCropSrc(null); // close editor
    };

    // Step 3: user clicks Save Photo
    const handleUploadProfilePicture = async () => {
        if (!selectedFile) return;
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('profilePicture', selectedFile);
            await api.post('/api/auth/me/profile-picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSelectedFile(null);
            showToast('Profile photo updated', 'success');
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch (err) {
            showToast(err.response?.data?.message || 'Upload failed', 'error');
        } finally { setUploadingImage(false); }
    };

    // Avatar picker: render DiceBear SVG to a canvas → export as PNG → upload
    const handleAvatarSelect = useCallback(async (avatarConfig) => {
        setUploadingImage(true);
        setShowAvatarPicker(false);
        try {
            const svgUrl = avatarUrl(avatarConfig.cat, avatarConfig.seed);
            // Fetch the SVG
            const res = await fetch(svgUrl);
            if (!res.ok) throw new Error('Could not load avatar');
            const svgText = await res.text();

            // Convert SVG text → PNG blob via canvas
            const blob = await new Promise((resolve, reject) => {
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 400;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 400, 400);
                    URL.revokeObjectURL(url);
                    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png', 1.0);
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG image load failed')); };
                img.src = url;
            });

            // Upload PNG to backend
            const formData = new FormData();
            formData.append('profilePicture', new File([blob], `avatar-${avatarConfig.seed}.png`, { type: 'image/png' }));
            const { data } = await api.post('/api/auth/me/profile-picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPreviewUrl(svgUrl);  // preview the original SVG (looks clean)
            setSelectedFile(null);
            showToast(`${avatarConfig.seed} set as profile avatar`, 'success');
            window.dispatchEvent(new CustomEvent('auth:refresh-user'));
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to apply avatar', 'error');
        } finally { setUploadingImage(false); }
    }, [showToast]);

    const handleRemove = async () => {
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

    const iClass = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12.5px] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
    const lClass = "block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5";
    const currentPic = previewUrl || user?.profilePicture;

    return (
        <div className="space-y-4">
            {/* Profile Photo */}
            <Card title="Profile Photo" subtitle="Your identity across all workspaces and channels">
                <div className="flex items-start gap-5">
                    {/* Avatar preview */}
                    <div className="relative flex-shrink-0">
                        {currentPic ? (
                            <img src={currentPic} alt={user?.username}
                                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800" />
                        ) : (
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-black text-3xl ring-2 ring-gray-200 dark:ring-gray-700">
                                {user?.username?.charAt(0)?.toUpperCase()}
                            </div>
                        )}
                        {uploadingImage && (
                            <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                                <Loader2 size={22} className="text-white animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex-1">
                        <div className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight">{user?.username}</div>
                        <div className="text-[11.5px] text-gray-400 mb-4">{user?.email}</div>

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
                                <label htmlFor="profile-pic-input"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                                    <ImagePlus size={12} /> Upload Photo
                                </label>
                                <button onClick={() => setShowAvatarPicker(true)} disabled={uploadingImage}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap">
                                    <Sparkles size={12} /> Avatar Library
                                </button>
                                {currentPic && (
                                    <button onClick={() => setShowRemoveConfirm(true)} disabled={uploadingImage}
                                        className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-[12px] font-semibold rounded-lg transition-colors">
                                        <Trash2 size={11} /> Remove
                                    </button>
                                )}
                            </div>
                        )}
                        <input id="profile-pic-input" ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={uploadingImage} />
                        <p className="text-[11px] text-gray-400 mt-3">Square image, min 200×200px. Max 5 MB.</p>
                    </div>
                </div>
            </Card>

            {/* Personal Info */}
            <Card title="Personal Information" subtitle="Your public profile details">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={lClass}>Display Name</label>
                            <input type="text" value={profileData.username} onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                className={iClass} placeholder="Your name" />
                        </div>
                        <div>
                            <label className={lClass}>Email Address</label>
                            <input type="email" value={user?.email || ''} disabled className={`${iClass} opacity-60 cursor-not-allowed`} />
                        </div>
                    </div>

                    <div>
                        <label className={lClass}>Phone Number</label>
                        <div className="flex gap-2">
                            <select value={profileData.phoneCode} onChange={e => setProfileData({ ...profileData, phoneCode: e.target.value })}
                                className="w-24 px-2 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[12px] outline-none focus:border-blue-500 dark:text-white">
                                <option value="+1">+1 US</option><option value="+44">+44 UK</option>
                                <option value="+91">+91 IN</option><option value="+61">+61 AU</option>
                                <option value="+49">+49 DE</option><option value="+33">+33 FR</option>
                                <option value="+81">+81 JP</option><option value="+86">+86 CN</option>
                                <option value="+971">+971 UAE</option><option value="+65">+65 SG</option>
                                <option value="+55">+55 BR</option><option value="+52">+52 MX</option>
                                <option value="+27">+27 ZA</option><option value="+82">+82 KR</option>
                            </select>
                            <input type="tel" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                                className={`${iClass} flex-1`} placeholder="Phone number" />
                        </div>
                    </div>

                    <div>
                        <label className={lClass}>Bio</label>
                        <textarea value={profileData.about} onChange={e => setProfileData({ ...profileData, about: e.target.value })}
                            rows={3} maxLength={500} className={`${iClass} resize-none`} placeholder="A brief professional summary…" />
                        <div className="text-right text-[10.5px] text-gray-400 mt-1">{profileData.about?.length || 0}/500</div>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button onClick={handleProfileUpdate} disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-50">
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </Card>

            {/* Avatar Picker Modal */}
            {showAvatarPicker && (
                <AvatarPickerModal onSelect={handleAvatarSelect} onClose={() => setShowAvatarPicker(false)} uploading={uploadingImage} />
            )}

            {/* Image Crop Editor — opens after file selection */}
            {cropSrc && (
                <ImageCropEditor
                    src={cropSrc}
                    onConfirm={handleCropConfirm}
                    onCancel={() => { setCropSrc(null); }}
                    outputSize={400}
                />
            )}

            {/* Remove Confirm */}
            {showRemoveConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
                        <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">Remove Profile Photo?</h3>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Your avatar will display your initials instead.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setShowRemoveConfirm(false)}
                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleRemove}
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
