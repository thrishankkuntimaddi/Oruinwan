import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import ChatWindow from "../../components/messagesComp/chatWindowComp/chatWindow";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from "../../services/api";
import { useSocket } from "../../contexts/SocketContext";

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
      setIsLoading(true);
      try {
        // 1. Check if it's a channel route
        if (location.pathname.includes("/channel/") && id) {
          // Fetch channel info with complete metadata
          const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
          const channels = res.data.channels || [];
          const channel = channels.find(c => String(c._id) === String(id) || c.name === id);

          if (channel) {
            setActiveChat({
              id: channel._id,
              name: `#${channel.name}`,
              type: "channel",
              workspaceId,
              isPrivate: channel.isPrivate,
              createdBy: channel.createdBy,
              isDefault: channel.isDefault,
              description: channel.description,
              admins: channel.admins || [], // Include admins array
              workspaceRole: activeWorkspace?.role // Pass workspace role for permission checks
            });
          } else {
            setActiveChat({
              id,
              name: "Channel",
              type: "channel",
              workspaceId,
              workspaceRole: activeWorkspace?.role
            });
          }
          return;
        }

        // 2. Check if it's a DM route (handles both /dm/:id and /dm/new/:dmId)
        if (location.pathname.includes("/dm/") && (id || dmId)) {
          const targetId = dmId || id; // Use dmId for new DMs, id for existing DMs

          if (targetId) {
            // Fetch user info to get the name
            const res = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = res.data.members || [];

            // Try to find member - check both direct ID and nested user.id
            let member = members.find(m =>
              String(m._id || m.id) === String(targetId) ||
              String(m.user?._id || m.user?.id) === String(targetId)
            );

            let dmSession = null; // Declare dmSession
            // If not found, targetId might be a DM session ID - fetch the session
            if (!member) {
              try {
                const dmRes = await api.get(`/api/messages/workspace/${workspaceId}/dms`);
                const dmSessions = dmRes.data.sessions || [];
                dmSession = dmSessions.find(s => String(s.id) === String(targetId));

                if (dmSession && dmSession.otherUserId) {
                  member = members.find(m =>
                    String(m._id || m.id) === String(dmSession.otherUserId) ||
                    String(m.user?._id || m.user?.id) === String(dmSession.otherUserId)
                  );
                }
              } catch (err) {
                console.error('❌ [Home] Failed to fetch DM sessions:', err);
              }
            }

            // Extract user data from nested structure if needed
            const userData = member?.user || member;
            const memberId = userData?._id || userData?.id;
            const memberName = userData?.username || userData?.name || userData?.email?.split('@')[0];
            const memberPicture = userData?.profilePicture || userData?.avatar;

            // Determine status
            let status = "offline";
            if (userData?.isOnline) {
              status = userData.userStatus || "active";
            }

            setActiveChat({
              id: targetId,
              userId: dmSession?.otherUserId || memberId,
              name: memberName || "Unknown User",
              image: memberPicture,
              status: status,
              type: "dm",
              isNew: !dmSession || location.pathname.includes("/dm/new/"), // New DM if no session exists OR on new route
              workspaceId,
              workspaceRole: activeWorkspace?.role
            });
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
  }, [location.pathname, id, dmId, workspaceId, activeWorkspace?.role]);

  // Handle real-time status updates for the active chat header
  useEffect(() => {
    if (!socket || !activeChat || activeChat.type !== 'dm') return;

    const handleStatusChange = ({ userId, status }) => {
      // If the update is for the user currently filling the active chat window
      if (String(activeChat.userId) === String(userId)) {
        setActiveChat(prev => ({ ...prev, status: status }));
      }
    };

    socket.on("user-status-changed", handleStatusChange);
    return () => socket.off("user-status-changed", handleStatusChange);
  }, [socket, activeChat]);

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading chat...</p>
        </div>
      ) : activeChat ? (
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
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-gray-900 relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

          <div className="relative z-10 flex flex-col items-center max-w-lg text-center p-8">
            <div className="w-24 h-24 mb-8 relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
              <div className="relative w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center border border-indigo-50 dark:border-gray-700 group-hover:-translate-y-1 transition-transform duration-300 overflow-hidden">
                <video
                  src="/hover-animation.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">
              Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Chttrix</span>
            </h1>

            <p className="text-lg text-slate-500 dark:text-gray-400 mb-8 leading-relaxed">
              Your command center for collaboration. Select a channel or direct message to start the conversation.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div
                onClick={() => navigate(`/workspace/${workspaceId}/channels`)}
                className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-gray-200 text-sm group-hover:text-indigo-600 transition-colors">Channels</div>
                  <div className="text-xs text-slate-400 dark:text-gray-500">Team discussions</div>
                </div>
              </div>

              <div
                onClick={() => navigate(`/workspace/${workspaceId}/messages`)}
                className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md hover:border-purple-200 transition-all group"
              >
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="22" y1="21" x2="22" y2="21"></line><path d="M20 8v6"></path><path d="M23 11h-6"></path></svg>
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-gray-200 text-sm group-hover:text-purple-600 transition-colors">Direct Messages</div>
                  <div className="text-xs text-slate-400 dark:text-gray-500">Private chats</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
