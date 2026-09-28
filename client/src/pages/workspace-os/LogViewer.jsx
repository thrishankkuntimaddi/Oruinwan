import React, { useEffect, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Download, ClipboardList } from 'lucide-react';
import api from '@services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    DashPage, PageHead, Toolbar, SelectBox, DataTable, Btn, IconBtn, Chip, Avatar, Dialog, Field,
    ErrorState, EmptyState, useAsync, timeAgo, errorMessage,
} from '../../components/company-dash/dashUi';
import { companyIdOf, downloadCsv, fullDate } from './wosShared';

const SEVERITY_TONE = { info: undefined, warning: 'warning', critical: 'danger' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const LIMIT = 50;
const dayStart = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

/**
 * Shared viewer for the audit and compliance logs: category / severity / date
 * filters, paging, a detail dialog and CSV export of the filtered set.
 *
 * config: { eyebrow, title, lead, endpoint, categories, actorOf(log), roleOf?(log),
 *           csvName, statusColumn?, verify? }
 */
export default function LogViewer({ config, companyId: propCompanyId }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const companyId = propCompanyId || companyIdOf(user);
    const [category, setCategory] = useState('');
    const [severity, setSeverity] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [verify, setVerify] = useState(false);
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => { setPage(1); }, [category, severity, from, to, verify]);
    const filters = {
        companyId,
        ...(category && { category }),
        ...(severity && { severity }),
        ...(from && { from: dayStart(from) }),
        ...(to && { to: dayEnd(to) }),
        ...(config.verify && verify && { verify: true }),
    };
    const { data, loading, error, reload } = useAsync(
        () => api.get(config.endpoint, { params: { ...filters, page, limit: LIMIT } }).then((r) => r.data),
        [companyId, page, category, severity, from, to, verify],
        { enabled: !!companyId },
    );
    const logs = data?.logs || [];
    const pg = data?.pagination || { page: 1, pages: 1, total: logs.length };

    const exportCsv = async () => {
        setExporting(true);
        try {
            const all = [];
            for (let p = 1; p <= 25; p += 1) {
                const r = await api.get(config.endpoint, { params: { ...filters, page: p, limit: 200 } });
                all.push(...(r.data?.logs || []));
                if (p >= (r.data?.pagination?.pages || 1)) break;
            }
            downloadCsv(config.csvName, [
                ['When', 'Action', 'Actor', 'Actor email', 'Category', 'Severity', 'Status', 'IP address', 'Description'],
                ...all.map((l) => {
                    const a = config.actorOf(l);
                    return [l.createdAt, l.action, a?.username || '', a?.email || l.actorEmail || '', l.category, l.severity, l.status || '', l.ipAddress || '', l.description || l.resourceName || ''];
                }),
            ]);
            showToast(`Exported ${all.length} entr${all.length === 1 ? 'y' : 'ies'}`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not export the log'), 'error');
        } finally {
            setExporting(false);
        }
    };

    const columns = [
        { key: 'when', label: 'When', render: (l) => <span title={fullDate(l.createdAt)} style={{ whiteSpace: 'nowrap' }}>{timeAgo(l.createdAt)}</span> },
        { key: 'action', label: 'Action', render: (l) => <span className="wo-code">{l.action}</span> },
        {
            key: 'actor', label: 'Actor', render: (l) => {
                const a = config.actorOf(l);
                return (
                    <div className="cd-cell-user">
                        <Avatar user={a} name={a?.username || l.actorEmail} size="sm" />
                        <div>
                            <div className="cd-cell-title">{a?.username || l.actorEmail || 'System'}</div>
                            {config.roleOf?.(l) && <div className="cd-cell-sub">{config.roleOf(l)}</div>}
                        </div>
                    </div>
                );
            },
        },
        { key: 'cat', label: 'Category', className: 'cd-hide-sm', render: (l) => (l.category ? <Chip>{l.category}</Chip> : '—') },
        { key: 'sev', label: 'Severity', render: (l) => <Chip tone={SEVERITY_TONE[l.severity]}>{l.severity || 'info'}</Chip> },
        ...(config.statusColumn ? [{ key: 'status', label: 'Result', className: 'cd-hide-sm', render: (l) => <Chip tone={l.status === 'failure' ? 'danger' : l.status === 'pending' ? 'warning' : 'success'}>{l.status || 'success'}</Chip> }] : []),
        ...(config.verify && verify ? [{
            key: 'hash', label: 'Integrity', render: (l) => (l._hashValid === true ? <Chip tone="success">Verified</Chip> : l._hashValid === false ? <Chip tone="danger">Tampered</Chip> : <Chip>—</Chip>),
        }] : []),
    ];

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow={config.eyebrow}
                    title={config.title}
                    lead={config.lead}
                    actions={(
                        <>
                            <Btn icon={RefreshCw} loading={loading} onClick={reload}>Refresh</Btn>
                            <Btn icon={Download} loading={exporting} disabled={!logs.length} onClick={exportCsv}>Export CSV</Btn>
                        </>
                    )}
                />
            )}
        >
            {!companyId ? (
                <EmptyState icon={ClipboardList} title="No company" />
            ) : (
                <>
                    <Toolbar>
                        <SelectBox value={category} onChange={setCategory} label="Category" style={{ maxWidth: 180 }}>
                            <option value="">All categories</option>
                            {config.categories.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
                        </SelectBox>
                        <SelectBox value={severity} onChange={setSeverity} label="Severity" style={{ maxWidth: 160 }}>
                            <option value="">All severities</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </SelectBox>
                        <label className="wo-check">From <input type="date" className="gl-input wo-date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" /></label>
                        <label className="wo-check">To <input type="date" className="gl-input wo-date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" /></label>
                        {config.verify && (
                            <label className="wo-check" title="Recompute each record's SHA-256 hash to detect tampering">
                                <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} /> Verify integrity
                            </label>
                        )}
                        {(category || severity || from || to) && (
                            <Btn size="sm" variant="ghost" onClick={() => { setCategory(''); setSeverity(''); setFrom(''); setTo(''); }}>Clear filters</Btn>
                        )}
                    </Toolbar>
                    {error && !data ? (
                        <ErrorState message={error} onRetry={reload} />
                    ) : (
                        <>
                            <DataTable
                                columns={columns}
                                rows={logs}
                                maxHeight="calc(100dvh - 330px)"
                                onRowClick={setOpen}
                                empty={loading
                                    ? <p className="cd-muted" style={{ padding: 24, textAlign: 'center', margin: 0, fontSize: 13 }}>Loading…</p>
                                    : <EmptyState icon={ClipboardList} title="No entries" text={category || severity || from || to ? 'Nothing matches these filters.' : config.emptyText} />}
                            />
                            <div className="wo-pager">
                                <span>{pg.total ? `${pg.total} entr${pg.total === 1 ? 'y' : 'ies'}` : ''}</span>
                                {pg.pages > 1 && (
                                    <div>
                                        <IconBtn label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /></IconBtn>
                                        <span>Page {page} of {pg.pages}</span>
                                        <IconBtn label="Next page" disabled={page >= pg.pages} onClick={() => setPage((p) => Math.min(pg.pages, p + 1))}><ChevronRight size={15} /></IconBtn>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            <Dialog open={!!open} title={open?.action || ''} lead={open ? fullDate(open.createdAt) : undefined} onClose={() => setOpen(null)} size="lg">
                {open && (
                    <>
                        <dl className="wo-kv">
                            <dt className="cd-muted">Actor</dt><dd style={{ margin: 0 }}>{config.actorOf(open)?.username || open.actorEmail || 'System'} {config.actorOf(open)?.email ? `(${config.actorOf(open).email})` : ''}</dd>
                            <dt className="cd-muted">Category</dt><dd style={{ margin: 0 }}>{open.category || '—'}</dd>
                            <dt className="cd-muted">Severity</dt><dd style={{ margin: 0 }}>{open.severity || 'info'}</dd>
                            {open.status && (<><dt className="cd-muted">Result</dt><dd style={{ margin: 0 }}>{open.status}{open.errorMessage ? ` — ${open.errorMessage}` : ''}</dd></>)}
                            {(open.resourceType || open.resource) && (<><dt className="cd-muted">Resource</dt><dd style={{ margin: 0 }}>{open.resourceType || open.resource}{open.resourceName ? ` · ${open.resourceName}` : ''}</dd></>)}
                            {open.description && (<><dt className="cd-muted">Description</dt><dd style={{ margin: 0 }}>{open.description}</dd></>)}
                            {open.ipAddress && (<><dt className="cd-muted">IP address</dt><dd style={{ margin: 0 }}>{open.ipAddress}</dd></>)}
                        </dl>
                        {open.details && Object.keys(open.details).length > 0 && (
                            <Field label="Details">
                                <pre className="wo-code" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: 10, margin: 0, maxHeight: 280, overflow: 'auto', display: 'block' }}>
                                    {JSON.stringify(open.details, null, 2)}
                                </pre>
                            </Field>
                        )}
                    </>
                )}
            </Dialog>
        </DashPage>
    );
}
