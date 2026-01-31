import React from 'react';
import { Settings, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

/**
 * MainMenuView Component
 * Main menu with profile header, status selector, and navigation options
 */
const MainMenuView = ({ user, status, onStatusChange, onNavigate, onLogout }) => {
    return (
        <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
            {/* Header */}
            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50">
                <div
                    onClick={() => onNavigate("profile")}
                    className="flex items-center gap-3 mb-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm transition-all group"
                >
                    <div className="w-12 h-12 rounded-full bg-gray-300 bg-cover bg-center shadow-sm border-2 border-white group-hover:border-blue-100 transition-colors flex-shrink-0" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
                    <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-900 dark:text-white text-base truncate group-hover:text-blue-600 transition-colors">{user?.username}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                        <ChevronRight size={16} />
                    </div>
                </div>

                {/* Status Selector */}
                <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange("active"); }}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "active" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div> Active
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange("away"); }}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "away" ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></div> Away
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange("dnd"); }}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "dnd" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div> DND
                    </button>
                </div>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
                <button onClick={() => onNavigate("help")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
                    <HelpCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    <span className="font-medium">Help & Support</span>
                </button>

                <div className="border-t border-gray-100 my-2 mx-2"></div>

                {/* Admin Dashboard Link (Admin/Owner Only) */}
                {(user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
                    <button
                        onClick={() => window.location.href = '/admin/company'}
                        className="w-full text-left px-3 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg flex items-center transition-colors group font-semibold"
                    >
                        <Settings size={18} className="mr-3 group-hover:rotate-90 transition-transform duration-300" />
                        <span>Admin Dashboard</span>
                    </button>
                )}

                <button onClick={onLogout} className="w-full text-left px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center transition-colors group">
                    <LogOut size={18} className="mr-3 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    );
};

export default MainMenuView;
