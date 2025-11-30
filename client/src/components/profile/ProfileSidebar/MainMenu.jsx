import React from 'react';
import { Settings, HelpCircle, LogOut, ChevronRight, Shield } from 'lucide-react';

const MainMenu = ({ user, status, setStatus, setView, handleLogout }) => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div
                onClick={() => setView("profile")}
                className="flex items-center gap-3 mb-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group"
            >
                <div className="w-12 h-12 rounded-full bg-gray-300 bg-cover bg-center shadow-sm border-2 border-white group-hover:border-blue-100 transition-colors flex-shrink-0" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-gray-900 text-base truncate group-hover:text-blue-600 transition-colors">{user?.username}</div>
                    <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                    <ChevronRight size={16} />
                </div>
            </div>

            {/* Status Selector */}
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                <button
                    onClick={(e) => { e.stopPropagation(); setStatus("active"); }}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "active" ? "bg-green-50 text-green-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
                >
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div> Active
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setStatus("away"); }}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "away" ? "bg-yellow-50 text-yellow-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
                >
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></div> Away
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setStatus("dnd"); }}
                    className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "dnd" ? "bg-red-50 text-red-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
                >
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div> DND
                </button>
            </div>
        </div>

        {/* Menu Items */}
        <div className="p-2 space-y-1">
            <button onClick={() => setView("preferences")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
                <Settings size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                <span className="font-medium">Preferences</span>
            </button>
            <button onClick={() => setView("security")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
                <Shield size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                <span className="font-medium">Security</span>
            </button>
            <button onClick={() => setView("help")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
                <HelpCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
                <span className="font-medium">Help & Support</span>
            </button>

            <div className="border-t border-gray-100 my-2 mx-2"></div>

            <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center transition-colors group">
                <LogOut size={18} className="mr-3 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Sign Out</span>
            </button>
        </div>
    </div>
);

export default MainMenu;
