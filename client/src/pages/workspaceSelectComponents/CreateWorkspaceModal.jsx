import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Rocket, X, CheckCircle2, ArrowRight, AlertCircle, Zap, Shield, Check, Loader2 } from 'lucide-react';
import { WORKSPACE_ICON_OPTIONS, WORKSPACE_COLORS, WorkspaceIcon } from '../../utils/workspaceIcons';

const s = {
    label: 'gl-wsp-label',
    h2: 'gl-wsp-wizard__h2',
    sub: 'gl-wsp-wizard__sub',
};

/** Optional starting template: its channels, settings and feature toggles are applied on create. */
function TemplatePicker({ value, onChange }) {
    const [templates, setTemplates] = useState([]);
    useEffect(() => {
        let cancelled = false;
        api.get('/api/workspace-templates')
            .then(({ data }) => { if (!cancelled) setTemplates(data.templates || []); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);
    if (templates.length === 0) return null;
    const selected = templates.find(t => t._id === value);
    return (
        <div>
            <label className={s.label} htmlFor="cw-template">Start from a template (Optional)</label>
            <select id="cw-template" data-testid="workspace-template" value={value || ''} onChange={e => onChange(e.target.value || null)} className="gl-input">
                <option value="">Blank workspace</option>
                {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            {selected && (
                <p className={s.sub} style={{ fontSize: '11.5px', marginTop: '6px' }}>
                    {selected.description ? `${selected.description} · ` : ''}
                    {(selected.defaultChannels || []).length} channel(s)
                    {(selected.defaultChannels || []).length > 0 ? `: ${selected.defaultChannels.map(c => `#${c.name}`).join(', ')}` : ''}
                </p>
            )}
        </div>
    );
}

const CreateWorkspaceModal = ({
    isOpen, onClose, createStep, setCreateStep, createData, setCreateData,
    nameError, setNameError, termsAccepted, setTermsAccepted, onSubmit, user, submitting = false,
}) => {
    useEffect(() => {
        if (isOpen) { document.body.style.overflow = 'hidden'; }
        else { document.body.style.overflow = 'unset'; }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Esc closes the wizard (not while the workspace is being created).
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !submitting) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, submitting]);

    if (!isOpen) return null;

    const steps = [
        { step: 1, label: 'Basics', desc: 'Name & Icon' },
        { step: 2, label: 'Branding', desc: 'Colors & Theme' },
        { step: 3, label: 'Admin', desc: 'Review Owner' },
        { step: 4, label: 'Members', desc: 'Invite Team' },
    ];

    const nextBlocked = createStep === 3 && !termsAccepted;
    const heading = (eyebrow, title, sub) => (
        <div>
            <span className="gl-eyebrow">{eyebrow}</span>
            <h2 className={s.h2}>{title}</h2>
            <p className={s.sub}>{sub}</p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 gl-wsp-overlay" role="dialog" aria-modal="true" aria-label="Create workspace">
            <div className="gl-wsp-wizard">

                {/* Step rail (desktop) */}
                <div className="gl-wsp-wizard__rail">
                    <div>
                        <span className="gl-eyebrow"><Rocket size={12} /> New Workspace</span>
                        <p className="gl-wsp-wizard__brand">Set up your <span className="gl-sheen">space</span></p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {steps.map(st => {
                                const state = createStep === st.step ? 'is-current' : createStep > st.step ? 'is-done' : '';
                                return (
                                    <button key={st.step} type="button"
                                        className={`gl-wsp-step ${state}`}
                                        onClick={() => createStep > st.step && setCreateStep(st.step)}
                                        disabled={createStep < st.step}
                                        aria-current={createStep === st.step ? 'step' : undefined}
                                    >
                                        <span className="gl-wsp-step__num">{createStep > st.step ? <CheckCircle2 size={13} /> : st.step}</span>
                                        <span>
                                            <span className="gl-wsp-step__label">{st.label}</span>
                                            <span className="gl-wsp-step__desc">{st.desc}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button type="button" onClick={onClose} className="gl-btn gl-btn--ghost gl-btn--sm" style={{ paddingLeft: 6 }}><X size={14} /> Cancel Creation</button>
                    </div>
                </div>

                <div className="gl-wsp-wizard__main">

                    {/* Mobile header */}
                    <div className="gl-wsp-wizard__mhead">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            {createStep > 1 && (
                                <button type="button" onClick={() => setCreateStep(s => s - 1)} className="gl-icon-btn" aria-label="Back">
                                    <ArrowRight style={{ transform: 'rotate(180deg)' }} size={17} />
                                </button>
                            )}
                            <div>
                                <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px', margin: 0, lineHeight: 1.2 }}>Step {createStep} of 4</h3>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{['Name & Icon', 'Branding & Theme', 'Confirm Admin', 'Invite Members'][createStep - 1]}</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="gl-icon-btn" aria-label="Close"><X size={16} /></button>
                    </div>

                    <div className="gl-wsp-wizard__progress" aria-hidden="true"><span style={{ width: `${(createStep / 4) * 100}%` }} /></div>

                    <div className="gl-wsp-wizard__body">
                        <form id="create-workspace-form" onSubmit={onSubmit} style={{ maxWidth: '680px', margin: '0 auto' }}>
                            {nameError && createStep > 1 && (
                                <div role="alert" className="gl-wsp-alert">
                                    <AlertCircle size={14} style={{ flexShrink: 0 }} /> {nameError}
                                </div>
                            )}

                            {createStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {heading('Step 01 · Basics', "Let's build your HQ", 'Give your workspace a distinct identity.')}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div>
                                                <label className={s.label} htmlFor="cw-name">Workspace Name</label>
                                                <input id="cw-name" type="text" autoFocus placeholder="e.g. Acme Corp, Engineering Team"
                                                    value={createData.name}
                                                    onChange={e => { setCreateData({ ...createData, name: e.target.value }); setNameError(''); }}
                                                    className={`gl-input${nameError ? ' is-invalid' : ''}`}
                                                    aria-invalid={!!nameError}
                                                />
                                                {nameError && <p style={{ marginTop: '6px', fontSize: '11.5px', fontWeight: 600, color: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} />{nameError}</p>}
                                            </div>
                                            <div>
                                                <label className={s.label} htmlFor="cw-desc">Description (Optional)</label>
                                                <textarea id="cw-desc" placeholder="What's this workspace for? Share your mission or guidelines."
                                                    value={createData.rules || ''}
                                                    onChange={e => setCreateData({ ...createData, rules: e.target.value })}
                                                    className="gl-input"
                                                    style={{ height: '110px' }}
                                                />
                                            </div>
                                            <TemplatePicker
                                                value={createData.templateId}
                                                onChange={templateId => setCreateData({ ...createData, templateId })}
                                            />
                                        </div>

                                        <div>
                                            <span className={s.label}>Choose an Icon</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                {WORKSPACE_ICON_OPTIONS.slice(0, 12).map(({ id: iconName, name, Icon: IconCmp }) => (
                                                    <button key={iconName} type="button" title={name} aria-label={name} aria-pressed={createData.icon === iconName}
                                                        onClick={() => setCreateData({ ...createData, icon: iconName })}
                                                        className="gl-wsp-choice"
                                                    >
                                                        <IconCmp size={18} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {createStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {heading('Step 02 · Branding', 'Brand your Space', "Pick a color that matches your team's vibe.")}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>
                                                <span className={s.label}>Preset Colors</span>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                                    {WORKSPACE_COLORS.map(color => (
                                                        <button key={color} type="button" aria-label={`Color ${color}`} aria-pressed={createData.color === color}
                                                            onClick={() => setCreateData({ ...createData, color })}
                                                            className="gl-wsp-swatch"
                                                            style={{ backgroundColor: color }}
                                                        >
                                                            {createData.color === color && <Check style={{ color: '#fff' }} size={14} strokeWidth={3} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <span className={s.label}>Custom Color</span>
                                                <div className="gl-wsp-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px' }}>
                                                    <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: 'var(--gl-radius)', overflow: 'hidden', border: '1px solid var(--border-default)', flexShrink: 0 }}>
                                                        <input type="color" value={createData.color} aria-label="Custom color"
                                                            onChange={e => setCreateData({ ...createData, color: e.target.value })}
                                                            style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', padding: 0, margin: 0, cursor: 'pointer', border: 'none' }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Pick a custom hex</div>
                                                        <input type="text" value={createData.color} aria-label="Hex color"
                                                            onChange={e => setCreateData({ ...createData, color: e.target.value })}
                                                            placeholder="#000000"
                                                            className="gl-input"
                                                            style={{ fontSize: '12px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden md:flex gl-wsp-panel" style={{ padding: '24px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                            <span className="gl-eyebrow" style={{ marginBottom: '20px' }}>Live Preview</span>
                                            <div className="gl-card" style={{ width: '100%', maxWidth: '240px', padding: '20px', textAlign: 'left' }}>
                                                <div className="gl-wsp-tile" style={{ backgroundColor: createData.color, marginBottom: '14px', transition: 'background-color 300ms ease', '--wsp-tint': createData.color }}>
                                                    <WorkspaceIcon icon={createData.icon} size={20} />
                                                </div>
                                                <h3 style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '0 0 4px' }}>{createData.name || 'Workspace Name'}</h3>
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Your new workspace</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {createStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {heading('Step 03 · Admin', "You're in charge", 'Confirming you as the Workspace Owner.')}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="gl-wsp-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-active)', border: '1px solid var(--gl-accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', overflow: 'hidden', boxShadow: 'var(--gl-accent-glow)' }}>
                                                {user?.profilePicture
                                                    ? <img src={user.profilePicture} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.username?.charAt(0).toUpperCase()}</span>
                                                }
                                            </div>
                                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{user?.username}</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>{user?.email}</p>
                                            <span className="gl-wsp-badge is-owner" style={{ height: 26, fontSize: 10.5 }}><Shield size={12} /> Workspace Owner</span>
                                        </div>

                                        <div className="gl-wsp-panel" style={{ padding: '18px' }}>
                                            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Zap size={14} style={{ color: 'var(--accent)' }} /> Owner Superpowers
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {['Manage Billings & Plans', 'Delete or Archive Workspace', 'Invite/Remove Team Members', 'Configure Integrations & API'].map((p, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                                        <CheckCircle2 size={13} style={{ color: 'var(--state-success)', flexShrink: 0 }} /> {p}
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ paddingTop: '16px', marginTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                                    <span className={`gl-wsp-check${termsAccepted ? ' is-on' : ''}`} aria-hidden="true">
                                                        {termsAccepted && <Check size={12} strokeWidth={3} />}
                                                    </span>
                                                    <input type="checkbox" style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                                                    <div style={{ fontSize: '12.5px' }}>
                                                        <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>I accept the responsibilities of a Workspace Owner.</span>
                                                        <p style={{ color: 'var(--text-secondary)', fontSize: '11.5px', margin: '3px 0 0', lineHeight: 1.6 }}>By continuing, you acknowledge that you are the primary administrator for this workspace.</p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {createStep === 4 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {heading('Step 04 · Members', 'Gather your team', 'Work is better together. Invite them now.')}

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div style={{ display: 'flex', flexDirection: 'column' }} className="lg:col-span-2">
                                            <label className={s.label} htmlFor="cw-invites">Email Addresses</label>
                                            <textarea id="cw-invites" placeholder="sarah@example.com, alex@design.co..."
                                                value={createData.invites || ''}
                                                onChange={e => setCreateData({ ...createData, invites: e.target.value })}
                                                className="gl-input"
                                                style={{ minHeight: '200px', fontFamily: 'monospace' }}
                                            />
                                            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>Separate emails with commas or new lines.</p>
                                        </div>

                                        <div className="hidden md:flex gl-wsp-panel" style={{ flexDirection: 'column', justifyContent: 'center', padding: '20px' }}>
                                            <span className="gl-empty-mark" style={{ width: 34, height: 34 }}><Rocket size={16} /></span>
                                            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', margin: '4px 0 6px' }}>Skip for now?</h4>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>You can always invite members later from workspace settings.</p>
                                            <button type="button" onClick={onSubmit} className="gl-btn" disabled={submitting}>Skip &amp; Launch</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="gl-wsp-wizard__foot">
                        <div className="hidden md:block" style={{ minWidth: '60px' }}>
                            {createStep > 1 && (
                                <button type="button" onClick={() => setCreateStep(s => s - 1)} className="gl-btn gl-btn--lg">Back</button>
                            )}
                        </div>

                        <div className="md:hidden">
                            {createStep === 4 && (
                                <button type="button" onClick={onSubmit} className="gl-btn gl-btn--ghost" disabled={submitting}>Skip</button>
                            )}
                        </div>

                        {createStep < 4 ? (
                            <button type="button"
                                onClick={() => {
                                    if (createStep === 1 && !createData.name.trim()) { setNameError('Workspace name is required'); return; }
                                    setCreateStep(s => s + 1);
                                }}
                                disabled={nextBlocked}
                                className="gl-btn gl-btn--primary gl-btn--lg"
                            >
                                Next <span className="hidden md:inline">Step</span> <ArrowRight size={15} />
                            </button>
                        ) : (
                            <button type="button" onClick={onSubmit} disabled={submitting}
                                className="gl-btn gl-btn--primary gl-btn--lg"
                                style={{ cursor: submitting ? 'wait' : undefined }}
                            >
                                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} {submitting ? 'Creating…' : <>Launch <span className="hidden md:inline">Workspace</span></>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkspaceModal;
