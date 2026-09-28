import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UserPlus, Upload, Download, FileSpreadsheet, Mail, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '@services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { useToast } from '../../contexts/ToastContext';
import { getCompanyMembers } from '../../services/companyService';
import OnboardingWizard from '../../components/admin/onboarding/OnboardingWizard';
import RoleBadge from '../../components/company/RoleBadge';
import {
    DashPage, PageHead, Grid, Panel, Btn, Chip, Dialog, KpiGrid, Kpi, Meter, LoadingState, ErrorState, EmptyState, Avatar, useAsync, errorMessage, timeAgo,
} from '../../components/company-dash/dashUi';
import './admin.css';

const COLUMNS = [
    ['A', 'First name'], ['B', 'Last name'], ['C', 'Work email *'], ['D', 'Personal email'], ['E', 'Job title'],
    ['F', 'Join date (YYYY-MM-DD)'], ['G', 'Mobile *'], ['H', 'Corporate ID'], ['I', 'Role (member/manager/guest/admin)'], ['J', 'Department'],
];
const PENDING = /pending|invited/;

/** Parse the template (or the older 5-column layout) in the browser for a preview. */
async function parseSheet(file) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    return rows.slice(1).filter((r) => r[2] || r[1]).map((r) => {
        if (String(r[2] || '').includes('@')) {
            return {
                name: `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
                companyEmail: String(r[2] || '').trim().toLowerCase(),
                jobTitle: String(r[4] || '').trim(),
                phone: String(r[6] || '').trim(),
                role: String(r[8] || 'member').trim().toLowerCase(),
                department: String(r[9] || '').trim(),
            };
        }
        return {
            name: String(r[0] || '').trim(), companyEmail: String(r[1] || '').trim().toLowerCase(), jobTitle: '',
            phone: String(r[2] || '').trim(), role: String(r[3] || 'member').trim().toLowerCase(), department: String(r[4] || '').trim(),
        };
    }).filter((e) => e.companyEmail);
}

const BulkImportDialog = ({ open, onClose, companyId, domain, onDone }) => {
    const { showToast } = useToast();
    const fileRef = useRef(null);
    const pollRef = useRef(null);
    const [phase, setPhase] = useState('upload');
    const [file, setFile] = useState(null);
    const [rows, setRows] = useState([]);
    const [progress, setProgress] = useState({ processed: 0, total: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    useEffect(() => () => stopPoll(), []);
    useEffect(() => { if (open) { setPhase('upload'); setFile(null); setRows([]); setResult(null); setError(null); } }, [open]);

    const downloadTemplate = async () => {
        try {
            const res = await api.get(`/api/companies/${companyId}/setup/template`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            Object.assign(document.createElement('a'), { href: url, download: 'oruinwan_team_template.xlsx' }).click();
            URL.revokeObjectURL(url);
        } catch (err) { showToast(errorMessage(err, 'Could not download the template'), 'error'); }
    };

    const pick = async (f) => {
        if (!f) return;
        setError(null);
        if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setError('Upload an .xlsx, .xls or .csv file.'); return; }
        try {
            const parsed = await parseSheet(f);
            if (!parsed.length) { setError('No rows with an email were found. Use the template.'); return; }
            if (domain) parsed.forEach((r) => { r.domainError = (r.companyEmail.split('@')[1] || '') !== domain; });
            setFile(f); setRows(parsed); setPhase('preview');
        } catch { setError('Could not read this file. Use the template.'); }
    };

    const submit = async () => {
        setPhase('submitting');
        setError(null);
        try {
            const fd = new FormData();
            fd.append('employeeFile', file);
            const res = await api.post('/api/company/onboarding/bulk', fd);
            const { jobId, total } = res.data;
            setProgress({ processed: 0, total: total || rows.length });
            let failures = 0;
            stopPoll();
            pollRef.current = setInterval(async () => {
                try {
                    const job = (await api.get(`/api/company/onboarding/status/${jobId}`)).data.job;
                    failures = 0;
                    setProgress({ processed: job.processedRows, total: job.totalRows });
                    if (job.status === 'done' || job.status === 'failed') {
                        stopPoll();
                        setResult({ status: job.status, created: job.createdCount ?? 0, skipped: job.skippedCount ?? 0, errors: (job.results || []).filter((r) => r.status === 'error') });
                        setPhase('done');
                        onDone?.();
                    }
                } catch (err) {
                    failures += 1;
                    if (failures >= 5) { stopPoll(); setError(errorMessage(err, 'Lost track of the import job')); setPhase('done'); }
                }
            }, 2000);
        } catch (err) {
            setError(errorMessage(err, 'Import failed'));
            setPhase('preview');
        }
    };

    const domainErrors = rows.filter((r) => r.domainError).length;
    const pct = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;

    return (
        <Dialog
            open={open}
            size="lg"
            title="Bulk import"
            lead="Create accounts for many people from a spreadsheet."
            onClose={onClose}
            busy={phase === 'submitting'}
            footer={phase === 'preview' ? (
                <>
                    <Btn variant="ghost" onClick={() => setPhase('upload')}>Choose another file</Btn>
                    <Btn variant="primary" icon={Upload} disabled={domainErrors > 0} onClick={submit}>Import {rows.length} {rows.length === 1 ? 'person' : 'people'}</Btn>
                </>
            ) : phase === 'done' ? <Btn variant="primary" onClick={onClose}>Done</Btn> : null}
        >
            {phase === 'upload' && (
                <>
                    <Panel title="1 · Get the template" icon={FileSpreadsheet} action={<Btn size="sm" icon={Download} onClick={downloadTemplate}>Download</Btn>}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {COLUMNS.map(([c, l]) => <Chip key={c}><strong>{c}</strong> {l}</Chip>)}
                        </div>
                    </Panel>
                    <button
                        type="button"
                        className="gl-card gl-card--interactive"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
                        style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, font: 'inherit', color: 'var(--text-primary)', borderStyle: 'dashed' }}
                    >
                        <Upload size={20} style={{ color: 'var(--accent)' }} />
                        <strong style={{ fontSize: 13 }}>2 · Drop the filled file here, or click to choose</strong>
                        <span className="cd-hint">.xlsx, .xls or .csv{domain ? ` · emails must end in @${domain}` : ''}</span>
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
                    {error && <div className="cd-error-text" role="alert">{error}</div>}
                </>
            )}

            {phase === 'preview' && (
                <>
                    <p className="cd-hint" style={{ margin: 0 }}>{file?.name} · {rows.length} rows{rows.length > 12 ? ' · showing the first 12' : ''}</p>
                    {domainErrors > 0 && (
                        <div className="ad-bulk" style={{ borderColor: 'color-mix(in srgb, var(--state-danger) 40%, transparent)', background: 'color-mix(in srgb, var(--state-danger) 8%, transparent)' }}>
                            <AlertTriangle size={14} style={{ color: 'var(--state-danger)' }} /> {domainErrors} {domainErrors === 1 ? 'email does' : 'emails do'} not use @{domain}. Fix the file and upload again.
                        </div>
                    )}
                    <div className="gl-card cd-table-wrap" style={{ maxHeight: 320 }}>
                        <table className="cd-table">
                            <thead><tr><th>Name</th><th>Work email</th><th className="cd-hide-sm">Title</th><th>Role</th><th className="cd-hide-sm">Department</th></tr></thead>
                            <tbody>
                                {rows.slice(0, 12).map((r, i) => (
                                    <tr key={`${r.companyEmail}-${i}`}>
                                        <td>{r.name || '—'}</td>
                                        <td style={{ color: r.domainError ? 'var(--state-danger)' : undefined }}>{r.companyEmail}</td>
                                        <td className="cd-hide-sm cd-muted">{r.jobTitle || '—'}</td>
                                        <td><RoleBadge role={r.role} /></td>
                                        <td className="cd-hide-sm cd-muted">{r.department || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {error && <div className="cd-error-text" role="alert">{error}</div>}
                </>
            )}

            {phase === 'submitting' && (
                <div className="cd-state">
                    <p className="gl-empty-title">Creating accounts…</p>
                    <p className="gl-empty-text">{progress.total ? `${progress.processed} of ${progress.total} processed` : 'Starting the import'}</p>
                    <div style={{ width: '100%', maxWidth: 360 }}><Meter value={pct} label="Import progress" /></div>
                </div>
            )}

            {phase === 'done' && (
                <>
                    {result && (
                        <KpiGrid min={140}>
                            <Kpi label="Created" value={result.created} icon={CheckCircle2} tone="success" />
                            <Kpi label="Skipped" value={result.skipped} tone="muted" />
                            <Kpi label="Errors" value={result.errors.length} icon={AlertTriangle} tone={result.errors.length ? 'danger' : 'muted'} />
                        </KpiGrid>
                    )}
                    {error && <div className="cd-error-text" role="alert">{error}</div>}
                    {result?.errors?.length > 0 && (
                        <div className="gl-card cd-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                            {result.errors.map((e, i) => (
                                <div className="cd-list-row" key={i}>
                                    <span className="cd-grow"><span className="cd-cell-title">{e.email || `Row ${e.row ?? i + 1}`}</span><span className="cd-cell-sub">{e.error || e.message || 'Error'}</span></span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </Dialog>
    );
};

const OnboardingPage = () => {
    const { company } = useCompany();
    const { showToast } = useToast();
    const companyId = company?._id;
    const [mode, setMode] = useState(null);
    const [resending, setResending] = useState(null);

    const { data, loading, error, reload } = useAsync(
        () => getCompanyMembers(companyId).then((r) => (r.members || []).filter((m) => PENDING.test(m.accountStatus || ''))),
        [companyId],
        { enabled: !!companyId },
    );
    const pending = data || [];

    const resend = useCallback(async (m) => {
        setResending(m._id);
        try {
            await api.post(`/api/company/onboarding/resend/${m._id}`);
            showToast(`Invite re-sent to ${m.email}`, 'success');
        } catch (err) { showToast(errorMessage(err, 'Could not resend the invite'), 'error'); } finally { setResending(null); }
    }, [showToast]);

    return (
        <DashPage head={<PageHead eyebrow="Organization" title="Onboard" lead="Bring new people into the company — one at a time or in bulk." />}>
            <Grid cols="2">
                <Panel title="Individual" icon={UserPlus}>
                    <p className="cd-hint" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6 }}>
                        A short wizard: name and title, work email, role, departments and workspaces. They receive an invite and set their own password.
                    </p>
                    <Btn variant="primary" icon={UserPlus} onClick={() => setMode('individual')} disabled={!companyId}>Onboard a person</Btn>
                </Panel>
                <Panel title="Bulk import" icon={Upload}>
                    <p className="cd-hint" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6 }}>
                        Fill in the spreadsheet template and upload it. Accounts are created with a temporary password and welcome emails go out.
                    </p>
                    <Btn icon={Upload} onClick={() => setMode('bulk')} disabled={!companyId}>Import a spreadsheet</Btn>
                </Panel>
            </Grid>

            <Panel title="Waiting to join" icon={Mail} flush action={<Btn size="sm" variant="ghost" icon={RefreshCw} onClick={reload}>Refresh</Btn>}>
                {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <LoadingState /> : pending.length === 0 ? (
                    <EmptyState icon={Mail} title="No pending invitations" text="People you onboard appear here until they sign in for the first time." />
                ) : (
                    <div className="cd-list">
                        {pending.map((m) => (
                            <div className="cd-list-row" key={m._id}>
                                <Avatar user={m} size="sm" />
                                <div className="cd-grow">
                                    <div className="cd-cell-title">{m.username || m.email}</div>
                                    <div className="cd-cell-sub">{m.email} · invited {timeAgo(m.createdAt)}</div>
                                </div>
                                <span className="cd-hide-sm"><RoleBadge role={m.companyRole} /></span>
                                <Btn size="sm" icon={Mail} loading={resending === m._id} onClick={() => resend(m)}>Resend</Btn>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            <OnboardingWizard open={mode === 'individual'} onClose={() => setMode(null)} onComplete={() => { setMode(null); reload(); }} />
            <BulkImportDialog
                open={mode === 'bulk'}
                onClose={() => setMode(null)}
                companyId={companyId}
                domain={(company?.domain || '').toLowerCase().replace(/^@/, '')}
                onDone={reload}
            />
        </DashPage>
    );
};

export default OnboardingPage;
