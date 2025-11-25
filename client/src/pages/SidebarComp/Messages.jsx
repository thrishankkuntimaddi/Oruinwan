import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
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

    if (path.includes("/channel/")) {
      const channelId = path.split("/channel/")[1];
      // Mock channel data for now since we don't have a backend fetch for single channel yet
      // In a real app, you'd fetch the channel details here
      setSelectedChat({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1), // Capitalize
        type: "channel",
        members: [] // Placeholder
      });
    } else if (path.includes("/dm/")) {
      const dmId = path.split("/dm/")[1];
      // Find contact or create mock
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
        status: "online" // Mock status
      });
    } else {
      setSelectedChat(null);
    }
  }, [location.pathname, contacts]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden">
        {/* RIGHT PANE – Chat window */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
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
