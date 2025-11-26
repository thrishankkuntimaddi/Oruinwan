import React from "react";
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Settings,
  Info,
  User,
  CheckSquare,
  Bell,
  BellOff,
  Ban,
  Circle,
  BarChart2,
  Trash2,
  X
} from "lucide-react";

export default function Header({
  chat,
  onClose,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  showMenu,
  setShowMenu,
  selectMode,
  setSelectMode,
  selectedCount,
  onDeleteSelected,
  setShowContactInfo,
  setShowChannelManagement,
  muted,
  setMuted,
  blocked,
  setBlocked,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-[#f9fafb]">
      <div className="flex items-center gap-3 min-w-0">
        {chat.image ? (
          <img src={chat.image} alt={chat.name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
            {chat.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
        )}

        <div className="min-w-0">
          <div className="text-base font-medium truncate">{chat.name}</div>
          <div className="text-xs text-gray-500 truncate">{chat.status}</div>
        </div>
      </div>

      {/* Selection Mode Actions */}
      {selectMode && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {selectedCount} selected
          </span>
          {selectedCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="Delete Selected"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={() => setSelectMode(false)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
            title="Cancel Selection"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Normal Actions (Hidden in Select Mode) */}
      {!selectMode && (
        <div className="flex items-center gap-1">
          {/* Channel Specific Actions */}
          {chat.type === "channel" && (
            <>
              <button title="Start Meeting" className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors">
                <Video size={20} />
              </button>
              <button title="Create Poll" className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors">
                <BarChart2 size={20} />
              </button>
            </>
          )}

          {/* DM Specific Actions */}
          {chat.type === "dm" && (
            <>
              <button title="Voice Call" className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors">
                <Phone size={20} />
              </button>
              <button title="Video Call" className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors">
                <Video size={20} />
              </button>
            </>
          )}

          {/* Common Actions: Search */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSearch((s) => !s);
                setShowMenu(false);
              }}
              className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors"
              title="Search messages"
            >
              <Search size={20} />
            </button>

            {showSearch && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 animate-fade-in">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={14} />
                  </span>
                  <input
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    placeholder="Search in conversation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">Press Esc to close</p>
              </div>
            )}
          </div>

          {/* Global Menu (Three Dots) */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((s) => !s);
              }}
              className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-md transition-colors"
              title="More options"
            >
              <MoreVertical size={20} />
            </button>

            {showMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                {chat.type === "channel" && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Channel Settings</div>
                    {setShowChannelManagement && (
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => { setShowChannelManagement(true); setShowMenu(false); }}>
                        <Settings size={16} /> Manage Channel
                      </button>
                    )}
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => { setShowContactInfo(true); setShowMenu(false); }}>
                      <Info size={16} /> Channel Info
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}

                {chat.type === "dm" && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact Options</div>
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => { setShowContactInfo(true); setShowMenu(false); }}>
                      <User size={16} /> View Profile
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}

                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => { setSelectMode(true); setShowMenu(false); }}>
                  <CheckSquare size={16} /> Select Messages
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => setMuted((m) => !m)}>
                  {muted ? <Bell size={16} /> : <BellOff size={16} />} {muted ? "Unmute Notifications" : "Mute Notifications"}
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 flex items-center gap-3" onClick={() => setBlocked((b) => !b)}>
                  {blocked ? <Circle size={16} /> : <Ban size={16} />} {blocked ? "Unblock User" : "Block User"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
