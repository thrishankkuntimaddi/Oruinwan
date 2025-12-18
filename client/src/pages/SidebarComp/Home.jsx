import React, { useState, useEffect } from "react";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";

const Home = () => {
  const [activeChat, setActiveChat] = useState(null);

  // This function will be called from panels when a channel/DM is clicked
  const openChat = (item) => {
    const chatData = {
      id: item.id,
      name: item.label || item.name,
      type: item.type,
      isPrivate: item.isPrivate
    };
    setActiveChat(chatData);

    // Also store in sessionStorage so panels can check what's active
    sessionStorage.setItem('activeChat', JSON.stringify(chatData));
  };

  // Expose openChat function globally so panels can call it
  useEffect(() => {
    window.openChat = openChat;

    // Trigger a custom event when chat changes so panels can update
    window.dispatchEvent(new CustomEvent('chatChanged', { detail: activeChat }));

    return () => {
      delete window.openChat;
    };
  }, [activeChat]);

  return (
    <div className="w-full h-full flex flex-col">
      {activeChat ? (
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
