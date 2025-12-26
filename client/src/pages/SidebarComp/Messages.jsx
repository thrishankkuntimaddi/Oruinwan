import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import BroadcastChatWindow from "../../components/messagesComp/BroadcastChatWindow";
import { useContacts } from "../../contexts/ContactsContext";

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const { contacts, deleteItem } = useContacts();
  const location = useLocation();
  const navigate = useNavigate();

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
