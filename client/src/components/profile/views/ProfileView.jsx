import React from 'react';
import { ChevronLeft, Trash2, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { getAvatarUrl } from '../../../utils/avatarUtils';

const inp = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark', transition: '150ms ease',
};
const lbl = {
    display: 'block', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px',
    fontFamily: 'Inter, system-ui, sans-serif',
};
const focusAmber = e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)';
const blurDefault = e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';

const ProfileView = ({
    user, formData, setFormData, phoneCode, setPhoneCode,
    emails, newEmail, setNewEmail,
    onBack, onSaveProfile, onAddEmail, onDeleteEmail, onMakePrimary, onVerifyEmail, onResendCode
}) => {
    return (
        <div style={{
            width: '256px', background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.75)', overflow: 'hidden', display: 'flex',
            flexDirection: 'column', maxHeight: '80vh', fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                <button onClick={onBack}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
                >
                    <ChevronLeft size={13} /> Back
                </button>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Profile</span>
                <div style={{ width: '40px' }} />
            </div>

            {}
            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }} className="custom-scrollbar">

                {}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ position: 'relative' }} title="Profile Picture Upload coming soon">
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)', backgroundImage: `url(${getAvatarUrl(user)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <button style={{ position: 'absolute', bottom: 0, right: 0, width: '18px', height: '18px', borderRadius: '50%', background: '#b8956a', border: '2px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0c0c0c' }}>
                            <Plus size={11} />
                        </button>
                    </div>
                </div>

                {}
                <div>
                    <label style={lbl}>Full Name</label>
                    <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                        style={inp} onFocus={focusAmber} onBlur={blurDefault} />
                </div>

                {}
                <div>
                    <label style={lbl}>Date of Birth</label>
                    <input type="date" value={formData.dob || ''} onChange={e => setFormData({ ...formData, dob: e.target.value })}
                        max={new Date().toISOString().split('T')[0]} min="1900-01-01"
                        style={inp} onFocus={focusAmber} onBlur={blurDefault} />
                </div>

                {}
                <div>
                    <label style={lbl}>Phone</label>
                    <div style={{ display: 'flex' }}>
                        <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                            style={{ ...inp, width: '70px', flexShrink: 0, borderRight: 'none' }}
                            onFocus={focusAmber} onBlur={blurDefault}
                        >
                            <option value="+1">+1</option>
                            <option value="+44">+44</option>
                            <option value="+91">+91</option>
                            <option value="+81">+81</option>
                        </select>
                        <input type="tel" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            style={{ ...inp, flex: 1 }} onFocus={focusAmber} onBlur={blurDefault}
                            placeholder={phoneCode === '+91' ? '98765 43210' : '123-456-7890'} />
                    </div>
                </div>

                {}
                <div>
                    <label style={lbl}>Email Addresses</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {emails.map(email => (
                            <div key={email.id || email._id} style={{ padding: '10px 12px', border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.email}</span>
                                    {!email.isPrimary && (
                                        <button onClick={() => onDeleteEmail(email.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', transition: '150ms' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.3)'}
                                        ><Trash2 size={13} /></button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    {email.verified ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, padding: '2px 7px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
                                            <CheckCircle2 size={9} /> Verified
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, padding: '2px 7px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                                            <AlertCircle size={9} /> Unverified
                                        </span>
                                    )}
                                    {email.isPrimary && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontWeight: 700, padding: '2px 7px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.25)', color: '#b8956a' }}>
                                            Primary
                                        </span>
                                    )}
                                </div>
                                {(!email.verified || (email.verified && !email.isPrimary)) && (
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                                        {!email.verified && (
                                            <>
                                                <button onClick={() => onVerifyEmail(email.id)}
                                                    style={{ fontSize: '10px', fontWeight: 700, color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}>
                                                    Verify Now
                                                </button>
                                                <button onClick={() => onResendCode(email.id)}
                                                    style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}>
                                                    Resend Code
                                                </button>
                                            </>
                                        )}
                                        {email.verified && !email.isPrimary && (
                                            <button onClick={() => onMakePrimary(email.id)}
                                                style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}>
                                                Set as Primary
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {}
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                placeholder="Add another email..." style={{ ...inp, flex: 1 }}
                                onFocus={focusAmber} onBlur={blurDefault} />
                            <button onClick={onAddEmail}
                                style={{ padding: '8px 12px', background: 'var(--bg-active)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', cursor: 'pointer', transition: '150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e4e4e4'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(228,228,228,0.6)'; }}
                            ><Plus size={16} /></button>
                        </div>
                    </div>
                </div>

                {}
                <div>
                    <label style={lbl}>About</label>
                    <textarea value={formData.about || ''} onChange={e => setFormData({ ...formData, about: e.target.value })}
                        style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} rows={3}
                        placeholder="Tell us a bit about yourself..." maxLength={500}
                        onFocus={focusAmber} onBlur={blurDefault} />
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                        {(formData.about || '').length} / 500
                    </div>
                </div>
            </div>

            {}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button onClick={onSaveProfile}
                    style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700, background: '#b8956a', color: '#0c0c0c', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default ProfileView;
