import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
    Users, Mail, CheckCircle,
    ArrowRight, ArrowLeft, Upload, Clock, Plus, X, Sparkles, Target, Zap
} from 'lucide-react';

const CompanySetup = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [profile, setProfile] = useState({
        displayName: user?.company?.name || '',
        timezone: 'Asia/Kolkata' // Default to India timezone
    });

    const [departments, setDepartments] = useState([
        "Engineering", "Sales", "Marketing"
    ]);

    const [invites, setInvites] = useState([
        { name: "", email: "", role: "member", department: "" }
    ]);

    const totalSteps = 4;

    const handleNext = async () => {
        setIsLoading(true);


        // Extract company ID properly - API returns 'id' not '_id'
        let companyId;
        if (user?.company && typeof user.company === 'object') {
            companyId = user.company.id || user.company._id; // Try both id and _id
        } else {
            companyId = user?.companyId;
        }

        if (!companyId) {
            console.error("[SETUP] No company ID found!");
            setIsLoading(false);
            return;
        }

        try {
            const response = await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}/setup`,
                {
                    step: step,
                    data: step === 1 ? profile :
                        step === 2 ? { departments } :
                            step === 3 ? { invites } : {}
                },
                { withCredentials: true }
            );

            if (step < totalSteps) {
                setStep(step + 1);
            } else {
                await refreshUser();
                // Use backend provided redirect or default to admin dashboard
                const redirectPath = response.data.redirectTo || '/admin/analytics';

                navigate(redirectPath);
            }
        } catch (error) {
            console.error("Setup Error", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper for step indicators
    const currentStepTitle = () => {
        switch (step) {
            case 1: return "Company Profile";
            case 2: return "Departments";
            case 3: return "Team Invites";
            case 4: return "All Set!";
            default: return "";
        }
    };

    const currentStepDesc = () => {
        switch (step) {
            case 1: return "Let's make your workspace feel like home.";
            case 2: return "Organize your team structure.";
            case 3: return "Get your key people in right away.";
            case 4: return "Your workspace is ready for launch.";
            default: return "";
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white font-sans">

            {/* Global Styles for custom scrollbar and animations */}
            <style>{`
                @keyframes float-slow { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(10px, -20px) rotate(2deg); } }
                @keyframes float-reverse { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(-15px, 15px) rotate(-1deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-float-slow { animation: float-slow 15s ease-in-out infinite; }
                .animate-float-reverse { animation: float-reverse 18s ease-in-out infinite; }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
                
                .glass-input {
                    background: rgba(255, 255, 255, 0.5);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    transition: all 0.3s ease;
                }
                .glass-input:focus {
                    background: rgba(255, 255, 255, 0.9);
                    border-color: #6366f1;
                    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1);
                    transform: translateY(-1px);
                }
            `}</style>

            {/* Ambient Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-indigo-200/30 via-purple-200/30 to-transparent blur-[120px] animate-float-slow mix-blend-multiply"></div>
                <div className="absolute top-[30%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-bl from-blue-200/30 via-teal-100/30 to-transparent blur-[100px] animate-float-reverse mix-blend-multiply"></div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent opacity-50"></div>
            </div>

            {/* Main Glass Card */}
            <div className="relative z-10 w-full max-w-6xl h-[85vh] bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/60 flex overflow-hidden ring-1 ring-white/50">

                {/* Left Sidebar - Navigation */}
                <div className="w-80 bg-slate-900/95 text-white p-8 flex flex-col justify-between relative overflow-hidden hidden md:flex backdrop-blur-3xl shrink-0">
                    {/* Subtle grain/noise texture overlay if we had one, using gradient instead */}
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none"></div>

                    {/* Logo Area */}
                    <div className="relative z-10 flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 text-white font-bold">
                            <Sparkles size={20} className="fill-white/20" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white">Chttrix</span>
                    </div>

                    {/* Navigation Steps */}
                    <div className="relative z-10 space-y-7 flex-1">
                        {[
                            { id: 1, title: "Identity", icon: Target, desc: "Brand & Regional" },
                            { id: 2, title: "Structure", icon: Users, desc: "Departments" },
                            { id: 3, title: "People", icon: Mail, desc: "Team Invites" },
                            { id: 4, title: "Launch", icon: Zap, desc: "Ready to go" },
                        ].map((item) => {
                            const isActive = step === item.id;
                            const isCompleted = step > item.id;

                            return (
                                <div key={item.id} className={`group flex items-start gap-4 transition-all duration-500 ${isActive ? 'opacity-100 translate-x-1' : 'opacity-40 hover:opacity-70'}`}>
                                    <div className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500
                                        ${isActive ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-900/20 scale-110' :
                                            isCompleted ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40' :
                                                'bg-slate-800 text-slate-500'}
                                    `}>
                                        {isCompleted ? <CheckCircle size={20} /> : <item.icon size={20} />}
                                    </div>
                                    <div className="pt-1">
                                        <h3 className={`font-bold text-sm leading-none mb-1.5 transition-colors ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bottom Status */}
                    <div className="relative z-10 pt-8 border-t border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Clock size={14} />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Estimated Time</p>
                                <p className="text-xs font-medium text-slate-300">~2 mins remaining</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 flex flex-col relative bg-white/40">
                    {/* Mobile Header (Visible only on small screens) */}
                    <div className="md:hidden px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-md sticky top-0 z-20">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                <span className="font-bold text-xs">{step}/4</span>
                            </div>
                            <span className="font-bold text-gray-900">{currentStepTitle()}</span>
                        </div>
                    </div>

                    {/* Scrolable Form Area */}
                    <div className="flex-1 overflow-y-auto px-8 md:px-16 py-12 scroll-smooth">
                        <div className="max-w-2xl mx-auto">

                            {/* Header Text */}
                            <div className="mb-10 animate-fadeIn">
                                <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">{currentStepTitle()}</h1>
                                <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-lg">{currentStepDesc()}</p>
                            </div>

                            {/* STEP 1: IDENTITY */}
                            {step === 1 && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Company Name</label>
                                            <input
                                                type="text"
                                                value={profile.displayName}
                                                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                                                className="w-full px-6 py-5 glass-input rounded-2xl outline-none text-xl font-bold text-slate-800 placeholder:text-slate-300 font-sans"
                                                placeholder="e.g. Acme Industries"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Timezone</label>
                                            <div className="relative group">
                                                <Clock className="absolute left-6 top-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" size={20} />
                                                <select
                                                    value={profile.timezone}
                                                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                                                    className="w-full pl-14 pr-6 py-5 glass-input rounded-2xl outline-none appearance-none font-medium text-slate-700 cursor-pointer text-lg"
                                                >
                                                    <option value="UTC">UTC (Universal Time)</option>
                                                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                                                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                                    <option value="Europe/London">London (GMT)</option>
                                                    <option value="Asia/Kolkata">India Standard Time</option>
                                                </select>
                                                <div className="absolute right-6 top-5 text-slate-400 pointer-events-none">
                                                    <ArrowRight size={20} className="rotate-90" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-3 block">Brand Logo</label>
                                        <div className="border border-dashed border-slate-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:bg-white/60 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-100/50 transition-all cursor-pointer group bg-white/20">
                                            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 border border-slate-100">
                                                <Upload size={28} className="text-indigo-500" />
                                            </div>
                                            <p className="font-bold text-slate-800 text-lg">Click to upload brand logo</p>
                                            <p className="text-sm text-slate-500 mt-2 font-medium">SVG, PNG, JPG (max 2MB)</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: STRUCTURE */}
                            {step === 2 && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="grid grid-cols-1 gap-4">
                                        {departments.map((dept, idx) => (
                                            <div
                                                key={idx}
                                                className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300 animate-fadeIn"
                                                style={{ animationDelay: `${idx * 0.05}s` }}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                        <Users size={20} />
                                                    </div>
                                                    <span className="font-bold text-lg text-slate-800">{dept}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (departments.length > 1) {
                                                            setDepartments(departments.filter((_, i) => i !== idx));
                                                        }
                                                    }}
                                                    disabled={departments.length === 1}
                                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all
                                                        ${departments.length === 1
                                                            ? "text-slate-200 cursor-not-allowed"
                                                            : "text-slate-400 hover:text-red-500 hover:bg-red-50"}`}
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        ))}

                                        <div className="relative group mt-2">
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                                <Plus size={22} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Add another department..."
                                                className="w-full pl-16 pr-6 py-5 border-2 border-dashed border-slate-300 bg-white/30 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 transition-all font-medium text-lg placeholder:text-slate-400"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                                        setDepartments([...departments, e.target.value.trim()]);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: INVITES */}
                            {step === 3 && (
                                <div className="space-y-8 animate-fadeIn">
                                    {/* Bulk Upload Section */}
                                    <div className="p-6 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-indigo-100 hover:shadow-lg hover:shadow-indigo-100/50 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
                                                <Upload size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-800 text-lg mb-1">Bulk Upload Team</h3>
                                                <p className="text-sm text-slate-500 font-medium">Upload an Excel/CSV file to auto-invite everyone at once.</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-indigo-200/20 flex items-center justify-center text-indigo-600">
                                                <ArrowRight size={20} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative flex py-2 items-center">
                                        <div className="flex-grow border-t border-slate-200"></div>
                                        <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Or Add Manually</span>
                                        <div className="flex-grow border-t border-slate-200"></div>
                                    </div>

                                    <div className="space-y-4">
                                        {invites.map((invite, idx) => (
                                            <div key={idx} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all relative group animate-fadeIn">
                                                {invites.length > 1 && (
                                                    <button
                                                        onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                                                        className="absolute -right-2 -top-2 w-8 h-8 flex items-center justify-center bg-white shadow-md rounded-full text-slate-400 hover:text-red-500 hover:scale-110 transition-all border border-slate-100 opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <input
                                                        type="text"
                                                        value={invite.name}
                                                        onChange={(e) => {
                                                            const newInvites = [...invites];
                                                            newInvites[idx].name = e.target.value;
                                                            setInvites(newInvites);
                                                        }}
                                                        placeholder="Full Name"
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                                                    />
                                                    <input
                                                        type="email"
                                                        value={invite.email}
                                                        onChange={(e) => {
                                                            const newInvites = [...invites];
                                                            newInvites[idx].email = e.target.value;
                                                            setInvites(newInvites);
                                                        }}
                                                        placeholder={`email@${user?.company?.domain || 'company.com'}`}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="relative">
                                                        <select
                                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-sm text-slate-700 appearance-none cursor-pointer"
                                                            value={invite.role}
                                                            onChange={(e) => {
                                                                const newInvites = [...invites];
                                                                newInvites[idx].role = e.target.value;
                                                                setInvites(newInvites);
                                                            }}
                                                        >
                                                            <option value="member">Member</option>
                                                            <option value="manager">Manager</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                        <div className="absolute right-3 top-3.5 text-slate-400 pointer-events-none">
                                                            <ArrowRight size={14} className="rotate-90" />
                                                        </div>
                                                    </div>

                                                    <div className="relative">
                                                        <select
                                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-sm text-slate-700 appearance-none cursor-pointer"
                                                            value={invite.department}
                                                            onChange={(e) => {
                                                                const newInvites = [...invites];
                                                                newInvites[idx].department = e.target.value;
                                                                setInvites(newInvites);
                                                            }}
                                                        >
                                                            <option value="">Select Dept</option>
                                                            {departments.map((dept, i) => (
                                                                <option key={i} value={dept}>{dept}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-3.5 text-slate-400 pointer-events-none">
                                                            <ArrowRight size={14} className="rotate-90" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setInvites([...invites, { name: "", email: "", role: "member", department: "" }])}
                                        className="w-full py-4 bg-white/50 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-2xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                            <Plus size={14} />
                                        </div>
                                        <span>Add Another Member</span>
                                    </button>
                                </div>
                            )}

                            {/* STEP 4: COMPLETION */}
                            {step === 4 && (
                                <div className="text-center py-12 animate-fadeIn">
                                    <div className="relative w-32 h-32 mx-auto mb-10">
                                        <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-20"></div>
                                        <div className="relative w-full h-full bg-gradient-to-br from-green-50 to-emerald-100 rounded-full flex items-center justify-center shadow-xl shadow-green-100 border border-white">
                                            <CheckCircle size={56} className="text-green-500 drop-shadow-sm" />
                                        </div>
                                    </div>

                                    <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Configuration Complete!</h2>
                                    <p className="text-lg text-slate-500 mb-12 max-w-md mx-auto leading-relaxed">
                                        Your workspace is ready. We've set up your departments and sent out the invites.
                                    </p>

                                    <div className="bg-white/80 rounded-3xl p-8 shadow-sm border border-white max-w-md mx-auto text-left relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                                        <h4 className="font-bold text-slate-900 mb-6 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles size={12} className="text-indigo-500" /> Summary
                                        </h4>
                                        <ul className="space-y-4">
                                            {[
                                                { label: "Profile Configured", val: "Done" },
                                                { label: "Departments Created", val: departments.length },
                                                { label: "Invites Queued", val: invites.filter(i => i.email).length }
                                            ].map((item, i) => (
                                                <li key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                                    <span className="text-slate-500 font-medium">{item.label}</span>
                                                    <span className="font-bold text-slate-900 bg-slate-50 px-3 py-1 rounded-full text-sm">{item.val}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="shrink-0 px-8 md:px-16 py-8 border-t border-white/40 flex items-center justify-between bg-white/40 backdrop-blur-md sticky bottom-0 z-20">
                        <div>
                            {step > 1 && step < 4 && (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="group text-slate-500 hover:text-slate-900 font-bold flex items-center gap-2 px-5 py-3 rounded-xl hover:bg-white/50 transition-all"
                                >
                                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                    <span>Back</span>
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={isLoading}
                            className={`
                                relative px-10 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 
                                hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 flex items-center gap-3 overflow-hidden group
                                ${step === 4 ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-200 hover:shadow-indigo-300 border border-white/20" : ""}
                            `}
                        >
                            <span className="relative z-10 flex items-center gap-3">
                                {isLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {step === 4 ? "Launch Workspace" : "Continue"}
                                        {step !== 4 && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                                    </>
                                )}
                            </span>
                            {/* Subtle shine effect on hover */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        </button>
                    </div>
                </div>
            </div>

            <p className="fixed bottom-4 text-slate-400 text-xs font-medium opacity-50">© 2026 Chttrix Inc.</p>
        </div>
    );
};

export default CompanySetup;
