import { useState, useEffect } from "react";
import MessageList from "../../components/messagesComp/MessageList";
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
      <div className="flex flex-1 border rounded-lg shadow-md overflow-hidden">

        {/* LEFT PANE – Slack style thread list */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
          <MessageList onSelectChat={setSelectedChat} />
        </div>

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
              Select a chat to start messaging
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
