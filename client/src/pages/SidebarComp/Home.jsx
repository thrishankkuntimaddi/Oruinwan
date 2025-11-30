import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Home = () => {
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

    if (path.includes("/channel/") || path.includes("/channels/")) {
      const channelId = path.includes("/channels/") ? path.split("/channels/")[1] : path.split("/channel/")[1];
      setSelectedChat({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        type: "channel",
        members: []
      });
    } else if (path.includes("/dm/")) {
      const dmId = path.split("/dm/")[1];
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
    } else {
      setSelectedChat(null);
    }
  }, [location.pathname, contacts]);

  return (
    <div className="w-full h-full flex flex-col">
      {selectedChat ? (
        <ChatWindow
          chat={selectedChat}
          contacts={contacts}
          onClose={() => setSelectedChat(null)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">👋</span>
          </div>
          <p className="text-lg font-medium text-gray-500">Welcome to Chttrix HQ</p>
          <p className="text-sm text-gray-400 mt-2">Select a channel or direct message to start chatting.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
