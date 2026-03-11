import React, { useState } from 'react';
import { CircleHelp, Search, BookOpen, Command, Bug, Sparkles, Shield, Briefcase, Settings, LogOut, Bell, Check, UserPlus, MessageSquare, AtSign, X, Bot } from 'lucide-react';
import { getAvatarUrl } from '../../utils/avatarUtils';

// --- NotificationPanel (self-contained) ---
const MOCK_NOTIFS = [
    { id: 1, type: 'mention', icon: AtSign, color: 'text-indigo-600 bg-indigo-50', title: 'You were mentioned', body: '@you in #general — "Can you review the PR?"', time: '2m ago', read: false },
    { id: 2, type: 'invite', icon: UserPlus, color: 'text-emerald-600 bg-emerald-50', title: 'Workspace invite', body: 'Alex invited you to join "Design Team"', time: '18m ago', read: false },
    { id: 3, type: 'message', icon: MessageSquare, color: 'text-violet-600 bg-violet-50', title: 'New direct message', body: 'Jordan: "Hey, are you free for a quick call?"', time: '1h ago', read: true },
    { id: 4, type: 'mention', icon: AtSign, color: 'text-indigo-600 bg-indigo-50', title: 'You were mentioned', body: '@you in #design — "Looks great, LGTM!"', time: '3h ago', read: true },
];

const NotificationPanel = () => {
    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState(MOCK_NOTIFS);
    const unread = notifs.filter(n => !n.read).length;

    const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    const dismiss = (id) => setNotifs(prev => prev.filter(n => n.id !== id));

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`relative p-2 rounded-lg transition-all ${open ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                title="Notifications"
            >
                <Bell size={20} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold px-1 shadow">
                        {unread}
                    </span>
                )}
            </button>

            {/* Click-away backdrop */}
            {open && (
                <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            )}

            {/* Dropdown Panel */}
            {open && (
                <div className="absolute top-12 right-0 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] overflow-hidden"
                    style={{ animation: 'notifFadeIn 0.18s cubic-bezier(.4,0,.2,1)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-600 to-purple-600">
                        <div className="flex items-center gap-2 text-white">
                            <Bell size={16} />
                            <span className="font-bold text-sm">Notifications</span>
                            {unread > 0 && (
                                <span className="bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unread} new</span>
                            )}
                        </div>
                        {unread > 0 && (
                            <button onClick={markAllRead} className="flex items-center gap-1 text-white/80 hover:text-white text-xs font-semibold transition-colors">
                                <Check size={12} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {notifs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <Bell size={32} className="mb-3 opacity-30" />
                                <p className="text-sm font-medium">All caught up!</p>
                            </div>
                        ) : notifs.map(n => {
                            const Icon = n.icon;
                            return (
                                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 group transition-colors ${n.read ? 'bg-white dark:bg-slate-800' : 'bg-indigo-50/60 dark:bg-indigo-900/10'} hover:bg-slate-50 dark:hover:bg-slate-700/50`}>
                                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${n.color}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm font-semibold truncate ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>{n.title}</p>
                                            {!n.read && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500" />}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{n.body}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{n.time}</p>
                                    </div>
                                    <button
                                        onClick={() => dismiss(n.id)}
                                        className="flex-shrink-0 p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-center">
                        <button className="text-xs text-indigo-600 font-bold hover:underline">View all notifications</button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes notifFadeIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

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
    onManagerConsoleClick,
    onAIClick,
    showAI
}) => {
    return (
        <header className="fixed top-0 w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-50 px-4 md:px-8 h-16 flex items-center justify-between">
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



                <div className="flex items-center gap-1">
                    {/* Profile Button - Desktop (Full) */}
                    <button
                        onClick={onProfileClick}
                        className="hidden sm:flex items-center gap-2.5 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors"
                        title="View Profile"
                    >
                        <img
                            src={getAvatarUrl(user)}
                            alt={user?.username || 'User'}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                        />
                        <div className="text-left">
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{user?.username || 'User'}</div>
                            <div className="text-xs text-slate-500 leading-tight">{user?.email}</div>
                        </div>
                    </button>

                    {/* Profile Button - Mobile (Avatar only) */}
                    <button
                        onClick={onProfileClick}
                        className="sm:hidden"
                        title="View Profile"
                    >
                        <img
                            src={getAvatarUrl(user)}
                            alt={user?.username || 'U'}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-200"
                        />
                    </button>

                    {/* Divider */}
                    <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                    {/* Notification Button */}
                    <NotificationPanel />

                    {/* Settings Button */}
                    <button
                        onClick={onSettingsClick}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>

                    {/* Help Button */}
                    <div className="relative">
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
                    </div>

                    {/* ChttrixAI Button */}
                    <button
                        onClick={onAIClick}
                        className={`p-2 rounded-lg transition-all ${showAI ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Chttrix AI"
                    >
                        <Bot size={18} />
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
