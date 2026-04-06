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
  onClearChat,
  onExitChannel,
  onDeleteChannel,
  currentUserId,
  showToast,
  typingUsers = [],
  onCreatePoll,
  onShowThreadsView,
  isThreadsOnly,
  onShowMemberList,
  onStartHuddle,
  huddleActive = false,
  onShowBookmarks,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

  const isDefaultChannel = chat.isDefault || ['general', 'announcements'].includes(chat.name?.toLowerCase().replace(/^#/, ''));
  const isWorkspaceAdmin = chat.workspaceRole === 'owner' || chat.workspaceRole === 'admin';
  const createdByIdStr = chat.createdBy?._id
    ? String(chat.createdBy._id)
    : String(chat.createdBy || '');
  const isChannelCreator = !!currentUserId && createdByIdStr === String(currentUserId);

  const isPromotedAdmin = chat.admins && Array.isArray(chat.admins)
    ? chat.admins.some(a => String(a?._id || a) === String(currentUserId))
    : false;

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

  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    return `${typingUsers.length} people are typing...`;
  };

  const typingText = getTypingText();

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .hdr-extra { display: none !important; }
        }
      `}</style>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        minHeight: '52px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {/* Channel/DM Avatar with Type Indicators */}
          {chat.type === 'channel' ? (
            chat.image ? (
              <img src={chat.image} alt={chat.name} style={{
                width: 32, height: 32, borderRadius: '2px', objectFit: 'cover',
                backgroundColor: 'var(--bg-active)',
              }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: chat.name?.toLowerCase().replace(/^#/, '') === 'announcements'
                  ? 'rgba(184,149,106,0.12)'
                  : chat.isPrivate
                    ? 'rgba(184,149,106,0.08)'
                    : 'var(--bg-active)',
                color: chat.name?.toLowerCase().replace(/^#/, '') === 'announcements'
                  ? 'var(--accent)'
                  : chat.isPrivate
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
              }}
                title={chat.description || (chat.isPrivate ? 'Private Channel' : 'Public Channel')}
              >
                {chat.name?.toLowerCase().replace(/^#/, '') === 'announcements' ? (
                  <Megaphone size={14} />
                ) : chat.isPrivate ? (
                  <Lock size={14} />
                ) : (
                  <Hash size={14} />
                )}
              </div>
            )
          ) : (
            <Avatar
              src={chat.image}
              fallback={chat.name || chat.username}
              alt={chat.name || chat.username}
              status={chat.isOnline || chat.status === 'online' ? 'online' : 'offline'}
              size="sm"
            />
          )}

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>
              {chat.type === 'channel'
                ? (chat.name?.replace(/^#/, '') || 'Unnamed Channel')
                : (chat.name || chat.username || chat.email?.split('@')[0] || 'Unknown User')
              }
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              lineHeight: 1.75,
            }}>
              {chat.type === 'dm' ? (
                chat.customStatus || (chat.isOnline || chat.status === 'online' ? 'Active now' : 'Offline')
              ) : (
                chat.memberCount ? `${chat.memberCount} members` : chat.status
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

          {/* Selection Mode Actions */}
          {selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '13px', fontWeight: 500, color: 'var(--accent)',
                backgroundColor: 'rgba(184,149,106,0.08)',
                padding: '2px 10px', borderRadius: '2px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              }}>
                {selectedCount} selected
              </span>
              <button
                onClick={() => setSelectMode(false)}
                style={{
                  padding: '6px', color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', borderRadius: '2px',
                  display: 'flex', alignItems: 'center', transition: 'color 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Cancel Selection"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Normal Actions */}
          {!selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>

              {/* Channel Specific Actions */}
              {chat.type === "channel" && (
                <>
                  {onStartHuddle && (
                    <button
                      className="hdr-extra"
                      title={huddleActive ? 'In huddle' : 'Start huddle'}
                      onClick={onStartHuddle}
                      style={{
                        padding: '6px', borderRadius: '2px', background: 'none',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        color: huddleActive ? 'var(--state-success)' : 'var(--text-muted)',
                        transition: 'color 150ms ease',
                      }}
                      onMouseEnter={e => { if (!huddleActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { if (!huddleActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      {huddleActive ? <PhoneOff size={18} /> : <Radio size={18} />}
                    </button>
                  )}

                  {onCreatePoll && (
                    <button
                      className="hdr-extra"
                      title="Create Poll"
                      onClick={() => { onCreatePoll(); }}
                      style={{
                        padding: '6px', borderRadius: '2px', background: 'none',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        color: 'var(--text-muted)', transition: 'color 150ms ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <BarChart2 size={18} />
                    </button>
                  )}
                </>
              )}

              {/* DM Specific Actions */}
              {chat.type === "dm" && (
                <>
                  <button
                    className="hdr-extra"
                    title={huddleActive ? "Leave Voice Call" : "Start Voice Call"}
                    onClick={() => onStartHuddle ? onStartHuddle() : showToast?.("Voice calls coming soon!", "info")}
                    style={{
                      padding: '6px', borderRadius: '2px', background: 'none',
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      color: huddleActive ? 'var(--state-success)' : 'var(--text-muted)',
                      transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => { if (!huddleActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { if (!huddleActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {huddleActive ? <PhoneOff size={18} /> : <Phone size={18} />}
                  </button>
                  <button
                    className="hdr-extra"
                    title="Video Call (Coming Soon)"
                    onClick={() => showToast?.("Video calls coming soon!", "info")}
                    style={{
                      padding: '6px', borderRadius: '2px', background: 'none',
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      color: 'var(--text-muted)', transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Video size={18} />
                  </button>
                </>
              )}

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearch((s) => !s);
                    setShowMenu(false);
                  }}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: showSearch ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => { if (!showSearch) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { if (!showSearch) e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Search"
                >
                  <Search size={18} />
                </button>

                {showSearch && (
                  <div onClick={(e) => e.stopPropagation()} style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: '240px', backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)', borderRadius: '2px',
                    padding: '8px', zIndex: 50,
                    animation: 'fadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <div style={{ position: 'relative' }}>
                      <Input
                        placeholder="Search messages..."
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

              {/* Threads Button */}
              {chat.type === "channel" && (
                <button
                  title={isThreadsOnly ? "Show all messages" : "Show threads only"}
                  onClick={() => onShowThreadsView?.()}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: isThreadsOnly ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => { if (!isThreadsOnly) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { if (!isThreadsOnly) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <MessageSquare size={18} />
                </button>
              )}

              {/* Bookmarks Button */}
              {onShowBookmarks && (
                <button
                  className="hdr-extra"
                  title="Saved / Bookmarked messages"
                  onClick={onShowBookmarks}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: 'var(--text-muted)', transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Bookmark size={18} />
                </button>
              )}

              {/* Global Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu((s) => !s);
                  }}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: showMenu ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => { if (!showMenu) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { if (!showMenu) e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Options"
                >
                  <MoreVertical size={18} />
                </button>

                {showMenu && (
                  <div onClick={(e) => e.stopPropagation()} style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: '220px', backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)', borderRadius: '2px',
                    padding: '4px 0', zIndex: 50,
                    animation: 'fadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    {chat.type === "channel" && (
                      <>
                        <div style={{
                          padding: '6px 12px', fontSize: '9px', fontWeight: 700,
                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>Channel Options</div>
                        {setShowChannelManagement && (
                          <MenuButton icon={<Users size={14} />} label="Channel Info" onClick={() => { setShowChannelManagement("members"); setShowMenu(false); }} />
                        )}
                        {isChannelAdmin && setShowChannelManagement && (
                          <MenuButton icon={<Settings size={14} />} label="Manage Channel" onClick={() => { setShowChannelManagement("settings"); setShowMenu(false); }} />
                        )}
                        <MenuButton icon={<Users size={14} />} label="View Members" onClick={() => { onShowMemberList?.(); setShowMenu(false); }} />
                        <MenuButton icon={<Link2 size={14} />} label="Copy Channel Link" onClick={() => {
                          const channelLink = `${window.location.origin}/join-channel?workspace=${chat.workspaceId}&channel=${chat.id}`;
                          navigator.clipboard.writeText(channelLink);
                          showToast && showToast("Channel link copied!", "success");
                          setShowMenu(false);
                        }} />
                        <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />
                      </>
                    )}

                    {chat.type === "dm" && (
                      <>
                        <div style={{
                          padding: '6px 12px', fontSize: '9px', fontWeight: 700,
                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>Contact Options</div>
                        <MenuButton icon={<User size={14} />} label="View Profile" onClick={() => { setShowContactInfo(true); setShowMenu(false); }} />
                        <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />
                      </>
                    )}

                    <MenuButton
                      icon={muted ? <Bell size={14} /> : <BellOff size={14} />}
                      label={muted ? "Unmute Notifications" : "Mute Notifications"}
                      onClick={() => setMuted?.((m) => !m)}
                    />
                    {chat.type !== "channel" && (
                      <>
                        <MenuButton
                          icon={blocked ? <Circle size={14} /> : <Ban size={14} />}
                          label={blocked ? "Unblock User" : "Block User"}
                          onClick={() => setBlocked((b) => !b)}
                        />
                        <MenuButton
                          icon={<Trash2 size={14} />}
                          label="Clear Chat"
                          onClick={() => { setShowMenu(false); setShowClearChatConfirm(true); }}
                          danger
                        />
                      </>
                    )}
                    <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />

                    {chat.type === 'channel' && !chat.isDefault && onExitChannel && (
                      <MenuButton
                        icon={<Trash2 size={14} />}
                        label="Exit Channel"
                        onClick={() => { setShowMenu(false); onExitChannel(); }}
                        danger
                      />
                    )}

                    {chat.type === 'channel' && isChannelAdmin && onDeleteChannel && !chat.isDefault && (
                      <MenuButton
                        icon={<Trash2 size={14} />}
                        label="Delete Channel Permanently"
                        onClick={() => { setShowMenu(false); onDeleteChannel(); }}
                        danger
                      />
                    )}

                    {chat.type !== 'channel' && (
                      <MenuButton
                        icon={<Trash2 size={14} />}
                        label="Delete Chat"
                        onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                        danger
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              {onClose && (
                <button
                  onClick={onClose}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: 'var(--text-muted)', transition: 'color 150ms ease', marginLeft: '4px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
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

      {/* Typing Indicator */}
      {typingText && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 30, marginTop: '8px',
          animation: 'fadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-accent)',
            color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 400,
            padding: '6px 16px', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '8px',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {[0, 150, 300].map((delay) => (
                <span key={delay} style={{
                  width: '4px', height: '4px', backgroundColor: 'var(--accent)',
                  borderRadius: '50%', animation: `bounce 1.2s ease infinite`,
                  animationDelay: `${delay}ms`, display: 'inline-block',
                }} />
              ))}
            </div>
            <span>{typingText}</span>
          </div>
        </div>
      )}
    </>
  );
}

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left', padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
        color: danger ? 'var(--state-danger)' : (hovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
        border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 400,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
