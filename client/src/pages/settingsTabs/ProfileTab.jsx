import React, { useState, useRef, useCallback, useMemo } from 'react';
import { ImagePlus, X, Loader2, Sparkles, Check, Trash2, Upload } from 'lucide-react';
import Card from './Card';
import ImageCropEditor from './ImageCropEditor';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const AVATAR_CATEGORIES = {
    'Illustrated': { style: 'lorelei-neutral' },
    'Notion-style': { style: 'notionists-neutral' },
    'Minimal': { style: 'micah' },
    'Geometric': { style: 'identicon' },
    'Abstract': { style: 'rings' },
    'Shapes': { style: 'shapes' },
    'Classic': { style: 'miniavs' },
};

const AVATAR_LIBRARY = [
    { cat: 'Illustrated', seed: 'Alexandra' }, { cat: 'Illustrated', seed: 'Jordan' },
    { cat: 'Illustrated', seed: 'Morgan' }, { cat: 'Illustrated', seed: 'Cameron' },
    { cat: 'Illustrated', seed: 'Avery' }, { cat: 'Illustrated', seed: 'Quinn' },
    { cat: 'Illustrated', seed: 'Riley' }, { cat: 'Illustrated', seed: 'Reese' },
    { cat: 'Illustrated', seed: 'Sage' }, { cat: 'Illustrated', seed: 'Emery' },
    { cat: 'Illustrated', seed: 'Parker' }, { cat: 'Illustrated', seed: 'Hayden' },
    { cat: 'Illustrated', seed: 'Finley' }, { cat: 'Illustrated', seed: 'River' },
    { cat: 'Illustrated', seed: 'Kendall' },
    { cat: 'Notion-style', seed: 'Atlas' }, { cat: 'Notion-style', seed: 'Cleo' },
    { cat: 'Notion-style', seed: 'Darwin' }, { cat: 'Notion-style', seed: 'Elliot' },
    { cat: 'Notion-style', seed: 'Fable' }, { cat: 'Notion-style', seed: 'Glen' },
    { cat: 'Notion-style', seed: 'Haven' }, { cat: 'Notion-style', seed: 'Inigo' },
    { cat: 'Notion-style', seed: 'Jules' }, { cat: 'Notion-style', seed: 'Knox' },
    { cat: 'Notion-style', seed: 'Lael' }, { cat: 'Notion-style', seed: 'Maren' },
    { cat: 'Notion-style', seed: 'Noel' }, { cat: 'Notion-style', seed: 'Orion' },
    { cat: 'Notion-style', seed: 'Piper' },
    { cat: 'Minimal', seed: 'Adam' }, { cat: 'Minimal', seed: 'Benjamin' },
    { cat: 'Minimal', seed: 'Charles' }, { cat: 'Minimal', seed: 'Daniel' },
    { cat: 'Minimal', seed: 'Edward' }, { cat: 'Minimal', seed: 'Francis' },
    { cat: 'Minimal', seed: 'George' }, { cat: 'Minimal', seed: 'Hannah' },
    { cat: 'Minimal', seed: 'Isabelle' }, { cat: 'Minimal', seed: 'Julian' },
    { cat: 'Minimal', seed: 'Katrina' }, { cat: 'Minimal', seed: 'Leonard' },
    { cat: 'Minimal', seed: 'Margaret' }, { cat: 'Minimal', seed: 'Nathan' },
    { cat: 'Minimal', seed: 'Olivia' },
    { cat: 'Geometric', seed: 'Alpha01' }, { cat: 'Geometric', seed: 'Beta02' },
    { cat: 'Geometric', seed: 'Gamma03' }, { cat: 'Geometric', seed: 'Delta04' },
    { cat: 'Geometric', seed: 'Epsilon05' }, { cat: 'Geometric', seed: 'Zeta06' },
    { cat: 'Geometric', seed: 'Eta07' }, { cat: 'Geometric', seed: 'Theta08' },
    { cat: 'Geometric', seed: 'Iota09' }, { cat: 'Geometric', seed: 'Kappa10' },
    { cat: 'Geometric', seed: 'Lambda11' }, { cat: 'Geometric', seed: 'Mu12' },
    { cat: 'Geometric', seed: 'Nu13' }, { cat: 'Geometric', seed: 'Xi14' },
    { cat: 'Geometric', seed: 'Omicron15' },
    { cat: 'Abstract', seed: 'Cobalt' }, { cat: 'Abstract', seed: 'Crimson' },
    { cat: 'Abstract', seed: 'Dune' }, { cat: 'Abstract', seed: 'Eclipse' },
    { cat: 'Abstract', seed: 'Flux' }, { cat: 'Abstract', seed: 'Granite' },
    { cat: 'Abstract', seed: 'Horizon' }, { cat: 'Abstract', seed: 'Indigo' },
    { cat: 'Abstract', seed: 'Jasper' }, { cat: 'Abstract', seed: 'Lunar' },
    { cat: 'Abstract', seed: 'Marble' }, { cat: 'Abstract', seed: 'Nordic' },
    { cat: 'Abstract', seed: 'Onyx' }, { cat: 'Abstract', seed: 'Prism' },
    { cat: 'Shapes', seed: 'Apex' }, { cat: 'Shapes', seed: 'Bolt' },
    { cat: 'Shapes', seed: 'Core' }, { cat: 'Shapes', seed: 'Drive' },
    { cat: 'Shapes', seed: 'Edge' }, { cat: 'Shapes', seed: 'Forge' },
    { cat: 'Shapes', seed: 'Grid' }, { cat: 'Shapes', seed: 'Hub' },
    { cat: 'Shapes', seed: 'Ion' }, { cat: 'Shapes', seed: 'Jolt' },
    { cat: 'Shapes', seed: 'Key' }, { cat: 'Shapes', seed: 'Link' },
    { cat: 'Shapes', seed: 'Matrix' }, { cat: 'Shapes', seed: 'Node' },
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

const AvatarPickerModal = ({ onSelect, onClose, uploading }) => {
    const [activeCategory, setActiveCategory] = useState('All');
    const [selectedKey, setSelectedKey] = useState(null);

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
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
        }}>
            <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: 2,
                width: '100%',
                maxWidth: 600,
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-active)',
                    flexShrink: 0,
                }}>
                    <div>
                        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, ...S.font }}>Choose a Profile Avatar</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 0, ...S.font }}>100 professionally designed avatars across 7 categories</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: 6, borderRadius: 2, background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center',
                            transition: 'color 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={16} />
                    </button>
                </div>

                {}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border-default)',
                    overflowX: 'auto',
                    flexShrink: 0,
                }}>
                    {CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                style={{
                                    flexShrink: 0,
                                    padding: '4px 12px',
                                    fontSize: 12,
                                    fontWeight: isActive ? 600 : 400,
                                    borderRadius: 2,
                                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-default)'}`,
                                    backgroundColor: isActive ? 'rgba(184,149,106,0.12)' : 'transparent',
                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 150ms ease',
                                    ...S.font,
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                            >
                                {cat}
                                <span style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                }}>
                                    {cat === 'All' ? AVATAR_LIBRARY.length : AVATAR_LIBRARY.filter(a => a.cat === cat).length}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                        {filtered.map((avatar) => {
                            const key = `${avatar.cat}|${avatar.seed}`;
                            const isSelected = selectedKey === key;
                            const url = avatarUrl(avatar.cat, avatar.seed);
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedKey(isSelected ? null : key)}
                                    title={`${avatar.cat} — ${avatar.seed}`}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: 6,
                                        borderRadius: 2,
                                        border: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                                        backgroundColor: isSelected ? 'rgba(184,149,106,0.1)' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'border-color 150ms ease, background-color 150ms ease',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'transparent'; }}
                                >
                                    <img
                                        src={url}
                                        alt={avatar.seed}
                                        style={{ width: 48, height: 48, borderRadius: 2, backgroundColor: 'var(--bg-active)' }}
                                        loading="lazy"
                                    />
                                    {isSelected && (
                                        <span style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            backgroundColor: 'var(--accent)',
                                            borderRadius: '50%',
                                            width: 14,
                                            height: 14,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Check size={9} style={{ color: '#0c0c0c' }} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {filtered.length === 0 && (
                        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, ...S.font }}>
                            No avatars in this category
                        </div>
                    )}
                </div>

                {}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    backgroundColor: 'var(--bg-active)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {selectedAvatar ? (
                            <>
                                <img
                                    src={avatarUrl(selectedAvatar.cat, selectedAvatar.seed)}
                                    alt={selectedAvatar.seed}
                                    style={{ width: 28, height: 28, borderRadius: 2, backgroundColor: 'var(--bg-hover)' }}
                                />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', ...S.font }}>{selectedAvatar.seed}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', ...S.font }}>{selectedAvatar.cat}</div>
                                </div>
                            </>
                        ) : (
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, ...S.font }}>Select an avatar from the grid above</p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '7px 14px',
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                backgroundColor: 'var(--bg-hover)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 2,
                                cursor: 'pointer',
                                transition: 'color 150ms ease',
                                ...S.font,
                            }}
                        >Cancel</button>
                        <button
                            onClick={() => selectedAvatar && onSelect(selectedAvatar)}
                            disabled={!selectedAvatar || uploading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 14px',
                                fontSize: 13,
                                fontWeight: 500,
                                color: '#0c0c0c',
                                backgroundColor: 'var(--accent)',
                                border: 'none',
                                borderRadius: 2,
                                cursor: !selectedAvatar || uploading ? 'not-allowed' : 'pointer',
                                opacity: !selectedAvatar || uploading ? 0.4 : 1,
                                transition: 'background-color 150ms ease',
                                ...S.font,
                            }}
                            onMouseEnter={e => { if (selectedAvatar && !uploading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                            onMouseLeave={e => { if (selectedAvatar && !uploading) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                        >
                            {uploading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Applying…</> : 'Use This Avatar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const inputClass_style = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 2,
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms ease',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    marginBottom: 6,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const ProfileTab = ({ user, profileData, setProfileData, loading, handleProfileUpdate }) => {
    const { showToast } = useToast();
    const [uploadingImage, setUploadingImage] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [cropSrc, setCropSrc] = useState(null);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
        if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10 MB', 'error'); return; }
        if (fileInputRef.current) fileInputRef.current.value = '';
        const objectUrl = URL.createObjectURL(file);
        setCropSrc(objectUrl);
    };

    const handleCropConfirm = (blob) => {
        const file = new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setCropSrc(null);
    };

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

    const handleAvatarSelect = useCallback(async (avatarConfig) => {
        setUploadingImage(true);
        setShowAvatarPicker(false);
        try {
            const svgUrl = avatarUrl(avatarConfig.cat, avatarConfig.seed);
            const res = await fetch(svgUrl);
            if (!res.ok) throw new Error('Could not load avatar');
            const svgText = await res.text();
            const blob = await new Promise((resolve, reject) => {
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400; canvas.height = 400;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 400, 400);
                    URL.revokeObjectURL(url);
                    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png', 1.0);
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG image load failed')); };
                img.src = url;
            });
            const formData = new FormData();
            formData.append('profilePicture', new File([blob], `avatar-${avatarConfig.seed}.png`, { type: 'image/png' }));
            await api.post('/api/auth/me/profile-picture', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPreviewUrl(svgUrl);
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

    const currentPic = previewUrl || user?.profilePicture;

    const actionBtn = (opts = {}) => ({
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        border: '1px solid var(--border-default)',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
        ...S.font,
        ...opts,
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {}
            <Card title="Profile Photo" subtitle="Your identity across all workspaces and channels">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                    {}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        {currentPic ? (
                            <img
                                src={currentPic}
                                alt={user?.username}
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 2,
                                    objectFit: 'cover',
                                    border: '1px solid var(--border-default)',
                                    backgroundColor: 'var(--bg-active)',
                                }}
                            />
                        ) : (
                            <div style={{
                                width: 72,
                                height: 72,
                                borderRadius: 2,
                                backgroundColor: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#0c0c0c',
                                fontWeight: 700,
                                fontSize: 28,
                                border: '1px solid var(--border-default)',
                            }}>
                                {user?.username?.charAt(0)?.toUpperCase()}
                            </div>
                        )}
                        {uploadingImage && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Loader2 size={20} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} />
                            </div>
                        )}
                    </div>

                    {}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', ...S.font }}>{user?.username}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, ...S.font }}>{user?.email}</div>

                        {selectedFile ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={handleUploadProfilePicture}
                                    disabled={uploadingImage}
                                    style={actionBtn({ color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none' })}
                                    onMouseEnter={e => { if (!uploadingImage) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                                    onMouseLeave={e => { if (!uploadingImage) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                                >
                                    <Upload size={12} /> Save Photo
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={uploadingImage}
                                    style={actionBtn({ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)' })}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <label
                                    htmlFor="profile-pic-input"
                                    style={actionBtn({ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)', cursor: 'pointer' })}
                                >
                                    <ImagePlus size={12} /> Upload Photo
                                </label>
                                <button
                                    onClick={() => setShowAvatarPicker(true)}
                                    disabled={uploadingImage}
                                    style={actionBtn({ color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none' })}
                                    onMouseEnter={e => { if (!uploadingImage) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                                    onMouseLeave={e => { if (!uploadingImage) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                                >
                                    <Sparkles size={12} /> Avatar Library
                                </button>
                                {currentPic && (
                                    <button
                                        onClick={() => setShowRemoveConfirm(true)}
                                        disabled={uploadingImage}
                                        style={actionBtn({ color: 'var(--state-danger)', backgroundColor: 'transparent', borderColor: 'rgba(224,82,82,0.3)' })}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <Trash2 size={11} /> Remove
                                    </button>
                                )}
                            </div>
                        )}
                        <input
                            id="profile-pic-input"
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            style={{ display: 'none' }}
                            disabled={uploadingImage}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, ...S.font }}>Square image, min 200×200px. Max 5 MB.</p>
                    </div>
                </div>
            </Card>

            {}
            <Card title="Personal Information" subtitle="Your public profile details">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Display Name</label>
                            <input
                                type="text"
                                value={profileData.username}
                                onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                style={inputClass_style}
                                placeholder="Your name"
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email Address</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                style={{ ...inputClass_style, opacity: 0.5, cursor: 'not-allowed' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Phone Number</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select
                                value={profileData.phoneCode}
                                onChange={e => setProfileData({ ...profileData, phoneCode: e.target.value })}
                                style={{ ...inputClass_style, width: 90 }}
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
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
                                <option value="+65">+65 SG</option>
                                <option value="+55">+55 BR</option>
                                <option value="+52">+52 MX</option>
                                <option value="+27">+27 ZA</option>
                                <option value="+82">+82 KR</option>
                            </select>
                            <input
                                type="tel"
                                value={profileData.phone}
                                onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                                style={{ ...inputClass_style, flex: 1 }}
                                placeholder="Phone number"
                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Bio</label>
                        <textarea
                            value={profileData.about}
                            onChange={e => setProfileData({ ...profileData, about: e.target.value })}
                            rows={3}
                            maxLength={500}
                            style={{ ...inputClass_style, resize: 'none' }}
                            placeholder="A brief professional summary…"
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                        />
                        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4, ...S.font }}>
                            {profileData.about?.length || 0}/500
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                        <button
                            onClick={handleProfileUpdate}
                            disabled={loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 16px',
                                fontSize: 13,
                                fontWeight: 500,
                                color: '#0c0c0c',
                                backgroundColor: 'var(--accent)',
                                border: 'none',
                                borderRadius: 2,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1,
                                transition: 'background-color 150ms ease',
                                ...S.font,
                            }}
                            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                        >
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </Card>

            {}
            {showAvatarPicker && (
                <AvatarPickerModal
                    onSelect={handleAvatarSelect}
                    onClose={() => setShowAvatarPicker(false)}
                    uploading={uploadingImage}
                />
            )}

            {}
            {cropSrc && (
                <ImageCropEditor
                    src={cropSrc}
                    onConfirm={handleCropConfirm}
                    onCancel={() => { setCropSrc(null); }}
                    outputSize={400}
                />
            )}

            {}
            {showRemoveConfirm && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    padding: 16,
                }}>
                    <div style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: 2,
                        padding: 24,
                        maxWidth: 360,
                        width: '100%',
                    }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', ...S.font }}>Remove Profile Photo?</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5, ...S.font }}>Your avatar will display your initials instead.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => setShowRemoveConfirm(false)}
                                style={{
                                    flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500,
                                    color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)',
                                    border: '1px solid var(--border-default)', borderRadius: 2, cursor: 'pointer',
                                    ...S.font,
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleRemove}
                                style={{
                                    flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 500,
                                    color: '#fff', backgroundColor: 'var(--state-danger)',
                                    border: 'none', borderRadius: 2, cursor: 'pointer',
                                    transition: 'opacity 150ms ease',
                                    ...S.font,
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileTab;
