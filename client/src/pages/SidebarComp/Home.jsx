import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatWindowV2 from "../../components/messagesComp/chatWindowComp/ChatWindowV2";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from "../../services/api";
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
          // Fetch channel info with complete metadata
          const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
          const channels = res.data.channels || [];
          const channel = channels.find(c => String(c._id) === String(id) || c.name === id);

          if (channel) {
            setActiveChat({
              id: channel._id,
              name: `#${channel.name}`,
              type: "channel",
              workspaceId,
              isPrivate: channel.isPrivate,
              isDiscoverable: channel.isDiscoverable,
              members: channel.members || [],
              createdBy: channel.createdBy,
              creatorName: channel.creatorName,
              systemEvents: channel.systemEvents || [],
              isDefault: channel.isDefault,
              description: channel.description,
              admins: channel.admins || [], // Include admins array
              workspaceRole: activeWorkspace?.role // Pass workspace role for permission checks
            });
          } else {
            setActiveChat({
              id,
              name: "Channel",
              type: "channel",
              workspaceId,
              members: [],
              workspaceRole: activeWorkspace?.role
            });
          }
          return;
        }

        // 2. Check if it's a DM route (handles both /dm/:id and /dm/new/:dmId)
        if (location.pathname.includes("/dm/") && (id || dmId)) {
          const targetId = dmId || id; // Use dmId for new DMs, id for existing DMs

          if (targetId) {
            console.log('[Home] ═══════════════════════════════════════');
            console.log('[Home] Processing DM with targetId:', targetId);
            console.log('[Home] URL:', location.pathname);
            console.log('[Home] id param:', id, 'dmId param:', dmId);
            console.log('[Home] ═══════════════════════════════════════');

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // DM E2EE FIX: Always resolve to DM session ID before opening ChatWindow
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // PROBLEM: targetId might be a user ID or DM session ID (ambiguous)
            // SOLUTION: Call resolve endpoint which finds or creates DM with encryption keys
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            let resolvedDMSessionId = null;
            let otherUserId = null;

            try {
              // First, try to resolve as user ID → DM session ID
              console.log('[Home] Calling resolve endpoint for user:', targetId);
              const resolveRes = await api.get(
                `/api/messages/workspace/${workspaceId}/dm/resolve/${targetId}`
              );

              if (resolveRes.data.success) {
                console.log('[Home] ✅ Resolved to DM session:', resolveRes.data.dmSessionId);
                resolvedDMSessionId = resolveRes.data.dmSessionId;
                otherUserId = resolveRes.data.otherUserId;
              }
            } catch (resolveErr) {
              // If resolve fails, targetId might already be a DM session ID
              // Try to fetch it directly
              console.log('[Home] Resolve failed, checking if targetId is DM session ID:', resolveErr.response?.status);

              if (resolveErr.response?.status === 404) {
                // User not found - targetId might be DM session ID
                try {
                  const dmRes = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
                  const dmSessions = dmRes.data.sessions || [];
                  const existingSession = dmSessions.find(s => String(s.id) === String(targetId));

                  if (existingSession) {
                    console.log('[Home] ✅ Found existing DM session');
                    resolvedDMSessionId = existingSession.id;
                    otherUserId = existingSession.otherUserId;
                  } else {
                    console.error('[Home] ❌ Could not resolve DM - neither user ID nor valid session ID');
                    setActiveChat(null);
                    return;
                  }
                } catch (dmErr) {
                  console.error('[Home] ❌ Failed to fetch DM sessions:', dmErr);
                  setActiveChat(null);
                  return;
                }
              } else {
                console.error('[Home] ❌ Unexpected resolve error:', resolveErr);
                setActiveChat(null);
                return;
              }
            }

            // Now fetch member info for display
            console.log('[Home] Fetching workspace members, otherUserId:', otherUserId);
            const res = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = res.data.members || [];
            console.log('[Home] Total members fetched:', members.length);

            let member = members.find(m =>
              String(m._id || m.id) === String(otherUserId) ||
              String(m.user?._id || m.user?.id) === String(otherUserId)
            );

            console.log('[Home] Found member:', member);

            // Extract user data from nested structure if needed
            const userData = member?.user || member;
            const memberName = userData?.username || userData?.name || userData?.email?.split('@')[0];
            const memberPicture = userData?.profilePicture || userData?.avatar;

            console.log('[Home] Extracted member data:', {
              memberName,
              memberPicture,
              userData
            });

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

            console.log('[Home] Setting activeChat to:', chatObject);
            setActiveChat(chatObject);
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
  }, [location.pathname, id, dmId, workspaceId, activeWorkspace?.role]);

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
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading chat...</p>
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
