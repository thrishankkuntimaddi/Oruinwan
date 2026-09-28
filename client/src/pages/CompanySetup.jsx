import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRevokeObjectUrl } from '../hooks/useRevokeObjectUrl';
import api from '@services/api';
import {
    Users, Mail, CheckCircle2, ArrowRight, ArrowLeft, Upload, Plus, X, Rocket, Download,
    FileSpreadsheet, Image, Trash2, Info, Target, Sun, Moon, Loader2,
} from 'lucide-react';
import '../styles/gloss.css';
import '../components/company-dash/dash.css';
import './admin/platform/platform.css';

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
    { id: 1, title: 'Identity', desc: 'Name, timezone, logo', icon: Target },
    { id: 2, title: 'Structure', desc: 'Departments', icon: Users },
    { id: 3, title: 'People', desc: 'Team invites', icon: Mail },
    { id: 4, title: 'Launch', desc: 'Review and go', icon: Rocket },
];
const blankInvite = () => ({ name: '', email: '', phone: '', role: 'member', department: '' });

/** Four-step company setup after verification (/company/setup). */
const CompanySetup = () => {
    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const { resolvedTheme, toggleTheme } = useTheme() || {};
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [displayName, setDisplayName] = useState(user?.company?.name || user?.companyName || '');
    const [timezone, setTimezone] = useState(() => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return TIMEZONES.some((t) => t.value === tz) ? tz : 'UTC';
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    useRevokeObjectUrl(logoPreview);
    const logoInputRef = useRef();

    const [departments, setDepartments] = useState(['Engineering', 'Sales', 'Marketing', 'HR']);
    const [newDeptInput, setNewDeptInput] = useState('');

    const [excelFile, setExcelFile] = useState(null);
    const [parsedEmployees, setParsedEmployees] = useState(null);
    const [manualInvites, setManualInvites] = useState([blankInvite()]);
    const excelInputRef = useRef();

    const [launchSummary, setLaunchSummary] = useState(null);

    const companyId = user?.company?.id || user?.company?._id
        || (typeof user?.companyId === 'string' ? user.companyId : user?.companyId?._id || user?.companyId?.toString());

    const handleLogoSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please upload an image file', 'error'); return; }
        if (file.size > 2 * 1024 * 1024) { showToast('Logo must be under 2 MB', 'error'); return; }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };
    const handleLogoDrop = (e) => { e.preventDefault(); handleLogoSelect(e.dataTransfer.files[0]); };

    const addDept = (name) => {
        const t = name.trim();
        if (!t || departments.some((d) => d.toLowerCase() === t.toLowerCase())) return;
        setDepartments((p) => [...p, t]);
    };
    const removeDept = (i) => departments.length > 1 && setDepartments((p) => p.filter((_, idx) => idx !== i));

    const handleExcelSelect = async (file) => {
        if (!file) return;
        setExcelFile(file);
        try {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            // Template columns: First, Last, Email, Personal email, Job title, Join date, Mobile, Corp ID, Role, Department.
            const data = rows.slice(1)
                .filter((r) => r[2] && String(r[2]).includes('@'))
                .map((r) => ({
                    name: `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
                    email: String(r[2] || '').trim().toLowerCase(),
                    personalEmail: String(r[3] || '').trim().toLowerCase(),
                    jobTitle: String(r[4] || '').trim(),
                    joiningDate: String(r[5] || '').trim(),
                    phone: String(r[6] || '').trim(),
                    corporateId: String(r[7] || '').trim(),
                    role: String(r[8] || 'member').trim().toLowerCase(),
                    department: String(r[9] || '').trim(),
                }));
            setParsedEmployees(data);
            showToast(`Read ${data.length} people from the file`, 'success');
        } catch {
            setParsedEmployees(null);
            showToast('Could not read that file. Use the template.', 'error');
        }
    };

    const downloadTemplate = async () => {
        try {
            const res = await api.get(`/api/companies/${companyId}/setup/template`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = 'oruinwan_team_template.xlsx'; a.click();
            URL.revokeObjectURL(url);
        } catch { showToast('Could not download the template', 'error'); }
    };

    const updateInvite = (i, field, val) => setManualInvites((p) => { const c = [...p]; c[i] = { ...c[i], [field]: val }; return c; });
    const removeInvite = (i) => manualInvites.length > 1 && setManualInvites((p) => p.filter((_, idx) => idx !== i));

    const handleNext = async () => {
        if (!companyId) { setError('Your account is not linked to a company.'); return; }
        if (step === 1 && !displayName.trim()) { setError('Enter the company name.'); return; }
        setIsLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('step', step);
            if (step === 1) {
                formData.append('data', JSON.stringify({ displayName: displayName.trim(), timezone }));
                if (logoFile) formData.append('logo', logoFile);
            } else if (step === 2) {
                formData.append('data', JSON.stringify({ departments }));
            } else if (step === 3) {
                if (excelFile) formData.append('employeeFile', excelFile);
                else formData.append('data', JSON.stringify({ invites: manualInvites.filter((i) => i.email.trim()) }));
            } else {
                formData.append('data', JSON.stringify({}));
            }

            const res = await api.put(`/api/companies/${companyId}/setup`, formData);

            if (step === 3) {
                const r = res.data?.results || {};
                setLaunchSummary({ invites: r.created || 0, skipped: r.skipped || 0, errors: Array.isArray(r.errors) ? r.errors.length : 0 });
            }
            if (step < 4) {
                setStep(step + 1);
            } else {
                await refreshUser?.();
                navigate(res.data?.redirectTo || '/owner/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pf-flow gl-ambient">
            {toggleTheme && (
                <button type="button" className="gl-icon-btn pf-flow-theme" onClick={() => toggleTheme()} aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
                    {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
            )}
            <div className="gl-card pf-flow-card">
                <aside className="pf-flow-aside">
                    <div className="pf-flow-brand"><img src="/icons/oruinwan-128.png" alt="" /> Oruinwan</div>
                    <ol className="pf-steps" aria-label="Setup steps" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {STEPS.map((s) => {
                            const state = step === s.id ? 'active' : step > s.id ? 'done' : 'todo';
                            return (
                                <li key={s.id} className="pf-step" data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
                                    <span className="pf-step-mark">{state === 'done' ? <CheckCircle2 size={14} /> : <s.icon size={14} />}</span>
                                    <span>
                                        <span className="pf-step-title" style={{ display: 'block' }}>{s.title}</span>
                                        <span className="pf-step-desc">{s.desc}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                    <div className="pf-flow-hide-sm">
                        <div className="cd-hint" style={{ marginBottom: 6 }}>Step {step} of 4</div>
                        <div className="pf-progress"><span style={{ width: `${(step / 4) * 100}%` }} /></div>
                    </div>
                </aside>

                <div className="pf-flow-main">
                    <div className="pf-flow-body">
                        {step === 1 && (
                            <>
                                <div>
                                    <div className="gl-eyebrow">Step 1 · Identity</div>
                                    <h1 className="gl-display pf-flow-title">Company profile</h1>
                                    <p className="pf-flow-lead">How your company appears to everyone in Oruinwan.</p>
                                </div>
                                <div className="cd-field">
                                    <label htmlFor="pf-setup-name">Company name</label>
                                    <input id="pf-setup-name" className="gl-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Acme Corp" autoFocus />
                                </div>
                                <div className="cd-field">
                                    <label htmlFor="pf-setup-tz">Timezone</label>
                                    <select id="pf-setup-tz" className="gl-input cd-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                                        {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                    </select>
                                </div>
                                <div className="cd-field">
                                    <span className="cd-label">Logo (optional)</span>
                                    {logoPreview ? (
                                        <div className="gl-card pf-file">
                                            <img src={logoPreview} alt="Logo preview" />
                                            <div className="cd-grow" style={{ flex: 1, minWidth: 0 }}>
                                                <div className="cd-cell-title">{logoFile?.name}</div>
                                                <div className="cd-cell-sub">{((logoFile?.size || 0) / 1024).toFixed(1)} KB</div>
                                            </div>
                                            <button type="button" className="gl-icon-btn" aria-label="Remove logo" onClick={() => { setLogoFile(null); setLogoPreview(null); }}><Trash2 size={15} /></button>
                                        </div>
                                    ) : (
                                        <button type="button" className="pf-drop" onDrop={handleLogoDrop} onDragOver={(e) => e.preventDefault()} onClick={() => logoInputRef.current?.click()}>
                                            <Image size={20} />
                                            <strong style={{ fontSize: 13 }}>Click or drop an image</strong>
                                            <span style={{ fontSize: 11.5 }}>SVG, PNG or JPG — up to 2 MB</span>
                                        </button>
                                    )}
                                    <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={(e) => handleLogoSelect(e.target.files[0])} />
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div>
                                    <div className="gl-eyebrow">Step 2 · Structure</div>
                                    <h1 className="gl-display pf-flow-title">Departments</h1>
                                    <p className="pf-flow-lead">Group people into departments. You can change these later.</p>
                                </div>
                                {PRESET_DEPTS.some((p) => !departments.includes(p)) && (
                                    <div className="cd-field">
                                        <span className="cd-label">Quick add</span>
                                        <div className="pf-pills">
                                            {PRESET_DEPTS.filter((p) => !departments.includes(p)).map((p) => (
                                                <button key={p} type="button" className="pf-pill" onClick={() => addDept(p)}>+ {p}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="gl-card cd-list">
                                    {departments.map((d, i) => (
                                        <div className="cd-list-row" key={d}>
                                            <Users size={14} style={{ color: 'var(--accent)' }} />
                                            <span className="cd-grow" style={{ fontWeight: 600, fontSize: 13 }}>{d}</span>
                                            <button type="button" className="gl-icon-btn" aria-label={`Remove ${d}`} disabled={departments.length === 1} onClick={() => removeDept(i)}><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <form className="cd-toolbar" onSubmit={(e) => { e.preventDefault(); addDept(newDeptInput); setNewDeptInput(''); }}>
                                    <input className="gl-input" style={{ flex: 1, minWidth: 0 }} value={newDeptInput} onChange={(e) => setNewDeptInput(e.target.value)} placeholder="Another department" aria-label="New department name" />
                                    <button type="submit" className="gl-btn" disabled={!newDeptInput.trim()}><Plus size={13} /> Add</button>
                                </form>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <div>
                                    <div className="gl-eyebrow">Step 3 · People</div>
                                    <h1 className="gl-display pf-flow-title">Invite your team</h1>
                                    <p className="pf-flow-lead">Upload the spreadsheet template or add people one by one. You can skip this and invite people later.</p>
                                </div>
                                <div className="gl-card pf-banner">
                                    <FileSpreadsheet size={18} style={{ color: 'var(--accent)' }} />
                                    <div className="pf-grow">
                                        <div className="pf-banner-title">Employee template</div>
                                        <div className="pf-banner-sub">Name, work email, mobile, role, department</div>
                                    </div>
                                    <button type="button" className="gl-btn gl-btn--sm" onClick={downloadTemplate}><Download size={13} /> Download</button>
                                </div>
                                <div className="cd-field">
                                    <span className="cd-label">Bulk upload (Excel / CSV)</span>
                                    {excelFile ? (
                                        <>
                                            <div className="gl-card pf-file">
                                                <FileSpreadsheet size={18} style={{ color: 'var(--state-success)' }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div className="cd-cell-title">{excelFile.name}</div>
                                                    <div className="cd-cell-sub">{parsedEmployees?.length || 0} people</div>
                                                </div>
                                                <button type="button" className="gl-icon-btn" aria-label="Remove file" onClick={() => { setExcelFile(null); setParsedEmployees(null); }}><X size={14} /></button>
                                            </div>
                                            {parsedEmployees?.length > 0 && (
                                                <div className="gl-card cd-table-wrap" style={{ '--cd-table-max': '200px' }}>
                                                    <table className="cd-table">
                                                        <thead><tr>{['Name', 'Work email', 'Role', 'Department'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                                                        <tbody>
                                                            {parsedEmployees.slice(0, 20).map((emp) => (
                                                                <tr key={emp.email}>
                                                                    <td>{emp.name || '—'}</td>
                                                                    <td className="cd-muted">{emp.email}</td>
                                                                    <td><span className="cd-chip" data-tone={emp.role === 'admin' ? 'accent' : emp.role === 'manager' ? 'success' : undefined}>{emp.role}</span></td>
                                                                    <td className="cd-muted">{emp.department || '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <button type="button" className="pf-drop" onClick={() => excelInputRef.current?.click()}>
                                            <Upload size={20} />
                                            <strong style={{ fontSize: 13 }}>Choose an .xlsx or .csv file</strong>
                                            <span style={{ fontSize: 11.5 }}>Based on the template above</span>
                                        </button>
                                    )}
                                    <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleExcelSelect(e.target.files[0])} />
                                </div>
                                {!excelFile && (
                                    <>
                                        <div className="gl-section-label" style={{ padding: 0 }}>Or add people</div>
                                        {manualInvites.map((inv, i) => (
                                            <div key={i} className="gl-card pf-invite">
                                                {manualInvites.length > 1 && (
                                                    <button type="button" className="gl-icon-btn pf-invite-remove" aria-label="Remove person" onClick={() => removeInvite(i)}><X size={13} /></button>
                                                )}
                                                <div className="pf-row" style={{ paddingRight: manualInvites.length > 1 ? 30 : 0 }}>
                                                    <input className="gl-input" value={inv.name} onChange={(e) => updateInvite(i, 'name', e.target.value)} placeholder="Full name" aria-label="Full name" />
                                                    <input className="gl-input" type="email" value={inv.email} onChange={(e) => updateInvite(i, 'email', e.target.value)} placeholder="Work email" aria-label="Work email" />
                                                </div>
                                                <div className="pf-row" style={{ '--pf-cols': 3 }}>
                                                    <input className="gl-input" type="tel" value={inv.phone} onChange={(e) => updateInvite(i, 'phone', e.target.value)} placeholder="Phone (optional)" aria-label="Phone" />
                                                    <select className="gl-input cd-select" value={inv.role} onChange={(e) => updateInvite(i, 'role', e.target.value)} aria-label="Role">
                                                        {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                                    </select>
                                                    <select className="gl-input cd-select" value={inv.department} onChange={(e) => updateInvite(i, 'department', e.target.value)} aria-label="Department">
                                                        <option value="">No department</option>
                                                        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" className="gl-btn" onClick={() => setManualInvites((p) => [...p, blankInvite()])}><Plus size={13} /> Add another person</button>
                                        <div className="gl-card pf-banner" style={{ alignItems: 'flex-start' }}>
                                            <Info size={15} className="cd-muted" />
                                            <div className="pf-grow pf-banner-sub" style={{ marginTop: 0 }}>Each person gets an email with a temporary password and changes it on first sign-in.</div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {step === 4 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, paddingTop: 12 }}>
                                <span className="pf-done-mark"><CheckCircle2 size={30} /></span>
                                <div>
                                    <div className="gl-eyebrow" style={{ justifyContent: 'center' }}>Step 4 · Launch</div>
                                    <h1 className="gl-display pf-flow-title">Ready to <span className="gl-sheen">launch</span></h1>
                                    <p className="pf-flow-lead" style={{ margin: '6px auto 0' }}>Launching creates your departments and opens the owner dashboard.</p>
                                </div>
                                <div className="gl-card cd-list pf-summary">
                                    <div className="cd-list-row"><span className="cd-muted">Company name</span><strong>{displayName || '—'}</strong></div>
                                    <div className="cd-list-row"><span className="cd-muted">Timezone</span><strong>{timezone}</strong></div>
                                    <div className="cd-list-row"><span className="cd-muted">Departments</span><strong>{departments.length}</strong></div>
                                    <div className="cd-list-row"><span className="cd-muted">Invites sent</span><strong>{launchSummary ? launchSummary.invites : 0}</strong></div>
                                    {launchSummary?.skipped > 0 && <div className="cd-list-row"><span className="cd-muted">Skipped (already members)</span><strong>{launchSummary.skipped}</strong></div>}
                                    {launchSummary?.errors > 0 && <div className="cd-list-row"><span className="cd-muted">Could not invite</span><strong style={{ color: 'var(--state-danger)' }}>{launchSummary.errors}</strong></div>}
                                </div>
                            </div>
                        )}
                        {error && <div className="cd-error-text" role="alert">{error}</div>}
                    </div>

                    <div className="pf-flow-foot">
                        <div>
                            {step > 1 && step < 4 && (
                                <button type="button" className="gl-btn gl-btn--ghost" onClick={() => { setError(''); setStep((s) => s - 1); }} disabled={isLoading}>
                                    <ArrowLeft size={14} /> Back
                                </button>
                            )}
                        </div>
                        <button type="button" className="gl-btn gl-btn--primary gl-btn--lg" onClick={handleNext} disabled={isLoading}>
                            {isLoading && <Loader2 size={15} className="cd-spin" />}
                            {step === 4 ? <>Launch workspace <Rocket size={15} /></> : step === 3 && !excelFile && !manualInvites.some((i) => i.email.trim()) ? <>Skip for now <ArrowRight size={15} /></> : <>Continue <ArrowRight size={15} /></>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanySetup;
