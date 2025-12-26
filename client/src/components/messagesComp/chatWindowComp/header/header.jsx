import React, { useState } from "react";
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Settings,
  Info,
  User,
  Bell,
  BellOff,
  Ban,
  Circle,
  BarChart2,
  X,
  Trash2,
  Link2,
  Lock
} from "lucide-react";
import ConfirmationModal from "../../../ui/ConfirmationModal";

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
  onDeleteChat,
  onExitChannel,
  onDeleteChannel,
  currentUserId,
  showToast,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Determine if current user is admin for this channel
  // Default channels (#general, #announcements): Workspace admin/owner
  // User-created channels: Channel creator OR promoted admin
  const isDefaultChannel = chat.isDefault || ['general', 'announcements'].includes(chat.name?.toLowerCase().replace(/^#/, ''));
  const isWorkspaceAdmin = chat.workspaceRole === 'owner' || chat.workspaceRole === 'admin';
  const isChannelCreator = chat.createdBy && String(chat.createdBy) === String(currentUserId);

  // Check if user is a promoted admin (in the admins array)
  const isPromotedAdmin = chat.admins && Array.isArray(chat.admins)
    ? chat.admins.some(adminId => String(adminId) === String(currentUserId))
    : false;

  // Admin for default channels = workspace admin, admin for user channels = creator OR promoted admin
  const isChannelAdmin = isDefaultChannel ? isWorkspaceAdmin : (isChannelCreator || isPromotedAdmin);

  const handleDelete = () => {
    if (onDeleteChat) {
      onDeleteChat();
    } else {
      onClose();
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-white relative z-20">
      <div className="flex items-center gap-2 min-w-0">
        {chat.image ? (
          <img src={chat.image} alt={chat.name} className="w-8 h-8 rounded object-cover shadow-sm bg-gray-50" />
        ) : (
          <div className={`w-8 h-8 rounded flex items-center justify-center font-medium text-xs ${chat.type === 'channel' && chat.isPrivate ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            {chat.type === 'channel' && chat.isPrivate ? <Lock size={14} /> : (chat.name?.charAt(0)?.toUpperCase() ?? "?")}
          </div>
        )}

        <div className="min-w-0">
          <div className="text-sm font-semibold truncate text-gray-800">
            {chat.type === 'channel' ? (chat.name?.replace(/^#/, '') || 'Unnamed Channel') : chat.name}
          </div>
          <div className="text-[10px] text-gray-400 truncate flex items-center gap-1">
            {chat.status}
          </div>
        </div>
      </div>

      {/* Selection Mode Actions */}
      {selectMode && (
        <div className="flex items-center gap-2 animate-fade-in">
          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {selectedCount} selected
          </span>
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
        <div className="flex items-center gap-0.5">
          {/* Channel Specific Actions */}
          {chat.type === "channel" && (
            <>
              <button title="Meeting" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                <Video size={16} />
              </button>
              <button title="Poll" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                <BarChart2 size={16} />
              </button>
            </>
          )}

          {/* DM Specific Actions */}
          {chat.type === "dm" && (
            <>
              <button title="Voice" onClick={() => showToast && showToast("Voice Call coming soon!", "info")} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                <Phone size={16} />
              </button>
              <button title="Video" onClick={() => showToast && showToast("Video Call coming soon!", "info")} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                <Video size={16} />
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
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Search"
            >
              <Search size={16} />
            </button>

            {showSearch && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 shadow-md rounded-lg p-2 z-50 animate-fade-in">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={12} />
                  </span>
                  <input
                    className="w-full pl-8 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
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
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Options"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                {chat.type === "channel" && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Channel Options</div>
                    {isChannelAdmin && setShowChannelManagement && (
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => { setShowChannelManagement("settings"); setShowMenu(false); }}>
                        <Settings size={16} /> Channel Settings
                      </button>
                    )}
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => { setShowChannelManagement("members"); setShowMenu(false); }}>
                      <Info size={16} /> View Members & Info
                    </button>
                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3"
                      onClick={() => {
                        const channelLink = `${window.location.origin}/join-channel?workspace=${chat.workspaceId}&channel=${chat.id}`;
                        navigator.clipboard.writeText(channelLink);
                        showToast && showToast("Channel link copied!", "success");
                        setShowMenu(false);
                      }}
                    >
                      <Link2 size={16} /> Copy Channel Link
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

                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-3" onClick={() => setMuted((m) => !m)}>
                  {muted ? <Bell size={16} /> : <BellOff size={16} />} {muted ? "Unmute Notifications" : "Mute Notifications"}
                </button>
                {chat.type !== "channel" && (
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 flex items-center gap-3" onClick={() => setBlocked((b) => !b)}>
                    {blocked ? <Circle size={16} /> : <Ban size={16} />} {blocked ? "Unblock User" : "Block User"}
                  </button>
                )}
                <div className="border-t border-gray-100 my-1" />

                {/* Channel: Exit Channel (only non-default channels) */}
                {chat.type === 'channel' && !chat.isDefault && onExitChannel && (
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-orange-600 flex items-center gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      onExitChannel();
                    }}
                  >
                    <Trash2 size={16} /> Exit Channel
                  </button>
                )}

                {/* Channel: Delete Channel (admins only) */}
                {chat.type === 'channel' && isChannelAdmin && onDeleteChannel && !chat.isDefault && (
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 flex items-center gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      onDeleteChannel();
                    }}
                  >
                    <Trash2 size={16} /> Delete Channel Permanently
                  </button>
                )}

                {/* DM: Delete Chat */}
                {chat.type !== 'channel' && (
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 flex items-center gap-3"
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 size={16} /> Delete Chat
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={`Delete ${chat.type === 'channel' ? 'Channel' : 'Chat'}?`}
        message={`Are you sure you want to delete this ${chat.type === 'channel' ? 'channel' : 'chat'}? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
