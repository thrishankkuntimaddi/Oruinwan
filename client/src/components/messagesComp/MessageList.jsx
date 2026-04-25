import { useContext, useEffect, useState, useRef, useCallback } from "react";
import api from '@services/api';
import { io } from "socket.io-client";
import { Search, Plus, Archive, Users, Hash, Lock, MessageCircle, MoreVertical, CheckCheck, X } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import CreateChannelModal from "./CreateChannelModal";
import JoinChannelModal from "./JoinChannelModal";
import NewDMModal from "./NewDMModal";
import { AuthContext } from "../../contexts/AuthContext";
import { SocketContext } from "../../contexts/SocketContext";
import { API_BASE } from '@services/api';
import { channelService } from "../../services/channelService";

import { Button, Input, Avatar, Badge } from "../../shared/components/ui";

const Tabs = ["All", "Direct Messages", "Channels"];

export default function MessageList({ onSelectChat }) {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  const { workspaceId } = useParams();
  const socketRef = useRef(null);

  
  function getMyId() {
    try {
      const t = localStorage.getItem("accessToken");
      if (!t) return null;
      const payload = JSON.parse(atob(t.split(".")[1]));
      return payload.sub || payload.id;
    } catch (e) {
      return null;
    }
  }
  const myId = getMyId();

  
  const loadAllChats = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      
      const chatsRes = await api.get(`/api/chat/list`);
      const existingChats = chatsRes.data.chats || [];

      
      const channelsRes = workspaceId
        ? await channelService.getMyChannels(workspaceId)
        : { data: { channels: [] } };
      const myChannels = channelsRes.data.channels || [];

      
      const usersRes = await api.get(`/api/auth/users`);
      const allUsers = usersRes.data.users || [];

      
      const channelMap = new Map();
      existingChats
        .filter(c => c.type === "channel")
        .forEach(c => channelMap.set(String(c.id), c));

      const mergedChannels = myChannels.map(ch => {
        const existing = channelMap.get(String(ch._id));
        if (existing) return existing;

        return {
          type: "channel",
          id: ch._id,
          name: ch.name,
          lastMessage: "",
          lastMessageAt: ch.createdAt,
          unreadCount: 0,
          isChannelEntry: true
        };
      });

      
      const dmMap = new Map();
      existingChats
        .filter(c => c.type === "dm")
        .forEach(c => dmMap.set(String(c.id), c));

      const mergedDMs = allUsers
        .filter(u => String(u._id) !== String(myId))
        .map(user => {
          const existing = dmMap.get(String(user._id));
          if (existing) return existing;

          return {
            type: "dm",
            id: user._id,
            name: user.username,
            profilePicture: user.profilePicture,
            email: user.email,
            lastMessage: "",
            lastMessageAt: null,
            unreadCount: 0,
            isUserEntry: true
          };
        });

      
      const sortedChannels = mergedChannels.sort((a, b) => {
        const timeA = new Date(a.lastMessageAt || 0);
        const timeB = new Date(b.lastMessageAt || 0);
        if (timeA.getTime() !== timeB.getTime()) return timeB - timeA;
        return a.name.localeCompare(b.name);
      });

      const sortedDMs = mergedDMs.sort((a, b) => {
        const timeA = new Date(a.lastMessageAt || 0);
        const timeB = new Date(b.lastMessageAt || 0);
        if (!!a.lastMessage !== !!b.lastMessage) return !!b.lastMessage - !!a.lastMessage;
        if (a.lastMessage && b.lastMessage) return timeB - timeA;
        return a.name.localeCompare(b.name);
      });

      setItems([...sortedChannels, ...sortedDMs]);
    } catch (err) {
      console.error("Failed to load chat list:", err);
    }
  }, [myId, workspaceId]);

  useEffect(() => {
    loadAllChats();
  }, [loadAllChats]);

  
  const { socket: sharedSocket, isConnected, addMessageListener, addChannelListener } = useContext(SocketContext);

  useEffect(() => {
    if (!sharedSocket || !isConnected) return;

    
    socketRef.current = sharedSocket;

    
    const unsubscribeMessages = addMessageListener((eventName, data) => {
      if (eventName === 'new-message') {
        const { message } = data;
        if (!message) return;

        const isChannel = !!message.channel;
        const chatId = isChannel
          ? message.channel
          : message.sender?._id === myId || message.sender === myId
            ? message.receiver
            : message.sender?._id || message.sender;

        const type = isChannel ? "channel" : "dm";

        const senderId =
          typeof message.sender === "object"
            ? message.sender._id
            : message.sender;

        
        const rawPreview =
          message.decryptedContent ||
          message.text ||
          (message.attachments?.length
            ? `[${message.attachments[0].type}]`
            : "");
        
        const previewText =
          rawPreview && !rawPreview.startsWith("\u{1F512}") ? rawPreview : "";

        const now = message.createdAt || new Date().toISOString();

        setItems((prev) => {
          const arr = [...prev];
          const idx = arr.findIndex(
            (it) => it.type === type && String(it.id) === String(chatId)
          );

          if (idx >= 0) {
            
            arr[idx].lastMessage = previewText;
            arr[idx].lastMessageAt = now;

            
            if (senderId !== myId) {
              arr[idx].unreadCount = (arr[idx].unreadCount || 0) + 1;
            }

            
            const updated = arr.splice(idx, 1)[0];
            return [updated, ...arr];
          }

          
          const newItem = {
            type,
            id: chatId,
            name: message.channelName || message.senderName || "User",
            lastMessage: previewText,
            lastMessageAt: now,
            unreadCount: senderId !== myId ? 1 : 0,
          };

          return [newItem, ...arr];
        });
      }
    });

    
    const unsubscribeChannels = addChannelListener((eventName, data) => {
      if (eventName === 'channel-created') {
        const channel = data.channel || data;
        setItems((prev) => {
          
          if (prev.some((it) => String(it.id) === String(channel._id))) return prev;
          return [
            {
              type: "channel",
              id: channel._id,
              name: channel.name,
              lastMessage: "",
              lastMessageAt: channel.createdAt,
              unreadCount: 0,
              isChannelEntry: true
            },
            ...prev,
          ];
        });
      } else if (eventName === 'invited-to-channel') {
        const { channelId, channelName } = data;
        
        setItems((prev) => {
          if (prev.some((it) => String(it.id) === String(channelId))) return prev;
          return [
            {
              type: "channel",
              id: channelId,
              name: channelName,
              lastMessage: "",
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
              isChannelEntry: true
            },
            ...prev,
          ];
        });
      } else if (eventName === 'removed-from-channel') {
        const { channelId } = data;
        
        setItems((prev) => prev.filter((it) => !(it.type === "channel" && String(it.id) === String(channelId))));
      }
    });

    return () => {
      
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeChannels) unsubscribeChannels();
    };
  }, [sharedSocket, isConnected, myId, addMessageListener, addChannelListener]);

  
  const filtered = items.filter((item) => {
    const txt = (item.name + " " + (item.lastMessage || "")).toLowerCase();
    if (!txt.includes(searchQuery.toLowerCase())) return false;
    if (activeTab === "All") return true;
    if (activeTab === "Direct Messages" && item.type === "dm") return true;
    if (activeTab === "Channels" && item.type === "channel") return true;
    return false;
  });

  
  function fmtShort(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;

    return d.toLocaleDateString();
  }

  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {}
      <div style={{ padding: '10px 16px' }}>
        <Input
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search size={18} />}
          className="bg-secondary-50 border-secondary-200"
          fullWidth
        />
      </div>

      {}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', padding: '6px 16px' }}>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => setShowNewChat(true)}
          icon={<Plus size={14} />}
        >
          New
        </Button>

        <Button
          onClick={() => setShowJoin(true)}
          size="xs"
          variant="secondary"
        >
          Join
        </Button>
        <Button
          onClick={() => setShowCreate(true)}
          size="xs"
          variant="primary"
        >
          Create
        </Button>
      </div>

      {}
      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={(ch) => {
            setItems(prev => [
              {
                type: "channel",
                id: ch._id,
                name: ch.name,
                lastMessage: "",
                lastMessageAt: ch.createdAt,
                unreadCount: 0,
                isChannelEntry: true
              },
              ...prev
            ]);
          }}
        />
      )}

      {showNewChat && (
        <NewDMModal
          onClose={() => setShowNewChat(false)}
          onStart={(user) => {
            onSelectChat({ type: "dm", id: user._id, name: user.username });
            setShowNewChat(false);
          }}
        />
      )}

      {showJoin && (
        <JoinChannelModal
          currentUserId={myId}
          onClose={() => setShowJoin(false)}
          onJoined={() => {
            
            loadAllChats();
          }}
        />
      )}

      {}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 16px', gap: '4px',
      }}>
        {Tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '10px 10px',
              fontSize: '12px', fontWeight: activeTab === t ? 600 : 400,
              color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              background: 'none', border: 'none', outline: 'none',
              borderBottom: activeTab === t ? '1px solid var(--text-primary)' : '1px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              transition: 'color 150ms ease, border-color 150ms ease',
            }}
            onMouseEnter={e => { if (activeTab !== t) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { if (activeTab !== t) e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {t}
          </button>
        ))}
      </div>

      {}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {(() => {
          
          const channels = filtered.filter(item => item.type === "channel");
          const dms = filtered.filter(item => item.type === "dm");

          return (
            <>
              {}
              {channels.length > 0 && (
                <>
                  <div style={{
                    padding: '6px 16px',
                    backgroundColor: 'var(--bg-active)',
                    position: 'sticky', top: 0, zIndex: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <p style={{
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0,
                      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                      Channels
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
                      style={{
                        background: 'none', border: 'none', outline: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        fontSize: '16px', lineHeight: 1, padding: '2px 4px',
                        borderRadius: '2px', transition: 'color 100ms ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Create Channel"
                    >
                      +
                    </button>
                  </div>
                  {channels.map((item) => (
                    <ChatListItem key={`${item.type}_${item.id}`} item={item} />
                  ))}
                </>
              )}

              {}
              {dms.length > 0 && (
                <>
                  <div style={{
                    padding: '6px 16px', marginTop: '4px',
                    backgroundColor: 'var(--bg-active)',
                    position: 'sticky', top: 0, zIndex: 10,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <p style={{
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0,
                      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                      Direct Messages
                    </p>
                  </div>
                  {dms.map((item) => (
                    <ChatListItem key={`${item.type}_${item.id}`} item={item} />
                  ))}
                </>
              )}

              {}
              {filtered.length === 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '128px',
                }}>
                  <p style={{
                    color: 'var(--text-muted)', fontSize: '13px',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  }}>No results found</p>
                </div>
              )}
            </>
          );
        })()}
      </div>

    </div>
  );

  
  function ChatListItem({ item }) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 16px', cursor: 'pointer', transition: '100ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        onClick={async () => {
          onSelectChat(item);

          
          if (!item.isUserEntry) {
            try {
              const token = localStorage.getItem("accessToken");
              const headers = token ? { Authorization: `Bearer ${token}` } : {};
              await api.post(`/api/chat/reset-unread`, {
                type: item.type,
                id: item.id
              });
            } catch (err) {
              console.error("reset unread failed:", err);
            }
          }

          
          setItems((prev) =>
            prev.map((i) =>
              i.type === item.type && String(i.id) === String(item.id)
                ? { ...i, unreadCount: 0 }
                : i
            )
          );
        }}
      >
        {}
        {item.type === "dm" ? (
          <Avatar
            src={item.profilePicture}
            alt={item.name}
            fallback={item.name}
            size="md"
          />
        ) : (
          <div style={{
            width: '40px', height: '40px', borderRadius: '2px', flexShrink: 0,
            backgroundColor: 'var(--bg-active)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <Hash size={18} />
          </div>
        )}

        {}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
            <p style={{
              fontWeight: 500, fontSize: '13px', margin: 0,
              color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>
              {item.name}
            </p>
            <p style={{
              fontSize: '11px', color: 'var(--text-muted)', margin: 0, flexShrink: 0, marginLeft: '8px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>
              {fmtShort(item.lastMessageAt)}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{
              fontSize: '12px', color: 'var(--text-muted)', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}>
              {item.lastMessage || (item.isUserEntry ? "Start a conversation" : "No messages yet")}
            </p>

            {item.unreadCount > 0 && (
              <Badge variant="primary" size="sm" className="rounded-full px-1.5 min-w-[1.25rem] justify-center">
                {item.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }
}
