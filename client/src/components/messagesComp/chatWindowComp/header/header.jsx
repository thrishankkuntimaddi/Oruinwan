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
  Megaphone,
  Radio,
  PhoneOff,
  Bookmark,
} from "lucide-react";
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";
import { Avatar, Input } from "../../../../shared/components/ui";



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
  isThreadsOnly, // Whether threads-only filter is active
  onShowMemberList, // Show member list modal
  // Phase 7.7 — Huddle
  onStartHuddle,
  huddleActive = false,
  // Phase 1 — Bookmarks
  onShowBookmarks,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

  // Determine if current user is admin for this channel
  // Default channels (#general, #announcements): Workspace admin/owner
  // User-created channels: Channel creator OR promoted admin
  const isDefaultChannel = chat.isDefault || ['general', 'announcements'].includes(chat.name?.toLowerCase().replace(/^#/, ''));
  const isWorkspaceAdmin = chat.workspaceRole === 'owner' || chat.workspaceRole === 'admin';
  // createdBy can be a raw ID string OR a populated object {_id, username} depending on the API path
  const createdByIdStr = chat.createdBy?._id
    ? String(chat.createdBy._id)
    : String(chat.createdBy || '');
  const isChannelCreator = !!currentUserId && createdByIdStr === String(currentUserId);

  // Check if user is a promoted admin (in the admins array — entries may be populated {_id} or raw string)
  const isPromotedAdmin = chat.admins && Array.isArray(chat.admins)
    ? chat.admins.some(a => String(a?._id || a) === String(currentUserId))
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
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0 min-h-[48px]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Channel/DM Avatar with Type Indicators */}
          {chat.type === 'channel' ? (
            // Channel Icon Logic
            chat.image ? (
              <img src={chat.image} alt={chat.name} className="w-8 h-8 rounded object-cover shadow-sm bg-gray-50 dark:bg-gray-800" />
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
            <Avatar
              src={chat.image}
              fallback={chat.name || chat.username}
              alt={chat.name || chat.username}
              status={chat.isOnline || chat.status === 'online' ? 'online' : 'offline'}
              size="sm"
            />
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
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
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
                  {/* Phase 7.7 — Huddle button */}
                  {onStartHuddle && (
                    <button
                      title={huddleActive ? 'In huddle' : 'Start huddle'}
                      onClick={onStartHuddle}
                      className={`p-1.5 rounded transition-colors ${huddleActive
                        ? 'text-green-500 bg-green-50 dark:bg-green-900/30 animate-pulse'
                        : 'text-gray-400 dark:text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                    >
                      {huddleActive ? <PhoneOff size={16} /> : <Radio size={16} />}
                    </button>
                  )}

                  {/* Poll Button */}
                  {onCreatePoll && (
                    <button
                      title="Create Poll"
                      onClick={() => {
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
                  <button
                    title={huddleActive ? "Leave Voice Call" : "Start Voice Call"}
                    onClick={() => onStartHuddle ? onStartHuddle() : showToast?.("🔧 Voice calls coming soon!", "info")}
                    className={`p-1.5 rounded transition-colors ${huddleActive
                      ? 'text-green-500 bg-green-50 dark:bg-green-900/30 animate-pulse'
                      : 'text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {huddleActive ? <PhoneOff size={16} /> : <Phone size={16} />}
                  </button>
                  <button
                    title="Video Call (Coming Soon)"
                    onClick={() => showToast?.("🔧 Video calls coming soon!", "info")}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  >
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
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Search"
                >
                  <Search size={16} />
                </button>

                {showSearch && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-secondary-200 dark:border-secondary-700 shadow-xl rounded-lg p-2 z-50 animate-fade-in">
                    <div className="relative">
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        icon={<Search size={14} />}
                        className="text-xs py-1.5 h-8"
                        fullWidth
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Threads Button - toggle threads-only filter */}
              {chat.type === "channel" && (
                <button
                  title={isThreadsOnly ? "Show all messages" : "Show threads only"}
                  onClick={() => onShowThreadsView?.()}
                  className={`p-1.5 rounded transition-colors ${isThreadsOnly
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <MessageSquare size={16} />
                </button>
              )}

              {/* Phase 1 — Bookmarks Button */}
              {onShowBookmarks && (
                <button
                  title="Saved / Bookmarked messages"
                  onClick={onShowBookmarks}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                >
                  <Bookmark size={16} />
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
                        {/* All members can view channel info */}
                        {setShowChannelManagement && (
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => { setShowChannelManagement("members"); setShowMenu(false); }}>
                            <Users size={16} /> Channel Info
                          </button>
                        )}
                        {/* Only admins/creators can manage settings */}
                        {isChannelAdmin && setShowChannelManagement && (
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3" onClick={() => { setShowChannelManagement("settings"); setShowMenu(false); }}>
                            <Settings size={16} /> Manage Channel
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
