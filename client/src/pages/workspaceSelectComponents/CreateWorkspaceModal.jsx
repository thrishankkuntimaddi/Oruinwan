import React, { useEffect } from 'react';
import { Rocket, X, CheckCircle2, ArrowRight, AlertCircle, Zap, Shield, Check } from 'lucide-react';

const s = {
    
    label: { display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' },
    input: { width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box', transition: '150ms ease' },
    inputErr: { width: '100%', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--state-danger)', borderRadius: '2px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' },
    h2: { fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.015em', lineHeight: 1.25 },
    sub: { fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 },
};

const CreateWorkspaceModal = ({
    isOpen, onClose, createStep, setCreateStep, createData, setCreateData,
    nameError, setNameError, termsAccepted, setTermsAccepted, onSubmit, getIconComponent, user
}) => {
    useEffect(() => {
        if (isOpen) { document.body.style.overflow = 'hidden'; }
        else { document.body.style.overflow = 'unset'; }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const steps = [
        { step: 1, label: 'Basics', desc: 'Name & Icon' },
        { step: 2, label: 'Branding', desc: 'Colors & Theme' },
        { step: 3, label: 'Admin', desc: 'Review Owner' },
        { step: 4, label: 'Members', desc: 'Invite Team' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="fixed inset-0 flex flex-col md:relative md:inset-auto md:flex-row md:max-w-5xl md:min-h-[580px] md:h-[80vh]" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden', fontFamily: 'var(--font)', width: '100%' }}>

                {}
                <div className="hidden md:flex" style={{ width: '220px', flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', padding: '24px', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '24px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Rocket size={16} style={{ color: 'var(--accent)' }} />
                            New Workspace
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {steps.map(st => (
                                <button key={st.step}
                                    onClick={() => createStep > st.step && setCreateStep(st.step)}
                                    disabled={createStep < st.step}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                                        borderRadius: '2px', textAlign: 'left', border: 'none', cursor: createStep > st.step ? 'pointer' : 'default',
                                        background: createStep === st.step ? 'var(--bg-active)' : 'transparent',
                                        outline: createStep === st.step ? '1px solid var(--border-accent)' : 'none',
                                        opacity: createStep < st.step ? 0.4 : 1,
                                        transition: '150ms ease', fontFamily: 'var(--font)',
                                    }}
                                    onMouseEnter={e => { if (createStep > st.step) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (createStep > st.step) e.currentTarget.style.background = createStep === st.step ? 'var(--bg-active)' : 'transparent'; }}
                                >
                                    <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                                        background: createStep === st.step ? 'var(--accent)' : createStep > st.step ? 'var(--state-success)' : 'var(--bg-active)',
                                        color: (createStep === st.step || createStep > st.step) ? '#0c0c0c' : 'var(--text-muted)',
                                    }}>
                                        {createStep > st.step ? <CheckCircle2 size={13} /> : st.step}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 500, color: createStep === st.step ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{st.label}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{st.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--font)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        ><X size={14} /> Cancel Creation</button>
                    </div>
                </div>

                {}
                <div className="min-h-0" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>

                    {}
                    <div className="flex md:hidden" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {createStep > 1 && (
                                <button onClick={() => setCreateStep(s => s - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                    <ArrowRight style={{ transform: 'rotate(180deg)' }} size={18} />
                                </button>
                            )}
                            <div>
                                <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', margin: 0, lineHeight: 1.2 }}>Step {createStep} of 4</h3>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{['Name & Icon', 'Branding & Theme', 'Confirm Admin', 'Invite Members'][createStep - 1]}</p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ padding: '6px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                            <X size={15} />
                        </button>
                    </div>

                    {}
                    <div className="flex-1 overflow-y-auto pb-20 md:pb-0" style={{ padding: '24px 32px', minHeight: 0 }}>
                        <form id="create-workspace-form" onSubmit={onSubmit} style={{ maxWidth: '640px', margin: '0 auto' }}>

                            {}
                            {createStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h2 style={s.h2}>Let's build your HQ</h2>
                                        <p style={s.sub}>Give your workspace a distinct identity.</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div>
                                                <label style={s.label}>Workspace Name</label>
                                                <input type="text" autoFocus placeholder="e.g. Acme Corp, Engineering Team"
                                                    value={createData.name}
                                                    onChange={e => { setCreateData({ ...createData, name: e.target.value }); setNameError(''); }}
                                                    style={nameError ? s.inputErr : s.input}
                                                    onFocus={e => { if (!nameError) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                                    onBlur={e => { if (!nameError) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                                                />
                                                {nameError && <p style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{nameError}</p>}
                                            </div>
                                            <div>
                                                <label style={s.label}>Description (Optional)</label>
                                                <textarea placeholder="What's this workspace for? Share your mission or guidelines."
                                                    value={createData.rules || ''}
                                                    onChange={e => setCreateData({ ...createData, rules: e.target.value })}
                                                    style={{ ...s.input, height: '110px', resize: 'vertical', lineHeight: 1.6 }}
                                                    onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={s.label}>Choose an Icon</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                {['rocket', 'briefcase', 'zap', 'palette', 'globe', 'trophy', 'target', 'flame', 'microscope', 'shield', 'lightbulb', 'sparkles'].map(iconName => {
                                                    const IconCmp = getIconComponent(iconName);
                                                    const active = createData.icon === iconName;
                                                    return (
                                                        <button key={iconName} type="button"
                                                            onClick={() => setCreateData({ ...createData, icon: iconName })}
                                                            style={{ aspectRatio: '1', borderRadius: '2px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`, background: active ? 'var(--accent-dim)' : 'var(--bg-surface)', color: active ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '150ms ease' }}
                                                            onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                                                            onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                                                        >
                                                            <IconCmp size={18} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {}
                            {createStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h2 style={s.h2}>Brand your Space</h2>
                                        <p style={s.sub}>Pick a color that matches your team's vibe.</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>
                                                <label style={s.label}>Preset Colors</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                                    {['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'].map(color => (
                                                        <button key={color} type="button"
                                                            onClick={() => setCreateData({ ...createData, color })}
                                                            style={{ aspectRatio: '1', borderRadius: '2px', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: createData.color === color ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', transition: '150ms ease', opacity: createData.color === color ? 1 : 0.75 }}
                                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                            onMouseLeave={e => e.currentTarget.style.opacity = createData.color === color ? '1' : '0.75'}
                                                        >
                                                            {createData.color === color && <Check style={{ color: '#fff' }} size={14} strokeWidth={3} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <label style={s.label}>Custom Color</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                                                    <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '2px', overflow: 'hidden', border: '1px solid var(--border-default)', flexShrink: 0 }}>
                                                        <input type="color" value={createData.color}
                                                            onChange={e => setCreateData({ ...createData, color: e.target.value })}
                                                            style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', padding: 0, margin: 0, cursor: 'pointer', border: 'none' }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Pick a custom hex</div>
                                                        <input type="text" value={createData.color}
                                                            onChange={e => setCreateData({ ...createData, color: e.target.value })}
                                                            placeholder="#000000"
                                                            style={{ ...s.input, fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                                            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden md:flex" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '24px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>Live Preview</span>
                                            <div style={{ width: '100%', maxWidth: '240px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '20px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '12px', backgroundColor: createData.color, transition: 'background-color 300ms ease' }}>
                                                    {React.createElement(getIconComponent(createData.icon), { size: 20 })}
                                                </div>
                                                <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>{createData.name || 'Workspace Name'}</h3>
                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>Your new workspace</p>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <div style={{ display: 'flex' }}>
                                                        {[1, 2, 3].map(i => <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-hover)', marginLeft: i > 1 ? '-6px' : 0 }} />)}
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+5 members</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {}
                            {createStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h2 style={s.h2}>You're in charge</h2>
                                        <p style={s.sub}>Confirming you as the Workspace Owner.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', overflow: 'hidden' }}>
                                                {user?.profilePicture
                                                    ? <img src={user.profilePicture} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.username?.charAt(0).toUpperCase()}</span>
                                                }
                                            </div>
                                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{user?.username}</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>{user?.email}</p>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: '2px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-accent)' }}>
                                                <Shield size={13} /> Workspace Owner
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', flex: 1 }}>
                                                <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Zap size={14} style={{ color: 'var(--accent)' }} /> Owner Superpowers
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {['Manage Billings & Plans', 'Delete or Archive Workspace', 'Invite/Remove Team Members', 'Configure Integrations & API'].map((p, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                            <CheckCircle2 size={13} style={{ color: 'var(--state-success)', flexShrink: 0 }} /> {p}
                                                        </div>
                                                    ))}
                                                </div>

                                                <div style={{ paddingTop: '16px', marginTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                                        <div style={{ marginTop: '1px', width: '16px', height: '16px', borderRadius: '2px', border: `1px solid ${termsAccepted ? 'var(--accent)' : 'var(--border-accent)'}`, background: termsAccepted ? 'var(--accent)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: '150ms ease' }}>
                                                            {termsAccepted && <Check size={11} strokeWidth={3} style={{ color: '#0c0c0c' }} />}
                                                        </div>
                                                        <input type="checkbox" style={{ display: 'none' }} checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                                                        <div style={{ fontSize: '12px' }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>I accept the responsibilities of a Workspace Owner.</span>
                                                            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '3px', lineHeight: 1.6 }}>By continuing, you acknowledge that you are the primary administrator for this workspace.</p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {}
                            {createStep === 4 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h2 style={s.h2}>Gather your team</h2>
                                        <p style={s.sub}>Work is better together. Invite them now.</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div style={{ display: 'flex', flexDirection: 'column' }} className="lg:col-span-2">
                                            <label style={s.label}>Email Addresses</label>
                                            <textarea placeholder="sarah@example.com, alex@design.co..."
                                                value={createData.invites || ''}
                                                onChange={e => setCreateData({ ...createData, invites: e.target.value })}
                                                style={{ ...s.input, minHeight: '200px', resize: 'vertical', lineHeight: 1.6, fontFamily: 'monospace' }}
                                                onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                            />
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Separate multiple emails with commas.</p>
                                        </div>

                                        <div className="hidden md:flex" style={{ flexDirection: 'column', justifyContent: 'center', padding: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                                            <div style={{ width: '32px', height: '32px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', color: 'var(--text-muted)' }}>
                                                <Rocket size={16} />
                                            </div>
                                            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', margin: '0 0 6px' }}>Skip for now?</h4>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>You can always invite members later from workspace settings.</p>
                                            <button type="button" onClick={onSubmit}
                                                style={{ padding: '8px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                            >Skip &amp; Launch</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {}
                    <div className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto" style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>

                        {createStep > 1 ? (
                            <button onClick={() => setCreateStep(s => s - 1)}
                                className="hidden md:flex"
                                style={{ height: '36px', padding: '0 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '13px', background: 'none', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease', alignItems: 'center' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                            >Back</button>
                        ) : <div style={{ width: '60px' }} />}

                        <div className="md:hidden">
                            {createStep === 4 && (
                                <button type="button" onClick={onSubmit} style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>Skip</button>
                            )}
                        </div>

                        {createStep < 4 ? (
                            <button
                                onClick={() => {
                                    if (createStep === 1 && !createData.name.trim()) { setNameError('Workspace name is required'); return; }
                                    setCreateStep(s => s + 1);
                                }}
                                disabled={createStep === 3 && !termsAccepted}
                                style={{ height: '36px', padding: '0 20px', background: (createStep === 3 && !termsAccepted) ? 'var(--bg-active)' : 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', color: (createStep === 3 && !termsAccepted) ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500, fontSize: '13px', cursor: (createStep === 3 && !termsAccepted) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font)', transition: '150ms ease', opacity: (createStep === 3 && !termsAccepted) ? 0.45 : 1 }}
                                className="w-full md:w-auto"
                                onMouseEnter={e => { if (!(createStep === 3 && !termsAccepted)) e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            >
                                Next <span className="hidden md:inline">Step</span> <ArrowRight size={15} />
                            </button>
                        ) : (
                            <button onClick={onSubmit}
                                style={{ height: '36px', padding: '0 20px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: '2px', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--accent-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)'; }}
                            >
                                <Rocket size={15} /> Launch <span className="hidden md:inline">Workspace</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkspaceModal;
