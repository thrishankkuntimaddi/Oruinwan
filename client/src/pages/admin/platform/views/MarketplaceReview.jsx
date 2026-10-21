import React, { useState } from 'react';
import api from '@services/api';
import { Store, Check, X, EyeOff, Hash, Flag, KeyRound, Bot, ExternalLink } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import {
    DashPage, PageHead, FilterTabs, Panel, Btn, Chip, Dialog, Field, EmptyState, ErrorState, LoadingState,
    useAsync, errorMessage, timeAgo,
} from '../../../../components/company-dash/dashUi';

/**
 * Platform admin → Marketplace: review developer-submitted apps and moderate
 * community workspace templates. Uses /api/developer/admin/apps and
 * /api/workspace-templates/community/admin (platform admins only).
 */

const KINDS = [{ value: 'apps', label: 'Apps' }, { value: 'templates', label: 'Community templates' }];
const APP_FILTERS = [
    { value: 'submitted', label: 'Waiting for review' }, { value: 'approved', label: 'Listed' },
    { value: 'rejected', label: 'Rejected' }, { value: 'draft', label: 'Drafts' },
];
const TEMPLATE_FILTERS = [
    { value: 'pending', label: 'Waiting for review' }, { value: 'reported', label: 'Reported' },
    { value: 'approved', label: 'Listed' }, { value: 'hidden', label: 'Hidden' },
];

const withCount = (filters, counts) => filters.map((f) => ({ ...f, label: counts?.[f.value] ? `${f.label} (${counts[f.value]})` : f.label }));

function DecisionDialog({ target, onClose, onDone }) {
    const { kind, item, action } = target;
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const needsNote = action === 'reject' || action === 'hide';
    const title = { approve: `Approve ${item.name}?`, reject: `Reject ${item.name}?`, hide: `Hide ${item.name}?`, dismiss_reports: `Dismiss reports on ${item.name}?` }[action];
    const lead = {
        approve: kind === 'apps' ? 'It will be listed in the marketplace for every workspace.' : 'It will be listed in the community gallery.',
        reject: item.status === 'approved' ? 'The app is taken down: it is uninstalled everywhere and its tokens stop working.' : 'The developer sees your note and can resubmit.',
        hide: 'It disappears from the gallery. The publisher sees your note.',
        dismiss_reports: 'The template stays listed and its reports are cleared.',
    }[action];

    const submit = async () => {
        if (needsNote && !note.trim()) { setError('Add a note for the publisher'); return; }
        setBusy(true);
        setError('');
        try {
            if (kind === 'apps') await api.post(`/api/developer/admin/apps/${item._id}/review`, { decision: action, note: note.trim() });
            else await api.post(`/api/workspace-templates/community/admin/${item._id}/moderate`, { action, note: note.trim() });
            onDone();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the decision'));
            setBusy(false);
        }
    };

    return (
        <Dialog open size="sm" title={title} lead={lead} onClose={onClose} busy={busy}
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
                    <Btn variant={action === 'approve' || action === 'dismiss_reports' ? 'primary' : 'danger'} onClick={submit} loading={busy}>
                        {{ approve: 'Approve', reject: 'Reject', hide: 'Hide', dismiss_reports: 'Dismiss reports' }[action]}
                    </Btn>
                </>
            )}>
            <Field label={needsNote ? 'Note to the publisher' : 'Note (optional)'} error={error || undefined} htmlFor="review-note">
                <textarea id="review-note" className="gl-input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
        </Dialog>
    );
}

function AppRow({ app, onDecide }) {
    return (
        <Panel>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="review-app-row">
                <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{app.name}</strong>
                        <span className="cd-hint">v{app.version} · {app.category} · by {app.ownerId?.username || app.developer}</span>
                        {app.submittedAt && <span className="cd-hint">submitted {timeAgo(app.submittedAt)}</span>}
                    </div>
                    <p style={{ margin: '6px 0', fontSize: 13, color: 'var(--text-secondary)' }}>{app.description}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(app.scopes || []).map((s) => <Chip key={s}><KeyRound size={10} />{s}</Chip>)}
                        {!app.scopes?.length && <Chip>No API scopes</Chip>}
                        {app.botUser?.enabled && <Chip><Bot size={10} />Bot user{app.botUser.name ? `: ${app.botUser.name}` : ''}</Chip>}
                        {app.installCount > 0 && <Chip>{app.installCount} installs</Chip>}
                    </div>
                    <div className="cd-hint" style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {app.webhookUrl && <span>Webhook: <code>{app.webhookUrl}</code></span>}
                        {app.redirectUrl && <span>Redirect: <code>{app.redirectUrl}</code></span>}
                        {app.homepageUrl && <a href={app.homepageUrl} target="_blank" rel="noopener noreferrer">Homepage <ExternalLink size={10} /></a>}
                    </div>
                    {app.review?.note && <p className="cd-hint" style={{ margin: '6px 0 0' }}>Last note: {app.review.note}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {app.status === 'submitted' && <Btn size="sm" variant="primary" icon={Check} onClick={() => onDecide(app, 'approve')}>Approve</Btn>}
                    {(app.status === 'submitted' || app.status === 'approved') && (
                        <Btn size="sm" variant="ghost" icon={X} onClick={() => onDecide(app, 'reject')}>{app.status === 'approved' ? 'Take down' : 'Reject'}</Btn>
                    )}
                </div>
            </div>
        </Panel>
    );
}

function TemplateRow({ template, onDecide }) {
    return (
        <Panel>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="review-template-row">
                <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{template.name}</strong>
                        <span className="cd-hint">{template.category} · by {template.publisher?.username || 'unknown'} · {timeAgo(template.publishedAt)}</span>
                        {template.reportCount > 0 && <Chip tone="danger"><Flag size={10} />{template.reportCount} report{template.reportCount === 1 ? '' : 's'}</Chip>}
                    </div>
                    <p style={{ margin: '6px 0', fontSize: 13, color: 'var(--text-secondary)' }}>{template.description}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(template.channels || []).map((c) => <Chip key={c.name}><Hash size={10} />{c.name}</Chip>)}
                    </div>
                    {template.reports?.length > 0 && (
                        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            {template.reports.map((r, i) => <li key={i}>{r.reason} <span className="cd-hint">— {r.by || 'someone'}, {timeAgo(r.at)}</span></li>)}
                        </ul>
                    )}
                    {template.moderationNote && <p className="cd-hint" style={{ margin: '6px 0 0' }}>Last note: {template.moderationNote}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {template.status !== 'approved' && <Btn size="sm" variant="primary" icon={Check} onClick={() => onDecide(template, 'approve')}>Approve</Btn>}
                    {template.reportCount > 0 && template.status === 'approved' && <Btn size="sm" variant="ghost" onClick={() => onDecide(template, 'dismiss_reports')}>Dismiss reports</Btn>}
                    {template.status !== 'hidden' && <Btn size="sm" variant="ghost" icon={EyeOff} onClick={() => onDecide(template, 'hide')}>Hide</Btn>}
                </div>
            </div>
        </Panel>
    );
}

export default function MarketplaceReview() {
    const { showToast } = useToast();
    const [kind, setKind] = useState('apps');
    const [appStatus, setAppStatus] = useState('submitted');
    const [tplStatus, setTplStatus] = useState('pending');
    const [target, setTarget] = useState(null);

    const status = kind === 'apps' ? appStatus : tplStatus;
    const list = useAsync(() => (kind === 'apps'
        ? api.get('/api/developer/admin/apps', { params: { status } }).then((r) => ({ items: r.data.apps || [], counts: r.data.counts || {} }))
        : api.get('/api/workspace-templates/community/admin', { params: { status } }).then((r) => ({ items: r.data.templates || [], counts: r.data.counts || {} }))
    ), [kind, status]);

    const items = list.data?.items || [];
    const counts = list.data?.counts;

    return (
        <DashPage head={<PageHead eyebrow="Platform" title="Marketplace" icon={Store}
            lead="Review apps developers submit and moderate community workspace templates before everyone can install them." />}>
            <FilterTabs value={kind} onChange={setKind} options={KINDS} label="What to review" />
            {kind === 'apps'
                ? <FilterTabs value={appStatus} onChange={setAppStatus} options={withCount(APP_FILTERS, counts)} label="App status" />
                : <FilterTabs value={tplStatus} onChange={setTplStatus} options={withCount(TEMPLATE_FILTERS, counts)} label="Template status" />}

            {list.loading ? <LoadingState />
                : list.error ? <Panel><ErrorState message={list.error} onRetry={list.reload} /></Panel>
                    : !items.length ? (
                        <Panel><EmptyState icon={Store} title="Nothing here" text={status === 'submitted' || status === 'pending' ? 'No submissions are waiting for review.' : 'No items with this status.'} /></Panel>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {items.map((it) => (kind === 'apps'
                                ? <AppRow key={it._id} app={it} onDecide={(item, action) => setTarget({ kind, item, action })} />
                                : <TemplateRow key={it._id} template={it} onDecide={(item, action) => setTarget({ kind, item, action })} />))}
                        </div>
                    )}

            {target && (
                <DecisionDialog target={target} onClose={() => setTarget(null)} onDone={() => {
                    showToast('Decision saved', 'success');
                    setTarget(null);
                    list.reload();
                }} />
            )}
        </DashPage>
    );
}
