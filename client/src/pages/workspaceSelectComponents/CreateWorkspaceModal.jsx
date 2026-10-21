import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Rocket, X, CheckCircle2, ArrowRight, AlertCircle, Check, Loader2, Copy, Hash, Link2, Mail } from 'lucide-react';
import { WORKSPACE_ICON_OPTIONS, WORKSPACE_COLORS, DEFAULT_WORKSPACE_COLOR, WorkspaceIcon } from '../../utils/workspaceIcons';
import { projectChannelName } from './projectChannelName';
import logger from '../../utils/logger';
import { skippedChannelsText } from '../../features/plan/planSkips';

const s = {
    label: 'gl-wsp-label',
    h2: 'gl-wsp-wizard__h2',
    sub: 'gl-wsp-wizard__sub',
};

const STEPS = [
    { step: 1, label: 'Name', desc: 'Team or company' },
    { step: 2, label: 'Project', desc: 'What you’re working on' },
    { step: 3, label: 'Teammates', desc: 'Invite your team' },
];

const PROJECT_IDEAS = ['Website', 'Product launch', 'Marketing', 'Hiring', 'Customer support'];

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
            <label className={s.label} htmlFor="cw-template">Start from a template (optional)</label>
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

const EMPTY = { name: '', icon: 'rocket', color: DEFAULT_WORKSPACE_COLOR, templateId: null, project: '', invites: '' };

/**
 * Slack-style setup: 1) name your team, 2) what you're working on (becomes a channel),
 * 3) invite teammates with a team link or by email. The workspace is created when step 2 ends,
 * so step 3 can show a real link to copy.
 *
 * onCreated(workspace) runs once the workspace exists; onOpen(workspaceId) when setup is done.
 */
const CreateWorkspaceModal = ({ isOpen, onClose, onCreated, onOpen, showToast }) => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState(EMPTY);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState(null); // { id, name, channels }
    const [teamLink, setTeamLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setStep(1); setData(EMPTY); setError(''); setBusy(false);
            setCreated(null); setTeamLink(''); setCopied(false);
        }
    }, [isOpen]);

    // Esc closes the wizard (not while something is being saved).
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose, busy]);

    // Step 3: a team link anyone can use to join (7 days, revocable from workspace settings).
    useEffect(() => {
        if (step !== 3 || !created || teamLink) return;
        api.post(`/api/workspaces/${created.id}/invite`, { inviteType: 'link', reusable: true, role: 'member' })
            .then(({ data: res }) => setTeamLink(res.inviteLink))
            .catch((err) => logger.warn('Team invite link could not be created', err));
    }, [step, created, teamLink]);

    if (!isOpen) return null;

    const set = (patch) => { setData(d => ({ ...d, ...patch })); setError(''); };
    const channelName = projectChannelName(data.project);
    const projectChannel = channelName && !['general', 'random'].includes(channelName) ? channelName : '';

    const createWorkspace = async (project = data.project) => {
        setBusy(true);
        setError('');
        try {
            const res = await api.post('/api/workspaces/create', {
                name: data.name.trim(),
                icon: data.icon,
                color: data.color,
                ...(project.trim() ? { project: project.trim() } : {}),
                ...(data.templateId ? { templateId: data.templateId } : {}),
            });
            const ws = res.data.workspace;
            setCreated({ id: ws.id, name: ws.name, channels: ws.channels || [] });
            onCreated?.(ws);
            if (res.data.templateError) showToast?.('Workspace created, but the template could not be applied', 'warning');
            else if (skippedChannelsText(res.data)) showToast?.(`Workspace created. ${skippedChannelsText(res.data)}`, 'warning');
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create workspace. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const finish = async () => {
        const emails = [...new Set((data.invites || '').split(/[\s,;]+/).map(e => e.trim()).filter(Boolean))];
        if (emails.length) {
            setBusy(true);
            try {
                await api.post(`/api/workspaces/${created.id}/invite`, { emails, inviteType: 'email' });
                showToast?.(`Invitation${emails.length === 1 ? '' : 's'} sent to ${emails.length} ${emails.length === 1 ? 'person' : 'people'}`, 'success');
            } catch (err) {
                showToast?.(err.response?.data?.message || 'Workspace created, but the invitations could not be sent', 'error');
            } finally {
                setBusy(false);
            }
        }
        onOpen?.(created.id);
    };

    const next = () => {
        if (step === 1) {
            if (!data.name.trim()) { setError('Give your workspace a name'); return; }
            setStep(2);
        } else if (step === 2) {
            createWorkspace();
        } else {
            finish();
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(teamLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast?.('Copy the link by selecting it', 'info');
        }
    };

    // Once the workspace exists, closing goes back to the list (where it now shows).
    const close = () => { if (!busy) onClose(); };
    const canGoBack = step === 2 && !busy;

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
                        <span className="gl-eyebrow"><Rocket size={12} /> New workspace</span>
                        <p className="gl-wsp-wizard__brand">Set up your <span className="gl-sheen">space</span></p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {STEPS.map(st => {
                                const state = step === st.step ? 'is-current' : step > st.step ? 'is-done' : '';
                                return (
                                    <button key={st.step} type="button"
                                        className={`gl-wsp-step ${state}`}
                                        onClick={() => !created && step > st.step && setStep(st.step)}
                                        disabled={step <= st.step || Boolean(created)}
                                        aria-current={step === st.step ? 'step' : undefined}
                                    >
                                        <span className="gl-wsp-step__num">{step > st.step ? <CheckCircle2 size={13} /> : st.step}</span>
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
                        <button type="button" onClick={close} className="gl-btn gl-btn--ghost gl-btn--sm" style={{ paddingLeft: 6 }}>
                            <X size={14} /> {created ? 'Close' : 'Cancel'}
                        </button>
                    </div>
                </div>

                <div className="gl-wsp-wizard__main">

                    {/* Mobile header */}
                    <div className="gl-wsp-wizard__mhead">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            {canGoBack && (
                                <button type="button" onClick={() => setStep(1)} className="gl-icon-btn" aria-label="Back">
                                    <ArrowRight style={{ transform: 'rotate(180deg)' }} size={17} />
                                </button>
                            )}
                            <div>
                                <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px', margin: 0, lineHeight: 1.2 }}>Step {step} of 3</h3>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{STEPS[step - 1].desc}</p>
                            </div>
                        </div>
                        <button type="button" onClick={close} className="gl-icon-btn" aria-label="Close"><X size={16} /></button>
                    </div>

                    <div className="gl-wsp-wizard__progress" aria-hidden="true"><span style={{ width: `${(step / 3) * 100}%` }} /></div>

                    <div className="gl-wsp-wizard__body">
                        <form id="create-workspace-form" onSubmit={(e) => { e.preventDefault(); next(); }} style={{ maxWidth: '680px', margin: '0 auto' }}>
                            {error && (
                                <div role="alert" className="gl-wsp-alert">
                                    <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
                                </div>
                            )}

                            {step === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                                    {heading('Step 1 of 3', 'What’s the name of your team or company?', 'This is the name of your workspace. Pick something your team will recognise.')}

                                    <div>
                                        <label className={s.label} htmlFor="cw-name">Workspace name</label>
                                        <input id="cw-name" type="text" autoFocus placeholder="e.g. Acme Corp, Design Team" maxLength={80}
                                            value={data.name} onChange={e => set({ name: e.target.value })}
                                            className={`gl-input${error ? ' is-invalid' : ''}`} aria-invalid={!!error} />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div>
                                            <span className={s.label}>Icon</span>
                                            <div className="gl-wsp-icon-grid">
                                                {WORKSPACE_ICON_OPTIONS.slice(0, 12).map(({ id: iconName, name, Icon: IconCmp }) => (
                                                    <button key={iconName} type="button" title={name} aria-label={name} aria-pressed={data.icon === iconName}
                                                        onClick={() => set({ icon: iconName })} className="gl-wsp-choice">
                                                        <IconCmp size={16} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <span className={s.label}>Colour</span>
                                            <div className="gl-wsp-color-grid">
                                                {WORKSPACE_COLORS.map(color => (
                                                    <button key={color} type="button" aria-label={`Colour ${color}`} aria-pressed={data.color === color}
                                                        onClick={() => set({ color })} className="gl-wsp-swatch" style={{ backgroundColor: color }}>
                                                        {data.color === color && <Check style={{ color: '#fff' }} size={14} strokeWidth={3} />}
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                                                <div className="gl-wsp-tile" style={{ backgroundColor: data.color, '--wsp-tint': data.color }}>
                                                    <WorkspaceIcon icon={data.icon} size={18} />
                                                </div>
                                                <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }}>{data.name.trim() || 'Your workspace'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <TemplatePicker value={data.templateId} onChange={templateId => set({ templateId })} />
                                </div>
                            )}

                            {step === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                                    {heading('Step 2 of 3', 'What’s your team working on right now?', 'It can be anything: a project, a campaign, an event or a deal. We’ll make a channel for it.')}

                                    <div>
                                        <label className={s.label} htmlFor="cw-project">Project</label>
                                        <input id="cw-project" type="text" autoFocus placeholder="e.g. Website redesign" maxLength={80}
                                            value={data.project} onChange={e => set({ project: e.target.value })} className="gl-input" />
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                            {PROJECT_IDEAS.map(idea => (
                                                <button key={idea} type="button" className="gl-btn gl-btn--sm" onClick={() => set({ project: idea })}>{idea}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="gl-wsp-panel" style={{ padding: 16 }}>
                                        <span className={s.label}>Your channels</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="channel-preview">
                                            {[
                                                ['general', 'Announcements and work-wide conversation'],
                                                ['random', 'Water-cooler talk'],
                                                ...(projectChannel ? [[projectChannel, 'Everything about this project']] : []),
                                            ].map(([name, desc]) => (
                                                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                                    <Hash size={14} style={{ color: 'var(--text-secondary)' }} />
                                                    <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>
                                                    <span style={{ color: 'var(--text-secondary)' }}>· {desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                                    {heading('Step 3 of 3', 'Who else is on your team?', `${created?.name || 'Your workspace'} is ready. Bring your teammates in.`)}

                                    <div className="gl-wsp-panel" style={{ padding: 16 }}>
                                        <span className={s.label}><Link2 size={12} style={{ display: 'inline', marginRight: 4 }} />Share a link</span>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input readOnly value={teamLink || 'Creating your link…'} className="gl-input" aria-label="Team invite link"
                                                onFocus={e => e.target.select()} style={{ fontFamily: 'monospace', fontSize: 12 }} data-testid="team-invite-link" />
                                            <button type="button" className="gl-btn" onClick={copyLink} disabled={!teamLink}>
                                                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                                            </button>
                                        </div>
                                        <p className={s.sub} style={{ fontSize: 11.5, marginTop: 6 }}>
                                            Anyone with this link can join for the next 7 days. You can turn it off from workspace settings.
                                        </p>
                                    </div>

                                    <div>
                                        <label className={s.label} htmlFor="cw-invites"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Or invite by email</label>
                                        <textarea id="cw-invites" placeholder="sam@example.com, alex@example.com"
                                            value={data.invites} onChange={e => set({ invites: e.target.value })}
                                            className="gl-input" style={{ minHeight: 110, fontFamily: 'monospace' }} />
                                        <p className={s.sub} style={{ fontSize: 11.5, marginTop: 6 }}>Separate emails with commas or new lines.</p>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="gl-wsp-wizard__foot">
                        <div style={{ minWidth: '60px' }}>
                            {canGoBack && <button type="button" onClick={() => setStep(1)} className="gl-btn gl-btn--lg hidden md:inline-flex">Back</button>}
                            {step === 2 && !busy && <button type="button" onClick={() => { set({ project: '' }); createWorkspace(''); }} className="gl-btn gl-btn--ghost">Skip</button>}
                            {step === 3 && !busy && !data.invites.trim() && <button type="button" onClick={finish} className="gl-btn gl-btn--ghost">Skip for now</button>}
                        </div>

                        <button type="button" onClick={next} disabled={busy} className="gl-btn gl-btn--primary gl-btn--lg"
                            style={{ cursor: busy ? 'wait' : undefined }} data-testid="wizard-next">
                            {busy && <Loader2 size={15} className="animate-spin" />}
                            {step === 1 && <>Next <ArrowRight size={15} /></>}
                            {step === 2 && !busy && <><Rocket size={15} /> Create workspace</>}
                            {step === 2 && busy && 'Creating…'}
                            {step === 3 && (data.invites.trim() ? 'Send invites and open' : 'Open workspace')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateWorkspaceModal;
