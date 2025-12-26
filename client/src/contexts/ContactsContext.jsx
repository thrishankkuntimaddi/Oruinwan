import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { channelService } from "../services/channelService";
import { messageService } from "../services/messageService";
import api from "../services/api";

const ContactsContext = createContext();
export const useContacts = () => useContext(ContactsContext);

// Helper to get current workspace ID
const getCurrentWorkspaceId = () => {
  // Try to get from URL first
  const path = window.location.pathname;
  const match = path.match(/\/workspace\/([a-f0-9]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

export default function ContactsProvider({ children }) {
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [dms, setDms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);

  const loadAllData = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch channels, chat list, and favorites in parallel
      const [channelsRes, chatListRes, favoritesRes] = await Promise.all([
        // Only fetch channels if workspaceId is provided
        workspaceId ? channelService.getMyChannels(workspaceId).catch(err => {
          console.warn("Channels fetch failed:", err);
          return { data: { channels: [] } };
        }) : Promise.resolve({ data: { channels: [] } }),

        messageService.getChatList().catch(err => {
          console.warn("Chat list fetch failed:", err);
          return { data: { conversations: [] } };
        }),

        // Fetch favorites if workspaceId is provided
        workspaceId ? api.get(`/api/favorites/${workspaceId}`).catch(err => {
          console.warn("Favorites fetch failed:", err);
          return { data: { favorites: [] } };
        }) : Promise.resolve({ data: { favorites: [] } })
      ]);

      // Extract favorite IDs
      const favorites = favoritesRes.data.favorites || [];
      const favoriteItemIds = favorites.map(fav => String(fav.itemId?._id || fav.itemId));
      setFavoriteIds(favoriteItemIds);

      console.log('⭐ Loaded favorites:', favoriteItemIds);

      // Format channels with favorite status
      const channelsData = (channelsRes.data.channels || []).map(ch => ({
        id: ch._id,
        type: 'channel',
        label: ch.name,
        path: `/channels/${ch._id}`,
        isFavorite: favoriteItemIds.includes(String(ch._id)),
        isPrivate: ch.isPrivate,
        description: ch.description
      }));

      // Format DMs from chat list with favorite status
      const dmsData = (chatListRes.data.conversations || [])
        .filter(c => c.type === 'dm')
        .map(dm => ({
          id: dm._id,
          type: 'dm',
          label: dm.otherUser?.username || dm.otherUser?.name || 'Unknown User',
          path: `/dm/${dm.otherUser?._id || dm._id}`,
          isFavorite: favoriteItemIds.includes(String(dm._id)),
          lastMessage: dm.lastMessage,
          unreadCount: dm.unreadCount || 0
        }));

      setChannels(channelsData);
      setDms(dmsData);
      setContacts([...channelsData, ...dmsData]);

      console.log('📡 ContactsContext loaded:', {
        channels: channelsData.length,
        dms: dmsData.length,
        favorites: favoriteItemIds.length,
        channelsData,
        dmsData
      });

    } catch (err) {
      console.error("Error loading contacts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - function doesn't depend on any external values

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const workspaceId = getCurrentWorkspaceId();
      if (workspaceId) {
        console.log('🔄 Loading contacts with workspaceId from URL:', workspaceId);
        loadAllData(workspaceId);
      }
    }
  }, [loadAllData]);

  // Combine channels and DMs into allItems
  const allItems = [...channels, ...dms];

  console.log('📋 ContactsContext allItems:', {
    totalItems: allItems.length,
    channels: channels.length,
    dms: dms.length,
    allItems
  });

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

  const toggleFavorite = async (id) => {
    const item = allItems.find(i => i.id === id);
    if (!item) {
      console.error('❌ Item not found:', id);
      return;
    }

    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      console.error('❌ No workspace ID found in URL');
      return;
    }

    console.log('⭐ toggleFavorite - Item:', item.label, 'WorkspaceId:', workspaceId);

    const isFavorited = favoriteIds.includes(String(id));

    // Optimistically update UI
    const updateFavorite = (items) => items.map(item =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    );

    setChannels(updateFavorite);
    setDms(updateFavorite);

    // Update local favorite IDs
    if (isFavorited) {
      setFavoriteIds(prev => prev.filter(favId => favId !== String(id)));
    } else {
      setFavoriteIds(prev => [...prev, String(id)]);
    }

    try {
      if (isFavorited) {
        // Remove from favorites - find the favorite ID first
        const favoritesRes = await api.get(`/api/favorites/${workspaceId}`);
        const favorite = favoritesRes.data.favorites?.find(fav =>
          String(fav.itemId?._id || fav.itemId) === String(id)
        );

        if (favorite) {
          await api.delete(`/api/favorites/${favorite.id}`);
          console.log(`⭐ Removed from favorites: ${id}`);
        }
      } else {
        // Add to favorites
        await api.post('/api/favorites', {
          workspaceId,
          itemType: item.type === 'channel' ? 'channel' : 'dm',
          itemId: id
        });
        console.log(`⭐ Added to favorites: ${id}`);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Revert on error
      setChannels(updateFavorite);
      setDms(updateFavorite);
      if (isFavorited) {
        setFavoriteIds(prev => [...prev, String(id)]);
      } else {
        setFavoriteIds(prev => prev.filter(favId => favId !== String(id)));
      }
    }
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
