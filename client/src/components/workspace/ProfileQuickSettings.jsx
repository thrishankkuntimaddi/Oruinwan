// client/src/components/workspace/ProfileQuickSettings.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, Mail, Phone, Calendar, Camera, Save,
    Settings, Shield, LogOut, Sun, Moon, Monitor, Edit3,
    Check, ChevronRight, Building
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getAvatarUrl } from '../../utils/avatarUtils';

/* ── Shared style tokens ──────────────────────────────────────── */
const inp = {
    width: '100%', padding: '8px 10px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box',
    transition: '150ms ease',
};
const lbl = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: 'var(--text-muted)', letterSpacing: '0.12em',
    textTransform: 'uppercase', marginBottom: '6px',
};
const rowBtn = {
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '10px 12px',
    borderRadius: '2px', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease',
};
const divider = { borderTop: '1px solid var(--border-subtle)', margin: '6px 0' };

const ProfileQuickSettings = ({ onClose }) => {
    const { user, updateProfile, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { showToast } = useToast();
    const { company } = useCompany();
    const navigate = useNavigate();

    const [view, setView] = useState('main');
    const [, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        username: user?.username || '',
        phone: user?.phone || '',
        phoneCode: user?.phoneCode || '+1',
        address: user?.address || user?.profile?.address || '',
        dob: user?.profile?.dob ? new Date(user.profile.dob).toISOString().split('T')[0] : '',
        about: user?.profile?.about || ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                phone: user.phone || '',
                phoneCode: user.phoneCode || '+1',
                address: user.address || user.profile?.address || '',
                dob: user.profile?.dob ? new Date(user.profile.dob).toISOString().split('T')[0] : '',
                about: user.profile?.about || ''
            });
        }
    }, [user]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateProfile(formData);
            showToast('Profile updated successfully!', 'success');
            setIsEditing(false);
            setView('main');
        } catch (err) {
            showToast(err.message || 'Failed to update profile', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    /* Role badge color — accent only for owner, neutral for rest */
    const getRoleBadge = () => {
        const role = user?.companyRole;
        const label = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member';
        const isOwner = role === 'owner';
        return (
            <span style={{
                padding: '3px 10px', borderRadius: '2px', fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: isOwner ? 'var(--accent-dim)' : 'var(--bg-active)',
                color: isOwner ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${isOwner ? 'var(--border-accent)' : 'var(--border-default)'}`,
            }}>{label}</span>
        );
    };

    /* ── Main View ─────────────────────────────────────────────── */
    const renderMainView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Avatar + name */}
            <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-accent)', margin: '0 auto' }}>
                        <img src={getAvatarUrl(user)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <button onClick={() => setView('edit')} style={{ position: 'absolute', bottom: 0, right: 0, width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <Edit3 size={11} />
                    </button>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px', letterSpacing: '-0.01em' }}>{user?.username}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>{user?.email}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {getRoleBadge()}
                    {company?.name && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building size={11} /> {company.name}
                        </span>
                    )}
                </div>
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {user?.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                        <Phone size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 2px' }}>Phone</p>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{user.phoneCode} {user.phone}</p>
                        </div>
                    </div>
                )}

                {formData.dob && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 2px' }}>Birthday</p>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                                {new Date(formData.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                )}

                {user?.createdAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                        <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 2px' }}>Member Since</p>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                                {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Action rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={() => { onClose(); navigate('/settings', { state: { from: '/workspaces' } }); }}
                    style={rowBtn}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Settings size={16} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>All Settings</span>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </button>

                {(user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
                    <>
                        <div style={divider} />
                        <button onClick={() => window.location.href = '/admin/dashboard'}
                            style={rowBtn}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Shield size={16} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Admin Dashboard</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                        </button>
                    </>
                )}

                <div style={divider} />

                <button onClick={handleLogout} style={rowBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.querySelector('span').style.color = 'var(--state-danger)'; e.currentTarget.querySelector('svg').style.color = 'var(--state-danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.querySelector('span').style.color = 'var(--text-secondary)'; e.currentTarget.querySelector('svg').style.color = 'var(--text-muted)'; }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LogOut size={16} style={{ color: 'var(--text-muted)', transition: '150ms ease' }} />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', transition: '150ms ease' }}>Sign Out</span>
                    </div>
                </button>
            </div>
        </div>
    );

    /* ── Edit View ─────────────────────────────────────────────── */
    const renderEditView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setView('main')} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >← Back</button>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Edit Profile</h4>
                <div style={{ width: '40px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '320px', overflowY: 'auto' }}>
                {/* Avatar */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ position: 'relative' }} className="group">
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-accent)' }}>
                            <img src={getAvatarUrl(user)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <button className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ border: 'none', cursor: 'pointer' }}>
                            <Camera size={16} style={{ color: '#fff' }} />
                        </button>
                    </div>
                </div>

                <div>
                    <label style={lbl}>Full Name</label>
                    <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                        style={inp}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />
                </div>

                <div>
                    <label style={lbl}>Email</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                        <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{user?.email}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Email cannot be changed here</p>
                </div>

                <div>
                    <label style={lbl}>Phone Number</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={formData.phoneCode} onChange={e => setFormData({ ...formData, phoneCode: e.target.value })}
                            style={{ ...inp, width: '72px', flexShrink: 0 }}>
                            <option value="+1">+1</option>
                            <option value="+44">+44</option>
                            <option value="+91">+91</option>
                        </select>
                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            style={inp} placeholder="123-456-7890"
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        />
                    </div>
                </div>

                <div>
                    <label style={lbl}>Date of Birth</label>
                    <input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                        style={inp}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />
                </div>

                <div>
                    <label style={lbl}>Address</label>
                    <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                        rows={2} placeholder="123 Main St, City, State"
                        style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />
                </div>

                <div>
                    <label style={lbl}>About</label>
                    <textarea value={formData.about} onChange={e => setFormData({ ...formData, about: e.target.value })}
                        rows={3} maxLength={500} placeholder="Tell us about yourself..."
                        style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>{formData.about?.length || 0}/500</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setView('main')}
                    style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >Cancel</button>
                <button onClick={handleSave} disabled={isSaving}
                    style={{ flex: 1, padding: '8px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isSaving ? 0.6 : 1, transition: '150ms ease' }}
                >
                    {isSaving ? <><div style={{ width: '14px', height: '14px', border: '2px solid var(--text-muted)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Saving...</> : <><Save size={14} />Save Changes</>}
                </button>
            </div>
        </div>
    );

    /* ── Theme View ────────────────────────────────────────────── */
    const renderThemeView = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setView('main')} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >← Back</button>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Appearance</h4>
                <div style={{ width: '40px' }} />
            </div>

            <div>
                <label style={lbl}>Theme</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                        { value: 'light', label: 'Light', icon: Sun },
                        { value: 'dark', label: 'Dark', icon: Moon },
                        { value: 'auto', label: 'Auto', icon: Monitor },
                    ].map(({ value, label, icon: Icon }) => {
                        const active = theme === value;
                        return (
                            <button key={value}
                                onClick={() => { setTheme(value); showToast(`Theme changed to ${label}`, 'success'); }}
                                style={{ padding: '12px 8px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: '2px', background: active ? 'var(--accent-dim)' : 'var(--bg-surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: '150ms ease', fontFamily: 'var(--font)' }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                            >
                                <Icon size={20} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{label}</span>
                                {active && <Check size={12} style={{ color: 'var(--accent)' }} />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px', fontFamily: 'var(--font)' }}>
            <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>My Profile</h3>
                    <button onClick={onClose}
                        style={{ width: '28px', height: '28px', borderRadius: '2px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: '150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><X size={16} /></button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px' }}>
                    {view === 'main' && renderMainView()}
                    {view === 'edit' && renderEditView()}
                    {view === 'theme' && renderThemeView()}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ProfileQuickSettings;
