import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from "../../services/api";
import { useSocket } from "../../contexts/SocketContext";

const Home = () => {
  const { workspaceId, id, dmId } = useParams();
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    const detectChat = async () => {
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
              createdBy: channel.createdBy,
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
              workspaceRole: activeWorkspace?.role
            });
          }
          return;
        }

        // 2. Check if it's a DM route (handles both /dm/:id and /dm/new/:dmId)
        if (location.pathname.includes("/dm/") && (id || dmId)) {
          const targetId = dmId || id; // Use dmId for new DMs, id for existing DMs

          if (targetId) {
            // Fetch user info to get the name
            const res = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = res.data.members || [];

            // Try to find member - check both direct ID and nested user.id
            let member = members.find(m =>
              String(m._id || m.id) === String(targetId) ||
              String(m.user?._id || m.user?.id) === String(targetId)
            );

            let dmSession = null; // Declare dmSession
            // If not found, targetId might be a DM session ID - fetch the session
            if (!member) {
              try {
                const dmRes = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
                const dmSessions = dmRes.data.sessions || [];
                dmSession = dmSessions.find(s => String(s.id) === String(targetId));

                if (dmSession && dmSession.otherUserId) {
                  member = members.find(m =>
                    String(m._id || m.id) === String(dmSession.otherUserId) ||
                    String(m.user?._id || m.user?.id) === String(dmSession.otherUserId)
                  );
                }
              } catch (err) {
                console.error('❌ [Home] Failed to fetch DM sessions:', err);
              }
            }

            // Extract user data from nested structure if needed
            const userData = member?.user || member;
            const memberId = userData?._id || userData?.id;
            const memberName = userData?.username || userData?.name || userData?.email?.split('@')[0];
            const memberPicture = userData?.profilePicture || userData?.avatar;

            // Determine status
            let status = "offline";
            if (userData?.isOnline) {
              status = userData.userStatus || "active";
            }

            setActiveChat({
              id: targetId,
              userId: dmSession?.otherUserId || memberId,
              name: memberName || "Unknown User",
              image: memberPicture,
              status: status,
              type: "dm",
              isNew: !dmSession || location.pathname.includes("/dm/new/"), // New DM if no session exists OR on new route
              workspaceId,
              workspaceRole: activeWorkspace?.role
            });
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
        <ChatWindow
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
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">👋</span>
          </div>
          <p className="text-lg font-medium text-gray-500 dark:text-gray-200">Welcome to Chttrix</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Select a channel or direct message to start chatting.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
