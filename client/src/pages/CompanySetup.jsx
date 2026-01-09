import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
    Building, Users, Mail, CheckCircle,
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
            `}</style>

            {/* Premium Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-indigo-100/40 via-purple-50/40 to-transparent blur-[100px] animate-float"></div>
                <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-bl from-blue-100/40 via-teal-50/40 to-transparent blur-[100px] animate-float-delayed"></div>
            </div>

            {/* Navbar */}
            <nav className="relative z-50 px-8 py-6 flex justify-between items-center max-w-7xl mx-auto w-full shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/80 backdrop-blur rounded-xl shadow-lg shadow-indigo-100/50 border border-white overflow-hidden">
                        <img src="/chttrix-logo.jpg" alt="Chttrix" className="w-full h-full object-cover" />
                    </div>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? "w-8 bg-indigo-600" : "w-2 bg-gray-200"}`} />
                    ))}
                </div>
            </nav>

            {/* Main Content Card */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden">
                <div className="w-full max-w-5xl h-[80vh] bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white/60 flex overflow-hidden">

                    {/* Left Panel: Context & Info */}
                    <div className="w-1/3 bg-white/40 border-r border-white/50 p-10 flex flex-col hidden md:flex">
                        <div className="mb-10">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100">
                                <Sparkles size={12} /> Setup Wizard
                            </span>
                            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">{currentStepTitle()}</h1>
                            <p className="text-gray-500 leading-relaxed">{currentStepDesc()}</p>
                        </div>

                        {/* Progress Steps Details */}
                        <div className="space-y-6 mt-8">
                            {[
                                { id: 1, title: "Identity", icon: Target },
                                { id: 2, title: "Structure", icon: Users },
                                { id: 3, title: "People", icon: Mail },
                                { id: 4, title: "Launch", icon: Zap },
                            ].map((item) => (
                                <div key={item.id} className={`flex items-center gap-4 transition-opacity duration-300 ${step === item.id ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${step === item.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : step > item.id ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                                        {step > item.id ? <CheckCircle size={18} /> : <item.icon size={18} />}
                                    </div>
                                    <span className={`font-bold ${step === item.id ? 'text-gray-900' : 'text-gray-400'}`}>{item.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Panel: Form Area */}
                    <div className="flex-1 flex flex-col relative bg-white/20">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">

                            {/* STEP 1: IDENTITY */}
                            {step === 1 && (
                                <div className="max-w-md mx-auto space-y-8 animate-fadeIn">
                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Company Display Name</label>
                                        <input
                                            type="text"
                                            value={profile.displayName}
                                            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                                            className="w-full px-5 py-4 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 rounded-2xl outline-none transition-all shadow-sm text-gray-900 text-lg"
                                            placeholder="e.g. Acme Corp"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-gray-700 ml-1">Timezone</label>
                                        <div className="relative group">
                                            <Clock className="absolute left-5 top-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                            <select
                                                value={profile.timezone}
                                                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                                                className="w-full pl-12 pr-5 py-4 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 rounded-2xl outline-none appearance-none transition-all shadow-sm text-gray-900 font-medium cursor-pointer"
                                            >
                                                <option value="UTC">UTC (Universal Time)</option>
                                                <option value="America/New_York">Eastern Time (US & Canada)</option>
                                                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                                <option value="Europe/London">London (GMT)</option>
                                                <option value="Asia/Kolkata">India Standard Time</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <label className="text-sm font-bold text-gray-700 ml-1 mb-2 block">Brand Logo</label>
                                        <div className="border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center hover:bg-indigo-50/50 hover:border-indigo-300 transition-all cursor-pointer group bg-white/50">
                                            <div className="w-16 h-16 bg-white shadow-md rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-indigo-500">
                                                <Upload size={24} />
                                            </div>
                                            <p className="font-bold text-gray-900">Upload Logo</p>
                                            <p className="text-xs text-gray-500 mt-1">SVG, PNG, JPG (max 2MB)</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: STRUCTURE */}
                            {step === 2 && (
                                <div className="max-w-lg mx-auto space-y-6 animate-fadeIn">
                                    <div className="space-y-3">
                                        {departments.map((dept, idx) => (
                                            <div key={idx} className="flex items-center gap-3 group animate-slideIn" style={{ animationDelay: `${idx * 0.1}s` }}>
                                                <div className="flex-1 px-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-between group-hover:border-indigo-300 group-hover:shadow-md transition-all">
                                                    <span className="font-bold text-gray-700">{dept}</span>
                                                    <button
                                                        onClick={() => {
                                                            if (departments.length > 1) {
                                                                setDepartments(departments.filter((_, i) => i !== idx));
                                                            }
                                                        }}
                                                        disabled={departments.length === 1}
                                                        title={departments.length === 1 ? "At least one department is required" : "Remove department"}
                                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${departments.length === 1
                                                            ? "text-gray-200 cursor-not-allowed"
                                                            : "text-gray-300 hover:text-red-500 hover:bg-red-50"
                                                            }`}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="relative group pt-4">
                                            <div className="absolute left-5 top-8 text-gray-400">
                                                <Plus size={20} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Add new department..."
                                                className="w-full pl-12 pr-6 py-4 bg-white/50 border-2 border-dashed border-gray-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50/50 rounded-2xl outline-none placeholder:text-gray-400 font-medium transition-all"
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
                                <div className="max-w-lg mx-auto space-y-6 animate-fadeIn">
                                    {/* Bulk Upload Section */}
                                    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-dashed border-purple-200">
                                        <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Upload size={16} /> Bulk Upload (Optional)
                                        </h3>
                                        <p className="text-xs text-gray-600 mb-4">Upload an Excel/CSV file with employee data to auto-create accounts.</p>
                                        <label className="block">
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                className="hidden"
                                                onChange={(e) => {

                                                }}
                                            />
                                            <div className="cursor-pointer py-3 px-4 bg-white border-2 border-purple-300 rounded-xl text-center hover:bg-purple-50 transition-all flex items-center justify-center gap-2 font-bold text-purple-700">
                                                <Upload size={18} />
                                                <span>Choose Excel/CSV File</span>
                                            </div>
                                        </label>
                                        <p className="text-xs text-gray-500 mt-2 italic">
                                            💡 Future: Automatic account creation with domain validation
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 my-6">
                                        <div className="flex-1 h-px bg-gray-200"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Or Add Manually</span>
                                        <div className="flex-1 h-px bg-gray-200"></div>
                                    </div>

                                    <div className="space-y-4 max-h-[400px]">
                                        {invites.map((invite, idx) => (
                                            <div key={idx} className="flex flex-col gap-3 animate-slideIn p-4 bg-gray-50 rounded-2xl border border-gray-100 relative">
                                                {invites.length > 1 && (
                                                    <button
                                                        onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                                                        className="absolute right-2 top-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {/* Name */}
                                                    <div className="relative group">
                                                        <Users className="absolute left-4 top-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                                        <input
                                                            type="text"
                                                            value={invite.name}
                                                            onChange={(e) => {
                                                                const newInvites = [...invites];
                                                                newInvites[idx].name = e.target.value;
                                                                setInvites(newInvites);
                                                            }}
                                                            placeholder="Full Name"
                                                            className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl outline-none transition-all shadow-sm text-gray-900"
                                                        />
                                                    </div>

                                                    {/* Email */}
                                                    <div className="relative group">
                                                        <Mail className="absolute left-4 top-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                                        <input
                                                            type="email"
                                                            value={invite.email}
                                                            onChange={(e) => {
                                                                const newInvites = [...invites];
                                                                newInvites[idx].email = e.target.value;
                                                                setInvites(newInvites);
                                                            }}
                                                            placeholder={`colleague@${user?.company?.domain || 'company.com'}`}
                                                            className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-xl outline-none transition-all shadow-sm text-gray-900"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {/* Role */}
                                                    <select
                                                        className="w-full py-3.5 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-indigo-500"
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

                                                    {/* Department */}
                                                    <select
                                                        className="w-full py-3.5 px-4 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-indigo-500"
                                                        value={invite.department}
                                                        onChange={(e) => {
                                                            const newInvites = [...invites];
                                                            newInvites[idx].department = e.target.value;
                                                            setInvites(newInvites);
                                                        }}
                                                    >
                                                        <option value="">Select Department</option>
                                                        {departments.map((dept, i) => (
                                                            <option key={i} value={dept}>{dept}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {invite.email && user?.company?.domain && !invite.email.endsWith(`@${user.company.domain}`) && (
                                                    <p className="text-xs text-red-500 mt-1 ml-2">⚠️ Email must match company domain (@{user.company.domain})</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setInvites([...invites, { name: "", email: "", role: "member", department: "" }])}
                                        className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 font-bold rounded-2xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} /> Add Another Member
                                    </button>
                                </div>
                            )}

                            {/* STEP 4: COMPLETION */}
                            {step === 4 && (
                                <div className="max-w-md mx-auto text-center py-10 animate-fadeIn">
                                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-100/50 animate-bounce">
                                        <CheckCircle size={48} />
                                    </div>
                                    <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Ready to Blast Off!</h2>
                                    <p className="text-gray-500 mb-10 text-lg">
                                        Your workspace has been successfully configured.
                                    </p>

                                    <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 text-left">
                                        <h4 className="font-bold text-gray-900 mb-4 text-xs uppercase tracking-wider">Configuration Summary</h4>
                                        <ul className="space-y-4">
                                            <li className="flex items-center gap-3 text-gray-600">
                                                <div className="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle size={14} /></div>
                                                <span className="font-medium">Profile & Branding Set</span>
                                            </li>
                                            <li className="flex items-center gap-3 text-gray-600">
                                                <div className="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle size={14} /></div>
                                                <span className="font-medium">{departments.length} Departments Created</span>
                                            </li>
                                            <li className="flex items-center gap-3 text-gray-600">
                                                <div className="w-6 h-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle size={14} /></div>
                                                <span className="font-medium">{invites.filter(i => i.email).length} Team Invites Sent</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer (Navigation) */}
                        <div className="shrink-0 px-10 py-8 border-t border-white/40 flex items-center justify-between bg-white/30 backdrop-blur-sm">
                            {step > 1 && step < 4 ? (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="text-gray-500 hover:text-gray-900 font-bold flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/50 transition-colors"
                                >
                                    <ArrowLeft size={18} /> Back
                                </button>
                            ) : <div></div>}

                            <button
                                onClick={handleNext}
                                disabled={isLoading}
                                className={`
                                    relative px-8 py-3.5 bg-gray-900 text-white font-bold rounded-2xl shadow-xl shadow-gray-200 
                                    hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-3
                                    ${step === 4 ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-200 hover:shadow-indigo-300" : ""}
                                `}
                            >
                                {isLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {step === 4 ? "Finish Setup" : "Continue"}
                                        {step !== 4 && <ArrowRight size={18} />}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanySetup;
