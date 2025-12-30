
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft, ArrowRight, Building, Users, Home, CheckCircle, Globe, Mail, Lock, User, X, Sparkles,
    Briefcase, FileText, Phone, UploadCloud, ShieldCheck, Eye, EyeOff, Info, ChevronDown
} from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import axios from "axios";

const RegisterCompany = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Password Visibility State
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Mock Verification States
    const [verificationStatus, setVerificationStatus] = useState({
        personalEmail: "idle", // idle, pending, verified
        phone: "idle"
    });

    const [formData, setFormData] = useState({
        // Step 1: Organization
        companyName: "",
        companyDomain: "",

        // Step 2: Administrator
        adminName: "",
        role: "Owner", // Default
        roleOther: "",
        personalEmail: "",
        phone: "",
        phoneCode: "+91", // Default to India as per user preference (or +1)

        // Step 3: Account Credentials
        companyEmail: "",
        password: "",
        confirmPassword: "",

        // Step 4: Documents
        documents: null
    });

    const [errors, setErrors] = useState({});

    const ROLES = ["Owner", "Admin", "PA", "Manager", "Other"];
    const PHONE_CODES = [
        { code: "+1", country: "US", label: "US (+1)", len: 10 },
        { code: "+91", country: "IN", label: "IN (+91)", len: 10 },
        { code: "+44", country: "UK", label: "UK (+44)", len: 10 },
        { code: "+61", country: "AU", label: "AU (+61)", len: 9 },
        { code: "+86", country: "CN", label: "CN (+86)", len: 11 },
        { code: "+55", country: "BR", label: "BR (+55)", len: 11 },
    ];

    const currentPhoneCode = PHONE_CODES.find(c => c.code === formData.phoneCode) || PHONE_CODES[0];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData(prev => ({ ...prev, documents: file }));
    };

    // --- Validation Logic ---

    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.companyName.trim()) newErrors.companyName = "Company Name is required";
        if (!formData.companyDomain.trim()) newErrors.companyDomain = "Domain is required";
        else if (!/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(formData.companyDomain)) newErrors.companyDomain = "Invalid domain format (e.g. acme.com)";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors = {};
        if (!formData.adminName.trim()) newErrors.adminName = "Name is required";
        if (!formData.personalEmail.trim()) newErrors.personalEmail = "Personal Email is required";
        else if (!/\S+@\S+\.\S+/.test(formData.personalEmail)) newErrors.personalEmail = "Invalid email";

        if (!formData.phone.trim()) newErrors.phone = "Phone is required";
        else if (formData.phone.replace(/\D/g, '').length !== currentPhoneCode.len) {
            newErrors.phone = `Must be ${currentPhoneCode.len} digits for ${currentPhoneCode.country}`;
        }

        if (formData.role === "Other" && !formData.roleOther.trim()) newErrors.roleOther = "Please specify your role";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        const newErrors = {};
        if (!formData.companyEmail.trim()) newErrors.companyEmail = "Company Email is required";
        else {
            const emailDomain = formData.companyEmail.split('@')[1];
            if (emailDomain !== formData.companyDomain) {
                newErrors.companyEmail = `Email must match company domain (@${formData.companyDomain})`;
            }
        }

        const pd = formData.password;
        // Min 8, Max 16, Upper, Lower, Number, Special, No Spaces
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

        if (!pd) newErrors.password = "Password is required";
        else if (pd.includes(" ")) newErrors.password = "No spaces allowed";
        else if (!passwordRegex.test(pd)) {
            newErrors.password = "Does not meet complexity rules";
        }

        if (pd !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep4 = () => {
        const newErrors = {};
        if (!formData.documents) newErrors.documents = "Please upload verification documents";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 2 && !validateStep2()) return;
        if (currentStep === 3 && !validateStep3()) return;
        if (currentStep === 4 && !validateStep4()) return;

        setCurrentStep(p => Math.min(p + 1, 5));
    };

    const handleBack = () => {
        setCurrentStep(p => Math.max(p - 1, 1));
    };

    // --- Verification Handlers ---

    const handleVerify = async (field) => {
        const target = formData[field];
        if (!target) {
            setErrors(prev => ({ ...prev, [field]: "Required for verification" }));
            return;
        }

        // Basic format check before sending
        if (field === 'personalEmail' && !/\S+@\S+\.\S+/.test(target)) {
            setErrors(prev => ({ ...prev, [field]: "Invalid email format" }));
            return;
        }

        setIsLoading(true);
        try {
            // 1. Send OTP
            await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/companies/otp/send`, {
                target,
                type: field === 'personalEmail' ? 'email' : 'phone'
            });

            setVerificationStatus(prev => ({ ...prev, [field]: "pending" }));
            showToast(`OTP sent to ${target}. Check server logs.`, "success"); // Helpful for dev

            // 2. Prompt for OTP
            setTimeout(async () => {
                const otp = window.prompt(`Enter OTP sent to ${target}`);

                if (otp) {
                    try {
                        // 3. Verify OTP
                        await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/companies/otp/verify`, {
                            target,
                            otp
                        });

                        setVerificationStatus(prev => ({ ...prev, [field]: "verified" }));
                        showToast(`${field === 'phone' ? 'Phone' : 'Email'} verified successfully!`, "success");
                        // Clear error if any
                        if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));

                    } catch (verifyErr) {
                        console.error(verifyErr);
                        setVerificationStatus(prev => ({ ...prev, [field]: "idle" }));
                        showToast(verifyErr.response?.data?.message || "Invalid OTP", "error");
                    }
                } else {
                    setVerificationStatus(prev => ({ ...prev, [field]: "idle" }));
                }
                setIsLoading(false);
            }, 500);

        } catch (error) {
            console.error(error);
            setIsLoading(false);
            showToast(error.response?.data?.message || "Failed to send OTP", "error");
        }
    };


    const handleFinalSubmit = async () => {
        setIsLoading(true);
        try {
            // Helper to read file as base64
            const readFile = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content: reader.result // Base64 Data URL
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            let documentData = null;
            if (formData.documents) {
                documentData = await readFile(formData.documents);
            }

            const payload = {
                companyName: formData.companyName,
                domain: formData.companyDomain,
                adminName: formData.adminName,
                adminEmail: formData.companyEmail, // Using company email for account logic
                personalEmail: formData.personalEmail,
                phone: formData.phone,
                phoneCode: formData.phoneCode,
                role: formData.role === "Other" ? formData.roleOther : formData.role,
                adminPassword: formData.password,
                workspaceName: `${formData.companyName} Workspace`,
                documents: documentData ? [documentData] : []
            };

            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/companies/register`,
                payload
            );

            setIsSuccess(true);
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || "Failed to register", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="h-screen w-full bg-white relative overflow-hidden font-sans flex flex-col items-center justify-center p-4">
                <style>{`
                    @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
                    .animate-float { animation: float 10s ease-in-out infinite; }
                `}</style>
                <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/50 via-purple-50/50 to-transparent blur-[100px] animate-float"></div>
                </div>

                <div className="relative z-10 w-full max-w-lg bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl p-10 text-center border border-white/50 animate-fadeIn">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Application Submitted!</h1>
                    <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                        Your company <strong>{formData.companyName}</strong> has been registered and is currently <strong>Pending Verification</strong>.
                    </p>
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-8 text-left">
                        <p className="font-bold mb-1 flex items-center gap-2"><Sparkles size={16} /> What happens next?</p>
                        <p>Our team will review your documents and domain. You will receive an activation email once your workspace is ready (usually within 24 hours).</p>
                    </div>

                    <button
                        onClick={() => navigate("/login")}
                        className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                    >
                        Return to Login
                    </button>

                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-white relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
            {/* Styles & Animations */}
            <style>{`
                @keyframes float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -20px); } }
                @keyframes float-delayed { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, 20px); } }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(99, 102, 241, 0.2); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(99, 102, 241, 0.4); }
                
                /* Tooltip Trigger */
                .tooltip-trigger:hover + .tooltip-content { opacity: 1; visibility: visible; transform: translateY(0); }
            `}</style>

            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/50 via-purple-50/50 to-transparent blur-[100px] animate-float"></div>
                <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-indigo-100/50 via-pink-50/50 to-transparent blur-[100px] animate-float-delayed"></div>
            </div>

            {/* Navbar */}
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

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden">

                {/* Glass Card */}
                <div className="w-full max-w-4xl h-full max-h-[85vh] bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/50 flex flex-col overflow-hidden transition-all duration-500">

                    {/* Card Header */}
                    <div className="shrink-0 px-8 pt-8 pb-4 border-b border-gray-100/50 bg-white/30">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-2 border border-indigo-100">
                                    <Sparkles size={10} />
                                    <span>Step {currentStep} of 5</span>
                                </div>
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                    {currentStep === 1 && "Start Your Organization"}
                                    {currentStep === 2 && "Administrator Profile"}
                                    {currentStep === 3 && "Secure Account"}
                                    {currentStep === 4 && "Verification"}
                                    {currentStep === 5 && "Review & Launch"}
                                </h1>
                            </div>

                            {/* Indicators */}
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((step) => (
                                    <div
                                        key={step}
                                        className={`h-2 rounded-full transition-all duration-500 ${currentStep >= step ? "w-8 bg-indigo-600" : "w-2 bg-gray-200"}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Form Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                        {/* STEP 1: ORGANIZATION INFO */}
                        {currentStep === 1 && (
                            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                                <div className="text-center mb-6">
                                    <p className="text-gray-500">Tell us about the entity you are registering.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Company Name</label>
                                        <div className="relative group">
                                            <Building className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="companyName"
                                                value={formData.companyName}
                                                onChange={handleChange}
                                                placeholder="e.g. Acme Innovations Inc."
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.companyName ? "border-red-300 ring-2 ring-red-50" : "border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"} rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                        {errors.companyName && <p className="text-red-500 text-xs font-bold ml-2">{errors.companyName}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Company Domain</label>
                                        <div className="relative group">
                                            <Globe className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="companyDomain"
                                                value={formData.companyDomain}
                                                onChange={handleChange}
                                                placeholder="e.g. acme.com (Must match email domain)"
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.companyDomain ? "border-red-300 ring-2 ring-red-50" : "border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"} rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                        {errors.companyDomain && <p className="text-red-500 text-xs font-bold ml-2">{errors.companyDomain}</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: ADMINISTRATOR */}
                        {currentStep === 2 && (
                            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                                <div className="text-center mb-6">
                                    <p className="text-gray-500">We need a point of contact for this account.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 col-span-2 md:col-span-1">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Your Full Name</label>
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
                                        {errors.adminName && <p className="text-red-500 text-xs font-bold ml-2">{errors.adminName}</p>}
                                    </div>

                                    <div className="space-y-2 col-span-2 md:col-span-1">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Role</label>
                                        <div className="relative group">
                                            <Briefcase className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <select
                                                name="role"
                                                value={formData.role}
                                                onChange={handleChange}
                                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900 appearance-none"
                                            >
                                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {formData.role === "Other" && (
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-sm font-bold text-gray-700 ml-1">Specify Role</label>
                                            <input
                                                name="roleOther"
                                                value={formData.roleOther}
                                                onChange={handleChange}
                                                placeholder="e.g. CTO"
                                                className={`w-full px-4 py-3.5 bg-white border ${errors.roleOther ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                            {errors.roleOther && <p className="text-red-500 text-xs font-bold ml-2">{errors.roleOther}</p>}
                                        </div>
                                    )}

                                    <div className="col-span-2">
                                        <div className="h-px w-full bg-gray-100 my-2"></div>
                                    </div>

                                    {/* Personal Email */}
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Personal Email <span className="text-xs font-normal text-gray-400">(For account recovery)</span></label>
                                        <div className="flex gap-2">
                                            <div className="relative group flex-1">
                                                <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                                <input
                                                    name="personalEmail"
                                                    value={formData.personalEmail}
                                                    onChange={handleChange}
                                                    placeholder="john.doe@gmail.com"
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.personalEmail ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleVerify('personalEmail')}
                                                disabled={verificationStatus.personalEmail === "verified"}
                                                className={`px-4 rounded-2xl font-bold text-sm transition-all border ${verificationStatus.personalEmail === "verified"
                                                    ? "bg-green-50 text-green-600 border-green-200 cursor-default"
                                                    : "bg-gray-900 text-white border-gray-900 hover:bg-black"
                                                    }`}
                                            >
                                                {verificationStatus.personalEmail === "verified" ? "Verified" : "Verify"}
                                            </button>
                                        </div>
                                        {errors.personalEmail && <p className="text-red-500 text-xs font-bold ml-2">{errors.personalEmail}</p>}
                                    </div>

                                    {/* Phone Number with Country Selector */}
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Phone Number</label>
                                        <div className="flex gap-2">

                                            {/* Country Code Select */}
                                            <div className="relative min-w-[110px]">
                                                <ChevronDown className="absolute right-3 top-4 text-gray-400 pointer-events-none" size={14} />
                                                <select
                                                    name="phoneCode"
                                                    value={formData.phoneCode}
                                                    onChange={handleChange}
                                                    className="w-full h-full px-3 py-3.5 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900 appearance-none font-medium text-sm"
                                                >
                                                    {PHONE_CODES.map(c => (
                                                        <option key={c.code} value={c.code}>{c.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="relative group flex-1">
                                                <Phone className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                                <input
                                                    name="phone"
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    placeholder="000-000-0000"
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.phone ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleVerify('phone')}
                                                disabled={verificationStatus.phone === "verified"}
                                                className={`px-4 rounded-2xl font-bold text-sm transition-all border ${verificationStatus.phone === "verified"
                                                    ? "bg-green-50 text-green-600 border-green-200 cursor-default"
                                                    : "bg-gray-900 text-white border-gray-900 hover:bg-black"
                                                    }`}
                                            >
                                                {verificationStatus.phone === "verified" ? "Verified" : "Verify"}
                                            </button>
                                        </div>
                                        {errors.phone && <p className="text-red-500 text-xs font-bold ml-2">{errors.phone}</p>}
                                        <p className="text-xs text-gray-400 ml-1">Select country code. E.g. India (+91) requires 10 digits.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: ACCOUNT */}
                        {currentStep === 3 && (
                            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                                <div className="text-center mb-6">
                                    <p className="text-gray-500">Create your official company login.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Company Email</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <input
                                                name="companyEmail"
                                                value={formData.companyEmail}
                                                onChange={handleChange}
                                                placeholder={`name@${formData.companyDomain || "company.com"}`}
                                                className={`w-full pl-12 pr-4 py-3.5 bg-white border ${errors.companyEmail ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                            />
                                        </div>
                                        {errors.companyEmail && <p className="text-red-500 text-xs font-bold ml-2">{errors.companyEmail}</p>}
                                        <p className="text-xs text-gray-400 ml-2">Must match verified domain: <strong>@{formData.companyDomain || "not set"}</strong></p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                        {/* Password Input */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                                                Password
                                                <div className="relative group cursor-help">
                                                    <Info size={14} className="text-gray-400 hover:text-indigo-500 transition-colors tooltip-trigger" />
                                                    {/* Tooltip Content */}
                                                    <div className="tooltip-content absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-4 bg-gray-900 text-white text-xs rounded-xl shadow-xl z-50 opacity-0 invisible transition-all duration-300 pointer-events-none">
                                                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                                        <p className="font-bold mb-2 text-indigo-300">Password Rules:</p>
                                                        <ul className="list-disc pl-3 space-y-1 text-gray-300">
                                                            <li>8-16 characters long</li>
                                                            <li>At least one uppercase (A-Z)</li>
                                                            <li>At least one lowercase (a-z)</li>
                                                            <li>At least one number (0-9)</li>
                                                            <li>At least one special char (@$!%*?&)</li>
                                                            <li>No spaces allowed</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    placeholder="••••••••"
                                                    className={`w-full pl-12 pr-12 py-3.5 bg-white border ${errors.password ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                                />
                                                <button
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                            {errors.password && <p className="text-red-500 text-xs font-bold ml-2">{errors.password}</p>}
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 ml-1">Confirm Password</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                                <input
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    name="confirmPassword"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    placeholder="••••••••"
                                                    className={`w-full pl-12 pr-12 py-3.5 bg-white border ${errors.confirmPassword ? "border-red-300" : "border-gray-200"} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none transition-all shadow-sm text-gray-900`}
                                                />
                                                <button
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                            {errors.confirmPassword && <p className="text-red-500 text-xs font-bold ml-2">{errors.confirmPassword}</p>}
                                        </div>
                                    </div>

                                    {/* Password Hints (Visible if typing) */}
                                    {formData.password && (
                                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 text-xs text-indigo-800">
                                            <div className="flex items-start gap-2">
                                                <Info size={14} className="shrink-0 mt-0.5" />
                                                <span>Ensure your password is 8-16 characters, includes uppercase, lowercase, number, and special character.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 4: DOCUMENTS */}
                        {currentStep === 4 && (
                            <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
                                <div className="text-center mb-6">
                                    <p className="text-gray-500">Please upload verification documents for your entity.</p>
                                </div>

                                <div className="space-y-6">
                                    <div
                                        className={`border-3 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all bg-white/50 ${formData.documents ? "border-indigo-400 bg-indigo-50/50" : "border-gray-300 text-gray-500 hover:border-indigo-400 hover:bg-white"
                                            }`}
                                    >
                                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform shadow-sm ${formData.documents ? "bg-white text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
                                            {formData.documents ? <FileText size={32} /> : <UploadCloud size={32} />}
                                        </div>

                                        {formData.documents ? (
                                            <div className="animate-fadeIn">
                                                <p className="font-bold text-gray-900 text-lg mb-1">{formData.documents.name}</p>
                                                <p className="text-sm text-gray-500 mb-4">{(formData.documents.size / 1024 / 1024).toFixed(2)} MB</p>
                                                <label className="cursor-pointer text-indigo-600 font-bold hover:underline">
                                                    Change File
                                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                                </label>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-bold text-gray-900 text-lg mb-2">Drag & Drop or Click to Upload</p>
                                                <p className="text-sm text-gray-400 mb-6">Business Registration, Tax ID, or Incorporation Cert.</p>
                                                <label className="cursor-pointer px-6 py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                                                    Browse Files
                                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                    {errors.documents && <p className="text-red-500 text-center text-sm font-bold">{errors.documents}</p>}
                                </div>
                            </div>
                        )}

                        {/* STEP 5: REVIEW */}
                        {currentStep === 5 && (
                            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                                <div className="text-center mb-8">
                                    <p className="text-gray-500">Verify your information before submitting.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Card 1 */}
                                    <div className="bg-white/60 p-6 rounded-3xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer group" onClick={() => setCurrentStep(1)}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <Building size={18} className="text-indigo-500" /> Organization
                                            </h3>
                                            <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Name</span> <span className="text-gray-900">{formData.companyName}</span></div>
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Domain</span> <span className="text-gray-900">{formData.companyDomain}</span></div>
                                        </div>
                                    </div>

                                    {/* Card 2 */}
                                    <div className="bg-white/60 p-6 rounded-3xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer group" onClick={() => setCurrentStep(2)}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <User size={18} className="text-indigo-500" /> Admin
                                            </h3>
                                            <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Name</span> <span className="text-gray-900">{formData.adminName}</span></div>
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Role</span> <span className="text-gray-900">{formData.role === "Other" ? formData.roleOther : formData.role}</span></div>
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Contact</span> <span className="text-gray-900 text-sm">{formData.personalEmail}<br />{formData.phoneCode} {formData.phone}</span></div>
                                        </div>
                                    </div>

                                    {/* Card 3 */}
                                    <div className="bg-white/60 p-6 rounded-3xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer group" onClick={() => setCurrentStep(3)}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <ShieldCheck size={18} className="text-indigo-500" /> Account
                                            </h3>
                                            <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Comp. Email</span> <span className="text-gray-900">{formData.companyEmail}</span></div>
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">Password</span> <span className="text-gray-900">••••••••</span></div>
                                        </div>
                                    </div>
                                    {/* Card 4 */}
                                    <div className="bg-white/60 p-6 rounded-3xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer group" onClick={() => setCurrentStep(4)}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <FileText size={18} className="text-indigo-500" /> Documents
                                            </h3>
                                            <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div><span className="text-xs text-gray-500 font-bold uppercase block">File</span> <span className="text-gray-900">{formData.documents?.name}</span></div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer Actions */}
                    <div className="shrink-0 px-8 py-6 border-t border-gray-100/50 bg-white/30 flex items-center justify-between">
                        {currentStep > 1 ? (
                            <button onClick={handleBack} className="text-gray-500 hover:text-gray-900 font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                                <ArrowLeft size={16} /> Back
                            </button>
                        ) : <div></div>}

                        {currentStep < 5 ? (
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
                                    {isLoading ? "Submitting..." : "Submit Registration"}
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
