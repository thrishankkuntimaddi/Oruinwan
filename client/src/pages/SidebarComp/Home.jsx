import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from "../../services/api";

const Home = () => {
  const { workspaceId, id, dmId } = useParams();
  const location = useLocation();
  const { activeWorkspace } = useWorkspace();
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

        // 2. Check if it's a DM route
        if (location.pathname.includes("/dm/") && id) {
          const targetId = id === "new" ? dmId : id;

          if (targetId) {
            // Fetch user info to get the name
            const res = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = res.data.members || [];
            let member = members.find(m => String(m._id || m.id) === String(targetId));
            console.log('🔍 [Home] Looking for targetId:', targetId, 'Found:', member);

            // If not found, targetId might be a DM session ID - fetch the session
            if (!member) {
              console.log('⚠️ [Home] Member not found by ID, checking if targetId is a DM session ID...');
              try {
                const dmRes = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
                const dmSessions = dmRes.data.sessions || [];
                const dmSession = dmSessions.find(s => String(s.id) === String(targetId));

                if (dmSession && dmSession.otherUserId) {
                  console.log('✅ [Home] Found DM session with otherUserId:', dmSession.otherUserId);
                  member = members.find(m => String(m._id || m.id) === String(dmSession.otherUserId));
                  console.log('👤 [Home] Found member by session lookup:', member);
                }
              } catch (err) {
                console.error('❌ [Home] Failed to fetch DM sessions:', err);
              }
            }

            setActiveChat({
              id: targetId,
              name: member ? (member.username || member.name || member.email?.split('@')[0]) : "Unknown User",
              image: member ? (member.profilePicture || member.avatar) : null,
              status: member ? (member.isOnline ? "online" : "offline") : "offline",
              type: "dm",
              isNew: id === "new",
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

  return (
    <div className="w-full h-full flex flex-col">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm text-gray-500">Loading chat...</p>
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
        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">👋</span>
          </div>
          <p className="text-lg font-medium text-gray-500">Welcome to Chttrix</p>
          <p className="text-sm text-gray-400 mt-2">Select a channel or direct message to start chatting.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
