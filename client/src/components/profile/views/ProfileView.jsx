import { forgetAvatar, rememberAvatar } from '../../../utils/avatarUtils';
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, CheckCircle2, AlertCircle, Plus, ImagePlus, Loader2, ArrowUpRight } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Btn, Chip, Confirm, Field, IconBtn, errorMessage } from '../../ui/page';
import '../profileMenu.css';
import SquareCropDialog from '../../../shared/components/media/SquareCropDialog';

// Matches the server's limits on POST /api/auth/me/profile-picture (multer, field `profilePicture`).
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function PhotoField({ user }) {
    const { setUser } = useAuth();
    const { showToast } = useToast();
    const fileRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const hasPhoto = !!user?.profilePicture;

    const updateUser = (profilePicture) => {
        forgetAvatar(user);
        if (profilePicture) rememberAvatar({ ...user, profilePicture });
        setUser?.((prev) => (prev ? { ...prev, profilePicture } : prev));
    };

    // A picked photo is cropped to a square first, then uploaded.
    const [cropping, setCropping] = useState(null);
    const onFile = (e) => {
        const file = e.target.files?.[0];
        if (fileRef.current) fileRef.current.value = '';
        if (!file) return;
        if (!PHOTO_TYPES.includes(file.type)) { showToast('Use a JPG, PNG, WebP or GIF image', 'error'); return; }
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) { showToast(`Images must be ${MAX_PHOTO_MB} MB or smaller`, 'error'); return; }
        setCropping(file);
    };
    const uploadCropped = async (blob) => {
        setBusy(true);
        try {
            const form = new FormData();
            form.append('profilePicture', new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
            const { data } = await api.post('/api/auth/me/profile-picture', form);
            if (data?.profilePicture) updateUser(data.profilePicture);
            showToast('Profile photo updated', 'success');
            setCropping(null);
        } catch (err) {
            showToast(errorMessage(err, 'Could not upload your photo'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const onRemove = async () => {
        setBusy(true);
        try {
            await api.delete('/api/auth/me/profile-picture');
            updateUser(null);
            showToast('Profile photo removed', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not remove your photo'), 'error');
        } finally {
            setBusy(false);
            setConfirmRemove(false);
        }
    };

    return (
        <div className="pm-photo">
            <div className="pm-photo-img" aria-busy={busy ? 'true' : undefined}>
                {hasPhoto
                    ? <img src={user.profilePicture} alt="Your profile" />
                    : <span className="pm-photo-initial" aria-hidden="true">{(user?.username || user?.email || '?').charAt(0).toUpperCase()}</span>}
                {busy && <span className="pm-photo-busy" role="status" aria-label="Updating photo"><Loader2 size={18} className="cd-spin" /></span>}
            </div>
            <div className="pm-photo-actions">
                <div className="pm-row">
                    <Btn size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()} disabled={busy}>
                        {hasPhoto ? 'Change photo' : 'Upload photo'}
                    </Btn>
                    {hasPhoto && (
                        <Btn size="sm" variant="ghost" onClick={() => setConfirmRemove(true)} disabled={busy}>Remove</Btn>
                    )}
                </div>
                <span className="pm-hint">JPG, PNG, WebP or GIF, up to {MAX_PHOTO_MB} MB.</span>
                <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(',')} onChange={onFile} hidden />
                {cropping && <SquareCropDialog file={cropping} title="Profile photo" round busy={busy} onCancel={() => setCropping(null)} onDone={uploadCropped} />}
            </div>
            <Confirm
                open={confirmRemove}
                title="Remove your photo?"
                confirmLabel="Remove photo"
                tone="danger"
                busy={busy}
                onConfirm={onRemove}
                onClose={() => setConfirmRemove(false)}
            >
                People will see your initials instead until you add a new one.
            </Confirm>
        </div>
    );
}

const ProfileView = ({
    user, formData, setFormData, phoneCode, setPhoneCode,
    emails, newEmail, setNewEmail,
    onBack, onSaveProfile, onAddEmail, onDeleteEmail, onMakePrimary, onVerifyEmail, onResendCode
}) => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try { await onSaveProfile(); } finally { setSaving(false); }
    };

    return (
        <div className="pm" data-wide="true" role="dialog" aria-label="Edit profile">
            <div className="pm-head">
                <button type="button" className="pm-back" onClick={onBack}><ChevronLeft size={14} /> Back</button>
                <h2>Edit profile</h2>
                <span />
            </div>

            <div className="pm-body">
                <PhotoField user={user} />

                <Field label="Display name" htmlFor="pm-name">
                    <input id="pm-name" className="gl-input" type="text" value={formData.username || ''}
                        onChange={e => setFormData({ ...formData, username: e.target.value })} maxLength={50} />
                </Field>

                <Field label="Date of birth" htmlFor="pm-dob">
                    <input id="pm-dob" className="gl-input" type="date" value={formData.dob || ''}
                        onChange={e => setFormData({ ...formData, dob: e.target.value })}
                        max={new Date().toISOString().split('T')[0]} min="1900-01-01" />
                </Field>

                <Field label="Phone" htmlFor="pm-phone">
                    <div className="pm-phone">
                        <select className="gl-input" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} aria-label="Country code">
                            <option value="+1">+1</option>
                            <option value="+44">+44</option>
                            <option value="+91">+91</option>
                            <option value="+81">+81</option>
                        </select>
                        <input id="pm-phone" className="gl-input" type="tel" value={formData.phone || ''}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder={phoneCode === '+91' ? '98765 43210' : '123-456-7890'} />
                    </div>
                </Field>

                <Field label="Email addresses">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {emails.map(email => (
                            <div key={email.id || email._id} className="pm-email">
                                <div className="pm-email-top">
                                    <span className="pm-email-addr">{email.email}</span>
                                    {!email.isPrimary && (
                                        <IconBtn label={`Remove ${email.email}`} onClick={() => onDeleteEmail(email.id)} style={{ width: 26, height: 26 }}>
                                            <Trash2 size={13} />
                                        </IconBtn>
                                    )}
                                </div>
                                <div className="pm-email-chips">
                                    {email.verified
                                        ? <Chip tone="success"><CheckCircle2 size={10} /> Verified</Chip>
                                        : <Chip tone="warning"><AlertCircle size={10} /> Not verified</Chip>}
                                    {email.isPrimary && <Chip tone="accent">Primary</Chip>}
                                </div>
                                {(!email.verified || !email.isPrimary) && (
                                    <div className="pm-email-acts">
                                        {!email.verified && (
                                            <>
                                                <button type="button" className="pm-link" data-tone="accent" onClick={() => onVerifyEmail(email.id)}>Enter code</button>
                                                <button type="button" className="pm-link" onClick={() => onResendCode(email.id)}>Send a new code</button>
                                            </>
                                        )}
                                        {email.verified && !email.isPrimary && (
                                            <button type="button" className="pm-link" onClick={() => onMakePrimary(email.id)}>Make primary</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="pm-add">
                            <input className="gl-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') onAddEmail(); }}
                                placeholder="Add another email" aria-label="Add another email" />
                            <IconBtn label="Add email" onClick={onAddEmail} disabled={!newEmail.trim()}><Plus size={16} /></IconBtn>
                        </div>
                    </div>
                </Field>

                <Field label="About you" htmlFor="pm-about">
                    <textarea id="pm-about" className="gl-input" value={formData.about || ''}
                        onChange={e => setFormData({ ...formData, about: e.target.value })}
                        style={{ resize: 'vertical', lineHeight: 1.6, minHeight: 72 }} rows={3}
                        placeholder="A line or two about what you work on" maxLength={500} />
                    <div className="pm-count">{(formData.about || '').length} / 500</div>
                </Field>
            </div>

            <div className="pm-foot">
                <button type="button" className="pm-link" onClick={() => navigate('/settings?tab=profile', { state: { from: window.location.pathname } })}>
                    All profile settings <ArrowUpRight size={12} />
                </button>
                <Btn variant="primary" onClick={save} loading={saving}>Save</Btn>
            </div>
        </div>
    );
};

export default ProfileView;
