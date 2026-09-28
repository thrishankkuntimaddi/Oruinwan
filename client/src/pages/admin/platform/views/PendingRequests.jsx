import React, { useState } from 'react';
import api, { API_BASE } from '@services/api';
import { Check, X, Globe, FileText, CheckCircle2, RefreshCcw, Clock } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import {
    DashPage, PageHead, Grid, Btn, Chip, Dialog, Field, EmptyState, ErrorState, LoadingState,
    Avatar, useAsync, errorMessage, timeAgo, Panel,
} from '../../../../components/company-dash/dashUi';

const docsOf = (c) => (c?.documents?.length ? c.documents : c?.verificationDocuments) || [];
const docUrl = (u) => (/^https?:/i.test(u || '') ? u : `${API_BASE}${u || ''}`);
const ownerOf = (c) => (c?.admins || []).find((a) => a.role === 'owner')?.user || c?.admins?.[0]?.user || null;

const PendingRequests = () => {
    const { showToast } = useToast();
    const list = useAsync(() => api.get('/api/admin/pending-companies').then((r) => (Array.isArray(r.data) ? r.data : [])));
    const [selected, setSelected] = useState(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(null);
    const [formError, setFormError] = useState('');

    const close = () => { if (busy) return; setSelected(null); setMessage(''); setFormError(''); };

    const decide = async (kind) => {
        if (kind === 'reject' && !message.trim()) { setFormError('Tell the company why the application is rejected.'); return; }
        setBusy(kind);
        setFormError('');
        try {
            await api.post(`/api/admin/${kind === 'approve' ? 'approve' : 'reject'}-company/${selected._id}`, { message: message.trim() });
            showToast(kind === 'approve' ? `${selected.name} approved` : `${selected.name} rejected`, kind === 'approve' ? 'success' : 'info');
            list.setData((prev) => (prev || []).filter((c) => c._id !== selected._id));
            setBusy(null);
            setSelected(null);
            setMessage('');
        } catch (err) {
            // The decision can be saved even when the follow-up email fails (the API
            // then answers 500). Re-check the queue before calling it a failure.
            const fresh = await list.reload();
            if (Array.isArray(fresh) && !fresh.some((c) => c._id === selected._id)) {
                showToast(`${selected.name} ${kind === 'approve' ? 'approved' : 'rejected'}, but the email to the owner could not be sent`, 'warning');
                setBusy(null);
                setSelected(null);
                setMessage('');
                return;
            }
            setFormError(errorMessage(err, kind === 'approve' ? 'Could not approve this company' : 'Could not reject this company'));
            setBusy(null);
        }
    };

    const companies = list.data || [];
    const owner = ownerOf(selected);

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Platform"
                    title="Pending requests"
                    lead="New company registrations waiting for verification."
                    actions={<Btn icon={RefreshCcw} onClick={list.reload}>Refresh</Btn>}
                />
            )}
        >
            {list.loading && !list.data ? <LoadingState /> : list.error ? (
                <ErrorState message={list.error} onRetry={list.reload} />
            ) : companies.length === 0 ? (
                <Panel><EmptyState icon={CheckCircle2} title="All caught up" text="No company is waiting for verification." /></Panel>
            ) : (
                <Grid min={280}>
                    {companies.map((c) => {
                        const docs = docsOf(c);
                        const o = ownerOf(c);
                        return (
                            <div key={c._id} className="gl-card pf-company">
                                <div className="pf-company-head">
                                    <Avatar name={c.name} src={c.logo} />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div className="pf-company-name">{c.name}</div>
                                        <div className="cd-cell-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} /> {c.domain || 'No domain'}</div>
                                    </div>
                                    <Chip tone="warning"><Clock size={11} /> Pending</Chip>
                                </div>
                                <dl className="pf-facts">
                                    <div><dt>Owner</dt><dd>{o?.username || o?.name || '—'}</dd></div>
                                    <div><dt>Submitted</dt><dd title={new Date(c.createdAt).toLocaleString()}>{timeAgo(c.createdAt)}</dd></div>
                                </dl>
                                <div className="cd-cell-sub">{docs.length ? `${docs.length} document${docs.length > 1 ? 's' : ''} attached` : 'No documents uploaded'}</div>
                                <Btn variant="primary" onClick={() => setSelected(c)}>Review application</Btn>
                            </div>
                        );
                    })}
                </Grid>
            )}

            <Dialog
                open={!!selected}
                size="lg"
                title="Review application"
                lead={selected ? `Verification for ${selected.name}` : ''}
                onClose={close}
                busy={!!busy}
                footer={selected && (
                    <>
                        <Btn variant="ghost" onClick={close} disabled={!!busy}>Cancel</Btn>
                        <Btn variant="danger" icon={X} loading={busy === 'reject'} disabled={!!busy} onClick={() => decide('reject')}>Reject</Btn>
                        <Btn variant="primary" icon={Check} loading={busy === 'approve'} disabled={!!busy} onClick={() => decide('approve')}>Approve</Btn>
                    </>
                )}
            >
                {selected && (
                    <>
                        <dl className="pf-facts">
                            <div><dt>Company</dt><dd>{selected.name}</dd></div>
                            <div><dt>Domain</dt><dd>{selected.domain || '—'}</dd></div>
                            <div><dt>Company email</dt><dd>{selected.billingEmail || selected.ownerEmail || '—'}</dd></div>
                            <div><dt>Company phone</dt><dd>{selected.settings?.phone || selected.ownerPhone || '—'}</dd></div>
                            <div><dt>Owner</dt><dd>{owner?.username || owner?.name || '—'}</dd></div>
                            <div><dt>Owner email</dt><dd>{owner?.personalEmail || owner?.email || '—'}</dd></div>
                            <div><dt>Job title</dt><dd>{owner?.jobTitle || '—'}</dd></div>
                            <div><dt>Owner phone</dt><dd>{owner?.phone ? `${owner.phoneCode || ''} ${owner.phone}` : '—'}</dd></div>
                            <div><dt>Requested departments</dt><dd>{(selected.metadata?.requestedDepartments || []).join(', ') || '—'}</dd></div>
                            <div><dt>Submitted</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div>
                        </dl>
                        <div className="cd-field">
                            <span className="cd-label">Supporting documents</span>
                            {docsOf(selected).length ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {docsOf(selected).map((d, i) => (
                                        <a key={d.url || i} className="pf-doc" href={docUrl(d.url)} target="_blank" rel="noopener noreferrer">
                                            <FileText size={13} /> {d.name || `Document ${i + 1}`}
                                        </a>
                                    ))}
                                </div>
                            ) : <span className="cd-hint">No documents were uploaded with this application.</span>}
                        </div>
                        <Field
                            label="Message to the owner"
                            htmlFor="pf-review-msg"
                            error={formError}
                            hint="Included in the approval or rejection email. Required when rejecting."
                        >
                            <textarea
                                id="pf-review-msg"
                                className="gl-input"
                                rows={4}
                                value={message}
                                onChange={(e) => { setMessage(e.target.value); if (formError) setFormError(''); }}
                                placeholder="e.g. Welcome to Oruinwan — or — Please upload a valid business registration."
                            />
                        </Field>
                    </>
                )}
            </Dialog>
        </DashPage>
    );
};

export default PendingRequests;
