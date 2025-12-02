import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatWindow from "../../components/messages/chat/ChatWindow";
import { useContacts } from "../../contexts/ContactsContext";

const Home = () => {
  const [selectedChat, setSelectedChat] = useState(null);
  const { contacts, allItems, deleteItem } = useContacts();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle Routing for Selected Chat
  useEffect(() => {
    const path = location.pathname;

    // Try to find the item in allItems first
    const matchedItem = allItems.find(item => item.path === path);

    if (matchedItem) {
      setSelectedChat({
        id: matchedItem.id,
        name: matchedItem.label,
        type: matchedItem.type,
        isPrivate: matchedItem.isPrivate,
        members: [] // Mock members for now
      });
      return;
    }

    // Fallback logic if not found in allItems (e.g. new DMs not yet in list)
    if (path.includes("/channel/") || path.includes("/channels/")) {
      const channelId = path.includes("/channels/") ? path.split("/channels/")[1] : path.split("/channel/")[1];
      setSelectedChat({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        type: "channel",
        members: []
      });
    } else if (path.includes("/dm/")) {
      // Handle both /dm/:id and /messages/dm/:id if this component is used there (it shouldn't be, but just in case)
      const parts = path.split("/dm/");
      const dmId = parts[1];
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
  }, [location.pathname, contacts, allItems]);

  const handleDeleteChat = (chat) => {
    // Use the ID from the matched item if possible, or the chat ID
    // We need to ensure we delete the item that corresponds to the current view
    // In allItems, IDs are like 'general' or 'sarah' (slugs)

    // If the chat was found in allItems, it has the correct ID.
    // If it was constructed, we might need to guess the ID.

    let idToDelete = chat.id;

    // If it's a DM constructed from contacts, chat.id might be the user ID, but allItems uses slug as ID for DMs
    if (chat.type === 'dm') {
      const item = allItems.find(i => i.type === 'dm' && i.label === chat.name);
      if (item) idToDelete = item.id;
    }

    deleteItem(idToDelete);
    setSelectedChat(null);

    // Navigate based on current context
    if (location.pathname.includes("/channels")) {
      navigate("/channels");
    } else {
      navigate("/app");
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {selectedChat ? (
        <ChatWindow
          chat={selectedChat}
          contacts={contacts}
          onClose={() => setSelectedChat(null)}
          onDeleteChat={() => handleDeleteChat(selectedChat)}
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
