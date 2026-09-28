import React, { useMemo, useState } from 'react';
import api from '@services/api';
import { Megaphone, Send, Users, CheckCircle2, Clock, Target, Info } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import {
    DashPage, PageHead, Panel, FilterTabs, Field, Btn, Chip, DataTable, EmptyState, ErrorState,
    LoadingState, useAsync, errorMessage, timeAgo,
} from '../../../../components/company-dash/dashUi';

const TARGETS = [
    { value: 'all', label: 'All verified', sub: 'Every approved company', icon: Users },
    { value: 'pending', label: 'Pending only', sub: 'Waiting for verification', icon: Clock },
    { value: 'specific', label: 'Specific companies', sub: 'Pick from the list', icon: Target },
];
const EMPTY = { subject: '', message: '', targetType: 'all', targetCompanies: [] };

const Broadcast = () => {
    const { showToast } = useToast();
    const [tab, setTab] = useState('compose');
    const [form, setForm] = useState(EMPTY);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const active = useAsync(() => api.get('/api/admin/active-companies').then((r) => (Array.isArray(r.data) ? r.data : [])));
    const pending = useAsync(() => api.get('/api/admin/pending-companies').then((r) => (Array.isArray(r.data) ? r.data : [])));
    const history = useAsync(() => api.get('/api/admin/broadcast/history').then((r) => (Array.isArray(r.data) ? r.data : [])), [], { enabled: tab === 'history' });

    const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (error) setError(''); };
    const toggleCompany = (id) => set('targetCompanies', form.targetCompanies.includes(id) ? form.targetCompanies.filter((x) => x !== id) : [...form.targetCompanies, id]);

    const recipients = useMemo(() => {
        if (form.targetType === 'specific') return form.targetCompanies.length;
        if (form.targetType === 'pending') return pending.data ? pending.data.length : null;
        return active.data ? active.data.length : null;
    }, [form.targetType, form.targetCompanies, active.data, pending.data]);

    const send = async () => {
        if (!form.subject.trim() || !form.message.trim()) { setError('Add a subject and a message.'); return; }
        if (form.targetType === 'specific' && form.targetCompanies.length === 0) { setError('Pick at least one company.'); return; }
        if (recipients === 0) { setError('There are no companies in that audience.'); return; }
        setSending(true);
        try {
            const res = await api.post('/api/admin/broadcast/send', {
                subject: form.subject.trim(),
                message: form.message.trim(),
                body: form.message.trim(),
                targetType: form.targetType,
                targetCompanies: form.targetType === 'specific' ? form.targetCompanies : [],
            });
            showToast(res.data?.message || 'Broadcast sent', 'success');
            setForm(EMPTY);
            setTab('history');
        } catch (err) {
            setError(errorMessage(err, 'Could not send the broadcast'));
        } finally {
            setSending(false);
        }
    };

    const columns = [
        { key: 'subject', label: 'Subject', render: (b) => <div><div className="cd-cell-title">{b.subject}</div><div className="cd-cell-sub">{(b.body || b.message || '').slice(0, 90)}</div></div> },
        { key: 'target', label: 'Audience', className: 'cd-hide-sm', render: (b) => <Chip>{TARGETS.find((t) => t.value === b.targetType)?.label || b.targetType}</Chip> },
        { key: 'count', label: 'Companies', className: 'cd-num', render: (b) => b.recipientCount ?? '—' },
        { key: 'by', label: 'Sent by', className: 'cd-hide-sm', render: (b) => <span className="cd-muted">{b.sentBy?.username || '—'}</span> },
        { key: 'at', label: 'Sent', render: (b) => <span className="cd-muted" title={new Date(b.sentAt || b.createdAt).toLocaleString()}>{timeAgo(b.sentAt || b.createdAt)}</span> },
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Communication"
                    title="Broadcast"
                    lead="Announcements from the Oruinwan team to companies."
                    actions={<FilterTabs label="View" value={tab} onChange={setTab} options={[{ value: 'compose', label: 'Compose' }, { value: 'history', label: 'History' }]} />}
                />
            )}
        >
            {tab === 'compose' ? (
                <div className="pf-split">
                    <Panel title="Message" icon={Megaphone}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Subject" htmlFor="pf-bc-subject">
                                <input id="pf-bc-subject" className="gl-input" value={form.subject} maxLength={160} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. Scheduled maintenance on Saturday" />
                            </Field>
                            <Field label="Message" htmlFor="pf-bc-message">
                                <textarea id="pf-bc-message" className="gl-input" rows={8} value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="What should companies know?" />
                            </Field>
                            <div className="cd-field">
                                <span className="cd-label">Audience</span>
                                <div className="pf-choices">
                                    {TARGETS.map((t) => (
                                        <button key={t.value} type="button" className="pf-choice" aria-pressed={form.targetType === t.value} onClick={() => set('targetType', t.value)}>
                                            <t.icon size={14} />
                                            <span className="pf-choice-label">{t.label}</span>
                                            <span className="pf-choice-sub">{t.sub}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {form.targetType === 'specific' && (
                                <div className="cd-field">
                                    <span className="cd-label">Companies ({form.targetCompanies.length} selected)</span>
                                    {active.loading ? <LoadingState /> : active.error ? <ErrorState message={active.error} onRetry={active.reload} /> : (active.data || []).length === 0 ? (
                                        <span className="cd-hint">No verified companies yet.</span>
                                    ) : (
                                        <div className="pf-checklist">
                                            {active.data.map((c) => (
                                                <label key={c._id}>
                                                    <input type="checkbox" checked={form.targetCompanies.includes(c._id)} onChange={() => toggleCompany(c._id)} />
                                                    <span style={{ minWidth: 0 }}>
                                                        <span className="cd-cell-title" style={{ display: 'block' }}>{c.name}</span>
                                                        <span className="cd-cell-sub" style={{ display: 'block' }}>{c.domain || 'No domain'}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {error && <div className="cd-error-text" role="alert">{error}</div>}
                        </div>
                    </Panel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <Panel title="Preview">
                            <dl className="pf-facts" style={{ gridTemplateColumns: '1fr' }}>
                                <div><dt>Subject</dt><dd>{form.subject || <span className="cd-muted">No subject yet</span>}</dd></div>
                                <div><dt>Message</dt><dd><p className="pf-preview-text">{form.message || <span className="cd-muted">No message yet</span>}</p></dd></div>
                                <div><dt>Recipients</dt><dd style={{ color: 'var(--accent)', fontWeight: 650 }}>{recipients === null ? '…' : `${recipients} compan${recipients === 1 ? 'y' : 'ies'}`}</dd></div>
                            </dl>
                        </Panel>
                        <Btn variant="primary" size="lg" icon={Send} loading={sending} onClick={send}>Send broadcast</Btn>
                        <div className="gl-card pf-banner" style={{ alignItems: 'flex-start' }}>
                            <Info size={15} className="cd-muted" />
                            <div className="pf-grow pf-banner-sub" style={{ marginTop: 0 }}>
                                Each broadcast is listed under History and recorded in the platform audit log.
                            </div>
                        </div>
                    </div>
                </div>
            ) : history.loading && !history.data ? <LoadingState /> : history.error ? (
                <ErrorState message={history.error} onRetry={history.reload} />
            ) : (
                <DataTable
                    caption="Broadcast history"
                    columns={columns}
                    rows={history.data || []}
                    empty={<EmptyState icon={CheckCircle2} title="No broadcasts yet" text="Sent announcements are listed here." />}
                />
            )}
        </DashPage>
    );
};

export default Broadcast;
