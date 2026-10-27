import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { channelService } from "../services/channelService";
import { messageService } from "../services/messageService";
import api from '@services/api';
import { useSocket } from "./SocketContext";
import logger from '../utils/logger';
import { rememberAvatars } from '../utils/avatarUtils';
import { setMentionNames } from '@platform/people/mentions.js';

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
  // Everyone, former members included ({ ..., standing }), for names and tags.
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const { socket, addNotificationListener } = useSocket() || {};
  const dmIdsRef = useRef(new Set());
  dmIdsRef.current = new Set(dms.map((d) => String(d.id)));

  const loadAllData = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      
      const [channelsRes, chatListRes, favoritesRes, membersRes] = await Promise.all([
        
        workspaceId ? channelService.getMyChannels(workspaceId).catch(err => {
          logger.warn("Channels fetch failed:", err);
          return { data: { channels: [] } };
        }) : Promise.resolve({ data: { channels: [] } }),

        messageService.getWorkspaceDMs(workspaceId).catch(err => {
          logger.warn("DM fetch failed:", err);
          return { data: { sessions: [] } };
        }),

        
        workspaceId ? api.get(`/api/favorites/${workspaceId}`).catch(err => {
          logger.warn("Favorites fetch failed:", err);
          return { data: { favorites: [] } };
        }) : Promise.resolve({ data: { favorites: [] } }),

        
        // With people who left or were removed: their names stay on what they wrote (tagged).
        workspaceId ? api.get(`/api/workspaces/${workspaceId}/members`, { params: { includeFormer: 1 } }).catch(err => {
          logger.warn("Members fetch failed:", err);
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
        description: ch.description,
        // Lists are newest first: the latest message (or when the channel was made).
        lastAt: ch.lastMessageAt || ch.createdAt || null,
      }));

      
      
      const filteredChannels = channelsData.filter(ch => ch.isMember || ch.isDiscoverable);

      
      // How each person stands (active / former / deactivated / suspended), for tags by their name.
      const standingById = new Map((membersRes.data.members || []).map((m) => [String(m.user?._id || m._id), m.standing || 'active']));

      // Conversations with AI agents are listed under Agents, not with people.
      // A 1:1 DM opened but never written in (a profile visited, "Message" pressed and left) isn't
      // a conversation yet: it stays out of the list until someone sends something — unless it's
      // unread, a favourite or the one open right now.
      const openPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const rawDMs = (chatListRes.data.sessions || []).filter((s) => !s.isAgent).filter((s) =>
        s.isGroup || s.isSelf || s.lastMessageId || (s.unreadCount || 0) > 0
        || favoriteItemIds.includes(String(s.id)) || openPath.includes(`/dm/${s.id}`));

      const dmsData = rawDMs.map(session => {
        
        const otherUser = session.otherUser;
        const otherUserId = otherUser?._id || otherUser?.id;

        
        
        
        
        
        
        
        
        
        

        
        const userStatus = otherUser?.isOnline ? (otherUser?.userStatus || 'active') : 'offline';
        const avatarColor = userStatus === 'active' ? 'green' :
          userStatus === 'away' ? 'yellow' :
            userStatus === 'dnd' ? 'red' : 'gray';

        if (session.isGroup) {
          return {
            id: session.id,
            userId: null,
            type: 'dm',
            isGroup: true,
            label: session.displayName || otherUser?.username || 'Group',
            memberCount: session.memberCount || (session.members || []).length,
            members: session.members || [],
            path: `/dm/${session.id}`,
            isFavorite: favoriteItemIds.includes(String(session.id)),
            lastMessage: session.lastMessage,
            unreadCount: session.unreadCount || 0,
            lastAt: session.lastMessageAt || null,
            status: 'offline',
            avatar: null,
          };
        }

        return {
          id: session.id, 
          userId: otherUserId, 
          type: 'dm',
          // Notes to self: "Name (you)".
          label: session.isSelf ? `${otherUser?.username || 'You'} (you)` : (otherUser?.username || 'Unknown User'),
          ...(session.isSelf ? { isSelf: true } : {}),
          standing: standingById.get(String(otherUserId)) || 'active',
          path: `/dm/${session.id}`, 
          isFavorite: favoriteItemIds.includes(String(session.id)),
          lastMessage: session.lastMessage,
          unreadCount: session.unreadCount || 0,
          lastAt: session.lastMessageAt || null,
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
        role: member.role,
        standing: member.standing || 'active',
      }));
      // Seed the shared avatar cache so every screen shows each member's stored picture.
      rememberAvatars(membersData);
      // Messages draw "@Full Name" as one mention once they know the workspace's usernames.
      setMentionNames(membersData.map((m) => m.username));
      // Everyone (names on old messages, tasks, notes); `members` below is who can be picked.
      setAllMembers(membersData);

      setChannels(filteredChannels);
      setDms(dmsData);
      setMembers(membersData.filter((m) => m.standing === 'active'));
      setContacts([...filteredChannels, ...dmsData]);

    } catch (err) {
      logger.error("Error loading contacts:", err);
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

  // A conversation had a new message: newest first in every list.
  const touch = useCallback((type, id, at) => {
    const bump = (list) => list.map((c) => (String(c.id) === String(id) && (!c.lastAt || Date.parse(at) > Date.parse(c.lastAt)) ? { ...c, lastAt: at } : c));
    if (type === 'channel') setChannels(bump);
    else setDms(bump);
  }, []);

  // Activity anywhere in the workspace (also conversations whose room this tab hasn't joined).
  useEffect(() => {
    if (!addNotificationListener) return undefined;
    return addNotificationListener((event, payload) => {
      if (event !== 'conversation:activity' || !payload?.conversationId) return;
      touch(payload.conversationType === 'channel' ? 'channel' : 'dm', String(payload.conversationId), payload.createdAt || payload.at || new Date().toISOString());
    });
  }, [addNotificationListener, touch]);

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

    // A message in a DM this list doesn't have yet (someone just started it): reload once, so it
    // is listed with the other DMs and not only counted as unread.
    const reloadedFor = new Set();
    const handleNewMessage = (msg) => {
      // Whatever it's in moves to the top of the lists.
      const chId = String(msg?.channel?._id || msg?.channel || '');
      const at = msg?.createdAt || new Date().toISOString();
      if (chId) touch('channel', chId, at);
      const dmId = String(msg?.dm?._id || msg?.dm || '');
      if (dmId) touch('dm', dmId, at);
      if (!dmId || reloadedFor.has(dmId) || dmIdsRef.current.has(dmId)) return;
      reloadedFor.add(dmId);
      const currentWsId = getCurrentWorkspaceId();
      if (currentWsId) loadAllData(currentWsId);
    };
    socket.on('new-message', handleNewMessage);

    socket.on('channel-created', handleChannelCreated);
    socket.on('channel-updated', handleChannelUpdated);
    socket.on('channel-deleted', handleChannelDeleted);
    socket.on('invited-to-channel', handleInvited);
    socket.on('removed-from-channel', handleRemoved);
    socket.on('new-dm-session', handleNewDMSession);
    const handlePrivacyChanged = (data) => {
      setChannels(prev => prev.map(ch =>
        ch.id === data.channelId
          ? { ...ch, isPrivate: data.isPrivate }
          : ch
      ));
    };
    socket.on('channel-privacy-changed', handlePrivacyChanged);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('channel-created', handleChannelCreated);
      socket.off('channel-updated', handleChannelUpdated);
      socket.off('channel-deleted', handleChannelDeleted);
      socket.off('invited-to-channel', handleInvited);
      socket.off('removed-from-channel', handleRemoved);
      socket.off('new-dm-session', handleNewDMSession);
      socket.off('channel-privacy-changed', handlePrivacyChanged);
    };
  }, [socket, loadAllData, touch]);

  // Newest conversation first (channels, DMs and groups alike), like the phone app.
  const byRecent = (a, b) => (Date.parse(b.lastAt || 0) || 0) - (Date.parse(a.lastAt || 0) || 0);
  const allItems = [...channels, ...dms].sort(byRecent);

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
      logger.error('❌ Item not found:', id);
      return;
    }

    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      logger.error('❌ No workspace ID found in URL');
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
      logger.error('Failed to toggle favorite:', err);
      
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
      channels: [...channels].sort(byRecent),
      dms: [...dms].sort(byRecent),
      members,
      allMembers,
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
