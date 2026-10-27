import React, { useRef, useState } from 'react';
import { Globe, ImagePlus, MapPin, Pencil, Trash2, UserSquare2 } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import { WorkspaceIcon, workspaceLogoSrc, DEFAULT_WORKSPACE_COLOR } from '../../../utils/workspaceIcons';
import { Btn, Field, Panel } from '../../ui/page';
import SquareCropDialog from '../../../shared/components/media/SquareCropDialog';

const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * The workspace's profile: cover image, logo, tagline, description, website and location.
 * Everyone sees it; owners and admins edit it (server: workspaceProfile.js).
 */
export default function WorkspaceProfilePanel({ workspace, isAdmin, onChanged }) {
    const { showToast } = useToast();
    const profile = workspace?.profile || {};
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(null);
    const [form, setForm] = useState({});
    const logoInput = useRef(null);
    // The workspace picture is cropped to a square first (like a group icon).
    const [cropping, setCropping] = useState(null);
    const coverInput = useRef(null);

    const start = () => {
        setForm({
            tagline: profile.tagline || '',
            description: workspace?.description || '',
            website: profile.website || '',
            location: profile.location || '',
        });
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            await api.put(`/api/workspaces/${workspace.id}`, {
                description: form.description,
                profile: { tagline: form.tagline, website: form.website, location: form.location },
            });
            showToast('Workspace profile saved', 'success');
            setEditing(false);
            await onChanged?.();
        } catch (err) {
            showToast(err.response?.data?.message || 'Could not save the profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const upload = async (kind, file) => {
        if (!file) return;
        if (file.size > MAX_IMAGE) return showToast('Images can be at most 5 MB', 'error');
        const body = new FormData();
        body.append('image', file);
        setUploading(kind);
        try {
            await api.post(`/api/workspaces/${workspace.id}/profile/${kind}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
            showToast(kind === 'logo' ? 'Workspace picture updated' : 'Cover image updated', 'success');
            await onChanged?.();
        } catch (err) {
            showToast(err.response?.data?.message || 'Upload failed', 'error');
        } finally {
            setUploading(null);
        }
    };

    const remove = async (kind) => {
        setUploading(kind);
        try {
            await api.delete(`/api/workspaces/${workspace.id}/profile/${kind}`);
            await onChanged?.();
        } catch (err) {
            showToast(err.response?.data?.message || 'Could not remove it', 'error');
        } finally {
            setUploading(null);
        }
    };

    const cover = workspaceLogoSrc(profile.coverUrl);
    const color = workspace?.color || DEFAULT_WORKSPACE_COLOR;
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    return (
        <Panel
            title="Profile"
            icon={UserSquare2}
            flush
            action={isAdmin && !editing && <Btn size="sm" icon={Pencil} onClick={start}>Edit profile</Btn>}
        >
            <div className="wsp-cover" data-testid="workspace-cover"
                style={cover ? { backgroundImage: `url("${cover}")` } : { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, var(--bg-surface)))` }}>
                {isAdmin && (
                    <div className="wsp-cover-actions">
                        <Btn size="sm" icon={ImagePlus} loading={uploading === 'cover'} onClick={() => coverInput.current?.click()}>
                            {cover ? 'Change cover' : 'Add cover'}
                        </Btn>
                        {cover && <Btn size="sm" variant="ghost" icon={Trash2} aria-label="Remove cover" onClick={() => remove('cover')} />}
                    </div>
                )}
            </div>
            <div className="wsp-body">
                <div className="wsp-logo-row">
                    <span className="wsg-tile wsg-tile--lg wsp-logo" style={{ backgroundColor: color }}>
                        <WorkspaceIcon icon={workspace?.icon} logo={profile.logoUrl} size={28} />
                    </span>
                    {isAdmin && (
                        <span className="wsp-logo-actions">
                            <Btn size="sm" icon={ImagePlus} loading={uploading === 'logo'} onClick={() => logoInput.current?.click()}>
                                {profile.logoUrl ? 'Change picture' : 'Add workspace picture'}
                            </Btn>
                            {profile.logoUrl && <Btn size="sm" variant="ghost" icon={Trash2} aria-label="Remove workspace picture" onClick={() => remove('logo')} />}
                        </span>
                    )}
                </div>

                {editing ? (
                    <div className="wsg-form">
                        <Field label="Tagline" htmlFor="wsp-tagline">
                            <input id="wsp-tagline" className="gl-input" value={form.tagline} onChange={set('tagline')} maxLength={120} placeholder="What this workspace is for, in a line" />
                        </Field>
                        <Field label="About" htmlFor="wsp-about">
                            <textarea id="wsp-about" className="gl-input" rows={4} value={form.description} onChange={set('description')} maxLength={1000}
                                placeholder="Who's here and what you work on" style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
                        </Field>
                        <Field label="Website" htmlFor="wsp-website">
                            <input id="wsp-website" className="gl-input" value={form.website} onChange={set('website')} maxLength={200} placeholder="example.com" inputMode="url" />
                        </Field>
                        <Field label="Location" htmlFor="wsp-location">
                            <input id="wsp-location" className="gl-input" value={form.location} onChange={set('location')} maxLength={80} placeholder="City, country or Remote" />
                        </Field>
                        <div className="wsg-actions">
                            <Btn variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Btn>
                            <Btn variant="primary" onClick={save} loading={saving}>Save profile</Btn>
                        </div>
                    </div>
                ) : (
                    <div className="wsp-text">
                        {profile.tagline ? <p className="wsp-tagline">{profile.tagline}</p> : null}
                        {workspace?.description ? <p className="wsp-about">{workspace.description}</p> : null}
                        {(profile.website || profile.location) && (
                            <p className="wsp-facts">
                                {profile.website && (
                                    <a href={profile.website} target="_blank" rel="noopener noreferrer"><Globe size={13} /> {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                                )}
                                {profile.location && <span><MapPin size={13} /> {profile.location}</span>}
                            </p>
                        )}
                        {!profile.tagline && !workspace?.description && !profile.website && !profile.location && (
                            <p className="cd-hint">{isAdmin ? 'Add a logo, cover, tagline and a few words about this workspace.' : 'No profile yet.'}</p>
                        )}
                    </div>
                )}
            </div>
            <input ref={logoInput} type="file" accept={IMAGE_TYPES} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropping(f); e.target.value = ''; }} />
            {cropping && (
                <SquareCropDialog
                    file={cropping}
                    title="Workspace picture"
                    busy={uploading === 'logo'}
                    onCancel={() => setCropping(null)}
                    onDone={async (blob) => {
                        await upload('logo', new File([blob], 'workspace.jpg', { type: 'image/jpeg' }));
                        setCropping(null);
                    }}
                />
            )}
            <input ref={coverInput} type="file" accept={IMAGE_TYPES} hidden onChange={(e) => { upload('cover', e.target.files?.[0]); e.target.value = ''; }} />
        </Panel>
    );
}
