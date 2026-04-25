import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatWindowV2 from "../../components/messagesComp/chatWindowComp/ChatWindowV2";
import BroadcastChatWindow from "../../components/messagesComp/BroadcastChatWindow";
import { useContacts } from "../../contexts/ContactsContext";
import api from '@services/api';
import { MessageSquarePlus } from "lucide-react";
import NewDMModal from "../../components/messagesComp/NewDMModal";
import { useParams } from "react-router-dom";

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
          console.error('❌ [Messages] Failed to fetch channel:', error);
          
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
          console.error('❌ [Messages] Failed to fetch DM:', error);
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
          console.error('❌ [Messages] Failed to fetch user for new DM:', error);
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
        console.error('❌ No workspaceId found!');
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
          console.error("❌ [DM Fetch] Failed to fetch DM details:", error);
          console.error("❌ [DM Fetch] Error details:", error.response?.data || error.message);

          
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
              chat={selectedChat}
              contacts={contacts}
              onClose={() => setSelectedChat(null)}
              onDeleteChat={() => handleDeleteChat(selectedChat)}
              workspaceId={workspaceId || selectedChat.workspaceId}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-base, #0c0c0c)', position: 'relative', overflow: 'hidden' }}>
              {}
              <div style={{ position: 'absolute', top: '30%', left: '40%', width: '320px', height: '320px', background: '#b8956a', opacity: 0.03, borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '360px', textAlign: 'center', padding: '32px' }}>
                {}
                <div style={{ width: '72px', height: '72px', background: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', overflow: 'hidden', flexShrink: 0 }}>
                  <video src="/hover-animation.mp4" autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                </div>

                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary, #e4e4e4)', marginBottom: '8px', letterSpacing: '-0.02em', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Direct Messages
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted, rgba(228,228,228,0.4))', marginBottom: '28px', lineHeight: '1.6', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Select a conversation from the sidebar or start a new private chat.
                </p>

                <button
                  onClick={() => setShowCreateDM(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
