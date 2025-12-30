import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
    Building2, Users, Mail, CheckCircle2,
    ArrowRight, ArrowLeft, Upload, Clock, Plus, X
} from 'lucide-react';

const CompanySetup = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form States
    const [profile, setProfile] = useState({
        displayName: user?.company?.name || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    const [departments, setDepartments] = useState([
        "Engineering", "Sales", "Marketing"
    ]); // Defaults, will fetch real ones later ideally

    const [invites, setInvites] = useState([
        { email: "", role: "member" }
    ]);

    const totalSteps = 4;

    const handleNext = async () => {
        setIsLoading(true);
        try {
            // Save current step data to backend
            await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company.id}/setup`,
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
                // Finish
                await refreshUser(); // Update context with isSetupComplete: true
                navigate('/workspace'); // Or admin dashboard
            }
        } catch (error) {
            console.error("Setup Error", error);
            // Handle error toast
        } finally {
            setIsLoading(false);
        }
    };

    // Render Steps
    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Company Profile</h2>
                            <p className="text-gray-500">Let's make your workspace feel like home.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Display Name</label>
                                <input
                                    type="text"
                                    value={profile.displayName}
                                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-gray-900 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Timezone</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                    <select
                                        value={profile.timezone}
                                        onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none bg-white text-gray-900"
                                    >
                                        <option value="UTC">UTC (Universal Time)</option>
                                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                        <option value="Europe/London">London (GMT)</option>
                                        <option value="Asia/Kolkata">India Standard Time</option>
                                        {/* Add more as needed */}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer group">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Upload size={20} />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">Click to upload</p>
                                    <p className="text-xs text-gray-500">SVG, PNG, JPG (max 2MB)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return ( // Departments
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Define Departments</h2>
                            <p className="text-gray-500">Organize your team structure.</p>
                        </div>

                        <div className="space-y-3">
                            {departments.map((dept, idx) => (
                                <div key={idx} className="flex items-center gap-2 group">
                                    <div className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl relative">
                                        <span className="font-medium text-gray-700">{dept}</span>
                                    </div>
                                    <button
                                        onClick={() => setDepartments(departments.filter((_, i) => i !== idx))}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ))}

                            <div className="flex items-center gap-2 mt-4">
                                <input
                                    type="text"
                                    placeholder="Add another department..."
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            setDepartments([...departments, e.target.value.trim()]);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <button className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return ( // Invites
                    <div className="space-y-6 animate-fadeIn">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Invite Your Team</h2>
                            <p className="text-gray-500">Get your key people in right away.</p>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {invites.map((invite, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <Mail className="absolute left-3 top-3.5 text-gray-400" size={16} />
                                        <input
                                            type="email"
                                            value={invite.email}
                                            onChange={(e) => {
                                                const newInvites = [...invites];
                                                newInvites[idx].email = e.target.value;
                                                setInvites(newInvites);
                                            }}
                                            placeholder="colleague@company.com"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 outline-none text-gray-900 bg-white"
                                        />
                                    </div>
                                    <select
                                        className="w-32 py-3 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900"
                                        value={invite.role}
                                        onChange={(e) => {
                                            const newInvites = [...invites];
                                            newInvites[idx].role = e.target.value;
                                            setInvites(newInvites);
                                        }}
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                        <option value="guest">Guest</option>
                                    </select>
                                    {invites.length > 1 && (
                                        <button
                                            onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setInvites([...invites, { email: "", role: "member" }])}
                            className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 font-medium rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Add Another
                        </button>
                    </div>
                );
            case 4:
                return ( // Completion
                    <div className="text-center py-10 animate-fadeIn">
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-slow">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-4">You're All Set!</h2>
                        <p className="text-gray-500 mb-10 max-w-md mx-auto">
                            Your workspace has been configured. It's time to start collaborating.
                        </p>

                        <div className="bg-gray-50 rounded-2xl p-6 text-left max-w-sm mx-auto mb-8 border border-gray-100">
                            <h4 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Summary</h4>
                            <ul className="space-y-3 text-sm text-gray-600">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    Profile Updated
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    {departments.length} Departments Configured
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    {invites.filter(i => i.email).length} Invites Queued
                                </li>
                            </ul>
                        </div>
                    </div>
                );
            default: return null;
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Sidebar / Progress */}
            <div className="hidden md:flex w-80 bg-white border-r border-gray-100 flex-col p-8">
                <div className="mb-10 flex items-center gap-2 text-indigo-600 font-black text-2xl">
                    <Building2 /> Chttrix
                </div>

                <div className="space-y-8 relative">
                    {/* Connecting Line */}
                    <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-100 -z-10"></div>

                    {[
                        { title: "Company Profile", icon: Building2, desc: "Branding & Timezone" },
                        { title: "Departments", icon: Users, desc: "Team Structure" },
                        { title: "Invites", icon: Mail, desc: "Add Members" },
                        { title: "Completion", icon: CheckCircle2, desc: "Review & Launch" },
                    ].map((s, i) => {
                        const sNum = i + 1;
                        const isActive = step === sNum;
                        const isCompleted = step > sNum;

                        return (
                            <div key={i} className={`flex gap-4 group ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{sNum}</span>}
                                </div>
                                <div className="pt-1">
                                    <h3 className={`font-bold text-sm ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{s.title}</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-xl shadow-indigo-100/50 p-8 md:p-12 relative overflow-hidden min-h-[500px] flex flex-col">

                        {renderStep()}

                        {/* Navigation Footer */}
                        <div className="mt-auto pt-8 flex items-center justify-between border-t border-gray-50">
                            {step > 1 && step < 4 && (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="px-6 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors flex items-center gap-2"
                                >
                                    <ArrowLeft size={18} /> Back
                                </button>
                            )}
                            <div className="flex-1"></div> {/* Spacer */}

                            <button
                                onClick={handleNext}
                                disabled={isLoading}
                                className={`px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 ${step === 4 ? 'w-full justify-center' : ''}`}
                            >
                                {isLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <>
                                        {step === 4 ? "Launch Workspace" : "Continue"}
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
