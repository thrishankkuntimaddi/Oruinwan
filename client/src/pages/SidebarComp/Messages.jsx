import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatWindowV2 from "../../components/messagesComp/chatWindowComp/ChatWindowV2";
import BroadcastChatWindow from "../../components/messagesComp/BroadcastChatWindow";
import { useContacts } from "../../contexts/ContactsContext";
import api from "../../services/api";
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

  // Handle Routing for Selected Chat
  useEffect(() => {
    const path = location.pathname;

    // FIRST: Check for query parameters (from universal search)
    const channelParam = searchParams.get('channel');
    const dmParam = searchParams.get('dm');
    const newDMParam = searchParams.get('newDM');



    // Extract workspaceId from path for query param handling
    const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
    const workspaceId = workspaceMatch ? workspaceMatch[1] : null;

    // Handle channel query parameter
    if (channelParam && workspaceId) {

      const fetchChannelDetails = async () => {
        try {
          const response = await api.get(`/api/channels/${channelParam}`);
          const channel = response.data;


          setSelectedChat({
            id: channel._id || channel.id,
            name: channel.name,
            type: "channel",
            workspaceId,
            isPrivate: channel.isPrivate,
            members: channel.members || []
          });
          setCurrentBroadcast(null);
        } catch (error) {
          console.error('❌ [Messages] Failed to fetch channel:', error);
          // Fallback
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
      return; // Exit early
    }

    // Handle DM query parameter
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
      return; // Exit early
    }

    // Handle new DM query parameter
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
      return; // Exit early
    }

    // THEN: Handle path-based routing (existing logic)
    if (path.includes("/broadcast/")) {
      const broadcastId = path.split("/broadcast/")[1];
      if (location.state?.broadcast) {
        setCurrentBroadcast(location.state.broadcast);
      } else {
        // Fallback for direct access
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
      // Should not happen in Messages context usually, but handled just in case
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
      const dmId = path.split("/dm/").pop();  // Could be session ID or user ID


      // Extract workspaceId from path
      const workspaceMatch = path.match(/\/workspace\/([^/]+)/);
      const workspaceId = workspaceMatch ? workspaceMatch[1] : null;


      if (!workspaceId) {
        console.error('❌ No workspaceId found!');
        setSelectedChat(null);
        return;
      }

      // Fetch DM sessions to find participant details
      const fetchDMDetails = async () => {
        try {

          const response = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
          const sessions = response.data.sessions || [];


          // Debug: Log session structure to understand data format
          if (sessions.length > 0) {

          }

          // Try to find by session ID first
          let dmSession = sessions.find(s => s.id === dmId);

          if (dmSession) {

          }

          // If not found, try to find by participant user ID (otherUserId)
          if (!dmSession) {
            dmSession = sessions.find(s => {
              const otherUserId = s.otherUserId || s.otherUser?._id || s.otherUser?.id;
              return otherUserId && (String(otherUserId) === String(dmId));
            });

            if (dmSession) {

            }
          }

          if (dmSession && dmSession.otherUser) {
            // Extract username with multiple fallback options
            const username = dmSession.otherUser.username
              || dmSession.otherUser.name
              || dmSession.otherUser.email?.split('@')[0]
              || "Unknown User";



            setSelectedChat({
              id: dmSession.id,  // Use the actual session ID
              name: username,
              type: "dm",
              avatar: dmSession.otherUser.profilePicture || dmSession.otherUser.avatar,
              status: dmSession.otherUser.isOnline ? "online" : "offline",
              isNew: false,  // Existing DM session
              workspaceId: workspaceId
            });
          } else {
            // If still not found, might be a new DM - fetch user details from workspace members

            const userRes = await api.get(`/api/workspaces/${workspaceId}/members`);
            const members = userRes.data.members || [];


            // Try to find user by ID with multiple match strategies
            const user = members.find(m => {
              const memberId = m._id || m.id || m.user?._id || m.user?.id;
              return String(memberId) === String(dmId);
            });

            if (user) {
              // Extract username from member data (could be nested in user object)
              const userData = user.user || user;
              const username = userData.username
                || userData.name
                || userData.email?.split('@')[0]
                || "Unknown User";




              setSelectedChat({
                id: dmId,  // Use user ID for new DMs
                name: username,
                type: "dm",
                avatar: userData.profilePicture || userData.avatar,
                status: userData.isOnline ? "online" : "offline",
                isNew: true,  // New DM
                workspaceId: workspaceId
              });
            } else {
              // Ultimate fallback - but log warning


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

          // Fallback with error context
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
    navigate("/messages"); // Go back to empty state in messages
  };

  const handleStartDM = (selectedUser) => {
    setShowCreateDM(false);
    // Navigate to the "new" DM route with the target user's ID
    if (workspaceId) {
      navigate(`/workspace/${workspaceId}/messages/dm/${selectedUser._id || selectedUser.id}`);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-1 overflow-hidden">
        {/* RIGHT PANE – Chat window */}
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
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-gray-900 relative overflow-hidden">
              {/* Background Decor */}
              <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

              <div className="relative z-10 flex flex-col items-center max-w-lg text-center p-8">

                {/* Video Container */}
                <div className="w-24 h-24 mb-6 relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                  <div className="relative w-full h-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center border border-purple-50 dark:border-gray-700 overflow-hidden transform group-hover:scale-105 transition-transform duration-300">
                    <video
                      src="/hover-animation.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-90"
                    />
                  </div>
                </div>

                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                  Direct Messages
                </h2>
                <p className="text-slate-500 dark:text-gray-400 mb-8 max-w-xs mx-auto leading-relaxed">
                  Select a conversation from the sidebar or start a new private chat.
                </p>

                {/* Visual Hint */}
                {/* Visual Hint */}
                <button
                  onClick={() => setShowCreateDM(true)}
                  className="flex items-center gap-2 text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-full border border-purple-100 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                >
                  <MessageSquarePlus size={18} />
                  <span>Start a new chat</span>
                </button>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* New DM Modal */}
      {showCreateDM && (
        <NewDMModal
          onClose={() => setShowCreateDM(false)}
          onStart={handleStartDM}
        />
      )}
    </div>
  );
}
