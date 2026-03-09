import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import axios from 'axios';
import {
    Users, Mail, CheckCircle, ArrowRight, ArrowLeft, Upload,
    Clock, Plus, X, Zap, Download, FileSpreadsheet, Image,
    Trash2, Eye, AlertCircle, Target
} from 'lucide-react';

// ─── constants ─────────────────────────────────────────────────────────────
const TIMEZONES = [
    { value: 'UTC', label: 'UTC — Universal Time' },
    { value: 'America/New_York', label: 'Eastern Time (US)' },
    { value: 'America/Chicago', label: 'Central Time (US)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India Standard Time' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Tokyo', label: 'Japan (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

const PRESET_DEPTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Design', 'Legal'];
const ROLES = ['member', 'manager', 'admin'];

const STEPS = [
    { id: 1, title: 'Identity', desc: 'Brand & Regional', icon: Target },
    { id: 2, title: 'Structure', desc: 'Departments', icon: Users },
    { id: 3, title: 'People', desc: 'Team Invites', icon: Mail },
    { id: 4, title: 'Launch', desc: 'Ready to go', icon: Zap },
];

// ─── input helper ───────────────────────────────────────────────────────────
const inp = 'w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all outline-none ' +
    'bg-white dark:bg-slate-800 ' +
    'border-slate-200 dark:border-slate-700 ' +
    'text-slate-800 dark:text-slate-100 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20';

// ─── component ──────────────────────────────────────────────────────────────
const CompanySetup = () => {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Step 1
    const [displayName, setDisplayName] = useState(user?.company?.name || user?.companyName || '');
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const logoInputRef = useRef();

    // Step 2
    const [departments, setDepartments] = useState(['Engineering', 'Sales', 'Marketing', 'HR']);
    const [newDeptInput, setNewDeptInput] = useState('');

    // Step 3
    const [excelFile, setExcelFile] = useState(null);
    const [parsedEmployees, setParsedEmployees] = useState(null);
    const [manualInvites, setManualInvites] = useState([{ name: '', email: '', phone: '', role: 'member', department: '' }]);
    const excelInputRef = useRef();

    // Step 4
    const [launchSummary, setLaunchSummary] = useState(null);

    const companyId = user?.company?.id || user?.company?._id
        || (typeof user?.companyId === 'string' ? user.companyId : user?.companyId?._id || user?.companyId?.toString());

    // ── logo ─────────────────────────────────────────────────────────────────
    const handleLogoSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please upload an image file', 'error'); return; }
        if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2 MB', 'error'); return; }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };
    const handleLogoDrop = useCallback((e) => {
        e.preventDefault();
        handleLogoSelect(e.dataTransfer.files[0]);
    }, []);

    // ── departments ───────────────────────────────────────────────────────────
    const addDept = (name) => {
        const t = name.trim();
        if (!t || departments.includes(t)) return;
        setDepartments(p => [...p, t]);
    };
    const removeDept = (i) => departments.length > 1 && setDepartments(p => p.filter((_, idx) => idx !== i));

    // ── excel ─────────────────────────────────────────────────────────────────
    const handleExcelSelect = async (file) => {
        if (!file) return;
        setExcelFile(file);
        try {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const data = rows.slice(1).filter(r => r[1]).map(r => ({
                name: String(r[0] || '').trim(),
                email: String(r[1] || '').trim(),
                phone: String(r[2] || '').trim(),
                role: String(r[3] || 'member').trim().toLowerCase(),
                department: String(r[4] || '').trim(),
            }));
            setParsedEmployees(data);
            showToast(`Parsed ${data.length} employee records`, 'success');
        } catch {
            showToast('Could not parse file. Use the provided template.', 'error');
        }
    };

    const downloadTemplate = async () => {
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/api/companies/${companyId}/setup/template`,
                { withCredentials: true, responseType: 'blob' }
            );
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = 'chttrix_team_template.xlsx'; a.click();
            URL.revokeObjectURL(url);
        } catch { showToast('Failed to download template', 'error'); }
    };

    // ── manual invites ────────────────────────────────────────────────────────
    const updateInvite = (i, field, val) =>
        setManualInvites(p => { const c = [...p]; c[i] = { ...c[i], [field]: val }; return c; });
    const removeInvite = (i) => manualInvites.length > 1 && setManualInvites(p => p.filter((_, idx) => idx !== i));

    // ── submit ────────────────────────────────────────────────────────────────
    const handleNext = async () => {
        if (!companyId) { showToast('No company ID found', 'error'); return; }
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('step', step);

            if (step === 1) {
                formData.append('data', JSON.stringify({ displayName, timezone }));
                if (logoFile) formData.append('logo', logoFile);
            } else if (step === 2) {
                formData.append('data', JSON.stringify({ departments }));
            } else if (step === 3) {
                if (excelFile) {
                    formData.append('employeeFile', excelFile);
                } else {
                    const valid = manualInvites.filter(i => i.email);
                    formData.append('data', JSON.stringify({ invites: valid }));
                }
            } else {
                formData.append('data', JSON.stringify({}));
            }

            const res = await axios.put(
                `${import.meta.env.VITE_BACKEND_URL}/api/companies/${companyId}/setup`,
                formData,
                { withCredentials: true }
            );

            if (step === 3) {
                const r = res.data.results || {};
                setLaunchSummary({ departments: departments.length, invites: r.created || 0 });
            }

            if (step < 4) {
                setStep(step + 1);
            } else {
                await refreshUser();
                navigate(res.data.redirectTo || '/admin/analytics');
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Something went wrong', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-screen w-full bg-slate-100 dark:bg-[#07090f] flex items-center justify-center overflow-hidden font-sans p-4">
            <style>{`
                @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
                .fade-up { animation: fadeUp 0.3s ease forwards; }
            `}</style>

            {/* ── Card ── */}
            <div className="w-full max-w-5xl h-full max-h-[92vh] rounded-3xl overflow-hidden shadow-2xl flex border border-slate-200 dark:border-slate-800">

                {/* ══ SIDEBAR ══ */}
                <div className="w-64 shrink-0 bg-[#0e1220] flex flex-col h-full">
                    <div className="p-6 flex flex-col h-full">

                        {/* Real logo + wordmark */}
                        <div className="flex items-center gap-2.5 mb-8">
                            <img
                                src="/chttrix-logo.jpg"
                                alt="Chttrix"
                                className="h-9 w-9 rounded-xl object-cover"
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                            <span className="font-black text-xl text-white tracking-tight">Chttrix</span>
                        </div>

                        {/* Step list */}
                        <div className="space-y-1 flex-1">
                            {STEPS.map(s => {
                                const active = step === s.id;
                                const done = step > s.id;
                                return (
                                    <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300
                                        ${active ? 'bg-white/10' : 'opacity-40'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                                            ${active ? 'bg-white text-indigo-700' : done ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                                            {done ? <CheckCircle size={15} /> : <s.icon size={15} />}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold leading-none mb-0.5 ${active ? 'text-white' : 'text-slate-400'}`}>{s.title}</p>
                                            <p className="text-[10px] text-slate-600">{s.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress */}
                        <div className="pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={11} className="text-slate-500" />
                                <p className="text-[10px] text-slate-500">Step {step} of 4</p>
                            </div>
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(step / 4) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══ MAIN AREA ══ */}
                <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col min-h-0">

                    {/* Scrollable form */}
                    <div className="flex-1 overflow-y-auto px-10 py-8">
                        <div className="max-w-xl mx-auto">

                            {/* ── STEP 1 ── */}
                            {step === 1 && (
                                <div className="fade-up space-y-5">
                                    <div>
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Company Profile</h1>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Personalise your workspace identity.</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                                        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                                            className={inp} placeholder="e.g. Acme Corp" autoFocus />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timezone</label>
                                        <div className="relative">
                                            <Clock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <select value={timezone} onChange={e => setTimezone(e.target.value)}
                                                className={`${inp} pl-10 appearance-none cursor-pointer`}>
                                                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brand Logo</label>
                                        {logoPreview ? (
                                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                <img src={logoPreview} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-slate-200 dark:border-slate-600" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{logoFile?.name}</p>
                                                    <p className="text-xs text-slate-400">{(logoFile?.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <button onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                                    className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div onDrop={handleLogoDrop} onDragOver={e => e.preventDefault()}
                                                onClick={() => logoInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-xl p-8 flex flex-col items-center cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                    <Image size={22} className="text-indigo-500" />
                                                </div>
                                                <p className="font-bold text-sm text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Click or drag to upload logo</p>
                                                <p className="text-xs text-slate-400 mt-1">SVG, PNG, JPG — max 2 MB</p>
                                            </div>
                                        )}
                                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                                            onChange={e => handleLogoSelect(e.target.files[0])} />
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 2 ── */}
                            {step === 2 && (
                                <div className="fade-up space-y-5">
                                    <div>
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Departments</h1>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Organise your team into departments.</p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Add</p>
                                        <div className="flex flex-wrap gap-2">
                                            {PRESET_DEPTS.filter(p => !departments.includes(p)).map(p => (
                                                <button key={p} onClick={() => addDept(p)}
                                                    className="px-3 py-1 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">
                                                    + {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {departments.map((d, i) => (
                                            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                                <Users size={15} className="text-indigo-500 shrink-0" />
                                                <span className="flex-1 text-sm font-bold text-slate-800 dark:text-white">{d}</span>
                                                <button onClick={() => removeDept(i)} disabled={departments.length === 1}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors
                                                        ${departments.length === 1 ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <Plus size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input value={newDeptInput} onChange={e => setNewDeptInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { addDept(newDeptInput); setNewDeptInput(''); } }}
                                            placeholder="Add department and press Enter..."
                                            className={`${inp} pl-10 border-dashed border-2 bg-white dark:bg-slate-900`} />
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 3 ── */}
                            {step === 3 && (
                                <div className="fade-up space-y-5">
                                    <div>
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Team Invites</h1>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Add your team via Excel upload or manually.</p>
                                    </div>

                                    {/* Template download */}
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 border border-emerald-100 dark:border-emerald-800 shrink-0">
                                            <FileSpreadsheet size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">Download Employee Template</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Fill in: Name, Email, Phone, Role, Department</p>
                                        </div>
                                        <button onClick={downloadTemplate}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0">
                                            <Download size={13} /> Download
                                        </button>
                                    </div>

                                    {/* Excel upload */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bulk Upload (Excel / CSV)</label>
                                        {excelFile ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                    <FileSpreadsheet size={18} className="text-green-600 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-xs text-slate-700 dark:text-white truncate">{excelFile.name}</p>
                                                        <p className="text-[11px] text-slate-400">{parsedEmployees?.length || 0} records</p>
                                                    </div>
                                                    <button onClick={() => { setExcelFile(null); setParsedEmployees(null); }}
                                                        className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center">
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                                {parsedEmployees?.length > 0 && (
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                                            <Eye size={12} className="text-slate-400" />
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview — {parsedEmployees.length} rows</p>
                                                        </div>
                                                        <div className="overflow-x-auto max-h-40 overflow-y-auto">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-white dark:bg-slate-900 sticky top-0">
                                                                    <tr>
                                                                        {['Name', 'Email', 'Phone', 'Role', 'Dept'].map(h => (
                                                                            <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                    {parsedEmployees.slice(0, 8).map((emp, i) => (
                                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{emp.name}</td>
                                                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{emp.email}</td>
                                                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{emp.phone || '—'}</td>
                                                                            <td className="px-3 py-2">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold
                                                                                    ${emp.role === 'admin' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                                                                        emp.role === 'manager' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                                                                            'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
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
                                                )}
                                            </div>
                                        ) : (
                                            <div onClick={() => excelInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                                                <Upload size={22} className="text-indigo-500 mb-2" />
                                                <p className="font-bold text-sm text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Click to upload Excel / CSV</p>
                                                <p className="text-xs text-slate-400 mt-1">.xlsx or .csv based on the template above</p>
                                            </div>
                                        )}
                                        <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                            onChange={e => handleExcelSelect(e.target.files[0])} />
                                    </div>

                                    {/* Manual — only when no Excel uploaded */}
                                    {!excelFile && (
                                        <>
                                            <div className="relative flex items-center gap-3">
                                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or Add Manually</span>
                                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                            </div>

                                            <div className="space-y-3">
                                                {manualInvites.map((invite, i) => (
                                                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl relative group">
                                                        {manualInvites.length > 1 && (
                                                            <button onClick={() => removeInvite(i)}
                                                                className="absolute -top-2 -right-2 w-6 h-6 bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <X size={11} />
                                                            </button>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                                            <input value={invite.name} onChange={e => updateInvite(i, 'name', e.target.value)}
                                                                placeholder="Full Name" className={inp} />
                                                            <input type="email" value={invite.email} onChange={e => updateInvite(i, 'email', e.target.value)}
                                                                placeholder="Email" className={inp} />
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <input type="tel" value={invite.phone} onChange={e => updateInvite(i, 'phone', e.target.value)}
                                                                placeholder="Phone (opt.)" className={inp} />
                                                            <select value={invite.role} onChange={e => updateInvite(i, 'role', e.target.value)} className={`${inp} cursor-pointer`}>
                                                                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                                            </select>
                                                            <select value={invite.department} onChange={e => updateInvite(i, 'department', e.target.value)} className={`${inp} cursor-pointer`}>
                                                                <option value="">Department</option>
                                                                {departments.map((d, j) => <option key={j} value={d}>{d}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <button onClick={() => setManualInvites(p => [...p, { name: '', email: '', phone: '', role: 'member', department: '' }])}
                                                className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2">
                                                <Plus size={15} /> Add Another Person
                                            </button>

                                            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-700 dark:text-amber-400">Each person will receive an email with a temporary password and must change it on first login.</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 4 ── */}
                            {step === 4 && (
                                <div className="fade-up flex flex-col items-center text-center py-6">
                                    <div className="relative w-24 h-24 mb-8">
                                        <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 animate-ping opacity-20" />
                                        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shadow-xl">
                                            <CheckCircle size={44} className="text-emerald-500" />
                                        </div>
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Configuration Complete!</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-sm">
                                        Your workspace is configured and ready. Click Launch to enter your dashboard.
                                    </p>
                                    <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 text-left relative overflow-hidden">
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Summary</p>
                                        {[
                                            { label: 'Company Profile', val: 'Configured ✓' },
                                            { label: 'Departments Created', val: departments.length },
                                            { label: 'Invites Sent', val: launchSummary?.invites ?? manualInvites.filter(i => i.email).length },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                                <span className="text-sm text-slate-500 dark:text-slate-400">{item.label}</span>
                                                <span className="font-black text-sm text-slate-900 dark:text-white">{item.val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="shrink-0 px-10 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                        <div>
                            {step > 1 && step < 4 && (
                                <button onClick={() => setStep(s => s - 1)}
                                    className="group flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                                    <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" /> Back
                                </button>
                            )}
                        </div>
                        <button onClick={handleNext} disabled={isLoading}
                            className={`px-8 py-3 font-bold rounded-xl text-white text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg relative overflow-hidden group
                                ${step === 4 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-200 dark:shadow-indigo-900' : 'bg-slate-900 dark:bg-indigo-600 shadow-slate-200 dark:shadow-indigo-900'}`}>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            {isLoading
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><span>{step === 4 ? '🚀 Launch Workspace' : 'Continue'}</span>
                                    {step !== 4 && <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />}</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanySetup;
