import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    UserPlus, Upload, FileText, ChevronRight, Users, Play, DownloadCloud, X,
    Download, Eye, CheckCircle, AlertCircle, FileSpreadsheet, ArrowLeft,
    Loader2, Trash2, Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import api from '@services/api';
import OnboardingWizard from '../../components/admin/onboarding/OnboardingWizard';

const roleBadgeSt = {
    admin: { color: 'var(--state-danger)', border: 'var(--state-danger)' },
    manager: { color: 'var(--accent)', border: 'var(--accent)' },
    member: { color: 'var(--text-secondary)', border: 'var(--border-accent)' },
};

const RoleBadge = ({ role }) => {
    const st = roleBadgeSt[role] || roleBadgeSt.member;
    return (
        <span style={{ display: 'inline-flex', padding: '1px 5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: st.color, border: `1px solid ${st.border}` }}>
            {role}
        </span>
    );
};

const BulkImportModal = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef();
    const [phase, setPhase] = useState('upload');
    const [excelFile, setExcelFile] = useState(null);
    const [parsedRows, setParsedRows] = useState([]);
    const [result, setResult] = useState(null);
    const [showColGuide, setShowColGuide] = useState(false);
    const [progress, setProgress] = useState({ processed: 0, total: 0 });
    const [companyDomain, setCompanyDomain] = useState('');

    const companyId = user?.company?.id || user?.company?._id || (typeof user?.companyId === 'string' ? user.companyId : user?.companyId?._id || user?.companyId?.toString());

    useEffect(() => {
        if (!companyId) return;
        api.get(`/api/companies/${companyId}`).then(res => {
            const domain = res.data?.company?.domain || res.data?.domain || '';
            setCompanyDomain(domain.toLowerCase().replace(/^@/, ''));
        }).catch(() => { });
    }, [companyId]);

    const downloadTemplate = async () => {
        try {
            const res = await api.get(`/api/companies/${companyId}/setup/template`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            Object.assign(document.createElement('a'), { href: url, download: 'chttrix_team_template.xlsx' }).click();
            URL.revokeObjectURL(url);
        } catch { showToast('Failed to download template', 'error'); }
    };

    const handleFile = async (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) { showToast('Please upload an .xlsx or .csv file', 'error'); return; }
        setExcelFile(file);
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(await file.arrayBuffer());
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            const data = rows.slice(1).filter(r => r[2] || r[1]).map(r => {
                const isNewFormat = String(r[2] || '').includes('@');
                if (isNewFormat) {
                    return {
                        name: `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
                        companyEmail: String(r[2] || '').trim().toLowerCase(),
                        personalEmail: String(r[3] || '').trim().toLowerCase(),
                        jobTitle: String(r[4] || '').trim(),
                        joiningDate: String(r[5] || '').trim(),
                        phone: String(r[6] || '').trim(),
                        corporateId: String(r[7] || '').trim(),
                        role: String(r[8] || 'member').trim().toLowerCase(),
                        department: String(r[9] || '').trim(),
                    };
                }
                return {
                    name: String(r[0] || '').trim(), companyEmail: String(r[1] || '').trim().toLowerCase(),
                    personalEmail: '', phone: String(r[2] || '').trim(),
                    role: String(r[3] || 'member').trim().toLowerCase(), department: String(r[4] || '').trim()
                };
            }).filter(e => e.companyEmail);
            if (companyDomain) {
                data.forEach(emp => {
                    const emailDomain = emp.companyEmail.split('@')[1] || '';
                    emp.domainError = emailDomain !== companyDomain;
                });
            }
            if (!data.length) { showToast('No valid rows found in file', 'error'); return; }
            setParsedRows(data); setPhase('preview');
        } catch { showToast('Could not parse file — use the provided template', 'error'); }
    };

    const onDrop = useCallback((e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }, []);

    const handleSubmit = async () => {
        if (!companyId) { showToast('No company ID found', 'error'); return; }
        setPhase('submitting');
        try {
            const formData = new FormData();
            formData.append('employeeFile', excelFile);
            const res = await api.post('/api/company/onboarding/bulk', formData);
            const { jobId, total } = res.data;
            setProgress({ processed: 0, total: total || 0 });
            const interval = setInterval(async () => {
                try {
                    const statusRes = await api.get(`/api/company/onboarding/status/${jobId}`);
                    const job = statusRes.data.job;
                    setProgress({ processed: job.processedRows, total: job.totalRows });
                    if (job.status === 'done' || job.status === 'failed') {
                        clearInterval(interval);
                        setResult({ created: job.createdCount ?? 0, skipped: job.skippedCount ?? 0, errors: job.results?.filter(r => r.status === 'error') || [] });
                        setPhase('done');
                    }
                } catch { }
            }, 2000);
            setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
        } catch (err) {
            showToast(err.response?.data?.error || 'Import failed', 'error');
            setPhase('preview');
        }
    };

    const colGuide = [
        { col: 'A', label: 'First Name', note: 'Given name', req: false },
        { col: 'B', label: 'Last Name', note: 'Family name', req: false },
        { col: 'C', label: 'Email', note: 'Work email', req: true },
        { col: 'D', label: 'Pers. Email', note: 'Personal', req: false },
        { col: 'E', label: 'Job Title', note: 'Position', req: false },
        { col: 'F', label: 'Join Date', note: 'YYYY-MM-DD', req: false },
        { col: 'G', label: 'Mobile', note: 'Phone no.', req: true },
        { col: 'H', label: 'Corp ID', note: 'e.g. EMP001', req: false },
        { col: 'I', label: 'Role', note: 'member/admin', req: false },
        { col: 'J', label: 'Department', note: 'Team name', req: false },
    ];

    const domainErrors = parsedRows.filter(r => r.domainError).length;

    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxWidth: '600px', width: '100%', position: 'relative', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />

            {}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', marginTop: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {phase === 'preview' && (
                        <button onClick={() => { setPhase('upload'); setExcelFile(null); setParsedRows([]); }}
                            style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <ArrowLeft size={15} />
                        </button>
                    )}
                    <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Bulk Team Import</h3>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {phase === 'upload' && 'Upload your employee spreadsheet'}
                            {phase === 'preview' && `${parsedRows.length} employees ready to import`}
                            {phase === 'submitting' && 'Creating accounts…'}
                            {phase === 'done' && 'Import complete!'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} style={{ padding: '5px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={16} />
                </button>
            </div>

            <div style={{ padding: '20px' }}>
                {}
                {phase === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderLeft: '2px solid var(--state-success)' }}>
                            <div style={{ width: '36px', height: '36px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FileSpreadsheet size={18} style={{ color: 'var(--state-success)' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>Step 1 — Download the Template</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fill in: First Name, Last Name, Email, Job Title, Mobile, Role, Dept…</p>
                            </div>
                            <DlBtn onClick={downloadTemplate} />
                        </div>

                        {}
                        <div style={{ background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <button onClick={() => setShowColGuide(v => !v)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Info size={12} style={{ color: 'var(--accent)' }} />
                                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Column Guide (10 columns)</span>
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: showColGuide ? 'var(--accent)' : 'var(--text-muted)' }}>{showColGuide ? 'Hide ▲' : 'Show ▼'}</span>
                            </button>
                            {showColGuide && (
                                <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                                    {colGuide.map(c => (
                                        <div key={c.col} style={{ textAlign: 'center' }}>
                                            <div style={{ padding: '3px 4px', fontSize: '10px', fontWeight: 700, marginBottom: '2px', background: c.req ? 'rgba(184,149,106,0.15)' : 'var(--bg-surface)', color: c.req ? 'var(--accent)' : 'var(--text-secondary)', border: `1px solid ${c.req ? 'var(--accent)' : 'var(--border-subtle)'}` }}>
                                                {c.col}: {c.label}
                                            </div>
                                            <p style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{c.note}</p>
                                            {c.req && <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--state-danger)' }}>Required</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {}
                        <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
                            style={{ border: '2px dashed var(--border-accent)', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center', transition: 'all 150ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'none'; }}>
                            <div style={{ width: '48px', height: '48px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                                <Upload size={20} style={{ color: 'var(--accent)' }} />
                            </div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Step 2 — Upload Filled Template</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Drag & drop or click to browse · .xlsx, .xls, .csv</p>
                        </div>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderLeft: '2px solid var(--accent)' }}>
                            <AlertCircle size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                Credentials (temp password) are sent to the <strong style={{ color: 'var(--text-primary)' }}>Personal Email</strong> (col D). The Work Email (col C) is stored as the company email.
                            </p>
                        </div>
                    </div>
                )}

                {}
                {phase === 'preview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>
                            <FileSpreadsheet size={16} style={{ color: 'var(--state-success)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{excelFile?.name}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{parsedRows.length} valid records found</p>
                            </div>
                            <button onClick={() => { setPhase('upload'); setExcelFile(null); setParsedRows([]); }}
                                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', cursor: 'pointer' }}>
                                <Trash2 size={12} />
                            </button>
                        </div>

                        {}
                        <div style={{ border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Eye size={11} style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                                        Preview — {parsedRows.length > 10 ? `showing first 10 of ${parsedRows.length}` : `${parsedRows.length} rows`}
                                    </span>
                                </div>
                                {companyDomain && (
                                    domainErrors > 0
                                        ? <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--state-danger)', padding: '1px 6px', border: '1px solid var(--state-danger)' }}>{domainErrors} wrong domain</span>
                                        : <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--state-success)', padding: '1px 6px', border: '1px solid var(--state-success)' }}>✓ All @{companyDomain}</span>
                                )}
                            </div>
                            <div style={{ overflowX: 'auto', maxHeight: '220px', overflowY: 'auto' }} className="custom-scrollbar">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0 }}>
                                            {['#', 'Name', 'Work Email', 'Pers. Email', 'Job Title', 'Phone', 'Role', 'Dept'].map(h => (
                                                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.slice(0, 10).map((emp, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', background: emp.domainError ? 'rgba(224,82,82,0.05)' : 'transparent', transition: 'background 150ms ease' }}
                                                onMouseEnter={e => !emp.domainError && (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                onMouseLeave={e => !emp.domainError && (e.currentTarget.style.background = 'transparent')}>
                                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                <td style={{ padding: '6px 10px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{emp.name || '—'}</td>
                                                <td style={{ padding: '6px 10px' }}>
                                                    {emp.domainError
                                                        ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                            <span style={{ color: 'var(--state-danger)' }}>{emp.companyEmail}</span>
                                                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--state-danger)', padding: '1px 4px', border: '1px solid var(--state-danger)' }}>⚠ must be @{companyDomain}</span>
                                                        </span>
                                                        : <span style={{ color: 'var(--text-secondary)' }}>{emp.companyEmail || '—'}</span>}
                                                </td>
                                                <td style={{ padding: '6px 10px', color: emp.personalEmail ? 'var(--accent)' : 'var(--text-muted)' }}>{emp.personalEmail || '—'}</td>
                                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{emp.jobTitle || '—'}</td>
                                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{emp.phone || '—'}</td>
                                                <td style={{ padding: '6px 10px' }}><RoleBadge role={emp.role} /></td>
                                                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{emp.department || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {parsedRows.length > 10 && (
                            <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>… and {parsedRows.length - 10} more rows not shown</p>
                        )}

                        {companyDomain && domainErrors > 0 && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: 'rgba(224,82,82,0.05)', border: '1px solid var(--state-danger)' }}>
                                <AlertCircle size={12} style={{ color: 'var(--state-danger)', flexShrink: 0, marginTop: '1px' }} />
                                <p style={{ fontSize: '11px', color: 'var(--state-danger)', lineHeight: '1.5' }}>
                                    <strong>{domainErrors} row(s)</strong> have a work email that doesn't match your company domain <strong>@{companyDomain}</strong>. Fix the file and re-upload.
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => { setPhase('upload'); setExcelFile(null); setParsedRows([]); }}
                                style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px' }}>
                                Change File
                            </button>
                            {domainErrors > 0 ? (
                                <button disabled style={{ flex: 1, padding: '10px', background: 'rgba(224,82,82,0.1)', border: '1px solid var(--state-danger)', color: 'var(--state-danger)', fontSize: '12px', fontWeight: 700, cursor: 'not-allowed', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <AlertCircle size={13} /> Fix {domainErrors} domain error{domainErrors !== 1 ? 's' : ''} first
                                </button>
                            ) : (
                                <button onClick={handleSubmit} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', color: 'var(--bg-base)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}>
                                    <Users size={14} /> Import {parsedRows.length} Employees
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {}
                {phase === 'submitting' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ width: '56px', height: '56px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                            <Loader2 size={24} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Creating Accounts…</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                            {progress.total > 0 ? `${progress.processed} / ${progress.total} processed` : 'Sending invite emails'}
                        </p>
                        {progress.total > 0 && (
                            <div style={{ width: '240px', height: '3px', background: 'var(--bg-active)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '3px', background: 'var(--accent)', width: `${Math.round((progress.processed / progress.total) * 100)}%`, transition: 'width 0.5s ease' }} />
                            </div>
                        )}
                    </div>
                )}

                {}
                {phase === 'done' && result && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 16px', gap: '16px' }}>
                        <div style={{ width: '64px', height: '64px', background: 'var(--bg-active)', border: '1px solid var(--state-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={28} style={{ color: 'var(--state-success)' }} />
                        </div>
                        <div>
                            <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Import Complete!</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Employees can now log in with their temporary passwords.</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%', maxWidth: '280px' }}>
                            {[
                                { val: result.created ?? 0, label: 'Created', color: 'var(--state-success)' },
                                { val: result.skipped ?? 0, label: 'Skipped', color: 'var(--accent)' },
                                { val: result.errors?.length ?? 0, label: 'Errors', color: 'var(--state-danger)' },
                            ].map(item => (
                                <div key={item.label} style={{ padding: '12px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '22px', fontWeight: 700, color: item.color, letterSpacing: '-0.02em', marginBottom: '2px' }}>{item.val}</p>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{item.label}</p>
                                </div>
                            ))}
                        </div>
                        {result.errors?.length > 0 && (
                            <div style={{ width: '100%', padding: '10px 12px', background: 'rgba(224,82,82,0.05)', border: '1px solid var(--state-danger)', textAlign: 'left' }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--state-danger)', marginBottom: '6px' }}>Failed imports:</p>
                                <div style={{ maxHeight: '80px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {result.errors.map((e, i) => (
                                        <p key={i} style={{ fontSize: '11px', color: 'var(--state-danger)' }}>• {e.email} — {e.error}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={onClose}
                            style={{ padding: '10px 28px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--bg-base)'; e.currentTarget.style.border = '1px solid var(--accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.border = '1px solid var(--border-default)'; }}>
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const DlBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', background: hov ? 'var(--state-success)' : 'rgba(90,186,138,0.15)', border: `1px solid var(--state-success)`, color: hov ? 'var(--bg-base)' : 'var(--state-success)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease', flexShrink: 0 }}>
            <Download size={12} /> Download
        </button>
    );
};

const OnboardingPage = () => {
    const [mode, setMode] = useState(null);

    return (
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', position: 'relative', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {}
            {mode && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                    {mode === 'individual' ? (
                        <div style={{ width: '100%', maxWidth: '900px', height: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                            <OnboardingWizard onComplete={() => setMode(null)} />
                        </div>
                    ) : (
                        <BulkImportModal onClose={() => setMode(null)} />
                    )}
                </div>
            )}

            {}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', transition: 'all 300ms ease', filter: mode ? 'blur(2px)' : 'none', opacity: mode ? 0.4 : 1 }} className="custom-scrollbar">
                <div style={{ maxWidth: '760px', width: '100%' }}>
                    {}
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: '20px' }}>
                            <Users size={11} /> Team Growth
                        </span>
                        <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.02em' }}>Grow Your Team</h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: '1.6' }}>Select a method to onboard new employees to your workspace.</p>
                    </div>

                    {}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <OnboardCard icon={UserPlus} label="Individual Setup" desc="Launch the wizard for a single employee. Configure roles, access details, and workspace assignments manually." cta="Start Setup" ctaIcon={Play} onClick={() => setMode('individual')} accentColor="var(--accent)" />
                        <OnboardCard icon={Upload} label="Bulk Import" desc="Upload an Excel file to onboard multiple employees at once. Accounts are created automatically with welcome emails sent." cta="Import Now" ctaIcon={DownloadCloud} onClick={() => setMode('bulk')} accentColor="var(--state-success)" badge=".xlsx · .csv" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const OnboardCard = ({ icon: Icon, label, desc, cta, ctaIcon: CtaIcon, onClick, accentColor, badge }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', background: hov ? 'var(--bg-hover)' : 'var(--bg-surface)', border: `1px solid ${hov ? accentColor : 'var(--border-subtle)'}`, borderTop: `2px solid ${hov ? accentColor : 'var(--border-subtle)'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms ease' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ width: '44px', height: '44px', background: hov ? 'rgba(0,0,0,0.1)' : 'var(--bg-active)', border: `1px solid ${hov ? accentColor : 'var(--border-default)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
                    <Icon size={20} style={{ color: hov ? accentColor : 'var(--text-muted)' }} />
                </div>
                <div style={{ width: '28px', height: '28px', background: hov ? accentColor : 'var(--bg-active)', border: `1px solid ${hov ? accentColor : 'var(--border-default)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
                    <ChevronRight size={14} style={{ color: hov ? 'var(--bg-base)' : 'var(--text-muted)' }} />
                </div>
            </div>
            <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: hov ? 'var(--text-primary)' : 'var(--text-primary)', marginBottom: '6px', transition: 'color 150ms ease' }}>{label}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{desc}</p>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: accentColor, display: 'flex', alignItems: 'center', gap: '4px', opacity: hov ? 1 : 0, transform: hov ? 'translateX(0)' : 'translateX(-6px)', transition: 'all 200ms ease' }}>
                    {cta} <CtaIcon size={11} />
                </span>
                {badge && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, padding: '1px 6px', background: 'var(--bg-active)', border: '1px solid var(--border-subtle)' }}>{badge}</span>}
            </div>
        </button>
    );
};

export default OnboardingPage;
