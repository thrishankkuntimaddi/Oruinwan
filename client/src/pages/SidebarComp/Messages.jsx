import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatWindowV2 from "../../features/messaging/chatWindowComp/ChatWindowV2";
import BroadcastChatWindow from "../../features/messaging/BroadcastChatWindow";
import { useContacts } from "../../contexts/ContactsContext";
import api from '@services/api';
import { MessageSquarePlus } from "lucide-react";
import BrandMark from "../../shared/components/ui/BrandMark";
import "../../components/layout/shell.css";
import NewDMModal from "../../features/messaging/NewDMModal";
import { useParams } from "react-router-dom";
import logger from '../../utils/logger';

export default function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [showCreateDM, setShowCreateDM] = useState(false);
  const { contacts, deleteItem } = useContacts();
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();

  
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

          if (dmSession && dmSession.otherUser) {
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";

            setSelectedChat({
              id: dmSession.id,
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
            const userData = user.user || user;
            const username = userData.username || userData.name || userData.email?.split('@')[0] || "Unknown User";

            setSelectedChat({
              id: newDMParam,
              name: username,
              type: "dm",
              avatar: userData.profilePicture || userData.avatar,
              status: userData.isOnline ? "online" : "offline",
              isNew: true,
              workspaceId: workspaceId
            });
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

          if (dmSession && dmSession.otherUser) {
            
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";

            setSelectedChat({
              id: dmSession.id,  
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,  
              workspaceId: workspaceId
            });
          } else {
            

            const userRes = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = userRes.data.members || [];

            
            const user = members.find(m => {
              const memberId = m._id || m.id || m.user?._id || m.user?.id;
              return String(memberId) === String(dmId);
            });

            if (user) {
              
              const userData = user.user || user;
              const username = userData.username
                || userData.name
                || userData.email?.split('@')[0]
                || "Unknown User";

              setSelectedChat({
                id: dmId,  
                name: username,
                type: "dm",
                avatar: userData.profilePicture || userData.avatar,
                status: userData.isOnline ? "online" : "offline",
                isNew: true,  
                workspaceId: workspaceId
              });
            } else {
              

              setSelectedChat({
                id: dmId,
                name: "Unknown User",
                type: "dm",
                avatar: null,
                status: "offline",
                isNew: true,
                workspaceId: workspaceId
              });
            }
          }
        } catch (error) {
          logger.error("❌ [DM Fetch] Failed to fetch DM details:", error);
          logger.error("❌ [DM Fetch] Error details:", error.response?.data || error.message);

          
          setSelectedChat({
            id: dmId,
            name: "Unknown User",
            type: "dm",
            avatar: null,
            status: "offline",
            isNew: true,
            workspaceId: workspaceId
          });
        }
        setCurrentBroadcast(null);
      };

      fetchDMDetails();
    } else {
      setSelectedChat(null);
      setCurrentBroadcast(null);
    }
  }, [location.pathname, location.state, contacts, searchParams]);

  const handleDeleteChat = (chat) => {
    deleteItem(chat.id);
    setSelectedChat(null);
    navigate("/messages"); 
  };

  const handleStartDM = (selectedUser) => {
    setShowCreateDM(false);
    
    if (workspaceId) {
      navigate(`/workspace/${workspaceId}/messages/dm/${selectedUser._id || selectedUser.id}`);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden">
        {}
        <div className="flex-1 flex flex-col">
          {currentBroadcast ? (
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
            <div className="gl-shell-welcome gl-ambient">
              <div className="gl-shell-welcome-inner" style={{ maxWidth: '380px' }}>
                <div className="gl-shell-brand-tile">
                  <BrandMark size={44} title="" />
                </div>
                <span className="gl-eyebrow">Messages</span>
                <h2 className="gl-display gl-shell-welcome-title" style={{ fontSize: '26px' }}>
                  Direct <span className="gl-sheen">Messages</span>
                </h2>
                <p className="gl-shell-welcome-lead">
                  Select a conversation from the sidebar or start a new private chat.
                </p>
                <button type="button" className="gl-btn gl-btn--primary gl-btn--lg" onClick={() => setShowCreateDM(true)}>
                  <MessageSquarePlus size={15} />
                  Start a new chat
                </button>
              </div>
            </div>
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
