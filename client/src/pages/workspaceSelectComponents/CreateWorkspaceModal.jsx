import React, { useEffect } from 'react';
import {
    Rocket, X, CheckCircle2, ArrowRight, AlertCircle,
    Zap, Shield, Check
} from 'lucide-react';

/**
 * CreateWorkspaceModal - Multi-step workspace creation wizard
 * Pure presentational component - entirely controlled by props, no API calls or business logic
 * 
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback to close modal and reset state
 * @param {number} createStep - Current step (1-4)
 * @param {function} setCreateStep - Setter for current step
 * @param {Object} createData - Form data {name, adminName, icon, color, rules, invites}
 * @param {function} setCreateData - Setter for form data
 * @param {string} nameError - Validation error for name field
 * @param {function} setNameError - Setter for name error
 * @param {boolean} termsAccepted - Whether terms checkbox is checked
 * @param {function} setTermsAccepted - Setter for terms checkbox
 * @param {function} onSubmit - Callback for final submission (e parameter)
 * @param {function} getIconComponent - Helper to get icon component from icon name
 * @param {Object} user - User object for profile display
 */
const CreateWorkspaceModal = ({
    isOpen,
    onClose,
    createStep,
    setCreateStep,
    createData,
    setCreateData,
    nameError,
    setNameError,
    termsAccepted,
    setTermsAccepted,
    onSubmit,
    getIconComponent,
    user
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full fixed inset-0 md:relative md:inset-auto h-full md:h-[80vh] md:max-w-5xl md:min-h-[600px] md:rounded-3xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col md:flex-row border-0 md:border md:border-slate-200 dark:border-slate-800 z-50">

                {/* Sidebar Steps (Left) - Hidden on Mobile, Visible on Desktop */}
                <div className="hidden md:flex w-64 bg-slate-50/80 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-6 flex-col justify-between backdrop-blur-sm">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-8 px-2 flex items-center gap-2">
                            <Rocket className="text-indigo-600" />
                            <span>New Workspace</span>
                        </h3>

                        <div className="space-y-2">
                            {[
                                { step: 1, label: "Basics", desc: "Name & Icon" },
                                { step: 2, label: "Branding", desc: "Colors & Theme" },
                                { step: 3, label: "Admin", desc: "Review Owner" },
                                { step: 4, label: "Members", desc: "Invite Team" }
                            ].map((s) => (
                                <button
                                    key={s.step}
                                    onClick={() => createStep > s.step && setCreateStep(s.step)}
                                    disabled={createStep < s.step}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${createStep === s.step
                                        ? 'bg-white dark:bg-slate-800 shadow-lg shadow-indigo-500/5 border border-indigo-100 dark:border-indigo-900'
                                        : createStep > s.step
                                            ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            : 'opacity-50 cursor-not-allowed text-slate-400'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${createStep === s.step
                                        ? 'bg-indigo-600 text-white'
                                        : createStep > s.step
                                            ? 'bg-green-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                        {createStep > s.step ? <CheckCircle2 size={16} /> : s.step}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${createStep === s.step ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {s.label}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-500">
                                            {s.desc}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-slate-800 hidden md:block">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors px-2"
                        >
                            <X size={16} /> Cancel Creation
                        </button>
                    </div>
                </div>

                {/* Content Area (Right) */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative h-full">
                    {/* Mobile Header (Visible only on Mobile) */}
                    <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10">
                        <div className="flex items-center gap-3">
                            {createStep > 1 && (
                                <button
                                    onClick={() => setCreateStep(s => s - 1)}
                                    className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                                >
                                    <ArrowRight className="rotate-180" size={20} />
                                </button>
                            )}
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
                                    Step {createStep} of 4
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {[
                                        "Name & Icon",
                                        "Branding & Theme",
                                        "Confirm Admin",
                                        "Invite Members"
                                    ][createStep - 1]}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-10 touch-auto overscroll-contain pb-32 md:pb-6">
                        <form id="create-workspace-form" onSubmit={onSubmit} className="max-w-3xl mx-auto min-h-0 md:h-full flex flex-col justify-start md:justify-center">

                            {/* Step 1: Basics */}
                            {createStep === 1 && (
                                <div className="space-y-6 md:space-y-8 animate-fadeIn">
                                    <div className="mb-4 md:mb-6">
                                        <h2 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Let's build your HQ</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg">Give your workspace a distinct identity.</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Workspace Name</label>
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="e.g. Acme Corp, Engineering Team"
                                                    value={createData.name}
                                                    onChange={(e) => {
                                                        setCreateData({ ...createData, name: e.target.value });
                                                        setNameError("");
                                                    }}
                                                    className={`w-full px-4 py-3 md:px-5 md:py-4 bg-slate-50 dark:bg-slate-950/50 border ${nameError
                                                        ? 'border-red-300 focus:border-red-500 ring-4 ring-red-500/10'
                                                        : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                                                        } rounded-xl md:rounded-2xl focus:outline-none transition-all text-base md:text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-400`}
                                                />
                                                {nameError && <p className="mt-2 text-xs font-bold text-red-500 animate-pulse flex items-center gap-1"><AlertCircle size={12} /> {nameError}</p>}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description (Optional)</label>
                                                <textarea
                                                    placeholder="What's this workspace for? Share your mission or guidelines."
                                                    value={createData.rules || ""}
                                                    onChange={(e) => setCreateData({ ...createData, rules: e.target.value })}
                                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium h-32 resize-none text-slate-700 dark:text-slate-200 text-base"
                                                ></textarea>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Choose an Icon</label>
                                            <div className="grid grid-cols-4 gap-3 md:gap-3">
                                                {['rocket', 'briefcase', 'zap', 'palette', 'globe', 'trophy', 'target', 'flame', 'microscope', 'shield', 'lightbulb', 'sparkles'].map((iconName) => {
                                                    const IconCmp = getIconComponent(iconName);
                                                    return (
                                                        <button
                                                            key={iconName}
                                                            type="button"
                                                            onClick={() => setCreateData({ ...createData, icon: iconName })}
                                                            className={`aspect-square rounded-xl md:rounded-2xl border-2 transition-all flex items-center justify-center ${createData.icon === iconName
                                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 shadow-md ring-4 ring-indigo-500/10'
                                                                : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                }`}
                                                        >
                                                            <IconCmp size={24} className="md:w-6 md:h-6 w-5 h-5" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Branding */}
                            {createStep === 2 && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="mb-6">
                                        <h2 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Brand your Space</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg">Pick a color that matches your team's vibe.</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 items-start">
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Preset Colors</label>
                                                <div className="grid grid-cols-5 gap-3 md:gap-3">
                                                    {['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'].map((color) => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            onClick={() => setCreateData({ ...createData, color })}
                                                            className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-300 group relative overflow-hidden ${createData.color === color ? 'ring-4 ring-offset-2 ring-indigo-500 scale-95 shadow-md' : 'hover:scale-110'
                                                                }`}
                                                            style={{ backgroundColor: color }}
                                                        >
                                                            {createData.color === color && <Check className="text-white drop-shadow-md" size={16} strokeWidth={4} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Custom Color</label>
                                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                                                    <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="color"
                                                            value={createData.color}
                                                            onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 m-0 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Pick a custom hex</div>
                                                        <input
                                                            type="text"
                                                            value={createData.color}
                                                            onChange={(e) => setCreateData({ ...createData, color: e.target.value })}
                                                            placeholder="#000000"
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden md:flex bg-slate-100 dark:bg-slate-950/50 p-4 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 flex-col items-center justify-center text-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Live Preview</span>

                                            {/* Workspace Card Preview */}
                                            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-4 md:p-6 shadow-xl border border-slate-100 dark:border-slate-800 transform transition-all duration-500 hover:scale-105">
                                                <div
                                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 mx-auto transition-colors duration-300"
                                                    style={{ backgroundColor: createData.color }}
                                                >
                                                    {React.createElement(getIconComponent(createData.icon), { size: 32 })}
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{createData.name || "Workspace Name"}</h3>
                                                <p className="text-sm text-slate-500 mb-4">Your awesome new workspace</p>
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="flex -space-x-2">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800"></div>
                                                        ))}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">+5 members</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Admin */}
                            {createStep === 3 && (
                                <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
                                    <div className="mb-4 md:mb-6 text-center md:text-left">
                                        <h2 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">You're in charge</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg">Confirming you as the Workspace Owner.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                        {/* Left Column: Profile Card */}
                                        <div className="relative group h-auto md:h-full">
                                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                                            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl h-full flex flex-col justify-center items-center text-center">
                                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-4 p-1 bg-gradient-to-br from-indigo-500 to-purple-600">
                                                    <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                        {user?.profilePicture ? (
                                                            <img src={user.profilePicture} alt="User" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-3xl font-black text-slate-700 dark:text-slate-300">
                                                                {user?.username?.charAt(0).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-1">{user?.username}</h3>
                                                <p className="text-slate-500 dark:text-slate-400 mb-6">{user?.email}</p>

                                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full font-bold text-sm border border-indigo-100 dark:border-indigo-800">
                                                    <Shield size={16} /> Workspace Owner
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Superpowers & Terms */}
                                        <div className="flex flex-col gap-6 h-full">
                                            <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-left flex-1">
                                                <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                    <Zap size={18} className="text-amber-500" /> Owner Superpowers
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3 mb-6">
                                                    {['Manage Billings & Plans', 'Delete or Archive Workspace', 'Invite/Remove Team Members', 'Configure Integrations & API'].map((p, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                            <CheckCircle2 size={14} className="text-green-500 shrink-0" /> {p}
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 mt-auto">
                                                    <label className="flex items-start gap-3 cursor-pointer group">
                                                        <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${termsAccepted
                                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
                                                            }`}>
                                                            {termsAccepted && <Check size={14} strokeWidth={3} />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={termsAccepted}
                                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                                        />
                                                        <div className="text-sm">
                                                            <span className="font-bold text-slate-700 dark:text-slate-300">I accept the responsibilities of a Workspace Owner.</span>
                                                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                                                                By continuing, you acknowledge that you are the primary administrator for this workspace.
                                                            </p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Members */}
                            {createStep === 4 && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="mb-4 md:mb-6">
                                        <h2 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Gather your team</h2>
                                        <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg">Work is better together. Invite them now.</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Left Column: Email Input */}
                                        <div className="lg:col-span-2 flex flex-col h-full">
                                            <div className="flex-1 flex flex-col h-full">
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Addresses</label>
                                                <textarea
                                                    placeholder="sarah@example.com, alex@design.co..."
                                                    value={createData.invites || ""}
                                                    onChange={(e) => setCreateData({ ...createData, invites: e.target.value })}
                                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium flex-1 resize-none text-slate-700 dark:text-slate-200 font-mono text-sm min-h-[220px]"
                                                ></textarea>
                                                <p className="text-xs text-slate-400 mt-2">Separate multiple emails with commas.</p>
                                            </div>
                                        </div>

                                        {/* Right Column: Skip Card */}
                                        <div className="h-full hidden md:block">
                                            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 h-full flex flex-col justify-center">
                                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                                                    <Rocket size={24} />
                                                </div>
                                                <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-2">Skip for now?</h4>
                                                <p className="text-sm text-blue-700 dark:text-blue-300/80 mb-6">You can always invite members later from workspace settings.</p>
                                                <button
                                                    type="button"
                                                    onClick={onSubmit}
                                                    className="w-full py-3 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mt-auto"
                                                >
                                                    Skip & Launch
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </form>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between items-center shrink-0 safe-pb absolute md:relative bottom-0 left-0 right-0 z-20">
                        {createStep > 1 ? (
                            <button
                                onClick={() => setCreateStep(s => s - 1)}
                                className="hidden md:flex h-12 md:h-auto px-6 py-0 md:py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors items-center justify-center"
                            >
                                Back
                            </button>
                        ) : (
                            <div className="w-4 md:w-20"></div> // Spacer
                        )}

                        {/* Mobile specific back button space preservation */}
                        <div className="md:hidden">
                            {createStep === 4 && (
                                <button
                                    type="button"
                                    onClick={onSubmit}
                                    className="text-blue-600 dark:text-blue-400 font-bold text-sm px-2"
                                >
                                    Skip
                                </button>
                            )}
                        </div>

                        {createStep < 4 ? (
                            <button
                                onClick={() => {
                                    if (createStep === 1 && !createData.name.trim()) {
                                        setNameError("Workspace name is required");
                                        return;
                                    }
                                    setCreateStep(s => s + 1);
                                }}
                                disabled={createStep === 3 && !termsAccepted}
                                className={`h-12 md:h-auto w-full md:w-auto px-6 md:px-8 py-0 md:py-3 bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 ${createStep === 3 && !termsAccepted
                                    ? 'opacity-50 cursor-not-allowed bg-slate-400 shadow-none'
                                    : 'hover:bg-indigo-700 hover:shadow-indigo-500/30 hover:-translate-y-0.5'
                                    }`}
                            >
                                Next <span className="hidden md:inline">Step</span> <ArrowRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={onSubmit}
                                className="h-12 md:h-auto px-6 md:px-10 py-0 md:py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                            >
                                <Rocket size={18} /> Launch <span className="hidden md:inline">Workspace</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CreateWorkspaceModal;
