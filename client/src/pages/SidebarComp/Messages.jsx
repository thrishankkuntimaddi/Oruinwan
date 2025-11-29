import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import BroadcastChatWindow from "../../components/messagesComp/BroadcastChatWindow";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [contacts, setContacts] = useState([]);
  const location = useLocation();

  // Load contacts
  useEffect(() => {
    async function loadContacts() {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });
        setContacts(res.data.contacts || []);
      } catch (err) {
        console.error("Failed to load contacts:", err);
      }
    }
    loadContacts();
  }, []);

  // Handle Routing for Selected Chat
  useEffect(() => {
    const path = location.pathname;

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
      const channelId = decodeURIComponent(path.split("/channel/")[1]);
      setSelectedChat({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        type: "channel",
        members: []
      });
      setCurrentBroadcast(null);
    } else if (path.includes("/dm/")) {
      const dmId = decodeURIComponent(path.split("/dm/")[1]);
      const contact = contacts.find(c => c.username.toLowerCase() === dmId.toLowerCase()) || {
        id: dmId,
        username: dmId.charAt(0).toUpperCase() + dmId.slice(1),
        profilePicture: null
      };

      setSelectedChat({
        id: contact.id,
        name: contact.username,
        type: "dm",
        avatar: contact.profilePicture,
        status: "online"
      });
      setCurrentBroadcast(null);
    } else {
      setSelectedChat(null);
      setCurrentBroadcast(null);
    }
  }, [location.pathname, location.state, contacts]);

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
