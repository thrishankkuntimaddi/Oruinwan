import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatWindowV2 from "../../features/messaging/chatWindowComp/ChatWindowV2";
import BroadcastChatWindow from "../../features/messaging/BroadcastChatWindow";
import { useContacts } from "../../contexts/ContactsContext";
import api from '@services/api';

import "../../components/layout/shell.css";
import NewDMModal from "../../features/messaging/NewDMModal";
import { useParams } from "react-router-dom";
import { MessagesLanding } from './landing/Landings';
import NewMessageView from "../../features/messaging/newMessage/NewMessageView";
import logger from '../../utils/logger';
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";
import { groupChatObject, useGroupDMLive } from "../../features/messaging/groupDm/groupChat";

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [showCreateDM, setShowCreateDM] = useState(false);
  const { contacts, deleteItem } = useContacts();
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const { socket } = useSocket() || {};
  const { user: me } = useAuth() || {};
  const myId = me?._id || me?.id || me?.sub || null;

  // An open group DM follows renames and member changes, and closes if I'm removed.
  const onGroupUpdate = useCallback((patch) => setSelectedChat((prev) => (prev?.isGroup ? { ...prev, ...patch } : prev)), []);
  const onGroupRemoved = useCallback(() => {
    setSelectedChat(null);
    navigate(`/workspace/${workspaceId}/messages`, { replace: true });
  }, [navigate, workspaceId]);
  useGroupDMLive(socket, selectedChat, myId, { onUpdate: onGroupUpdate, onRemoved: onGroupRemoved });

  // A DM opened by the other person's user id (New message, a profile, a link) is not a
  // conversation yet: create or find the real DM first. Sending under a user id fails with
  // "This conversation's encryption key is not ready yet".
  const openDMWithUser = useCallback(async (wsId, userId) => {
    try {
      const { data } = await api.get(`/api/v2/messages/workspace/${wsId}/dm/resolve/${userId}`);
      if (data?.success && data.dmSessionId) {
        navigate(`/workspace/${wsId}/messages/dm/${data.dmSessionId}`, { replace: true });
        return true;
      }
    } catch (error) {
      logger.error('❌ [Messages] Could not start the DM:', error);
    }
    return false;
  }, [navigate]);

  
  useEffect(() => {
    const path = location.pathname;

    
    const channelParam = searchParams.get('channel');
    const dmParam = searchParams.get('dm');
    const newDMParam = searchParams.get('newDM');

    
    const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
    const workspaceId = workspaceMatch ? workspaceMatch[1] : null;

    
    if (channelParam && workspaceId) {

      const fetchChannelDetails = async () => {
        try {
          const response = await api.get(`/api/channels/${channelParam}/details`);
          const channel = response.data.channel || response.data;

          setSelectedChat({
            id: channel._id || channel.id,
            name: channel.name,
            type: "channel",
            workspaceId,
            isPrivate: channel.isPrivate,
            isDiscoverable: channel.isDiscoverable,
            members: channel.members || [],
            creatorName: channel.creatorName,
            createdAt: channel.createdAt,
            createdBy: channel.createdBy,
            systemEvents: channel.systemEvents || []
          });
          setCurrentBroadcast(null);
        } catch (error) {
          logger.error('❌ [Messages] Failed to fetch channel:', error);
          
          setSelectedChat({
            id: channelParam,
            name: "Channel",
            type: "channel",
            workspaceId,
            members: []
          });
          setCurrentBroadcast(null);
        }
      };
      fetchChannelDetails();
      return; 
    }

    
    if (dmParam && workspaceId) {

      const fetchDMDetails = async () => {
        try {
          const response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
          const sessions = response.data.sessions || [];
          const dmSession = sessions.find(s => s.id === dmParam);

          if (dmSession?.isGroup) {
            setSelectedChat(groupChatObject(dmSession, workspaceId));
            setCurrentBroadcast(null);
            return;
          }
          if (dmSession && dmSession.otherUser) {
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";

            setSelectedChat({
              id: dmSession.id,
              userId: dmSession.otherUser._id || dmSession.otherUser.id || dmSession.otherUserId || null,
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,
              workspaceId: workspaceId
            });
            setCurrentBroadcast(null);
          } else {

          }
        } catch (error) {
          logger.error('❌ [Messages] Failed to fetch DM:', error);
        }
      };
      fetchDMDetails();
      return; 
    }

    
    if (newDMParam && workspaceId) {

      const fetchUserDetails = async () => {
        try {
          const userRes = await api.get(`/api/workspaces/${workspaceId}/members`);
          const members = userRes.data.members || [];
          const user = members.find(m => {
            const memberId = m._id || m.id || m.user?._id || m.user?.id;
            return String(memberId) === String(newDMParam);
          });

          if (user) {
            if (!(await openDMWithUser(workspaceId, newDMParam))) setSelectedChat(null);
            setCurrentBroadcast(null);
          }
        } catch (error) {
          logger.error('❌ [Messages] Failed to fetch user for new DM:', error);
        }
      };
      fetchUserDetails();
      return; 
    }

    
    if (path.includes("/broadcast/")) {
      const broadcastId = path.split("/broadcast/")[1];
      if (location.state?.broadcast) {
        setCurrentBroadcast(location.state.broadcast);
      } else {
        
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
      
      const channelId = decodeURIComponent(path.split("/channel/")[1]);
      setSelectedChat({
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        type: "channel",
        workspaceId: workspaceId,
        members: []
      });
      setCurrentBroadcast(null);
    } else if (path.includes("/dm/")) {
      const dmId = path.split("/dm/").pop();  

      
      const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
      const workspaceId = workspaceMatch ? workspaceMatch[1] : null;

      if (!workspaceId) {
        logger.error('❌ No workspaceId found!');
        setSelectedChat(null);
        return;
      }

      
      const fetchDMDetails = async () => {
        try {

          const response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
          const sessions = response.data.sessions || [];

          
          if (sessions.length > 0) {

          }

          
          let dmSession = sessions.find(s => s.id === dmId);

          if (dmSession) {

          }

          
          if (!dmSession) {
            dmSession = sessions.find(s => {
              const otherUserId = s.otherUserId || s.otherUser?._id || s.otherUser?.id;
              return otherUserId && (String(otherUserId) === String(dmId));
            });

            if (dmSession) {

            }
          }

          if (dmSession?.isGroup) {
            setSelectedChat(groupChatObject(dmSession, workspaceId));
            return;
          }
          if (dmSession && dmSession.otherUser) {
            
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";

            setSelectedChat({
              id: dmSession.id,  
              userId: dmSession.otherUser._id || dmSession.otherUser.id || dmSession.otherUserId || null,
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,  
              workspaceId: workspaceId
            });
          } else {
            // Not a DM id: a person's id (New message, a profile, a link). Open the real DM.
            // If it is not a person either, it may be a DM the list doesn't show yet: open it as is.
            if (!(await openDMWithUser(workspaceId, dmId))) {
              setSelectedChat({ id: dmId, name: "Direct message", type: "dm", isNew: false, workspaceId });
            }
          }
        } catch (error) {
          logger.error("❌ [DM Fetch] Failed to fetch DM details:", error);
          logger.error("❌ [DM Fetch] Error details:", error.response?.data || error.message);
          setSelectedChat({ id: dmId, name: "Direct message", type: "dm", isNew: false, workspaceId });
        }
        setCurrentBroadcast(null);
      };

      fetchDMDetails();
    } else {
      setSelectedChat(null);
      setCurrentBroadcast(null);
    }
  }, [location.pathname, location.state, contacts, searchParams, openDMWithUser]);

  const handleDeleteChat = (chat) => {
    deleteItem(chat.id);
    setSelectedChat(null);
    navigate("/messages"); 
  };

  const handleStartDM = (selectedUser) => {
    setShowCreateDM(false);
    
    const userId = selectedUser?._id || selectedUser?.id;
    if (workspaceId && userId) openDMWithUser(workspaceId, userId);
  };

  const isCompose = /\/messages\/new\/?$/.test(location.pathname);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden">
        {}
        <div className="flex-1 flex flex-col">
          {isCompose ? (
            <NewMessageView key={workspaceId} workspaceId={workspaceId} currentUserId={myId} />
          ) : currentBroadcast ? (
            <BroadcastChatWindow broadcast={currentBroadcast} />
          ) : selectedChat ? (
            <ChatWindowV2
              key={selectedChat.id || selectedChat._id}
              chat={selectedChat}
              contacts={contacts}
              onClose={() => setSelectedChat(null)}
              onDeleteChat={() => handleDeleteChat(selectedChat)}
              workspaceId={workspaceId || selectedChat.workspaceId}
            />
          ) : (
            <MessagesLanding onNewMessage={() => navigate(`/workspace/${workspaceId}/messages/new`)} />
          )}
        </div>
      </div>

      {}
      {showCreateDM && (
        <NewDMModal
          onClose={() => setShowCreateDM(false)}
          onStart={handleStartDM}
        />
      )}
    </div>
  );
}
