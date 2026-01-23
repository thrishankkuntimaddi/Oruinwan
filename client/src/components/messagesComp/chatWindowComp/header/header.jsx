import React, { useState } from "react";
import {
  Phone,
  Video,
  Search,
  Hash,
  MoreVertical,
  Settings,
  User,
  Bell,
  BellOff,
  Ban,
  Circle,
  BarChart2,
  X,
  Trash2,
  Link2,
  Lock,
  MessageSquare,
  Users,
  Megaphone
} from "lucide-react";
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";



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
  onClearChat, // Clear chat history (DM only)
  onExitChannel,
  onDeleteChannel,
  currentUserId,
  showToast,
  typingUsers = [], // NEW: Array of {id, name} objects
  onCreatePoll, // Poll creation handler
  onShowThreadsView, // Show threads-only view
  onShowMemberList, // Show member list modal
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

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

  const handleClearChat = () => {
    if (onClearChat) {
      onClearChat();
      showToast && showToast("Chat cleared successfully", "success");
    }
    setShowClearChatConfirm(false);
  };

  // Format typing users text
  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  };

  const typingText = getTypingText();

  return (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 min-w-0">
          {/* Channel/DM Avatar with Type Indicators */}
          {chat.type === 'channel' ? (
            // Channel Icon Logic
            chat.image ? (
              <img src={chat.image} alt={chat.name} className="w-8 h-8 rounded object-cover shadow-sm bg-gray-50" />
            ) : (
              <div
                className={`w-8 h-8 rounded flex items-center justify-center font-medium text-sm ${chat.name?.toLowerCase().replace(/^#/, '') === 'announcements'
                  ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                  : chat.isPrivate
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                title={chat.description || (chat.isPrivate ? 'Private Channel' : 'Public Channel')}
              >
                {chat.name?.toLowerCase().replace(/^#/, '') === 'announcements' ? (
                  <Megaphone size={14} />
                ) : chat.isPrivate ? (
                  <Lock size={14} />
                ) : (
                  <Hash size={14} /> // Explicitly use Hash icon
                )}
              </div>
            )
          ) : (
            // DM Avatar with Online Indicator
            <div className="relative">
              {chat.image ? (
                <img src={chat.image} alt={chat.name} className="w-8 h-8 rounded object-cover shadow-sm bg-gray-50" />
              ) : (
                <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {(chat.name || chat.username || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {/* Online/Offline Indicator */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${chat.isOnline || chat.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                title={chat.isOnline || chat.status === 'online' ? 'Online' : 'Offline'}
              ></div>
            </div>
          )}

          <div className="min-w-0">
            {/* Debug: Log chat object for DMs */}


            <div className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">
              {chat.type === 'channel'
                ? (chat.name?.replace(/^#/, '') || 'Unnamed Channel')
                : (chat.name || chat.username || chat.email?.split('@')[0] || 'Unknown User')
              }
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-1">
              {/* Show custom status for DMs, member count for channels */}
              {chat.type === 'dm' ? (
                chat.customStatus || (chat.isOnline || chat.status === 'online' ? 'Active now' : 'Offline')
              ) : (
                chat.memberCount ? `${chat.memberCount} members` : chat.status
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-1">
          {/* Close Button moved to end */}

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
                  <button
                    title="Start Meeting"
                    onClick={() => showToast?.("Meeting feature coming soon!", "info")}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    <Video size={16} />
                  </button>

                  {/* Poll Button */}
                  {onCreatePoll && (
                    <button
                      title="Create Poll"
                      onClick={() => {
                        console.log('🎯 POLL BUTTON CLICKED');
                        onCreatePoll();
                      }}
                      className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    >
                      <BarChart2 size={16} />
                    </button>
                  )}
                </>
              )}

              {/* DM Specific Actions */}
              {chat.type === "dm" && (
                <>
                  <button title="Voice (Coming Soon)" disabled className="p-1.5 text-gray-300 dark:text-gray-600 cursor-not-allowed rounded transition-colors opacity-50">
                    <Phone size={16} />
                  </button>
                  <button title="Video (Coming Soon)" disabled className="p-1.5 text-gray-300 dark:text-gray-600 cursor-not-allowed rounded transition-colors opacity-50">
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
                  <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-md rounded-lg p-2 z-50 animate-fade-in">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                        <Search size={12} />
                      </span>
                      <input
                        className="w-full pl-8 pr-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Threads Button (Moved to end) */}
              {chat.type === "channel" && (
                <button
                  title="Threads View - Show only threaded messages"
                  onClick={() => onShowThreadsView?.()}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  <MessageSquare size={16} />
                </button>
              )}

              {/* Global Menu (Three Dots) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu((s) => !s);
                  }}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Options"
                >
                  <MoreVertical size={16} />
                </button>

                {showMenu && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50 text-sm animate-fade-in">
                    {chat.type === "channel" && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Channel Options</div>
                        {isChannelAdmin && setShowChannelManagement && (
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => { setShowChannelManagement("settings"); setShowMenu(false); }}>
                            <Settings size={16} /> Channel Settings
                          </button>
                        )}
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => { onShowMemberList?.(); setShowMenu(false); }}>
                          <Users size={16} /> View Members
                        </button>
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3"
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
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => { setShowContactInfo(true); setShowMenu(false); }}>
                          <User size={16} /> View Profile
                        </button>
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                      </>
                    )}

                    <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => setMuted?.((m) => !m)}>
                      {muted ? <Bell size={16} /> : <BellOff size={16} />} {muted ? "Unmute Notifications" : "Mute Notifications"}
                    </button>
                    {chat.type !== "channel" && (
                      <>
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => setBlocked((b) => !b)}>
                          {blocked ? <Circle size={16} /> : <Ban size={16} />} {blocked ? "Unblock User" : "Block User"}
                        </button>
                        <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-orange-600 dark:text-orange-400 flex items-center gap-3" onClick={() => { setShowMenu(false); setShowClearChatConfirm(true); }}>
                          <Trash2 size={16} /> Clear Chat
                        </button>
                      </>
                    )}
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

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

              {/* Close Button (if onClose provided) - Moved to end */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors ml-1"
                  title="Close Chat"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title={`Delete ${chat.type === 'channel' ? 'Channel' : 'Chat'}?`}
          message={`Are you sure you want to delete this ${chat.type === 'channel' ? 'channel' : 'chat'}? This action cannot be undone.`}
          confirmText="Delete"
        />

        <ConfirmationModal
          isOpen={showClearChatConfirm}
          onClose={() => setShowClearChatConfirm(false)}
          onConfirm={handleClearChat}
          title="Clear Chat History?"
          message="This will clear all messages from this chat for you only. The other person will still see the messages. This action cannot be undone."
          confirmText="Clear Chat"
        />
      </div>

      {/* Dynamic Island Typing Indicator */}
      {typingText && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 mt-2 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-gray-900/95 dark:bg-black/95 backdrop-blur-xl text-white text-xs font-medium px-4 py-2 rounded-full shadow-2xl border border-white/10 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span>{typingText}</span>
          </div>
        </div>
      )}
    </>
  );
}
