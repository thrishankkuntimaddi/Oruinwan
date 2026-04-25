import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatWindowV2 from "../../components/messagesComp/chatWindowComp/ChatWindowV2";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from '@services/api';
import { useSocket } from "../../contexts/SocketContext";
import EmptyState from "./states/EmptyState";

const Home = () => {
  const { workspaceId, id, dmId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    const detectChat = async () => {

      
      setActiveChat(null);
      setIsLoading(true);
      try {
        
        if (location.pathname.includes("/channel/") && id) {
          try {
            
            const res = await api.get(`/api/channels/${id}/details`);
            const channelData = res.data.channel || res.data;

            if (channelData) {
              setActiveChat({
                id: channelData._id || channelData.id,
                name: `#${channelData.name}`,
                type: "channel",
                workspaceId,
                isPrivate: channelData.isPrivate,
                isDiscoverable: channelData.isDiscoverable,
                members: channelData.members || [],
                createdBy: channelData.createdBy,
                createdAt: channelData.createdAt,
                creatorName: channelData.creatorName,
                systemEvents: channelData.systemEvents || [],
                isDefault: channelData.isDefault,
                description: channelData.description,
                admins: channelData.admins || [],
                workspaceRole: activeWorkspace?.role,
                isMember: true,
              });
            }
          } catch (detailsErr) {
            
            
            if (detailsErr?.response?.status === 403 || detailsErr?.response?.status === 404) {
              try {
                const listRes = await api.get(`/api/workspaces/${workspaceId}/channels`);
                const channels = listRes.data.channels || [];
                const channel = channels.find(c => String(c._id) === String(id));

                if (channel) {
                  setActiveChat({
                    id: channel._id,
                    name: `#${channel.name}`,
                    type: "channel",
                    workspaceId,
                    isPrivate: channel.isPrivate,
                    isDiscoverable: channel.isDiscoverable ?? true,
                    members: [],
                    description: channel.description,
                    isDefault: channel.isDefault,
                    workspaceRole: activeWorkspace?.role,
                    isMember: false, 
                  });
                } else {
                  setActiveChat(null);
                }
              } catch {
                setActiveChat(null);
              }
            } else {
              
              setActiveChat(null);
            }
          }
          return;
        }

        
        if (location.pathname.includes("/dm/") && (id || dmId)) {
          const targetId = dmId || id; 

          if (targetId) {

            
            
            
            
            
            

            let resolvedDMSessionId = null;
            let otherUserId = null;
            let isAlreadySessionId = false;

            
            try {
              const dmRes = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
              const dmSessions = dmRes.data.sessions || [];
              const existingSession = dmSessions.find(s => String(s.id) === String(targetId));

              if (existingSession) {
                resolvedDMSessionId = existingSession.id;
                otherUserId = existingSession.otherUserId;
                isAlreadySessionId = true;
              }
            } catch (err) {
              
            }

            
            if (!isAlreadySessionId) {
              try {
                
                const resolveRes = await api.get(
                  `/api/v2/messages/workspace/${workspaceId}/dm/resolve/${targetId}`
                );

                if (resolveRes.data.success) {
                  resolvedDMSessionId = resolveRes.data.dmSessionId;
                  otherUserId = resolveRes.data.otherUserId;
                }
              } catch (resolveErr) {
                
                console.error('[Home] ❌ Could not resolve DM');
                setActiveChat(null);
                return;
              }
            }

            
            const res = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = res.data.members || [];

            let member = members.find(m =>
              String(m._id || m.id) === String(otherUserId) ||
              String(m.user?._id || m.user?.id) === String(otherUserId)
            );

            
            const userData = member?.user || member;
            const memberName = userData?.username || userData?.name || userData?.email?.split('@')[0];
            const memberPicture = userData?.profilePicture || userData?.avatar;

            
            let status = "offline";
            if (userData?.isOnline) {
              status = userData.userStatus || "active";
            }

            
            const chatObject = {
              id: resolvedDMSessionId,  
              userId: otherUserId,       
              name: memberName || "Unknown User",
              image: memberPicture,
              status: status,
              type: "dm",
              isNew: location.pathname.includes("/dm/new/"),
              workspaceId,
              workspaceRole: activeWorkspace?.role
            };

            setActiveChat(chatObject);

            
            
            try {
              
              if (!isAlreadySessionId) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              const conversationKeyService = (await import('../../services/conversationKeyService')).default;
              await conversationKeyService.getConversationKey(resolvedDMSessionId, 'dm');
            } catch (keyErr) {
              
            }

            
            
            if (!isAlreadySessionId && targetId !== resolvedDMSessionId) {
              navigate(`/workspace/${workspaceId}/dm/${resolvedDMSessionId}`, { replace: true });
              return; 
            }
          }
          return;
        }

        setActiveChat(null);
      } catch (err) {
        console.error("Error detecting chat metadata:", err);
      } finally {
        setIsLoading(false);
      }
    };

    detectChat();
  }, [location.pathname, id, dmId, workspaceId, activeWorkspace?.role, navigate]);

  
  useEffect(() => {
    if (!socket || !activeChat || activeChat.type !== 'dm') return;

    const handleStatusChange = ({ userId, status }) => {
      
      if (String(activeChat.userId) === String(userId)) {
        setActiveChat(prev => ({ ...prev, status: status }));
      }
    };

    socket.on("user-status-changed", handleStatusChange);
    return () => socket.off("user-status-changed", handleStatusChange);
  }, [socket, activeChat]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base, #0c0c0c)' }}>
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.8; }
          100% { opacity: 0.4; }
        }
        .skel-shimmer { animation: shimmer 1.6s ease-in-out infinite; }
      `}</style>

      {isLoading ? (
        <div className="skel-shimmer" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base, #0c0c0c)', padding: '16px', gap: '20px' }}>
          {}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(184,149,106,0.15)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ height: '10px', width: '120px', background: 'var(--bg-active)' }} />
              <div style={{ height: '8px', width: '70px', background: 'var(--bg-hover)' }} />
            </div>
          </div>

          {}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '22px', overflow: 'hidden' }}>
            {[
              { aw: 100, l1: '65%', l2: null },
              { aw: 88,  l1: '50%', l2: '38%' },
              { aw: 72,  l1: '78%', l2: null },
              { aw: 96,  l1: '55%', l2: '42%' },
              { aw: 82,  l1: '70%', l2: null },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-active)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, maxWidth: '68%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                    <div style={{ height: '9px', width: `${b.aw}px`, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ height: '7px', width: '40px', background: 'var(--bg-hover)' }} />
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg-active)', width: b.l1 }} />
                  {b.l2 && <div style={{ height: '14px', background: 'var(--bg-hover)', width: b.l2 }} />}
                </div>
              </div>
            ))}
          </div>

          {}
          <div style={{ height: '42px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }} />
        </div>
      ) : activeChat ? (
        <ChatWindowV2
          chat={activeChat}
          onClose={() => {
            setActiveChat(null);
            sessionStorage.removeItem('activeChat');
          }}
          contacts={[]} 
          onDeleteChat={() => {
            setActiveChat(null);
            sessionStorage.removeItem('activeChat');
          }}
          workspaceId={workspaceId}
          onChatUpdate={setActiveChat}
        />
      ) : (
        <EmptyState
          onNavigateChannels={() => navigate(`/workspace/${workspaceId}/channels`)}
          onNavigateDMs={() => navigate(`/workspace/${workspaceId}/messages`)}
        />
      )}
    </div>
  );

};

export default Home;
