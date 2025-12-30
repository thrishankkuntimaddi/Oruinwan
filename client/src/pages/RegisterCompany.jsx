
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft, ArrowRight, Building, Users, Home, CheckCircle, Globe, Mail, Lock, User, X, Sparkles,
    Code, Palette, Megaphone, Settings, Briefcase, Headphones, Layers
} from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import axios from "axios";

const RegisterCompany = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        // Step 1: Company & Admin Info
        companyName: "",
        domain: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        confirmPassword: "",
        // Step 2: Departments
        selectedDepartments: [],
        customDepartments: [],
        customDepartment: "",
        // Step 3: Workspace
        workspaceName: "",
        workspaceDescription: "",
        defaultChannels: ["general", "announcements"]
    });

    const [errors, setErrors] = useState({});

    // Professional Icons using Lucide React
    const DEFAULT_DEPARTMENTS = [
        { id: "engineering", name: "Engineering", icon: <Code size={32} strokeWidth={1.5} />, color: "text-blue-600 bg-blue-50" },
        { id: "design", name: "Design", icon: <Palette size={32} strokeWidth={1.5} />, color: "text-purple-600 bg-purple-50" },
        { id: "marketing", name: "Marketing", icon: <Megaphone size={32} strokeWidth={1.5} />, color: "text-pink-600 bg-pink-50" },
        { id: "operations", name: "Operations", icon: <Settings size={32} strokeWidth={1.5} />, color: "text-emerald-600 bg-emerald-50" },
        { id: "sales", name: "Sales", icon: <Briefcase size={32} strokeWidth={1.5} />, color: "text-orange-600 bg-orange-50" },
        { id: "support", name: "Support", icon: <Headphones size={32} strokeWidth={1.5} />, color: "text-indigo-600 bg-indigo-50" }
    ];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    };

    const toggleDepartment = (deptId) => {
        setFormData(prev => ({
            ...prev,
            selectedDepartments: prev.selectedDepartments.includes(deptId)
                ? prev.selectedDepartments.filter(id => id !== deptId)
                : [...prev.selectedDepartments, deptId]
        }));
    };

    const addCustomDepartment = () => {
        if (!formData.customDepartment.trim()) return;
        const name = formData.customDepartment.trim();
        const customId = `custom-${Date.now()}`;
        // Use Layers icon for custom departments
        const newDept = {
            id: customId,
            name: name,
            icon: <Layers size={32} strokeWidth={1.5} />,
            isCustom: true,
            color: "text-gray-600 bg-gray-50"
        };

        setFormData(prev => ({
            ...prev,
            customDepartments: [...prev.customDepartments, newDept],
            selectedDepartments: [...prev.selectedDepartments, customId],
            customDepartment: ""
        }));
    };

    const getDepartmentDetails = (id) => {
        const defaultDept = DEFAULT_DEPARTMENTS.find(d => d.id === id);
        if (defaultDept) return defaultDept;
        const customDept = formData.customDepartments.find(d => d.id === id);
        if (customDept) return customDept;
        return {
            id,
            name: "Unknown",
            icon: <Layers size={20} />,
            color: "text-gray-500 bg-gray-50"
        };
    };

    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.companyName.trim()) newErrors.companyName = "Required";
        if (!formData.adminName.trim()) newErrors.adminName = "Required";
        if (!formData.adminEmail.trim()) newErrors.adminEmail = "Required";
        else if (!/\S+@\S+\.\S+/.test(formData.adminEmail)) newErrors.adminEmail = "Invalid email";
        if (!formData.adminPassword) newErrors.adminPassword = "Required";
        else if (formData.adminPassword.length < 8) newErrors.adminPassword = "Min 8 chars";
        if (formData.adminPassword !== formData.confirmPassword) newErrors.confirmPassword = "Mismatch";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        setErrors({});
        if (!formData.workspaceName.trim()) {
            setFormData(prev => ({
                ...prev,
                workspaceName: prev.companyName ? `${prev.companyName} Workspace` : "Main Workspace"
            }));
        }
        return true;
    };

    const handleNext = () => {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 3 && !validateStep3()) return;
        setCurrentStep(p => Math.min(p + 1, 4));
    };

    const handleBack = () => {
        setCurrentStep(p => Math.max(p - 1, 1));
    };

    const handleEdit = (step) => setCurrentStep(step);

    const handleFinalSubmit = async () => {
        setIsLoading(true);
        try {
            const departmentNames = formData.selectedDepartments.map(id => getDepartmentDetails(id).name);
            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/companies/register`,
                {
                    companyName: formData.companyName,
                    adminName: formData.adminName,
                    adminEmail: formData.adminEmail,
                    adminPassword: formData.adminPassword,
                    domain: formData.domain || undefined,
                    departments: departmentNames,
                    workspaceName: formData.workspaceName || `${formData.companyName} Workspace`,
                    workspaceDescription: formData.workspaceDescription || undefined,
                    defaultChannels: formData.defaultChannels
                }
            );
            showToast("Registration successful! Redirecting...", "success");
            setTimeout(() => {
                navigate("/login", { state: { email: formData.adminEmail, message: "Login to verify account." } });
            }, 2000);
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || "Failed to register", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen w-full bg-white relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
            {/* Styles & Animations */}
            <style>{`
                @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
                @keyframes float-delayed { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 20px); } }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
                /* Custom Scrollbar for Card */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(99, 102, 241, 0.2); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(99, 102, 241, 0.4); }
            `}</style>

            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/50 via-purple-50/50 to-transparent blur-[100px] animate-float"></div>
                <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-indigo-100/50 via-pink-50/50 to-transparent blur-[100px] animate-float-delayed"></div>
            </div>

            {/* Navbar (Fixed width content) */}
            <nav className="relative z-50 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full shrink-0">
                <div onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer group">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center group-hover:rotate-6 transition-transform">
                        <Building className="w-5 h-5 text-indigo-600" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 tracking-tight">Chttrix</span>
                </div>
                <div className="text-sm font-medium text-gray-500">
                    Already have an account? <button onClick={() => navigate("/login")} className="text-indigo-600 hover:text-indigo-700 font-semibold ml-1">Sign in</button>
                </div>
            </nav>

            {/* Main Content Area (Centered Card) */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden">

                {/* Glass Card Rectangle */}
                <div className="w-full max-w-4xl h-full max-h-[85vh] bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/50 flex flex-col overflow-hidden transition-all duration-500">

                    {/* Card Header (Fixed) */}
                    <div className="shrink-0 px-8 pt-8 pb-4 border-b border-gray-100/50 bg-white/30">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-2 border border-indigo-100">
                                    <Sparkles size={10} />
                                    <span>Step {currentStep} of 4</span>
                                </div>
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                    {currentStep === 1 && "Create Company"}
                                    {currentStep === 2 && "Structure Teams"}
                                    {currentStep === 3 && "Digital HQ"}
                                    {currentStep === 4 && "Review & Launch"}
                                </h1>
                            </div>

                            {/* Step Indicator */}
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map((step) => (
                                    <div
                                        key={step}
                                        className={`h-2 rounded-full transition-all duration-500 ${currentStep >= step ? "w-8 bg-indigo-600" : "w-2 bg-gray-200"}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                        {/* STEP 1: COMPANY INFO */}
                        {currentStep === 1 && (
                            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                                <div className="text-center mb-6">
                                    <p className="text-gray-500">Let's start with the basics to set up your organization.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Company Name</label>
                                        <div className="relative group">
                                            <Building className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="companyName"
                                                value={formData.companyName}
                                                onChange={handleChange}
                                                placeholder="Acme Inc."
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.companyName ? "border-red-300 ring-4 ring-red-50" : "border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"} rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                        {errors.companyName && <p className="text-red-500 text-xs font-semibold ml-2">{errors.companyName}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Domain <span className="text-gray-400 font-normal">(Optional)</span></label>
                                        <div className="relative group">
                                            <Globe className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="domain"
                                                value={formData.domain}
                                                onChange={handleChange}
                                                placeholder="acme.com"
                                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px w-full bg-gray-100"></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Your Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="adminName"
                                                value={formData.adminName}
                                                onChange={handleChange}
                                                placeholder="John Doe"
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.adminName ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Work Email</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="adminEmail"
                                                value={formData.adminEmail}
                                                onChange={handleChange}
                                                placeholder="john@acme.com"
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.adminEmail ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                        {errors.adminEmail && <p className="text-red-500 text-xs font-semibold ml-2">{errors.adminEmail}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                type="password"
                                                name="adminPassword"
                                                value={formData.adminPassword}
                                                onChange={handleChange}
                                                placeholder="••••••••"
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.adminPassword ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                        {errors.adminPassword && <p className="text-red-500 text-xs font-semibold ml-2">{errors.adminPassword}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Confirm</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                placeholder="••••••••"
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.confirmPassword ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: DEPARTMENTS */}
                        {currentStep === 2 && (
                            <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
                                <p className="text-center text-gray-500">Select standard departments or add your own.</p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {DEFAULT_DEPARTMENTS.map((dept) => {
                                        const isSelected = formData.selectedDepartments.includes(dept.id);
                                        return (
                                            <button
                                                key={dept.id}
                                                onClick={() => toggleDepartment(dept.id)}
                                                className={`p-4 rounded-3xl border text-left transition-all duration-300 relative group overflow-hidden ${isSelected
                                                    ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-500/20'
                                                    : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-lg hover:-translate-y-1'
                                                    }`}
                                            >
                                                <div className={`text-2xl mb-3 transform group-hover:scale-110 transition-transform duration-300 ${isSelected ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`}>
                                                    {/* Clone element to pass props if needed, or rely on stored component */}
                                                    {React.cloneElement(dept.icon, {
                                                        size: 32,
                                                        strokeWidth: 1.5,
                                                        className: isSelected ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500 transition-colors'
                                                    })}
                                                </div>
                                                <div className="font-bold text-gray-900">{dept.name}</div>
                                                {isSelected && <div className="absolute top-4 right-4"><CheckCircle className="w-5 h-5 text-indigo-600 fill-indigo-100" /></div>}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="bg-gray-50/80 rounded-3xl p-6 border border-gray-200/50">
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Add Custom Department</label>
                                    <div className="flex gap-3">
                                        <input
                                            value={formData.customDepartment}
                                            onChange={handleChange}
                                            name="customDepartment"
                                            placeholder="Human Resources"
                                            className="flex-1 px-5 py-3 rounded-2xl border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all bg-white text-gray-900"
                                            onKeyPress={(e) => e.key === 'Enter' && addCustomDepartment()}
                                        />
                                        <button onClick={addCustomDepartment} className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black hover:shadow-lg transition-all">
                                            Add
                                        </button>
                                    </div>
                                </div>

                                {formData.selectedDepartments.length > 0 && (
                                    <div className="border-t border-gray-100 pt-6">
                                        <p className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                            <Users size={16} /> Selected Departments ({formData.selectedDepartments.length})
                                        </p>
                                        <div className="flex flex-wrap gap-3">
                                            {formData.selectedDepartments.map(id => {
                                                const details = getDepartmentDetails(id);
                                                return (
                                                    <span key={id} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${details.color || 'bg-gray-100 text-gray-700 border-gray-200'} border-transparent shadow-sm`}>
                                                        {React.isValidElement(details.icon) ? React.cloneElement(details.icon, { size: 16 }) : details.icon}
                                                        {details.name}
                                                        <button onClick={() => toggleDepartment(id)} className="hover:bg-black/10 rounded-full p-0.5 transition-colors">
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 3: WORKSPACE */}
                        {currentStep === 3 && (
                            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                                <p className="text-center text-gray-500">Name your digital headquarters.</p>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Workspace Name</label>
                                    <input
                                        name="workspaceName"
                                        value={formData.workspaceName}
                                        onChange={handleChange}
                                        placeholder={`${formData.companyName || "Company"} Workspace`}
                                        className="w-full px-5 py-4 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-lg text-gray-900"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
                                    <textarea
                                        name="workspaceDescription"
                                        value={formData.workspaceDescription}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder="The central hub for all things Acme Inc."
                                        className="w-full px-5 py-4 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm resize-none text-gray-900"
                                    />
                                </div>

                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-8 border border-indigo-100">
                                    <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-4">
                                        <CheckCircle size={20} className="text-indigo-600" />
                                        Initial Channels
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.defaultChannels.map((channel) => (
                                            <span key={channel} className="px-4 py-2 bg-white text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100 shadow-sm">
                                                # {channel}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: REVIEW */}
                        {currentStep === 4 && (
                            <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                                <p className="text-center text-gray-500 mb-6">Double check everything before we launch.</p>
                                <div className="bg-white/50 rounded-3xl p-6 border border-gray-100 hover:border-indigo-200 transition-colors group relative cursor-pointer" onClick={() => handleEdit(1)}>
                                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 text-sm font-bold">Edit</div>
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Building size={18} className="text-gray-400" /> Company</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><span className="block text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">Name</span><span className="text-gray-900 font-medium">{formData.companyName}</span></div>
                                        <div><span className="block text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">Admin</span><span className="text-gray-900 font-medium">{formData.adminName}</span></div>
                                        <div className="col-span-2"><span className="block text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">Email</span><span className="text-gray-900 font-medium">{formData.adminEmail}</span></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white/50 rounded-3xl p-6 border border-gray-100 hover:border-indigo-200 transition-colors group relative cursor-pointer" onClick={() => handleEdit(2)}>
                                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 text-sm font-bold">Edit</div>
                                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Users size={18} className="text-gray-400" /> Departments</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.selectedDepartments.map(id => {
                                                const details = getDepartmentDetails(id);
                                                return (
                                                    <span key={id} className="text-xs font-bold px-2 py-1 bg-gray-100 rounded-md text-gray-600 flex items-center gap-1">
                                                        {React.isValidElement(details.icon) ? React.cloneElement(details.icon, { size: 12 }) : details.icon}
                                                        {details.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-white/50 rounded-3xl p-6 border border-gray-100 hover:border-indigo-200 transition-colors group relative cursor-pointer" onClick={() => handleEdit(3)}>
                                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 text-sm font-bold">Edit</div>
                                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Home size={18} className="text-gray-400" /> Workspace</h3>
                                        <p className="font-medium text-gray-900">{formData.workspaceName}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Fixed at bottom of card) */}
                    <div className="shrink-0 px-8 py-6 border-t border-gray-100/50 bg-white/30 flex items-center justify-between">
                        {currentStep > 1 ? (
                            <button onClick={handleBack} className="text-gray-500 hover:text-gray-900 font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                <ArrowLeft size={16} /> Back
                            </button>
                        ) : <div></div>}

                        {currentStep < 4 ? (
                            <button
                                onClick={handleNext}
                                className="group relative px-6 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                            >
                                <span className="relative flex items-center gap-2">
                                    Continue <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>
                        ) : (
                            <button
                                onClick={handleFinalSubmit}
                                disabled={isLoading}
                                className="group relative px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                <span className="relative flex items-center gap-2">
                                    {isLoading ? "Creating..." : "Launch Workspace"}
                                    {!isLoading && <Sparkles size={18} className="animate-pulse" />}
                                </span>
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default RegisterCompany;
