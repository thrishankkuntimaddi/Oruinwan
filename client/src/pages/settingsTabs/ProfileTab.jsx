import React, { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';
import { useRevokeObjectUrl } from '../../hooks/useRevokeObjectUrl';
import ImageCropEditor from './ImageCropEditor';
import AvatarPicker, { renderAvatarPng } from './account/AvatarPicker';
import EmailAddresses from './account/EmailAddresses';
import useFreshUser from './account/useFreshUser';
import {
    Button, ConfirmDialog, ErrorState, Field, Input, LoadingState, PageIntro, SaveBar, Section, Select, Textarea,
    errorMessage, useSettingsForm,
} from './settingsUi';
import './account/account.css';

// Matches the server's multer limit on POST /api/auth/me/profile-picture.
const MAX_PHOTO_MB = 5;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BIO_MAX = 500;

const COUNTRY_CODES = [
    ['+1', 'US / CA'], ['+44', 'UK'], ['+91', 'India'], ['+61', 'Australia'], ['+49', 'Germany'],
    ['+33', 'France'], ['+34', 'Spain'], ['+39', 'Italy'], ['+31', 'Netherlands'], ['+46', 'Sweden'],
    ['+41', 'Switzerland'], ['+353', 'Ireland'], ['+48', 'Poland'], ['+7', 'Russia'], ['+90', 'Türkiye'],
    ['+971', 'UAE'], ['+966', 'Saudi Arabia'], ['+972', 'Israel'], ['+20', 'Egypt'], ['+234', 'Nigeria'],
    ['+254', 'Kenya'], ['+27', 'South Africa'], ['+92', 'Pakistan'], ['+880', 'Bangladesh'], ['+94', 'Sri Lanka'],
    ['+977', 'Nepal'], ['+65', 'Singapore'], ['+60', 'Malaysia'], ['+62', 'Indonesia'], ['+63', 'Philippines'],
    ['+66', 'Thailand'], ['+84', 'Vietnam'], ['+86', 'China'], ['+852', 'Hong Kong'], ['+81', 'Japan'],
    ['+82', 'South Korea'], ['+64', 'New Zealand'], ['+55', 'Brazil'], ['+52', 'Mexico'], ['+54', 'Argentina'],
    ['+57', 'Colombia'], ['+56', 'Chile'],
];

const initialFrom = (user) => ({
    username: user?.username || '',
    about: user?.profile?.about || user?.about || '',
    phone: user?.phone || '',
    phoneCode: user?.phoneCode || '+1',
});

const validate = (v) => {
    const errors = {};
    const name = v.username.trim();
    if (name.length < 2) errors.username = 'Use at least 2 characters';
    else if (name.length > 50) errors.username = 'Use 50 characters or fewer';
    if (v.about.length > BIO_MAX) errors.about = `Keep it under ${BIO_MAX} characters`;
    if (v.phone && (v.phone.length < 4 || v.phone.length > 15)) errors.phone = 'Enter 4 to 15 digits, without the country code';
    return errors;
};

function PhotoSection({ user, setUser }) {
    const { showToast } = useToast();
    const fileRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const [cropSrc, setCropSrc] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerError, setPickerError] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(false);
    useRevokeObjectUrl(cropSrc);

    const [brokenSrc, setBrokenSrc] = useState(null);
    const picture = user?.profilePicture && user.profilePicture !== brokenSrc ? user.profilePicture : null;
    const initial = (user?.username || user?.email || '?').charAt(0).toUpperCase();

    const upload = async (file) => {
        const form = new FormData();
        form.append('profilePicture', file);
        const { data } = await api.post('/api/auth/me/profile-picture', form);
        if (data?.profilePicture) setUser((prev) => (prev ? { ...prev, profilePicture: data.profilePicture } : prev));
    };

    const onFile = (e) => {
        const file = e.target.files?.[0];
        if (fileRef.current) fileRef.current.value = '';
        if (!file) return;
        if (!PHOTO_TYPES.includes(file.type)) { showToast('Use a JPG, PNG, WebP or GIF image', 'error'); return; }
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) { showToast(`Images must be ${MAX_PHOTO_MB} MB or smaller`, 'error'); return; }
        setCropSrc(URL.createObjectURL(file));
    };

    const onCropped = async (blob) => {
        setBusy(true);
        try {
            await upload(new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' }));
            setCropSrc(null);
            showToast('Profile photo updated', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not upload your photo'), 'error');
        } finally {
            setBusy(false);
        }
    };

    const onAvatar = async (avatar) => {
        setBusy(true);
        setPickerError('');
        try {
            const png = await renderAvatarPng(avatar);
            await upload(new File([png], `avatar-${avatar.seed}.png`, { type: 'image/png' }));
            setPickerOpen(false);
            showToast('Avatar updated', 'success');
        } catch (err) {
            setPickerError(errorMessage(err, 'Could not apply that avatar'));
        } finally {
            setBusy(false);
        }
    };

    const onRemove = async () => {
        setBusy(true);
        try {
            await api.delete('/api/auth/me/profile-picture');
            setUser((prev) => (prev ? { ...prev, profilePicture: null } : prev));
            setConfirmRemove(false);
            showToast('Profile photo removed', 'success');
        } catch (err) {
            setConfirmRemove(false);
            showToast(errorMessage(err, 'Could not remove your photo'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Section title="Photo" description="Shown next to your name everywhere in Oruinwan." pad>
            <div className="stg-acc-photo">
                <div className="stg-acc-avatar" aria-busy={busy ? 'true' : undefined}>
                    {picture ? <img src={picture} alt="Your profile" onError={() => setBrokenSrc(picture)} /> : <span aria-hidden="true">{initial}</span>}
                    {busy && <div className="stg-acc-avatar-busy" role="status" aria-label="Updating photo"><Loader2 size={22} className="stg-spin" /></div>}
                </div>
                <div className="stg-acc-photo-text">
                    <div className="stg-acc-name">{user?.username || 'Your name'}</div>
                    <div className="stg-acc-sub">{user?.email}</div>
                    <div className="stg-acc-actions">
                        <Button size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()} disabled={busy}>Upload photo</Button>
                        <Button size="sm" icon={Sparkles} onClick={() => { setPickerError(''); setPickerOpen(true); }} disabled={busy}>Choose avatar</Button>
                        {user?.profilePicture && (
                            <Button size="sm" variant="danger-soft" icon={Trash2} onClick={() => setConfirmRemove(true)} disabled={busy}>Remove</Button>
                        )}
                    </div>
                    <div className="stg-hint stg-acc-photo-hint">JPG, PNG, WebP or GIF, up to {MAX_PHOTO_MB} MB.</div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept={PHOTO_TYPES.join(',')}
                        onChange={onFile}
                        hidden
                        aria-label="Upload a profile photo"
                    />
                </div>
            </div>

            {cropSrc && (
                <ImageCropEditor src={cropSrc} busy={busy} onConfirm={onCropped} onCancel={() => setCropSrc(null)} outputSize={400} />
            )}

            <AvatarPicker
                open={pickerOpen}
                busy={busy}
                error={pickerError}
                onSelect={onAvatar}
                onClose={() => setPickerOpen(false)}
            />

            <ConfirmDialog
                open={confirmRemove}
                title="Remove profile photo?"
                confirmLabel="Remove"
                tone="danger"
                loading={busy}
                onConfirm={onRemove}
                onCancel={() => setConfirmRemove(false)}
            >
                Your photo will be removed from your profile.
            </ConfirmDialog>
        </Section>
    );
}

/** Basic info form. `children` render between the form and its save bar so the bar stays at the end of the page. */
function BasicInfo({ user, setUser, children }) {
    const { showToast } = useToast();
    const [touched, setTouched] = useState(false);

    const save = useCallback(async (values) => {
        const body = {
            username: values.username.trim(),
            about: values.about.trim(),
            phone: values.phone,
            phoneCode: values.phoneCode,
        };
        const { data } = await api.put('/api/auth/me', body);
        const saved = data?.user || data || {};
        const next = {
            username: saved.username ?? body.username,
            about: saved.about ?? saved.profile?.about ?? body.about,
            phone: saved.phone ?? body.phone,
            phoneCode: saved.phoneCode || body.phoneCode,
        };
        setUser((prev) => (prev ? {
            ...prev,
            username: next.username,
            phone: next.phone,
            phoneCode: next.phoneCode,
            profile: { ...(prev.profile || {}), about: next.about },
        } : prev));
        return next;
    }, [setUser]);

    const form = useSettingsForm({
        initial: initialFrom(user),
        save,
        onSaved: () => { setTouched(false); showToast('Profile saved', 'success'); },
        onError: (msg) => showToast(msg, 'error'),
    });
    const { values, set } = form;
    const errors = validate(values);
    const invalid = Object.keys(errors).length > 0;
    const show = (k) => (touched || values[k] !== form.saved[k]) ? errors[k] : undefined;

    const codes = COUNTRY_CODES.some(([c]) => c === values.phoneCode)
        ? COUNTRY_CODES
        : [[values.phoneCode, 'Current'], ...COUNTRY_CODES];

    const onSave = () => {
        setTouched(true);
        if (!invalid) form.save();
    };

    return (
        <>
            <Section title="Basic info" description="Visible to people in your workspaces." pad>
                <div className="stg-acc-stack">
                    <Field id="profile-name" label="Display name" error={show('username')}>
                        <Input
                            id="profile-name"
                            value={values.username}
                            onChange={(e) => set('username', e.target.value)}
                            maxLength={50}
                            autoComplete="name"
                            placeholder="Your name"
                            invalid={!!show('username')}
                        />
                    </Field>

                    <Field id="profile-bio" label="Bio" error={show('about')}>
                        <Textarea
                            id="profile-bio"
                            value={values.about}
                            onChange={(e) => set('about', e.target.value)}
                            rows={3}
                            maxLength={BIO_MAX}
                            placeholder="A line or two about you and your work"
                            aria-describedby="profile-bio-count"
                        />
                        <div className="stg-acc-hint-row">
                            <span id="profile-bio-count" className="stg-acc-counter" data-over={values.about.length > BIO_MAX ? 'true' : undefined}>
                                {values.about.length}/{BIO_MAX}
                            </span>
                        </div>
                    </Field>

                    <Field id="profile-phone" label="Phone" error={show('phone')} hint="Optional. Digits only, without the country code.">
                        <div className="stg-acc-phone">
                            <Select
                                aria-label="Country code"
                                value={values.phoneCode}
                                onChange={(e) => set('phoneCode', e.target.value)}
                            >
                                {codes.map(([code, name]) => <option key={code} value={code}>{code} {name}</option>)}
                            </Select>
                            <Input
                                id="profile-phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                value={values.phone}
                                onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 15))}
                                placeholder="Phone number"
                                invalid={!!show('phone')}
                            />
                        </div>
                    </Field>
                </div>
            </Section>

            {children}

            <SaveBar
                visible={form.dirty}
                saving={form.saving}
                onSave={onSave}
                onDiscard={() => { form.discard(); setTouched(false); }}
                message={invalid ? 'Fix the highlighted fields to save' : 'You have unsaved changes'}
                disabled={invalid}
            />
        </>
    );
}

const ProfileTab = () => {
    const { user, setUser, loading, error, reload } = useFreshUser();

    return (
        <>
            <PageIntro title="Profile" description="Your photo, name and contact details." />
            {loading || !user ? (
                <LoadingState />
            ) : error ? (
                <ErrorState message={error} onRetry={reload} />
            ) : (
                <>
                    <PhotoSection user={user} setUser={setUser} />
                    <BasicInfo key={user._id || user.id} user={user} setUser={setUser}>
                        <EmailAddresses />
                    </BasicInfo>
                </>
            )}
        </>
    );
};

export default ProfileTab;
