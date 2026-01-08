import React, { useState, useEffect } from 'react';
import {
    User, Mail, Briefcase, Calendar,
    Check, ChevronRight, Smartphone, CheckCircle2, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import { useCompany } from '../../../contexts/CompanyContext';
import { getDepartments } from '../../../services/departmentService';

const OnboardingWizard = ({ onComplete }) => {
    const { company } = useCompany();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data Loading State
    const [departments, setDepartments] = useState([]);
    const [workspacesByDept, setWorkspacesByDept] = useState({});

    // -- FORM STATE --
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        personalEmail: '',
        phone: '',
        countryCode: '+91',
        jobTitle: '',
        customJobTitle: '',
        joiningDate: new Date().toISOString().split('T')[0],
        employeeCategory: 'Full-time',
        companyEmail: '',
        role: 'member', // member, manager, admin, guest
        managedDepartments: [],
        assignedDepartments: [],
        assignedWorkspaces: [],
        hardware: [],
        checklist: true
    });

    const commonJobTitles = [
        "Software Engineer", "Product Manager", "Designer", "Sales Representative",
        "HR Specialist", "Accountant", "Marketing Manager", "Customer Support", "Custom"
    ];

    const countryCodes = [
        { code: '+91', label: '🇮🇳 +91' },
        { code: '+1', label: '🇺🇸 +1' },
        { code: '+44', label: '🇬🇧 +44' },
        { code: '+61', label: '🇦🇺 +61' },
        { code: '+81', label: '🇯🇵 +81' },
        { code: '+49', label: '🇩🇪 +49' },
    ];

    // Load data
    useEffect(() => {
        if (company?._id) {
            getDepartments(company?._id).then(res => setDepartments(res.departments || []));
        }
    }, [company?._id]);

    // Fetch workspaces when departments are selected
    useEffect(() => {
        const fetchWorkspaces = async () => {
            if (step === 2 && formData.assignedDepartments.length > 0) {
                console.log('📦 Fetching workspaces for departments:', formData.assignedDepartments);

                // Fetch workspaces for all selected departments
                const fetchPromises = formData.assignedDepartments.map(async (deptId) => {
                    // Only fetch if we haven't already
                    if (!workspacesByDept[deptId]) {
                        try {
                            console.log(`🔍 Fetching workspaces for department: ${deptId}`);
                            const res = await api.get(`/api/admin/departments/${deptId}/workspaces`);
                            console.log(`✅ Workspaces received for ${deptId}:`, res.data);
                            return { deptId, workspaces: res.data || [] };
                        } catch (err) {
                            console.error(`❌ Error fetching workspaces for ${deptId}:`, err);
                            toast.error(`Failed to load workspaces for department`);
                            return { deptId, workspaces: [] };
                        }
                    }
                    return null;
                });

                const results = await Promise.all(fetchPromises);

                // Update state with all fetched workspaces
                const updates = {};
                results.forEach(result => {
                    if (result) {
                        updates[result.deptId] = result.workspaces;
                    }
                });

                if (Object.keys(updates).length > 0) {
                    setWorkspacesByDept(prev => {
                        const updated = { ...prev, ...updates };
                        console.log('📊 Updated workspacesByDept:', updated);
                        return updated;
                    });
                }
            }
        };

        fetchWorkspaces();
    }, [step, formData.assignedDepartments]);

    const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const toggleSelection = (field, id) => {
        setFormData(prev => {
            const list = prev[field] || [];
            return list.includes(id) ? { ...prev, [field]: list.filter(i => i !== id) } : { ...prev, [field]: [...list, id] };
        });
    };

    const handleBack = () => setStep(prev => prev - 1);

    const validateStep = () => {
        if (step === 1) return formData.firstName && formData.lastName && formData.personalEmail && formData.jobTitle;
        if (step === 1 && formData.jobTitle === 'Custom' && !formData.customJobTitle) return false;

        if (step === 2) {
            if (!formData.companyEmail) return false;
            if (formData.assignedDepartments.length === 0) return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateStep()) return;
        setLoading(true);
        try {
            await api.post('/api/admin/onboard-employee', {
                ...formData,
                phone: `${formData.countryCode} ${formData.phone}`,
                jobTitle: formData.jobTitle === 'Custom' ? formData.customJobTitle : formData.jobTitle,
                departments: formData.assignedDepartments,
                workspaces: formData.assignedWorkspaces
            });
            toast.success("Employee onboarded successfully!");
            onComplete();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed");
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { num: 1, label: 'Basic Info' },
        { num: 2, label: 'Company & Role' },
        { num: 3, label: 'Assignment' }
    ];

    return (
        <div className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full overflow-hidden flex flex-col h-full transition-colors relative">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-white dark:bg-[#1e293b] z-20">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Onboard New Employee</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Configure profile, access, and permissions.</p>
                </div>
                <button onClick={onComplete} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                    <X size={20} />
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                {/* Sidebar Stepper (Desktop) / Top Stepper (Mobile) */}
                <div className="w-full md:w-64 bg-slate-50 dark:bg-[#0f172a]/50 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700/50 p-6 flex-shrink-0">
                    <div className="flex md:flex-col items-center md:items-start justify-between md:justify-start gap-4 h-full">
                        {steps.map((s, idx) => (
                            <div key={s.num} className="group flex items-center gap-3 relative z-10">
                                {/* Connector Line (Desktop only) */}
                                {idx < steps.length - 1 && (
                                    <div className={`hidden md:block absolute left-4 top-8 w-0.5 h-8 -z-10 ${step > s.num ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                                        }`} />
                                )}

                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ring-2 ring-offset-2 dark:ring-offset-[#0f172a] ${step === s.num
                                    ? 'bg-indigo-600 text-white ring-indigo-100 dark:ring-indigo-900/40'
                                    : step > s.num
                                        ? 'bg-indigo-600 text-white ring-transparent'
                                        : 'bg-white dark:bg-[#1e293b] text-slate-400 border border-slate-200 dark:border-slate-600 ring-transparent'
                                    }`}>
                                    {step > s.num ? <Check size={14} strokeWidth={3} /> : s.num}
                                </div>
                                <span className={`text-sm font-medium transition-colors ${step === s.num ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                                    }`}>
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-white dark:bg-[#1e293b]">

                    {step === 1 && (
                        <div className="space-y-6 max-w-2xl mx-auto animate-fadeIn">
                            <div className="grid grid-cols-2 gap-5">
                                <FormInput
                                    label="First Name"
                                    icon={<User size={16} />}
                                    value={formData.firstName}
                                    onChange={e => updateForm('firstName', e.target.value)}
                                    placeholder="Jane"
                                    required
                                />
                                <FormInput
                                    label="Last Name"
                                    icon={<User size={16} />}
                                    value={formData.lastName}
                                    onChange={e => updateForm('lastName', e.target.value)}
                                    placeholder="Doe"
                                    required
                                />
                            </div>

                            <FormInput
                                label="Personal Email"
                                icon={<Mail size={16} />}
                                value={formData.personalEmail}
                                onChange={e => updateForm('personalEmail', e.target.value)}
                                placeholder="jane.doe@gmail.com"
                                type="email"
                                required
                            />

                            <div className="grid grid-cols-2 gap-5">
                                <FormInput
                                    label="Job Title"
                                    icon={<Briefcase size={16} />}
                                    type="select"
                                    options={commonJobTitles}
                                    value={formData.jobTitle}
                                    onChange={e => updateForm('jobTitle', e.target.value)}
                                    required
                                />
                                <FormInput
                                    label="Joining Date"
                                    icon={<Calendar size={16} />}
                                    type="date"
                                    value={formData.joiningDate}
                                    onChange={e => updateForm('joiningDate', e.target.value)}
                                />
                            </div>

                            {formData.jobTitle === 'Custom' && (
                                <div className="animate-fadeIn">
                                    <FormInput
                                        label="Custom Title"
                                        value={formData.customJobTitle}
                                        onChange={e => updateForm('customJobTitle', e.target.value)}
                                        placeholder="Specific Role Name"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Mobile Number</label>
                                <div className="flex gap-3">
                                    <div className="relative w-28">
                                        <select
                                            value={formData.countryCode}
                                            onChange={e => updateForm('countryCode', e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer font-medium"
                                        >
                                            {countryCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                        </select>
                                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={14} />
                                    </div>
                                    <div className="flex-1 relative group">
                                        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={16} />
                                        <input
                                            value={formData.phone}
                                            onChange={e => updateForm('phone', e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            placeholder="98765 43210"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 max-w-2xl mx-auto animate-fadeIn">
                            {/* Email Setup */}
                            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 block">Corporate Identity</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <FormInput
                                            icon={<Mail size={16} />}
                                            value={formData.companyEmail}
                                            onChange={e => updateForm('companyEmail', e.target.value)}
                                            placeholder="jane.doe"
                                            className="bg-white dark:bg-[#1e293b]"
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-400">@{company?.domain}</span>
                                </div>
                            </div>

                            {/* Role Select */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 block">System Role</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {['member', 'manager', 'admin', 'guest'].map(r => (
                                        <button
                                            key={r}
                                            onClick={() => updateForm('role', r)}
                                            className={`px-2 py-2.5 rounded-lg border text-sm font-semibold capitalize transition-all ${formData.role === r
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dept & Workspace */}
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Department Access</h3>
                                <div className="grid grid-cols-1 gap-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                    {departments.map(dept => {
                                        const isSelected = formData.assignedDepartments.includes(dept._id);
                                        return (
                                            <div key={dept._id} className={`rounded-xl border transition-all overflow-hidden ${isSelected ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b]'}`}>
                                                <label className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelection('assignedDepartments', dept._id)}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{dept.name}</span>
                                                </label>

                                                {isSelected && (
                                                    <div className="px-3.5 pb-3.5 pl-10 space-y-2 animate-fadeIn">
                                                        {workspacesByDept[dept._id]?.length > 0 ? workspacesByDept[dept._id].map(ws => (
                                                            <label key={ws._id} className="flex items-center gap-2 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.assignedWorkspaces.includes(ws._id)}
                                                                    onChange={() => toggleSelection('assignedWorkspaces', ws._id)}
                                                                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{ws.name}</span>
                                                            </label>
                                                        )) : (
                                                            <p className="text-xs text-slate-400 italic">No workspaces</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center h-full animate-fadeIn py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 ring-4 ring-green-50 dark:ring-green-900/10">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ready to Launch!</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-sm text-center">
                                Review the details below. We'll send an invite to <span className="text-indigo-500 font-bold">{formData.personalEmail}</span>.
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700/50 space-y-4">
                                <ReviewRow label="Name" value={`${formData.firstName} ${formData.lastName}`} />
                                <ReviewRow label="Role" value={formData.jobTitle} />
                                <ReviewRow label="Email" value={`${formData.companyEmail}@${company?.domain}`} highlight />
                                <ReviewRow label="Access" value={`${formData.role} • ${formData.assignedDepartments.length} Depts`} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:px-8 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-white dark:bg-[#1e293b] z-20">
                <button
                    onClick={handleBack}
                    disabled={step === 1}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${step === 1 ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed hidden' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    Back
                </button>

                <button
                    onClick={step === 3 ? handleSubmit : () => setStep(s => s + 1)}
                    disabled={loading || !validateStep()}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm"
                >
                    {loading ? 'Sending Invite...' : step === 3 ? 'Confirm & Invite' : 'Continue'}
                    {!loading && step < 3 && <ChevronRight size={16} />}
                </button>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
            `}</style>
        </div>
    );
};

// -- Reusable Components --

const FormInput = ({ label, icon, type = "text", className = "", options = [], ...props }) => (
    <div className={className}>
        {label && <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{label} {props.required && <span className="text-red-500">*</span>}</label>}
        <div className="relative group">
            {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">{icon}</div>}

            {type === 'select' ? (
                <div className="relative">
                    <select
                        className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl ${icon ? 'pl-10' : 'pl-4'} pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer`}
                        {...props}
                    >
                        <option value="">Select...</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={14} />
                </div>
            ) : (
                <input
                    type={type}
                    className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600`}
                    {...props}
                />
            )}
        </div>
    </div>
);

const ReviewRow = ({ label, value, highlight }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</span>
        <span className={`text-sm font-bold ${highlight ? 'text-indigo-600' : 'text-slate-800 dark:text-slate-200'}`}>{value}</span>
    </div>
);

export default OnboardingWizard;
