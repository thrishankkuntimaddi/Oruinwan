import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatWindowV2 from "../../components/messagesComp/chatWindowComp/ChatWindowV2";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from '@services/api';
import { useSocket } from "../../contexts/SocketContext";
import EmptyState from "./states/EmptyState";


const Home = () => {
  const { workspaceId, id, dmId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    const detectChat = async () => {


      // Reset activeChat when route changes to prevent stale data
      setActiveChat(null);
      setIsLoading(true);
      try {
        // 1. Check if it's a channel route
        if (location.pathname.includes("/channel/") && id) {
          try {
            // Members get full details (createdAt, creatorName, admins etc.)
            const res = await api.get(`/api/channels/${id}/details`);
            const channelData = res.data.channel || res.data;

            if (channelData) {
              setActiveChat({
                id: channelData._id || channelData.id,
                name: `#${channelData.name}`,
                type: "channel",
                workspaceId,
                isPrivate: channelData.isPrivate,
                isDiscoverable: channelData.isDiscoverable,
                members: channelData.members || [],
                createdBy: channelData.createdBy,
                createdAt: channelData.createdAt,
                creatorName: channelData.creatorName,
                systemEvents: channelData.systemEvents || [],
                isDefault: channelData.isDefault,
                description: channelData.description,
                admins: channelData.admins || [],
                workspaceRole: activeWorkspace?.role,
                isMember: true,
              });
            }
          } catch (detailsErr) {
            // 403 = non-member trying to view a discoverable public channel
            // Fall back to workspace channels list (always accessible) for basic info
            if (detailsErr?.response?.status === 403 || detailsErr?.response?.status === 404) {
              try {
                const listRes = await api.get(`/api/workspaces/${workspaceId}/channels`);
                const channels = listRes.data.channels || [];
                const channel = channels.find(c => String(c._id) === String(id));

                if (channel) {
                  setActiveChat({
                    id: channel._id,
                    name: `#${channel.name}`,
                    type: "channel",
                    workspaceId,
                    isPrivate: channel.isPrivate,
                    isDiscoverable: channel.isDiscoverable ?? true,
                    members: [],
                    description: channel.description,
                    isDefault: channel.isDefault,
                    workspaceRole: activeWorkspace?.role,
                    isMember: false, // ← triggers JoinChannelCTA in CentralContentView
                  });
                } else {
                  setActiveChat(null);
                }
              } catch {
                setActiveChat(null);
              }
            } else {
              // Unexpected error — show empty state
              setActiveChat(null);
            }
          }
          return;
        }

        // 2. Check if it's a DM route (handles both /dm/:id and /dm/new/:dmId)
        if (location.pathname.includes("/dm/") && (id || dmId)) {
          const targetId = dmId || id; // Use dmId for new DMs, id for existing DMs

          if (targetId) {


            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // DM E2EE FIX: Always resolve to DM session ID before opening ChatWindow
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // PROBLEM: targetId might be a user ID or DM session ID (ambiguous)
            // SOLUTION: Call resolve endpoint which finds or creates DM with encryption keys
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            let resolvedDMSessionId = null;
            let otherUserId = null;
            let isAlreadySessionId = false;

            // First check if targetId is already a valid DM session ID
            try {
              const dmRes = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
              const dmSessions = dmRes.data.sessions || [];
              const existingSession = dmSessions.find(s => String(s.id) === String(targetId));

              if (existingSession) {
                resolvedDMSessionId = existingSession.id;
                otherUserId = existingSession.otherUserId;
                isAlreadySessionId = true;
              }
            } catch (err) {
              // Could not fetch DM sessions for validation
            }

            // Only try to resolve if it's not already a session ID
            if (!isAlreadySessionId) {
              try {
                // Try to resolve as user ID → DM session ID
                const resolveRes = await api.get(
                  `/api/v2/messages/workspace/${workspaceId}/dm/resolve/${targetId}`
                );

                if (resolveRes.data.success) {
                  resolvedDMSessionId = resolveRes.data.dmSessionId;
                  otherUserId = resolveRes.data.otherUserId;
                }
              } catch (resolveErr) {
                // If resolve fails, targetId might be an invalid ID
                console.error('[Home] ❌ Could not resolve DM');
                setActiveChat(null);
                return;
              }
            }

            // Now fetch member info for display
            const res = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = res.data.members || [];

            let member = members.find(m =>
              String(m._id || m.id) === String(otherUserId) ||
              String(m.user?._id || m.user?.id) === String(otherUserId)
            );

            // Extract user data from nested structure if needed
            const userData = member?.user || member;
            const memberName = userData?.username || userData?.name || userData?.email?.split('@')[0];
            const memberPicture = userData?.profilePicture || userData?.avatar;

            // Determine status
            let status = "offline";
            if (userData?.isOnline) {
              status = userData.userStatus || "active";
            }

            // ✅ CRITICAL: Always pass DM SESSION ID, never user ID
            const chatObject = {
              id: resolvedDMSessionId,  // ✅ DM session ID (not user ID)
              userId: otherUserId,       // Store other user's ID for display
              name: memberName || "Unknown User",
              image: memberPicture,
              status: status,
              type: "dm",
              isNew: location.pathname.includes("/dm/new/"),
              workspaceId,
              workspaceRole: activeWorkspace?.role
            };


            setActiveChat(chatObject);

            // ✅ CRITICAL: ALWAYS prefetch encryption key for DMs
            // This prevents 404 errors when opening any DM (new or existing)
            try {
              // Small delay to allow backend to commit encryption keys (for new DMs)
              if (!isAlreadySessionId) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              const conversationKeyService = (await import('../../services/conversationKeyService')).default;
              await conversationKeyService.getConversationKey(resolvedDMSessionId, 'dm');
            } catch (keyErr) {
              // Don't block - ChatWindow will handle retry/creation
            }

            // ✅ CRITICAL FIX: Redirect URL ONLY if we resolved a user ID to a session ID
            // Don't redirect if targetId was already a valid session ID
            if (!isAlreadySessionId && targetId !== resolvedDMSessionId) {
              navigate(`/workspace/${workspaceId}/dm/${resolvedDMSessionId}`, { replace: true });
              return; // Exit early to prevent setting activeChat with old data
            }
          }
          return;
        }

        setActiveChat(null);
      } catch (err) {
        console.error("Error detecting chat metadata:", err);
      } finally {
        setIsLoading(false);
      }
    };

    detectChat();
  }, [location.pathname, id, dmId, workspaceId, activeWorkspace?.role, navigate]);

  // Handle real-time status updates for the active chat header
  useEffect(() => {
    if (!socket || !activeChat || activeChat.type !== 'dm') return;

    const handleStatusChange = ({ userId, status }) => {
      // If the update is for the user currently filling the active chat window
      if (String(activeChat.userId) === String(userId)) {
        setActiveChat(prev => ({ ...prev, status: status }));
      }
    };

    socket.on("user-status-changed", handleStatusChange);
    return () => socket.off("user-status-changed", handleStatusChange);
  }, [socket, activeChat]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base, #0c0c0c)' }}>
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.8; }
          100% { opacity: 0.4; }
        }
        .skel-shimmer { animation: shimmer 1.6s ease-in-out infinite; }
      `}</style>

      {isLoading ? (
        <div className="skel-shimmer" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base, #0c0c0c)', padding: '16px', gap: '20px' }}>
          {/* Header skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(184,149,106,0.15)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ height: '10px', width: '120px', background: 'var(--bg-active)' }} />
              <div style={{ height: '8px', width: '70px', background: 'var(--bg-hover)' }} />
            </div>
          </div>

          {/* Message skeletons */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '22px', overflow: 'hidden' }}>
            {[
              { aw: 100, l1: '65%', l2: null },
              { aw: 88,  l1: '50%', l2: '38%' },
              { aw: 72,  l1: '78%', l2: null },
              { aw: 96,  l1: '55%', l2: '42%' },
              { aw: 82,  l1: '70%', l2: null },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-active)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, maxWidth: '68%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                    <div style={{ height: '9px', width: `${b.aw}px`, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ height: '7px', width: '40px', background: 'var(--bg-hover)' }} />
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg-active)', width: b.l1 }} />
                  {b.l2 && <div style={{ height: '14px', background: 'var(--bg-hover)', width: b.l2 }} />}
                </div>
              </div>
            ))}
          </div>

          {/* Input skeleton */}
          <div style={{ height: '42px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }} />
        </div>
      ) : activeChat ? (
        <ChatWindowV2
          chat={activeChat}
          onClose={() => {
            setActiveChat(null);
            sessionStorage.removeItem('activeChat');
          }}
          contacts={[]} // Pass contacts if available
          onDeleteChat={() => {
            setActiveChat(null);
            sessionStorage.removeItem('activeChat');
          }}
          workspaceId={workspaceId}
          onChatUpdate={setActiveChat}
        />
      ) : (
        <EmptyState
          onNavigateChannels={() => navigate(`/workspace/${workspaceId}/channels`)}
          onNavigateDMs={() => navigate(`/workspace/${workspaceId}/messages`)}
        />
      )}
    </div>
  );

};

export default Home;
