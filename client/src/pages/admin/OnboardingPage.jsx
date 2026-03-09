import React, { useState, useRef, useCallback } from 'react';
import {
    UserPlus, Upload, FileText, ChevronRight, Users, Play, DownloadCloud, X,
    Download, Eye, CheckCircle, AlertCircle, FileSpreadsheet, ArrowLeft,
    Loader2, Trash2, Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import axios from 'axios';
import OnboardingWizard from '../../components/admin/onboarding/OnboardingWizard';

// ─── Bulk Import Modal ────────────────────────────────────────────────────────
const BulkImportModal = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef();
    const [phase, setPhase] = useState('upload');   // upload | preview | submitting | done
    const [excelFile, setExcelFile] = useState(null);
    const [parsedRows, setParsedRows] = useState([]);
    const [result, setResult] = useState(null);
    const [showColGuide, setShowColGuide] = useState(false);
    const [progress, setProgress] = useState({ processed: 0, total: 0 });


    const companyId =
        user?.company?.id || user?.company?._id ||
        (typeof user?.companyId === 'string'
            ? user.companyId
            : user?.companyId?._id || user?.companyId?.toString());

    // ── template download ──────────────────────────────────────────────────────
    const downloadTemplate = async () => {
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/api/companies/${companyId}/setup/template`,
                { withCredentials: true, responseType: 'blob' }
            );
            const url = URL.createObjectURL(res.data);
            Object.assign(document.createElement('a'), { href: url, download: 'chttrix_team_template.xlsx' }).click();
            URL.revokeObjectURL(url);
        } catch {
            showToast('Failed to download template', 'error');
        }
    };

    // ── file select & parse ───────────────────────────────────────────────────
    const handleFile = async (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            showToast('Please upload an .xlsx or .csv file', 'error'); return;
        }
        setExcelFile(file);
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(await file.arrayBuffer());
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            const data = rows.slice(1)
                .filter(r => r[2] || r[1])   // email at col 2 (new) or col 1 (old)
                .map(r => {
                    const isNewFormat = String(r[2] || '').includes('@');
                    if (isNewFormat) {
                        return {
                            name: `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
                            email: String(r[2] || '').trim().toLowerCase(),
                            phone: String(r[6] || '').trim(),
                            role: String(r[8] || 'member').trim().toLowerCase(),
                            department: String(r[9] || '').trim(),
                        };
                    }
                    return {
                        name: String(r[0] || '').trim(),
                        email: String(r[1] || '').trim().toLowerCase(),
                        phone: String(r[2] || '').trim(),
                        role: String(r[3] || 'member').trim().toLowerCase(),
                        department: String(r[4] || '').trim(),
                    };
                })
                .filter(e => e.email);
            if (!data.length) { showToast('No valid rows found in file', 'error'); return; }
            setParsedRows(data);
            setPhase('preview');
        } catch {
            showToast('Could not parse file — use the provided template', 'error');
        }
    };

    const onDrop = useCallback((e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files[0]);
    }, []);


    // ── submit via new stabilized onboarding endpoint ─────────────────────────
    const handleSubmit = async () => {
        if (!companyId) { showToast('No company ID found', 'error'); return; }
        setPhase('submitting');
        try {
            const formData = new FormData();
            formData.append('employeeFile', excelFile);

            // FIX-4: POST to new endpoint — receives { jobId } immediately (HTTP 202)
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/company/onboarding/bulk`,
                formData,
                { withCredentials: true }
            );

            const { jobId, total } = res.data;
            setProgress({ processed: 0, total });

            // Poll for job completion
            const interval = setInterval(async () => {
                try {
                    const statusRes = await axios.get(
                        `${import.meta.env.VITE_BACKEND_URL}/api/company/onboarding/status/${jobId}`,
                        { withCredentials: true }
                    );
                    const job = statusRes.data.job;
                    setProgress({ processed: job.processed, total: job.total });

                    if (job.status === 'done') {
                        clearInterval(interval);
                        setResult({
                            created: job.created,
                            skipped: job.skipped,
                            errors: job.errors || [],
                        });
                        setPhase('done');
                    }
                } catch { /* poll failures are non-fatal */ }
            }, 2000);

            // Safety: clear interval after 10 minutes
            setTimeout(() => clearInterval(interval), 10 * 60 * 1000);

        } catch (err) {
            showToast(err.response?.data?.error || 'Import failed', 'error');
            setPhase('preview');
        }
    };


    // ── role badge colour ─────────────────────────────────────────────────────
    const roleBadge = (role) => {
        const map = {
            admin: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            manager: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
            member: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
        };
        return map[role] || map.member;
    };

    return (
        <div className="bg-white dark:bg-[#1a2236] rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">

            {/* top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-teal-500" />

            {/* header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    {phase === 'preview' && (
                        <button onClick={() => { setPhase('upload'); setExcelFile(null); setParsedRows([]); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">Bulk Team Import</h3>
                        <p className="text-xs text-slate-400">
                            {phase === 'upload' && 'Upload your employee spreadsheet'}
                            {phase === 'preview' && `${parsedRows.length} employees ready to import`}
                            {phase === 'submitting' && 'Creating accounts…'}
                            {phase === 'done' && 'Import complete!'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="p-6">

                {/* ── UPLOAD PHASE ── */}
                {phase === 'upload' && (
                    <div className="space-y-4">

                        {/* Template download strip */}
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center shrink-0">
                                <FileSpreadsheet size={20} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-slate-800 dark:text-white">Step 1 — Download the Template</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Fill in: First Name, Last Name, Email, Job Title, Mobile, Role, Dept…</p>
                            </div>
                            <button onClick={downloadTemplate}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0">
                                <Download size={13} /> Download
                            </button>
                        </div>

                        {/* Column guide — collapsible via ⓘ button */}
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <button
                                onClick={() => setShowColGuide(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Info size={13} className="text-indigo-400" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Column Guide (10 columns)</p>
                                </div>
                                <span className={`text-[10px] font-semibold transition-colors ${showColGuide ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    {showColGuide ? 'Hide ▲' : 'Show ▼'}
                                </span>
                            </button>

                            {showColGuide && (
                                <div className="px-4 pb-4 pt-1 border-t border-slate-200 dark:border-slate-700">
                                    <div className="grid grid-cols-5 gap-1.5 mt-3">
                                        {[
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
                                        ].map(c => (
                                            <div key={c.col} className="text-center">
                                                <div className={`rounded-lg py-1 px-1.5 text-[10px] font-black mb-1 ${c.req ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                    {c.col}: {c.label}
                                                </div>
                                                <p className="text-[9px] text-slate-400">{c.note}</p>
                                                {c.req && <span className="text-[9px] font-bold text-red-500">Required</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drop zone */}
                        <div
                            onDrop={onDrop} onDragOver={e => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500 rounded-2xl p-8 flex flex-col items-center cursor-pointer hover:bg-green-50/40 dark:hover:bg-green-900/10 transition-all group text-center"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload size={24} className="text-green-600 dark:text-green-400" />
                            </div>
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                                Step 2 — Upload Filled Template
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Drag & drop or click to browse · .xlsx, .xls, .csv</p>
                        </div>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                            onChange={e => handleFile(e.target.files[0])} />

                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <AlertCircle size={13} className="text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Each employee will receive a welcome email with a temporary password.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── PREVIEW PHASE ── */}
                {phase === 'preview' && (
                    <div className="space-y-4">
                        {/* file info */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <FileSpreadsheet size={18} className="text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs text-slate-700 dark:text-white truncate">{excelFile?.name}</p>
                                <p className="text-[11px] text-slate-400">{parsedRows.length} valid records found</p>
                            </div>
                            <button onClick={() => { setPhase('upload'); setExcelFile(null); setParsedRows([]); }}
                                className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                                <Trash2 size={13} />
                            </button>
                        </div>

                        {/* table preview */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <Eye size={12} className="text-slate-400" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Preview — {parsedRows.length > 10 ? `showing first 10 of ${parsedRows.length}` : `${parsedRows.length} rows`}
                                </p>
                            </div>
                            <div className="overflow-x-auto max-h-56 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-white dark:bg-slate-900 sticky top-0 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            {['#', 'Name', 'Email', 'Phone', 'Role', 'Department'].map(h => (
                                                <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {parsedRows.slice(0, 10).map((emp, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                                <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{emp.name || '—'}</td>
                                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{emp.email}</td>
                                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{emp.phone || '—'}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${roleBadge(emp.role)}`}>
                                                        {emp.role}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{emp.department || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {parsedRows.length > 10 && (
                            <p className="text-center text-xs text-slate-400">… and {parsedRows.length - 10} more rows not shown</p>
                        )}

                        <div className="flex gap-3 pt-1">
                            <button onClick={() => { setPhase('upload'); setExcelFile(null); setParsedRows([]); }}
                                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Change File
                            </button>
                            <button onClick={handleSubmit}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2">
                                <Users size={16} /> Import {parsedRows.length} Employees
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'submitting' && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-4">
                            <Loader2 size={28} className="text-green-600 animate-spin" />
                        </div>
                        <p className="font-bold text-slate-800 dark:text-white mb-1">Creating Accounts…</p>
                        <p className="text-sm text-slate-400">
                            {progress.total > 0
                                ? `${progress.processed} / ${progress.total} processed`
                                : 'Sending invite emails'}
                        </p>
                        {progress.total > 0 && (
                            <div className="w-64 h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}


                {/* ── DONE ── */}
                {phase === 'done' && result && (
                    <div className="flex flex-col items-center text-center py-6 space-y-5">
                        <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center border border-green-200 dark:border-green-800">
                            <CheckCircle size={36} className="text-green-600" />
                        </div>
                        <div>
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white">Import Complete!</h4>
                            <p className="text-sm text-slate-400 mt-1">Employees can now log in with their temporary passwords.</p>
                        </div>

                        <div className="w-full max-w-xs grid grid-cols-3 gap-3">
                            {[
                                { val: result.created ?? 0, label: 'Created', color: 'text-green-600 dark:text-green-400' },
                                { val: result.skipped ?? 0, label: 'Skipped', color: 'text-amber-600 dark:text-amber-400' },
                                { val: result.errors?.length ?? 0, label: 'Errors', color: 'text-red-600 dark:text-red-400' },
                            ].map(item => (
                                <div key={item.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                                    <p className={`text-2xl font-black ${item.color}`}>{item.val}</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {result.errors?.length > 0 && (
                            <div className="w-full p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-left">
                                <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">Failed imports:</p>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {result.errors.map((e, i) => (
                                        <p key={i} className="text-xs text-red-600 dark:text-red-400">• {e.email} — {e.error}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={onClose}
                            className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const OnboardingPage = () => {
    const [mode, setMode] = useState(null); // 'individual' | 'bulk'

    return (
        <div className="flex-1 h-full overflow-hidden flex flex-col bg-white dark:bg-[#0f172a] transition-colors duration-200 relative">

            {/* Overlay */}
            {mode && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fadeIn">

                    {/* Individual */}
                    {mode === 'individual' && (
                        <div className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                            <OnboardingWizard onComplete={() => setMode(null)} />
                        </div>
                    )}

                    {/* Bulk */}
                    {mode === 'bulk' && (
                        <BulkImportModal onClose={() => setMode(null)} />
                    )}
                </div>
            )}

            {/* Main content */}
            <div className={`flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-8
                ${mode ? 'blur-sm grayscale-[0.5] opacity-40 scale-[0.98]' : 'scale-100'}
                transition-all duration-500 ease-out origin-center`}>
                <div className="max-w-4xl w-full">

                    {/* Header */}
                    <div className="mb-12 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-6 tracking-wide uppercase">
                            <Users size={12} /> Team Growth
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                            Grow Your Team
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-base leading-relaxed">
                            Select a method to onboard new employees to your workspace.
                        </p>
                    </div>

                    {/* Cards */}
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* Individual */}
                        <button onClick={() => setMode('individual')}
                            className="group relative p-6 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 text-left overflow-hidden flex flex-col h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-1 ring-indigo-100 dark:ring-indigo-500/20">
                                    <UserPlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    Individual Setup
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                    Launch the wizard for a single employee. Configure roles, access details, and workspace assignments manually.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                    Start Setup <Play size={10} fill="currentColor" />
                                </span>
                            </div>
                        </button>

                        {/* Bulk */}
                        <button onClick={() => setMode('bulk')}
                            className="group relative p-6 bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-green-500 dark:hover:border-green-500 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300 text-left overflow-hidden flex flex-col h-full">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-1 ring-green-100 dark:ring-green-500/20">
                                    <Upload className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                    Bulk Import
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                    Upload an Excel file to onboard multiple employees at once. Accounts are created automatically with welcome emails sent.
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                    Import Now <DownloadCloud size={12} />
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                    .xlsx · .csv
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
