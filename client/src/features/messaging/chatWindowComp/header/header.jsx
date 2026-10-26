import React, { useState } from "react";
import { presenceState, presenceLabel } from '../../../../shared/utils/presence';
import { Pin, AlarmClock, Plus,
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
  Sparkles,
} from "lucide-react";
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";
import { Avatar, Input } from "../../../../shared/components/ui";
import GroupAvatar from "../../groupDm/GroupAvatar";
import GroupInfoModal from "../../groupDm/GroupInfoModal";

export default function Header({
  chat,
  onClose,
  onEditPeople,
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
  onCreatePoll,
  onShowThreadsView,
  isThreadsOnly,
  onShowMemberList,
  onStartHuddle,
  huddleActive = false,
  onShowBookmarks,
  onAskAi,
  onShowPinned,
  onStartVideoCall,
  onShowReminders,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const isGroup = chat.type === 'dm' && !!chat.isGroup;

  const isDefaultChannel = chat.isDefault || ['general', 'announcements'].includes(chat.name?.toLowerCase().replace(/^#/, ''));
  const isWorkspaceAdmin = chat.workspaceRole === 'owner' || chat.workspaceRole === 'admin';
  const createdByIdStr = chat.createdBy?._id
    ? String(chat.createdBy._id)
    : String(chat.createdBy || '');
  const isChannelCreator = !!currentUserId && createdByIdStr === String(currentUserId);

  const isPromotedAdmin = chat.admins && Array.isArray(chat.admins)
    ? chat.admins.some(a => String(a?._id || a) === String(currentUserId))
    : false;

  // Workspace owners and admins manage every channel; channel admins manage theirs.
  const isChannelAdmin = isWorkspaceAdmin || (!isDefaultChannel && (isChannelCreator || isPromotedAdmin));

  const compactItems = compactHeaderActions({
    chat, isGroup, huddleActive, onStartHuddle, onStartVideoCall, onCreatePoll, onShowReminders, onShowPinned, onShowBookmarks,
  });

  const handleDelete = () => {
    if (onDeleteChat) {
      onDeleteChat();
    } else {
      onClose();
    }
    setShowDeleteConfirm(false);
  };

  const handleClearChat = () => {
    // The action itself reports success or failure.
    if (onClearChat) onClearChat();
    setShowClearChatConfirm(false);
  };

  return (
    <>
      <style>{`
        .hdr-menu-compact { display: none; }
        @media (max-width: 768px) {
          .hdr-extra { display: none !important; }
          .hdr-menu-compact { display: block; }
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
          {}
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
          ) : isGroup ? (
            <button type="button" onClick={() => setShowGroupInfo(true)} aria-label="Open group info"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
              <GroupAvatar size={32} />
            </button>
          ) : (
            <Avatar
              src={chat.image}
              fallback={chat.name || chat.username}
              alt={chat.name || chat.username}
              status={chat.isAgent ? undefined : presenceState(chat)}
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
              {/* Groups: "+" turns into the To: bar with this group's people, to add or remove
                  someone and open that conversation instead. */}
              {isGroup && onEditPeople && (
                <button type="button" onClick={onEditPeople} data-testid="group-edit-people"
                  title="Add or remove people (opens the To: bar)" aria-label="Add or remove people"
                  style={{ marginLeft: 6, verticalAlign: 'middle', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: 2, cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                  <Plus size={12} />
                </button>
              )}
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              lineHeight: 1.75,
            }}>
              {chat.isAgent ? (
                'AI agent · answers every message'
              ) : isGroup ? (
                `${chat.memberCount || (chat.members || []).length} people · group`
              ) : chat.type === 'dm' ? (
                chat.customStatus || presenceLabel(chat)
              ) : (
                chat.memberCount ? `${chat.memberCount} members` : chat.status
              )}
            </div>
          </div>
        </div>

        {}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

          {}
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

          {}
          {!selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>

              {}
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

              {}
              {chat.type === "dm" && !chat.isAgent && onStartHuddle && (
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
                    title={huddleActive ? "Leave Call" : "Start Video Call"}
                    onClick={() => onStartVideoCall?.()}
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

              {}
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

              {}
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

              {onShowReminders && (
                <button
                  className="hdr-extra"
                  title="Reminders"
                  onClick={onShowReminders}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: 'var(--text-muted)', transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <AlarmClock size={18} />
                </button>
              )}

              {onAskAi && (
                <button
                  className="hdr-extra"
                  title="Ask AI about this chat"
                  aria-label="Ask AI about this chat"
                  data-testid="ask-ai-button"
                  onClick={onAskAi}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: 'var(--accent)', transition: 'color 150ms ease',
                  }}
                >
                  <Sparkles size={18} />
                </button>
              )}

              {onShowPinned && (
                <button
                  className="hdr-extra"
                  title="Pinned messages"
                  onClick={onShowPinned}
                  style={{
                    padding: '6px', borderRadius: '2px', background: 'none',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    color: 'var(--text-muted)', transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Pin size={18} />
                </button>
              )}

              {}
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

              {}
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
                  <div onClick={(e) => e.stopPropagation()} className="gl-liquid gl-liquid--strong" style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: '220px', borderRadius: 'var(--gl-radius-md)',
                    padding: '4px', zIndex: 50,
                    maxHeight: 'min(70vh, 560px)', overflowY: 'auto',
                    animation: 'fadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    {/* Phone width: the header buttons hidden there (.hdr-extra) live here instead. */}
                    {compactItems.length > 0 && (
                      <div className="hdr-menu-compact" data-testid="header-compact-actions">
                        {compactItems.map((item) => (
                          <MenuButton key={item.label} icon={item.icon} label={item.label} onClick={() => { setShowMenu(false); item.run(); }} />
                        ))}
                        <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />
                      </div>
                    )}
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

                    {isGroup && (
                      <>
                        <MenuButton icon={<Users size={14} />} label="Group info" onClick={() => { setShowGroupInfo(true); setShowMenu(false); }} />
                        <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />
                      </>
                    )}
                    {chat.type === "dm" && !isGroup && (
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
                      onClick={() => { setShowMenu(false); setMuted?.((m) => !m); }}
                    />
                    {chat.type !== "channel" && (
                      <>
                        {!isGroup && <MenuButton
                          icon={blocked ? <Circle size={14} /> : <Ban size={14} />}
                          label={blocked ? "Unblock User" : "Block User"}
                          onClick={() => { setShowMenu(false); setBlocked((b) => !b); }}
                        />}
                        <MenuButton
                          icon={<Trash2 size={14} />}
                          label="Clear Chat"
                          onClick={() => { setShowMenu(false); setShowClearChatConfirm(true); }}
                          danger
                        />
                      </>
                    )}
                    {(chat.type !== 'channel' || (!chat.isDefault && (onExitChannel || (isChannelAdmin && onDeleteChannel)))) && <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '4px 0' }} />}

                    {chat.type === 'channel' && !chat.isDefault && onExitChannel && (
                      <MenuButton
                        icon={<Trash2 size={14} />}
                        label="Leave channel"
                        onClick={() => { setShowMenu(false); onExitChannel(); }}
                        danger
                      />
                    )}

                    {chat.type === 'channel' && isChannelAdmin && onDeleteChannel && !chat.isDefault && (
                      <MenuButton
                        icon={<Trash2 size={14} />}
                        label="Delete channel"
                        onClick={() => { setShowMenu(false); onDeleteChannel(); }}
                        danger
                      />
                    )}

                    {chat.type !== 'channel' && (
                      <MenuButton
                        icon={<Trash2 size={14} />}
                        label="Delete chat"
                        onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                        danger
                      />
                    )}
                  </div>
                )}
              </div>

              {}
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

      {showGroupInfo && isGroup && (
        <GroupInfoModal
          dmId={chat.id}
          workspaceId={chat.workspaceId}
          currentUserId={currentUserId}
          onClose={() => setShowGroupInfo(false)}
          onLeft={() => { setShowGroupInfo(false); onClose?.(); }}
        />
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
        width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '4px',
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

/**
 * The header buttons that are hidden at phone width (.hdr-extra), as ⋮ menu items:
 * [{ label, icon, run }] in the same order as the header shows them.
 */
export function compactHeaderActions({
  chat, isGroup = false, huddleActive = false, onStartHuddle, onStartVideoCall, onCreatePoll, onShowReminders, onShowPinned, onShowBookmarks,
}) {
  const items = [];
  if (chat?.type === 'channel') {
    if (onStartHuddle) items.push({ label: huddleActive ? 'In huddle' : 'Start huddle', icon: huddleActive ? <PhoneOff size={14} /> : <Radio size={14} />, run: onStartHuddle });
    if (onCreatePoll) items.push({ label: 'Create poll', icon: <BarChart2 size={14} />, run: onCreatePoll });
  }
  if (chat?.type === 'dm' && !chat.isAgent && onStartHuddle) {
    items.push({ label: huddleActive ? 'Leave voice call' : (isGroup ? 'Start huddle' : 'Voice call'), icon: huddleActive ? <PhoneOff size={14} /> : <Phone size={14} />, run: onStartHuddle });
    if (onStartVideoCall) items.push({ label: 'Video call', icon: <Video size={14} />, run: onStartVideoCall });
  }
  if (onShowReminders) items.push({ label: 'Reminders', icon: <AlarmClock size={14} />, run: onShowReminders });
  if (onShowPinned) items.push({ label: 'Pinned messages', icon: <Pin size={14} />, run: onShowPinned });
  if (onShowBookmarks) items.push({ label: 'Saved messages', icon: <Bookmark size={14} />, run: onShowBookmarks });
  return items;
}
