import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import axios from 'axios';
import {
    Users, Mail, CheckCircle, ArrowRight, ArrowLeft, Upload,
    Clock, Plus, X, Sparkles, Target, Zap, Download,
    FileSpreadsheet, Image, Trash2, Eye, AlertCircle
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── main component ───────────────────────────────────────────────────────────
const CompanySetup = () => {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Step 1 state
    const [displayName, setDisplayName] = useState(user?.company?.name || '');
    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const logoInputRef = useRef();

    // Step 2 state
    const [departments, setDepartments] = useState(['Engineering', 'Sales', 'Marketing', 'HR']);
    const [newDeptInput, setNewDeptInput] = useState('');

    // Step 3 state
    const [excelFile, setExcelFile] = useState(null);
    const [parsedEmployees, setParsedEmployees] = useState(null); // rows from parsed excel
    const [manualInvites, setManualInvites] = useState([{ name: '', email: '', phone: '', role: 'member', department: '' }]);
    const excelInputRef = useRef();

    // Step 4 state
    const [launchSummary, setLaunchSummary] = useState(null);

    const companyId = user?.company?.id || user?.company?._id
        || (typeof user?.companyId === 'string' ? user.companyId : user?.companyId?._id || user?.companyId?.toString());
    const totalSteps = 4;

    const STEPS = [
        { id: 1, title: 'Identity', desc: 'Brand & Regional', icon: Target },
        { id: 2, title: 'Structure', desc: 'Departments', icon: Users },
        { id: 3, title: 'People', desc: 'Team Invites', icon: Mail },
        { id: 4, title: 'Launch', desc: 'Ready to go', icon: Zap },
    ];

    // ── Logo handlers ──────────────────────────────────────────────────────────
    const handleLogoSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please upload an image file', 'error'); return; }
        if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2MB', 'error'); return; }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleLogoDrop = useCallback((e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        handleLogoSelect(file);
    }, []);

    // ── Department handlers ────────────────────────────────────────────────────
    const addDept = (name) => {
        const trimmed = name.trim();
        if (!trimmed || departments.includes(trimmed)) return;
        setDepartments(prev => [...prev, trimmed]);
    };

    const removeDept = (idx) => {
        if (departments.length <= 1) return;
        setDepartments(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Excel handlers ─────────────────────────────────────────────────────────
    const handleExcelSelect = async (file) => {
        if (!file) return;
        setExcelFile(file);
        // Client-side parse preview using SheetJS (lazy load)
        try {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const dataRows = rows.slice(1).filter(r => r[1]).map(r => ({
                name: String(r[0] || '').trim(),
                email: String(r[1] || '').trim(),
                phone: String(r[2] || '').trim(),
                role: String(r[3] || 'member').trim().toLowerCase(),
                department: String(r[4] || '').trim()
            }));
            setParsedEmployees(dataRows);
            showToast(`Parsed ${dataRows.length} employee records`, 'success');
        } catch (err) {
            showToast('Could not parse file. Make sure it matches the template.', 'error');
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
            a.href = url;
            a.download = 'chttrix_team_template.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            showToast('Failed to download template', 'error');
        }
    };

    // ── Manual invite handlers ─────────────────────────────────────────────────
    const updateInvite = (idx, field, val) => {
        setManualInvites(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: val };
            return copy;
        });
    };

    const removeInvite = (idx) => {
        if (manualInvites.length <= 1) return;
        setManualInvites(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Next step handler ──────────────────────────────────────────────────────
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
                    const validInvites = manualInvites.filter(i => i.email);
                    formData.append('data', JSON.stringify({ invites: validInvites }));
                }
            } else if (step === 4) {
                formData.append('data', JSON.stringify({}));
            }

            const res = await axios.put(
                `${import.meta.env.VITE_BACKEND_URL}/api/companies/${companyId}/setup`,
                formData,
                {
                    withCredentials: true,
                    headers: step === 1 ? {} : { 'Content-Type': 'application/json' }
                }
            );

            if (step === 3) {
                const r = res.data.results || {};
                setLaunchSummary({ departments: departments.length, invites: r.created || 0 });
            }

            if (step < totalSteps) {
                setStep(step + 1);
            } else {
                // step 4 submitted — navigate to dashboard
                await refreshUser();
                navigate(res.data.redirectTo || '/admin/analytics');
            }
        } catch (err) {
            console.error('Setup error:', err);
            showToast(err.response?.data?.message || 'Something went wrong', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => setStep(s => Math.max(1, s - 1));

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-[#0a0d14] flex items-center justify-center p-4 relative overflow-hidden font-sans">
            <style>{`
                @keyframes fadeSlide { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
                .fade-slide { animation: fadeSlide 0.35s ease forwards; }
                .glass-input {
                    background: rgba(255,255,255,0.6);
                    backdrop-filter: blur(8px);
                    border: 1.5px solid rgba(226,232,240,0.8);
                    transition: all 0.25s ease;
                }
                .glass-input:focus {
                    background: white;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 4px rgba(99,102,241,0.12);
                    outline: none;
                }
            `}</style>

            {/* Ambient blobs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-indigo-200/25 via-purple-200/20 to-transparent blur-[120px]" />
                <div className="absolute top-[30%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-bl from-blue-200/20 via-teal-100/20 to-transparent blur-[100px]" />
            </div>

            {/* ── Main card ── */}
            <div className="relative z-10 w-full max-w-6xl h-[88vh] bg-white/75 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_24px_80px_-10px_rgba(0,0,0,0.08)] border border-white/70 dark:border-white/10 flex overflow-hidden">

                {/* ── Sidebar ── */}
                <div className="w-72 shrink-0 bg-slate-900 dark:bg-black text-white p-8 flex flex-col justify-between relative overflow-hidden hidden md:flex">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
                    <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Logo */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-12">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Sparkles size={18} className="text-white fill-white/20" />
                            </div>
                            <span className="font-bold text-xl text-white">Chttrix</span>
                        </div>

                        {/* Steps */}
                        <div className="space-y-6">
                            {STEPS.map(s => {
                                const isActive = step === s.id;
                                const isDone = step > s.id;
                                return (
                                    <div key={s.id} className={`flex items-start gap-4 transition-all duration-400 ${isActive ? 'opacity-100 translate-x-1' : 'opacity-40 hover:opacity-60'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                                            ${isActive ? 'bg-white text-indigo-600 shadow-xl scale-110' : isDone ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40' : 'bg-slate-800 text-slate-500'}`}>
                                            {isDone ? <CheckCircle size={18} /> : <s.icon size={18} />}
                                        </div>
                                        <div className="pt-1.5">
                                            <p className={`font-bold text-sm leading-none mb-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>{s.title}</p>
                                            <p className="text-xs text-slate-500">{s.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="relative z-10 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            <Clock size={13} className="text-slate-400" />
                            <p className="text-xs text-slate-400">Step {step} of {totalSteps}</p>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(step / totalSteps) * 100}%` }} />
                        </div>
                    </div>
                </div>

                {/* ── Right content ── */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white/30 dark:bg-transparent">
                    {/* Scrollable form area */}
                    <div className="flex-1 overflow-y-auto px-8 md:px-14 py-10">
                        <div className="max-w-2xl mx-auto">

                            {/* ── STEP 1: IDENTITY ── */}
                            {step === 1 && (
                                <div className="fade-slide space-y-8">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Company Profile</h1>
                                        <p className="text-slate-500 dark:text-slate-400">Let's personalise your workspace identity.</p>
                                    </div>

                                    {/* Company Name */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={e => setDisplayName(e.target.value)}
                                            className="w-full px-5 py-4 glass-input rounded-2xl text-xl font-bold text-slate-800 placeholder:text-slate-300"
                                            placeholder="e.g. Acme Corp"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Timezone */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Timezone</label>
                                        <div className="relative">
                                            <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <select
                                                value={timezone}
                                                onChange={e => setTimezone(e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 glass-input rounded-2xl appearance-none font-medium text-slate-700 cursor-pointer"
                                            >
                                                {TIMEZONES.map(tz => (
                                                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                                                ))}
                                            </select>
                                            <ArrowRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Brand Logo */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Brand Logo</label>
                                        {logoPreview ? (
                                            <div className="relative flex items-center gap-5 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                                <img src={logoPreview} alt="Logo preview" className="w-20 h-20 object-contain rounded-xl border border-slate-100 shadow" />
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800 mb-0.5">{logoFile?.name}</p>
                                                    <p className="text-xs text-slate-400">{(logoFile?.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <button
                                                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                                    className="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onDrop={handleLogoDrop}
                                                onDragOver={e => e.preventDefault()}
                                                onClick={() => logoInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-10 flex flex-col items-center text-center cursor-pointer hover:bg-indigo-50/30 transition-all group"
                                            >
                                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 border border-indigo-100 flex items-center justify-center mb-4 transition-colors">
                                                    <Image size={26} className="text-indigo-500" />
                                                </div>
                                                <p className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Click or drag to upload your logo</p>
                                                <p className="text-sm text-slate-400 mt-1">SVG, PNG, JPG — max 2MB</p>
                                            </div>
                                        )}
                                        <input
                                            ref={logoInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => handleLogoSelect(e.target.files[0])}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 2: STRUCTURE ── */}
                            {step === 2 && (
                                <div className="fade-slide space-y-8">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Departments</h1>
                                        <p className="text-slate-500 dark:text-slate-400">Organize your team into departments.</p>
                                    </div>

                                    {/* Quick presets */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Add Presets</p>
                                        <div className="flex flex-wrap gap-2">
                                            {PRESET_DEPTS.filter(p => !departments.includes(p)).map(p => (
                                                <button key={p} onClick={() => addDept(p)} className="px-3 py-1.5 text-sm font-medium rounded-full border border-slate-200 bg-white hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                                    + {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Department list */}
                                    <div className="space-y-3">
                                        {departments.map((dept, idx) => (
                                            <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-100 hover:shadow-md transition-all">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                    <Users size={17} />
                                                </div>
                                                <span className="flex-1 font-bold text-slate-800">{dept}</span>
                                                <button
                                                    onClick={() => removeDept(idx)}
                                                    disabled={departments.length === 1}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${departments.length === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                                                >
                                                    <X size={17} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add input */}
                                    <div className="relative">
                                        <Plus size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={newDeptInput}
                                            onChange={e => setNewDeptInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { addDept(newDeptInput); setNewDeptInput(''); } }}
                                            placeholder="Add department and press Enter..."
                                            className="w-full pl-14 pr-5 py-4 border-2 border-dashed border-slate-300 bg-white/40 rounded-2xl focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-medium placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 3: PEOPLE ── */}
                            {step === 3 && (
                                <div className="fade-slide space-y-8">
                                    <div>
                                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Team Invites</h1>
                                        <p className="text-slate-500 dark:text-slate-400">Add your team — via Excel upload or manually.</p>
                                    </div>

                                    {/* Download Template */}
                                    <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600 border border-emerald-100">
                                                <FileSpreadsheet size={22} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800 mb-0.5">Download Employee Template</p>
                                                <p className="text-xs text-slate-500">Fill in: Name, Email, Phone, Role, Department — then upload below</p>
                                            </div>
                                            <button
                                                onClick={downloadTemplate}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                                            >
                                                <Download size={15} /> Download
                                            </button>
                                        </div>
                                    </div>

                                    {/* Excel Upload */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bulk Upload via Excel/CSV</label>
                                        {excelFile ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                                    <div className="w-11 h-11 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                                                        <FileSpreadsheet size={20} className="text-green-600" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-800 text-sm">{excelFile.name}</p>
                                                        <p className="text-xs text-slate-400">{parsedEmployees?.length || 0} employee records found</p>
                                                    </div>
                                                    <button onClick={() => { setExcelFile(null); setParsedEmployees(null); }} className="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors">
                                                        <X size={15} />
                                                    </button>
                                                </div>

                                                {/* Preview table */}
                                                {parsedEmployees && parsedEmployees.length > 0 && (
                                                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                                                            <Eye size={14} className="text-slate-400" />
                                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preview ({parsedEmployees.length} rows)</p>
                                                        </div>
                                                        <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-white border-b border-slate-100 sticky top-0">
                                                                    <tr>
                                                                        {['Name', 'Email', 'Phone', 'Role', 'Department'].map(h => (
                                                                            <th key={h} className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {parsedEmployees.slice(0, 8).map((emp, i) => (
                                                                        <tr key={i} className="hover:bg-slate-50">
                                                                            <td className="px-4 py-2.5 font-medium text-slate-700">{emp.name}</td>
                                                                            <td className="px-4 py-2.5 text-slate-500">{emp.email}</td>
                                                                            <td className="px-4 py-2.5 text-slate-500">{emp.phone || '—'}</td>
                                                                            <td className="px-4 py-2.5">
                                                                                <span className={`px-2 py-0.5 rounded-full font-bold ${emp.role === 'admin' ? 'bg-red-50 text-red-600' : emp.role === 'manager' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                                    {emp.role}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-2.5 text-slate-500">{emp.department || '—'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            {parsedEmployees.length > 8 && (
                                                                <p className="text-center text-xs text-slate-400 py-2">...and {parsedEmployees.length - 8} more</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => excelInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center text-center cursor-pointer hover:bg-indigo-50/30 transition-all group"
                                            >
                                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center mb-3">
                                                    <Upload size={24} className="text-indigo-500" />
                                                </div>
                                                <p className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Click to upload Excel / CSV</p>
                                                <p className="text-sm text-slate-400 mt-1">.xlsx or .csv — based on the template above</p>
                                            </div>
                                        )}
                                        <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleExcelSelect(e.target.files[0])} />
                                    </div>

                                    {/* Divider */}
                                    {!excelFile && (
                                        <>
                                            <div className="relative flex items-center gap-3">
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Or Add Manually</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                            </div>

                                            {/* Manual invite rows */}
                                            <div className="space-y-4">
                                                {manualInvites.map((invite, idx) => (
                                                    <div key={idx} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all relative group">
                                                        {manualInvites.length > 1 && (
                                                            <button onClick={() => removeInvite(idx)} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white shadow-md border border-slate-100 text-slate-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                                <X size={13} />
                                                            </button>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                                            <input type="text" value={invite.name} onChange={e => updateInvite(idx, 'name', e.target.value)} placeholder="Full Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm" />
                                                            <input type="email" value={invite.email} onChange={e => updateInvite(idx, 'email', e.target.value)} placeholder="Email Address" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm" />
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <input type="tel" value={invite.phone} onChange={e => updateInvite(idx, 'phone', e.target.value)} placeholder="Phone (optional)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm" />
                                                            <select value={invite.role} onChange={e => updateInvite(idx, 'role', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 text-sm font-bold text-slate-700 appearance-none cursor-pointer">
                                                                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                                            </select>
                                                            <select value={invite.department} onChange={e => updateInvite(idx, 'department', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 text-sm font-bold text-slate-700 appearance-none cursor-pointer">
                                                                <option value="">Select Dept</option>
                                                                {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => setManualInvites(prev => [...prev, { name: '', email: '', phone: '', role: 'member', department: '' }])}
                                                className="w-full py-3.5 bg-white/50 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-2xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center gap-2 group"
                                            >
                                                <Plus size={16} />
                                                Add Another Person
                                            </button>

                                            <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <AlertCircle size={15} className="text-amber-500 shrink-0" />
                                                <p className="text-xs text-amber-700">Each person will receive an email with a temporary password and must change it on first login.</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 4: LAUNCH ── */}
                            {step === 4 && (
                                <div className="fade-slide text-center py-8">
                                    {/* Success animation */}
                                    <div className="relative w-32 h-32 mx-auto mb-10">
                                        <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-20" />
                                        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center shadow-xl border border-white">
                                            <CheckCircle size={52} className="text-emerald-500" />
                                        </div>
                                    </div>

                                    <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Configuration Complete!</h2>
                                    <p className="text-slate-500 dark:text-slate-400 mb-12 max-w-md mx-auto">
                                        Your workspace is configured and ready. Click Launch to enter your dashboard.
                                    </p>

                                    {/* Summary card */}
                                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 max-w-md mx-auto text-left relative overflow-hidden mb-6">
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-6">
                                            <Sparkles size={12} className="text-indigo-500" /> Summary
                                        </h4>
                                        <ul className="space-y-4">
                                            {[
                                                { label: 'Company Profile', val: 'Configured ✓' },
                                                { label: 'Departments Created', val: departments.length },
                                                { label: 'Team Invites Sent', val: launchSummary?.invites ?? manualInvites.filter(i => i.email).length },
                                            ].map((item, i) => (
                                                <li key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                                    <span className="text-slate-500 font-medium text-sm">{item.label}</span>
                                                    <span className="font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-full text-sm">{item.val}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Footer Controls ── */}
                    <div className="shrink-0 px-8 md:px-14 py-6 border-t border-white/50 dark:border-white/10 flex items-center justify-between bg-white/40 dark:bg-transparent backdrop-blur-md">
                        <div>
                            {step > 1 && step < 4 && (
                                <button
                                    onClick={handleBack}
                                    className="group flex items-center gap-2 px-5 py-3 text-slate-500 hover:text-slate-900 font-bold rounded-xl hover:bg-white/60 transition-all"
                                >
                                    <ArrowLeft size={17} className="group-hover:-translate-x-1 transition-transform" /> Back
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={isLoading}
                            className={`relative px-10 py-4 font-bold rounded-2xl text-white shadow-xl flex items-center gap-3 overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98]
                                ${step === 4
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-200'
                                    : 'bg-slate-900 shadow-slate-200'
                                }`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            <span className="relative z-10 flex items-center gap-3">
                                {isLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {step === 4 ? '🚀 Launch Workspace' : 'Continue'}
                                        {step !== 4 && <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />}
                                    </>
                                )}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <p className="fixed bottom-4 text-slate-400 text-xs font-medium opacity-50">© 2026 Chttrix Inc.</p>
        </div>
    );
};

export default CompanySetup;
