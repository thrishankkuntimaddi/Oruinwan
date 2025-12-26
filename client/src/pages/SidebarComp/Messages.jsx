import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

  // Handle Routing for Selected Chat
  useEffect(() => {
    const path = location.pathname;

    // Async function to fetch user details from workspace members
    const fetchUserDetails = async (userId) => {
      try {
        // Extract workspaceId from path
        const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
        if (!workspaceMatch) return null;
        const workspaceId = workspaceMatch[1];

        // Fetch workspace members and find the specific user
        const response = await api.get(`/api/workspaces/${workspaceId}/members`);
        const member = response.data.members.find(m => m._id === userId);

        if (member) {
          return {
            id: member._id,
            username: member.username,
            profilePicture: member.profilePicture
          };
        }
        return null;
      } catch (error) {
        console.error("Failed to fetch user details:", error);
        return null;
      }
    };

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
      const dmSessionId = path.split("/dm/").pop();  // This is the DM session ID

      // Extract workspaceId from path
      const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
      const workspaceId = workspaceMatch ? workspaceMatch[1] : null;

      if (!workspaceId) {
        setSelectedChat(null);
        return;
      }

      // Fetch DM sessions to find participant details
      const fetchDMDetails = async () => {
        try {
          console.log('🔍 Fetching DM for session ID:', dmSessionId);
          const response = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
          const sessions = response.data.sessions || [];
          console.log('📋 Sessions:', sessions);
          const dmSession = sessions.find(s => s.id === dmSessionId);
          console.log('✅ Found:', dmSession);

          if (dmSession && dmSession.otherUser) {
            setSelectedChat({
              id: dmSessionId,
              name: dmSession.otherUser.username || "User",
              type: "dm",
              avatar: dmSession.otherUser.profilePicture,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: true,
              workspaceId: workspaceId
            });
          } else {
            // Fallback if session not found
            setSelectedChat({
              id: dmSessionId,
              name: "User",
              type: "dm",
              avatar: null,
              status: "offline",
              isNew: true,
              workspaceId: workspaceId
            });
          }
        } catch (error) {
          console.error("Failed to fetch DM details:", error);
          // Fallback
          setSelectedChat({
            id: dmSessionId,
            name: "User",
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
  }, [location.pathname, location.state, contacts]);

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
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">💬</span>
              </div>
              <p className="text-lg font-medium text-gray-500">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
