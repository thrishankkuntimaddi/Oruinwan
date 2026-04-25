import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { channelService } from "../services/channelService";
import { messageService } from "../services/messageService";
import api from '@services/api';
import { useSocket } from "./SocketContext";

const ContactsContext = createContext();
export const useContacts = () => useContext(ContactsContext);

const getCurrentWorkspaceId = () => {
  
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
  const [members, setMembers] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const { socket } = useSocket();

  const loadAllData = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      
      const [channelsRes, chatListRes, favoritesRes, membersRes] = await Promise.all([
        
        workspaceId ? channelService.getMyChannels(workspaceId).catch(err => {
          console.warn("Channels fetch failed:", err);
          return { data: { channels: [] } };
        }) : Promise.resolve({ data: { channels: [] } }),

        messageService.getWorkspaceDMs(workspaceId).catch(err => {
          console.warn("DM fetch failed:", err);
          return { data: { sessions: [] } };
        }),

        
        workspaceId ? api.get(`/api/favorites/${workspaceId}`).catch(err => {
          console.warn("Favorites fetch failed:", err);
          return { data: { favorites: [] } };
        }) : Promise.resolve({ data: { favorites: [] } }),

        
        workspaceId ? api.get(`/api/workspaces/${workspaceId}/members`).catch(err => {
          console.warn("Members fetch failed:", err);
          return { data: { members: [] } };
        }) : Promise.resolve({ data: { members: [] } })
      ]);

      
      const favorites = favoritesRes.data.favorites || [];
      const favoriteItemIds = favorites.map(fav => String(fav.itemId?._id || fav.itemId));
      setFavoriteIds(favoriteItemIds);

      
      const channelsData = (channelsRes.data.channels || []).map(ch => ({
        id: ch._id,
        type: 'channel',
        label: ch.name,
        path: `/channels/${ch._id}`,
        isFavorite: favoriteItemIds.includes(String(ch._id)),
        isPrivate: ch.isPrivate,
        isDiscoverable: ch.isDiscoverable ?? true, 
        isMember: ch.isMember ?? true, 
        description: ch.description
      }));

      
      
      const filteredChannels = channelsData.filter(ch => ch.isMember || ch.isDiscoverable);

      
      const rawDMs = chatListRes.data.sessions || [];

      const dmsData = rawDMs.map(session => {
        
        const otherUser = session.otherUser;
        const otherUserId = otherUser?._id || otherUser?.id;

        
        
        
        
        
        
        
        
        
        

        
        const userStatus = otherUser?.isOnline ? (otherUser?.userStatus || 'active') : 'offline';
        const avatarColor = userStatus === 'active' ? 'green' :
          userStatus === 'away' ? 'yellow' :
            userStatus === 'dnd' ? 'red' : 'gray';

        return {
          id: session.id, 
          userId: otherUserId, 
          type: 'dm',
          label: otherUser?.username || 'Unknown User',
          path: `/dm/${session.id}`, 
          isFavorite: favoriteItemIds.includes(String(session.id)),
          lastMessage: session.lastMessage,
          unreadCount: session.unreadCount || 0,
          status: userStatus,
          avatarColor: avatarColor, 
          avatar: otherUser?.profilePicture 
        };
      });

      
      const membersData = (membersRes.data.members || []).map(member => ({
        _id: member.user?._id || member._id,
        id: member.user?._id || member._id,
        username: member.user?.username || member.username,
        email: member.user?.email || member.email,
        profilePicture: member.user?.profilePicture || member.profilePicture,
        role: member.role
      }));

      setChannels(filteredChannels);
      setDms(dmsData);
      setMembers(membersData);
      setContacts([...filteredChannels, ...dmsData]);

    } catch (err) {
      console.error("Error loading contacts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); 

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const workspaceId = getCurrentWorkspaceId();
      if (workspaceId) {
        loadAllData(workspaceId);
      }
    }
  }, [loadAllData]);

  
  useEffect(() => {
    if (!socket) return;

    const handleChannelCreated = (channel) => {
      
      
      const currentWsId = getCurrentWorkspaceId();
      if (channel.workspace !== currentWsId) return;

      const newChannel = {
        id: channel._id,
        type: 'channel',
        label: channel.name,
        path: `/channels/${channel._id}`,
        isFavorite: false,
        isPrivate: channel.isPrivate,
        isDiscoverable: channel.isDiscoverable ?? true,
        isMember: true, 
        description: channel.description
      };
      setChannels(prev => [...prev, newChannel]);
    };

    const handleChannelUpdated = (data) => {
      const { channelId, name, description } = data;
      setChannels(prev => prev.map(ch =>
        ch.id === channelId
          ? { ...ch, label: name || ch.label, description: description || ch.description }
          : ch
      ));
    };

    const handleChannelDeleted = (data) => {
      setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
    };

    const handleInvited = (data) => {
      
      
      const currentWsId = getCurrentWorkspaceId();
      
      
      
      if (currentWsId) loadAllData(currentWsId);
    };

    const handleRemoved = (data) => {
      setChannels(prev => prev.filter(ch => ch.id !== data.channelId));
    };

    const handleNewDMSession = (data) => {

      
      const currentWsId = getCurrentWorkspaceId();
      if (currentWsId) loadAllData(currentWsId);
    };

    socket.on('channel-created', handleChannelCreated);
    socket.on('channel-updated', handleChannelUpdated);
    socket.on('channel-deleted', handleChannelDeleted);
    socket.on('invited-to-channel', handleInvited);
    socket.on('removed-from-channel', handleRemoved);
    socket.on('new-dm-session', handleNewDMSession);
    socket.on('channel-privacy-changed', (data) => {
      setChannels(prev => prev.map(ch =>
        ch.id === data.channelId
          ? { ...ch, isPrivate: data.isPrivate }
          : ch
      ));
    });

    return () => {
      socket.off('channel-created', handleChannelCreated);
      socket.off('channel-updated', handleChannelUpdated);
      socket.off('channel-deleted', handleChannelDeleted);
      socket.off('invited-to-channel', handleInvited);
      socket.off('removed-from-channel', handleRemoved);
      socket.off('new-dm-session', handleNewDMSession);
      socket.off('channel-privacy-changed');
    };
  }, [socket, loadAllData]);

  
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

    
    const updateFavorite = (items) => items.map(item =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    );

    setChannels(updateFavorite);
    setDms(updateFavorite);

    
    if (isFavorited) {
      setFavoriteIds(prev => prev.filter(favId => favId !== String(id)));
    } else {
      setFavoriteIds(prev => [...prev, String(id)]);
    }

    try {
      if (isFavorited) {
        
        const favoritesRes = await api.get(`/api/favorites/${workspaceId}`);
        const favorite = favoritesRes.data.favorites?.find(fav =>
          String(fav.itemId?._id || fav.itemId) === String(id)
        );

        if (favorite) {
          await api.delete(`/api/favorites/${favorite.id}`);
        }
      } else {
        
        await api.post('/api/favorites', {
          workspaceId,
          itemType: item.type === 'channel' ? 'channel' : 'dm',
          itemId: id
        });
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      
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
      members,  
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
