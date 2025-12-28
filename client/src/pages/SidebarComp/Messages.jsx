import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import BroadcastChatWindow from "../../components/messagesComp/BroadcastChatWindow";
import { useContacts } from "../../contexts/ContactsContext";
import api from "../../services/api";

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const { contacts, deleteItem } = useContacts();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle Routing for Selected Chat
  useEffect(() => {
    const path = location.pathname;

    // FIRST: Check for query parameters (from universal search)
    const channelParam = searchParams.get('channel');
    const dmParam = searchParams.get('dm');
    const newDMParam = searchParams.get('newDM');

    console.log('🔍 [Messages] Query params - channel:', channelParam, 'dm:', dmParam, 'newDM:', newDMParam);

    // Extract workspaceId from path for query param handling
    const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
    const workspaceId = workspaceMatch ? workspaceMatch[1] : null;

    // Handle channel query parameter
    if (channelParam && workspaceId) {
      console.log('📢 [Messages] Opening channel from query param:', channelParam);
      const fetchChannelDetails = async () => {
        try {
          const response = await api.get(`/api/channels/${channelParam}`);
          const channel = response.data;
          console.log('✅ [Messages] Channel fetched:', channel);

          setSelectedChat({
            id: channel._id || channel.id,
            name: channel.name,
            type: "channel",
            isPrivate: channel.isPrivate,
            members: channel.members || []
          });
          setCurrentBroadcast(null);
        } catch (error) {
          console.error('❌ [Messages] Failed to fetch channel:', error);
          // Fallback
          setSelectedChat({
            id: channelParam,
            name: "Channel",
            type: "channel",
            members: []
          });
          setCurrentBroadcast(null);
        }
      };
      fetchChannelDetails();
      return; // Exit early
    }

    // Handle DM query parameter
    if (dmParam && workspaceId) {
      console.log('💬 [Messages] Opening DM from query param:', dmParam);
      const fetchDMDetails = async () => {
        try {
          const response = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
          const sessions = response.data.sessions || [];
          const dmSession = sessions.find(s => s.id === dmParam);

          if (dmSession && dmSession.otherUser) {
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";

            setSelectedChat({
              id: dmSession.id,
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,
              workspaceId: workspaceId
            });
            setCurrentBroadcast(null);
          } else {
            console.warn('⚠️ [Messages] DM session not found:', dmParam);
          }
        } catch (error) {
          console.error('❌ [Messages] Failed to fetch DM:', error);
        }
      };
      fetchDMDetails();
      return; // Exit early
    }

    // Handle new DM query parameter
    if (newDMParam && workspaceId) {
      console.log('✨ [Messages] Creating new DM from query param:', newDMParam);
      const fetchUserDetails = async () => {
        try {
          const userRes = await api.get(`/api/workspaces/${workspaceId}/members`);
          const members = userRes.data.members || [];
          const user = members.find(m => {
            const memberId = m._id || m.id || m.user?._id || m.user?.id;
            return String(memberId) === String(newDMParam);
          });

          if (user) {
            const userData = user.user || user;
            const username = userData.username || userData.name || userData.email?.split('@')[0] || "Unknown User";

            setSelectedChat({
              id: newDMParam,
              name: username,
              type: "dm",
              avatar: userData.profilePicture || userData.avatar,
              status: userData.isOnline ? "online" : "offline",
              isNew: true,
              workspaceId: workspaceId
            });
            setCurrentBroadcast(null);
          }
        } catch (error) {
          console.error('❌ [Messages] Failed to fetch user for new DM:', error);
        }
      };
      fetchUserDetails();
      return; // Exit early
    }

    // THEN: Handle path-based routing (existing logic)
    if (path.includes("/broadcast/")) {
      const broadcastId = path.split("/broadcast/")[1];
      if (location.state?.broadcast) {
        setCurrentBroadcast(location.state.broadcast);
      } else {
        // Fallback for direct access
        setCurrentBroadcast({
          id: broadcastId,
          name: "Broadcast",
          recipients: [],
          lastMessage: "Broadcast details not found.",
          type: "broadcast"
        });
      }
      setSelectedChat(null);
    } else if (path.includes("/channel/")) {
      // Should not happen in Messages context usually, but handled just in case
      const channelId = decodeURIComponent(path.split("/channel/")[1]);
      setSelectedChat({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        type: "channel",
        members: []
      });
      setCurrentBroadcast(null);
    } else if (path.includes("/dm/")) {
      const dmId = path.split("/dm/").pop();  // Could be session ID or user ID
      console.log('🚀 DM ROUTE DETECTED! dmId:', dmId);

      // Extract workspaceId from path
      const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
      const workspaceId = workspaceMatch ? workspaceMatch[1] : null;
      console.log('🌍 Extracted workspaceId:', workspaceId);

      if (!workspaceId) {
        console.error('❌ No workspaceId found!');
        setSelectedChat(null);
        return;
      }

      // Fetch DM sessions to find participant details
      const fetchDMDetails = async () => {
        try {
          console.log('🔍 [DM Fetch] Starting fetch for dmId:', dmId);
          const response = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
          const sessions = response.data.sessions || [];
          console.log('📋 [DM Fetch] Found', sessions.length, 'DM sessions');

          // Debug: Log session structure to understand data format
          if (sessions.length > 0) {
            console.log('🔬 [DM Fetch] Sample session structure:', JSON.stringify(sessions[0], null, 2));
          }

          // Try to find by session ID first
          let dmSession = sessions.find(s => s.id === dmId);

          if (dmSession) {
            console.log('✅ [DM Fetch] Found by session ID:', dmId);
            console.log('👤 [DM Fetch] Other user data:', dmSession.otherUser);
          }

          // If not found, try to find by participant user ID (otherUserId)
          if (!dmSession) {
            dmSession = sessions.find(s => {
              const otherUserId = s.otherUserId || s.otherUser?._id || s.otherUser?.id;
              return otherUserId && (String(otherUserId) === String(dmId));
            });

            if (dmSession) {
              console.log('✅ [DM Fetch] Found by otherUserId:', dmId);
              console.log('👤 [DM Fetch] Other user data:', dmSession.otherUser);
            }
          }

          if (dmSession && dmSession.otherUser) {
            // Extract username with multiple fallback options
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";

            console.log('✅ [DM Fetch] Setting chat with username:', username);
            console.log('📦 [DM Fetch] Full chat object being set:', {
              id: dmSession.id,
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,
              workspaceId: workspaceId
            });

            setSelectedChat({
              id: dmSession.id,  // Use the actual session ID
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,  // Existing DM session
              workspaceId: workspaceId
            });
          } else {
            // If still not found, might be a new DM - fetch user details from workspace members
            console.log('⚠️ [DM Fetch] No existing DM session found, fetching workspace members for user ID:', dmId);
            const userRes = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = userRes.data.members || [];
            console.log('👥 [DM Fetch] Found', members.length, 'workspace members');

            // Try to find user by ID with multiple match strategies
            const user = members.find(m => {
              const memberId = m._id || m.id || m.user?._id || m.user?.id;
              return String(memberId) === String(dmId);
            });

            if (user) {
              // Extract username from member data (could be nested in user object)
              const userData = user.user || user;
              const username = userData.username
                || userData.name
                || userData.email?.split('@')[0]
                || "Unknown User";

              console.log('✅ [DM Fetch] Found user in members:', username);
              console.log('📦 [DM Fetch] Full chat object being set (new DM):', {
                id: dmId,
                name: username,
                type: "dm",
                avatar: userData.profilePicture || userData.avatar,
                status: userData.isOnline ? "online" : "offline",
                isNew: true,
                workspaceId: workspaceId
              });

              setSelectedChat({
                id: dmId,  // Use user ID for new DMs
                name: username,
                type: "dm",
                avatar: userData.profilePicture || userData.avatar,
                status: userData.isOnline ? "online" : "offline",
                isNew: true,  // New DM
                workspaceId: workspaceId
              });
            } else {
              // Ultimate fallback - but log warning
              console.warn('⚠️ [DM Fetch] Could not find user data for ID:', dmId);
              console.warn('Available member IDs:', members.map(m => m._id || m.id || m.user?._id));

              setSelectedChat({
                id: dmId,
                name: "Unknown User",
                type: "dm",
                avatar: null,
                status: "offline",
                isNew: true,
                workspaceId: workspaceId
              });
            }
          }
        } catch (error) {
          console.error("❌ [DM Fetch] Failed to fetch DM details:", error);
          console.error("❌ [DM Fetch] Error details:", error.response?.data || error.message);

          // Fallback with error context
          setSelectedChat({
            id: dmId,
            name: "Unknown User",
            type: "dm",
            avatar: null,
            status: "offline",
            isNew: true,
            workspaceId: workspaceId
          });
        }
        setCurrentBroadcast(null);
      };

      fetchDMDetails();
    } else {
      setSelectedChat(null);
      setCurrentBroadcast(null);
    }
  }, [location.pathname, location.state, contacts, searchParams]);

  const handleDeleteChat = (chat) => {
    deleteItem(chat.id);
    setSelectedChat(null);
    navigate("/messages"); // Go back to empty state in messages
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden">
        {/* RIGHT PANE – Chat window */}
        <div className="flex-1 flex flex-col">
          {currentBroadcast ? (
            <BroadcastChatWindow broadcast={currentBroadcast} />
          ) : selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              contacts={contacts}
              onClose={() => setSelectedChat(null)}
              onDeleteChat={() => handleDeleteChat(selectedChat)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white dark:bg-gray-900">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">💬</span>
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
