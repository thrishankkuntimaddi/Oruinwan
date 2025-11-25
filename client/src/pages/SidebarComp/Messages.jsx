import { useState, useEffect } from "react";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [contacts, setContacts] = useState([]);

  // Load contacts once (needed for ChatWindow + DM metadata)
  useEffect(() => {
    async function loadContacts() {
      try {
        const token = localStorage.getItem("accessToken");

        // If no token, user is not logged in - skip loading
        if (!token) {
          console.log("No auth token found - user needs to log in");
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });
        setContacts(res.data.contacts || []);
      } catch (err) {
        console.error("Failed to load contacts:", err);

        // If 401, token is invalid - clear it
        if (err.response?.status === 401) {
          console.log("Token expired or invalid - please log in again");
          localStorage.removeItem("accessToken");
        }
      }
    }

    loadContacts();
  }, []);

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
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a chat from the sidebar to start messaging
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
