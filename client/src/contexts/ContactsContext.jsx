import { createContext, useContext, useEffect, useState } from "react";
import { channelService } from "../services/channelService";
import { messageService } from "../services/messageService";

const ContactsContext = createContext();
export const useContacts = () => useContext(ContactsContext);

export default function ContactsProvider({ children }) {
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [dms, setDms] = useState([]);
  const [loading, setLoading] = useState(false); // Changed to false initially
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only load if user has access token (is authenticated)
    const token = localStorage.getItem('accessToken');
    if (token) {
      loadAllData();
    }
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch channels and chat list in parallel
      const [channelsRes, chatListRes] = await Promise.all([
        channelService.getMyChannels().catch(err => {
          console.warn("Channels fetch failed:", err);
          return { data: { channels: [] } };
        }),
        messageService.getChatList().catch(err => {
          console.warn("Chat list fetch failed:", err);
          return { data: { conversations: [] } };
        })
      ]);

      // Format channels
      const channelsData = (channelsRes.data.channels || []).map(ch => ({
        id: ch._id,
        type: 'channel',
        label: ch.name,
        path: `/channels/${ch._id}`,
        isFavorite: false,
        isPrivate: ch.isPrivate,
        description: ch.description
      }));

      // Format DMs from chat list
      const dmsData = (chatListRes.data.conversations || [])
        .filter(c => c.type === 'dm')
        .map(dm => ({
          id: dm._id,
          type: 'dm',
          label: dm.otherUser?.username || dm.otherUser?.name || 'Unknown User',
          path: `/dm/${dm.otherUser?._id || dm._id}`,
          isFavorite: false,
          lastMessage: dm.lastMessage,
          unreadCount: dm.unreadCount || 0
        }));

      setChannels(channelsData);
      setDms(dmsData);
      setContacts([...channelsData, ...dmsData]);

      console.log('📡 ContactsContext loaded:', {
        channels: channelsData.length,
        dms: dmsData.length,
        channelsData,
        dmsData
      });

    } catch (err) {
      console.error("Error loading contacts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Combine channels and DMs into allItems
  const allItems = [...channels, ...dms];

  const deleteItem = (id) => {
    setChannels(prev => prev.filter(item => item.id !== id));
    setDms(prev => prev.filter(item => item.id !== id));
  };

  const addItem = (item) => {
    if (item.type === 'channel') {
      setChannels(prev => [...prev, item]);
    } else if (item.type === 'dm') {
      setDms(prev => [...prev, item]);
    }
  };

  const toggleFavorite = (id) => {
    const updateFavorite = (items) => items.map(item =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    );

    setChannels(updateFavorite);
    setDms(updateFavorite);
  };

  return (
    <ContactsContext.Provider value={{
      contacts,
      allItems,
      channels,
      dms,
      setAllItems: setContacts,
      deleteItem,
      addItem,
      toggleFavorite,
      loading,
      error,
      refreshContacts: loadAllData
    }}>
      {children}
    </ContactsContext.Provider>
  );
}
