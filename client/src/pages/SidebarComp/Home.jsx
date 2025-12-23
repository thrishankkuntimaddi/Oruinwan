import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import api from "../../services/api";

const Home = () => {
  const { workspaceId, id, dmId } = useParams();
  const location = useLocation();
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const detectChat = async () => {
      setIsLoading(true);
      try {
        // 1. Check if it's a channel route
        if (location.pathname.includes("/channel/") && id) {
          // Fetch channel info to get the name
          const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
          const channels = res.data.channels || [];
          const channel = channels.find(c => String(c._id) === String(id) || c.name === id);

          if (channel) {
            setActiveChat({
              id: channel._id,
              name: `#${channel.name}`,
              type: "channel",
              workspaceId,
              isPrivate: channel.isPrivate
            });
          } else {
            setActiveChat({ id, name: "Channel", type: "channel", workspaceId });
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
            const member = members.find(m => String(m.id) === String(targetId));

            setActiveChat({
              id: targetId,
              name: member ? member.name : "User",
              image: member ? member.avatar : null,
              status: member ? member.status : "offline",
              type: "dm",
              isNew: id === "new",
              workspaceId
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
  }, [location.pathname, id, dmId, workspaceId]);

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
