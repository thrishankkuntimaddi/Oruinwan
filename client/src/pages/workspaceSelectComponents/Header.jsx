import React from 'react';
import { CircleHelp, Search, BookOpen, Command, Bug, Sparkles, Shield, Briefcase, Settings, LogOut } from 'lucide-react';

/**
 * Header - Top navigation bar with logo, help popover, console links, profile, settings, logout
 * Pure presentational component - all interactions delegated to parent via props
 * 
 * @param {boolean} showHelp - Whether help popover is open
 * @param {function} setShowHelp - Setter for showHelp
 * @param {function} onHelpModalOpen - Callback to open specific help modal (modalName)
 * @param {Object} user - User object for display (username, email, companyRole, profilePicture)
 * @param {function} onProfileClick - Callback when clicking profile button
 * @param {function} onSettingsClick - Callback when clicking settings icon
 * @param {function} onLogout - Callback when clicking logout icon
 * @param {function} onOwnerConsoleClick - Callback when clicking Owner Console link
 * @param {function} onAdminConsoleClick - Callback when clicking Admin Console link
 * @param {function} onManagerConsoleClick - Callback when clicking Manager Console link
 */
const Header = ({
    showHelp,
    setShowHelp,
    onHelpModalOpen,
    user,
    onProfileClick,
    onSettingsClick,
    onLogout,
    onOwnerConsoleClick,
    onAdminConsoleClick,
    onManagerConsoleClick
}) => {
    return (
        <header className="fixed top-0 w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-50 px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <img
                    src="/chttrix-logo.jpg"
                    alt="Chttrix"
                    className="w-8 h-8 rounded-lg shadow-sm shadow-indigo-200 object-cover"
                />
                <span className="font-extrabold text-slate-800 dark:text-slate-100 tracking-tight text-lg">Chttrix</span>
            </div>

            <div className="flex items-center gap-4 relative">
                {/* Help Button */}
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className={`text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-slate-50 rounded-lg ${showHelp ? "bg-indigo-50 text-indigo-600" : ""}`}
                    title="Help & Resources"
                >
                    <CircleHelp size={20} />
                </button>

                {/* Help Popover */}
                {showHelp && (
                    <>
                        <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setShowHelp(false)}></div>
                        <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden animate-fade-in origin-top-right">
                            {/* Gradient Header */}
                            <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                                <h3 className="font-bold text-base">Chttrix Support</h3>
                                <p className="text-xs text-indigo-100 mt-0.5 opacity-90">We're here to help you collaborate better.</p>
                            </div>

                            {/* Search */}
                            <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Find answers..."
                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Quick Actions Grid */}
                            <div className="p-2 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setShowHelp(false); onHelpModalOpen("academy"); }}
                                    className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                >
                                    <BookOpen size={20} className="mb-1 group-hover:scale-110 transition-transform text-indigo-600" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Academy</span>
                                </button>
                                <button
                                    onClick={() => { setShowHelp(false); onHelpModalOpen("shortcuts"); }}
                                    className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                >
                                    <Command size={20} className="mb-1 group-hover:scale-110 transition-transform text-slate-700" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Shortcuts</span>
                                </button>
                                <button
                                    onClick={() => { setShowHelp(false); onHelpModalOpen("bug"); }}
                                    className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                >
                                    <Bug size={20} className="mb-1 group-hover:scale-110 transition-transform text-red-600" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Report Bug</span>
                                </button>
                                <button
                                    onClick={() => { setShowHelp(false); onHelpModalOpen("whatsnew"); }}
                                    className="flex flex-col items-center justify-center p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors group"
                                >
                                    <Sparkles size={20} className="mb-1 group-hover:scale-110 transition-transform text-yellow-500" />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">What's New</span>
                                </button>
                            </div>

                            {/* System Status Footer */}
                            <div className="border-t border-slate-100 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Systems Operational</span>
                                </div>
                                <button
                                    onClick={() => { setShowHelp(false); onHelpModalOpen("contact"); }}
                                    className="text-xs text-indigo-600 font-bold hover:underline"
                                >
                                    Contact Us
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Owner Console Link */}
                {user?.companyRole === 'owner' && (
                    <button
                        onClick={onOwnerConsoleClick}
                        className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                    >
                        <Shield size={16} />
                        Owner Console
                    </button>
                )}

                {/* Admin Console Link */}
                {user?.companyRole === 'admin' && (
                    <button
                        onClick={onAdminConsoleClick}
                        className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                    >
                        <Shield size={16} />
                        Admin Console
                    </button>
                )}

                {/* Manager Console Link */}
                {(user?.companyRole === 'manager' || user?.companyRole === 'admin') && (
                    <button
                        onClick={onManagerConsoleClick}
                        className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
                    >
                        <Briefcase size={16} />
                        Manager Console
                    </button>
                )}

                <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                <div className="flex items-center gap-3">
                    {/* Profile Button */}
                    <button
                        onClick={onProfileClick}
                        className="text-right hidden sm:block hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
                        title="View Profile"
                    >
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.username || 'User'}</div>
                        <div className="text-xs text-slate-500">{user?.email}</div>
                    </button>

                    {/* Settings Button */}
                    <button
                        onClick={onSettingsClick}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>

                    {/* Logout Button */}
                    <button
                        onClick={onLogout}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Sign out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
