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
  const [members, setMembers] = useState([]); // Workspace members for task assignment
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);

  const loadAllData = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch channels, chat list, favorites, AND workspace members in parallel
      const [channelsRes, chatListRes, favoritesRes, membersRes] = await Promise.all([
        // Only fetch channels if workspaceId is provided
        workspaceId ? channelService.getMyChannels(workspaceId).catch(err => {
          console.warn("Channels fetch failed:", err);
          return { data: { channels: [] } };
        }) : Promise.resolve({ data: { channels: [] } }),

        messageService.getWorkspaceDMs(workspaceId).catch(err => {
          console.warn("DM fetch failed:", err);
          return { data: { sessions: [] } };
        }),

        // Fetch favorites if workspaceId is provided
        workspaceId ? api.get(`/api/favorites/${workspaceId}`).catch(err => {
          console.warn("Favorites fetch failed:", err);
          return { data: { favorites: [] } };
        }) : Promise.resolve({ data: { favorites: [] } }),

        // Fetch workspace members
        workspaceId ? api.get(`/api/workspaces/${workspaceId}/members`).catch(err => {
          console.warn("Members fetch failed:", err);
          return { data: { members: [] } };
        }) : Promise.resolve({ data: { members: [] } })
      ]);

      // Extract favorite IDs
      const favorites = favoritesRes.data.favorites || [];
      const favoriteItemIds = favorites.map(fav => String(fav.itemId?._id || fav.itemId));
      setFavoriteIds(favoriteItemIds);

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

      // Format DMs from workspace sessions
      const rawDMs = chatListRes.data.sessions || [];

      const dmsData = rawDMs.map(session => {
        // Correctly extract the other user from the session object
        const otherUser = session.otherUser;
        const otherUserId = otherUser?._id || otherUser?.id;

        // Use the session ID for the list item ID, but we might need the user ID for the path
        // Checking MessagesPanel: it uses `session.id` for the key/id and navigates to `/dm/${session.id}`
        // Wait, MessagesPanel navigates: `/dm/${item.id}` where item.id is session.id? 
        // Let's re-read MessagesPanel.jsx line 165: `/workspace/${workspaceId}/dm/${item.id}`
        // AND line 51: id: session.id
        // So the ID used in the URL is the SESSION ID, not the USER ID?
        // Actually, looking at HomePanel handleStartDM (line 138): navigate(`/workspace/.../dm/${existingDM.id}`)
        // So existingDM.id must matches the route param.
        // App.js route: /workspace/:workspaceId/dm/:id
        // So yes, we should use session.id as the ID.

        // Determine avatar color based on user status
        const userStatus = otherUser?.isOnline ? (otherUser?.userStatus || 'active') : 'offline';
        const avatarColor = userStatus === 'active' ? 'green' :
          userStatus === 'away' ? 'yellow' :
            userStatus === 'dnd' ? 'red' : 'gray';

        return {
          id: session.id, // Use Session ID
          userId: otherUserId, // Keep User ID reference
          type: 'dm',
          label: otherUser?.username || 'Unknown User',
          path: `/dm/${session.id}`, // Consistent with MessagesPanel logic
          isFavorite: favoriteItemIds.includes(String(session.id)),
          lastMessage: session.lastMessage,
          unreadCount: session.unreadCount || 0,
          status: userStatus,
          avatarColor: avatarColor, // Add avatar color based on status
          avatar: otherUser?.profilePicture // Add profile picture
        };
      });

      // Format workspace members
      const membersData = (membersRes.data.members || []).map(member => ({
        _id: member.user?._id || member._id,
        id: member.user?._id || member._id,
        username: member.user?.username || member.username,
        email: member.user?.email || member.email,
        profilePicture: member.user?.profilePicture || member.profilePicture,
        role: member.role
      }));

      setChannels(channelsData);
      setDms(dmsData);
      setMembers(membersData);
      setContacts([...channelsData, ...dmsData]);

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
        loadAllData(workspaceId);
      }
    }
  }, [loadAllData]);

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
        }
      } else {
        // Add to favorites
        await api.post('/api/favorites', {
          workspaceId,
          itemType: item.type === 'channel' ? 'channel' : 'dm',
          itemId: id
        });
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
      members,  // Add workspace members
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
