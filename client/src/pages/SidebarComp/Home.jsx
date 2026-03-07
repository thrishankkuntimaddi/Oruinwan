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
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900">
      {isLoading ? (
        <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900 animate-pulse p-4 gap-4">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-2 w-16 bg-gray-100 dark:bg-gray-700/50 rounded" />
            </div>
          </div>
          {/* Chat message skeletons - Slack-style, all left-aligned */}
          <div className="flex-1 space-y-5 overflow-hidden">
            {[{n:18,l1:65,l2:0},{n:22,l1:50,l2:38},{n:16,l1:78,l2:0},{n:24,l1:55,l2:42},{n:20,l1:70,l2:0}].map((b,i)=>(
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5" style={{maxWidth:'70%'}}>
                  <div className="flex gap-2 items-baseline">
                    <div className="h-2.5 bg-gray-300 dark:bg-gray-600 rounded" style={{width:`${b.n*4}px`}} />
                    <div className="h-2 w-8 bg-gray-100 dark:bg-gray-700/50 rounded" />
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg" style={{width:`${b.l1}%`}} />
                  {b.l2 > 0 && <div className="h-4 bg-gray-100 dark:bg-gray-700/60 rounded-lg" style={{width:`${b.l2}%`}} />}
                </div>
              </div>
            ))}
          </div>
          {/* Input skeleton */}
          <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
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
