// client/src/components/messagesComp/MessageList.jsx
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import CreateChannelModal from "./CreateChannelModal";
import JoinChannelModal from "./JoinChannelModal";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Tabs = ["All", "Direct Messages", "Channels"];

export default function MessageList({ onSelectChat }) {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const socketRef = useRef(null);

  /* -------------------------------------------------
     GET MY USER ID FROM TOKEN
  ------------------------------------------------- */
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

  /* -------------------------------------------------
     LOAD INITIAL CHAT LIST
  ------------------------------------------------- */
  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/chat/list`, { headers });

        setItems(res.data.chats || []);
      } catch (err) {
        console.error("Failed to load chat list:", err);
      }
    }
    load();
  }, []);

  /* -------------------------------------------------
     SOCKET: LISTEN FOR NEW MESSAGES
  ------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const socket = io(API_BASE, { auth: { token }, transports: ["websocket"] });

    socketRef.current = socket;

    socket.on("new-message", ({ message }) => {
      if (!message) return;

      const isChannel = !!message.channelId;
      const chatId = isChannel
        ? message.channelId
        : message.senderId === myId
          ? message.receiverId
          : message.senderId;

      const type = isChannel ? "channel" : "dm";

      const senderId =
        typeof message.senderId === "object"
          ? message.senderId._id
          : message.senderId;

      const previewText =
        message.text ||
        (message.attachments?.length
          ? `[${message.attachments[0].type}]`
          : "");

      const now = message.createdAt || new Date().toISOString();

      setItems((prev) => {
        const arr = [...prev];
        const idx = arr.findIndex(
          (it) => it.type === type && String(it.id) === String(chatId)
        );

        if (idx >= 0) {
          // update
          arr[idx].lastMessage = previewText;
          arr[idx].lastMessageAt = now;

          // unread
          if (senderId !== myId) {
            arr[idx].unreadCount = (arr[idx].unreadCount || 0) + 1;
          }

          // move to top
          const updated = arr.splice(idx, 1)[0];
          return [updated, ...arr];
        }

        // new chat
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
    });

    socket.on("channel-created", (channel) => {
      setItems((prev) => {
        // avoid duplicates
        if (prev.some((it) => String(it.id) === String(channel._id))) return prev;
        return [
          {
            type: "channel",
            id: channel._id,
            name: channel.name,
            lastMessage: "",
            lastMessageAt: channel.createdAt,
            unreadCount: 0,
          },
          ...prev,
        ];
      });
    });

    socket.on("invited-to-channel", ({ channelId, channelName }) => {
      // User was invited to a channel, add it to their list
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
          },
          ...prev,
        ];
      });
    });

    socket.on("removed-from-channel", ({ channelId }) => {
      // User was removed from a channel, remove it from their list
      setItems((prev) => prev.filter((it) => !(it.type === "channel" && String(it.id) === String(channelId))));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId]);

  /* -------------------------------------------------
     FILTER RESULTS
  ------------------------------------------------- */
  const filtered = items.filter((item) => {
    const txt = (item.name + " " + (item.lastMessage || "")).toLowerCase();
    if (!txt.includes(searchQuery.toLowerCase())) return false;
    if (activeTab === "All") return true;
    if (activeTab === "Direct Messages" && item.type === "dm") return true;
    if (activeTab === "Channels" && item.type === "channel") return true;
    return false;
  });

  /* -------------------------------------------------
     TIME FORMAT
  ------------------------------------------------- */
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

  /* -------------------------------------------------
     RENDER
  ------------------------------------------------- */
  return (
    <div className="h-full flex flex-col">

      {/* Search */}
      <div className="px-4 py-3">
        <div className="flex w-full rounded-lg h-12 bg-[#f0f2f4]">
          <div className="flex items-center justify-center pl-4">
            🔍
          </div>
          <input
            type="text"
            placeholder="Search"
            className="flex-1 bg-[#f0f2f4] px-4 text-sm focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Channel Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-2">
        <button
          onClick={() => setShowJoin(true)}
          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
        >
          Join Channel
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          + Create Channel
        </button>
      </div>

      {/* Modals */}
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
                unreadCount: 0
              },
              ...prev
            ]);
          }}
        />
      )}

      {showJoin && (
        <JoinChannelModal
          onClose={() => setShowJoin(false)}
          onJoined={() => {
            // Reload chat list after joining
            async function reload() {
              try {
                const token = localStorage.getItem("accessToken");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get(`${API_BASE}/api/chat/list`, { headers });
                setItems(res.data.chats || []);
              } catch (err) {
                console.error("Failed to reload chat list:", err);
              }
            }
            reload();
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4 gap-8">
        {Tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-3 pt-3 text-sm font-semibold ${activeTab === t
              ? "text-black border-b-2 border-black"
              : "text-gray-500"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => (
          <div
            key={`${item.type}_${item.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-gray-100 cursor-pointer"
            onClick={async () => {
              onSelectChat(item);

              // reset unread server-side
              try {
                const token = localStorage.getItem("accessToken");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await axios.post(`${API_BASE}/api/chat/reset-unread`, {
                  type: item.type,
                  id: item.id
                }, { headers });
              } catch (err) {
                console.error("reset unread failed:", err);
              }

              // reset local
              setItems((prev) =>
                prev.map((i) =>
                  i.type === item.type && String(i.id) === String(item.id)
                    ? { ...i, unreadCount: 0 }
                    : i
                )
              );
            }}
          >
            {/* Avatar */}
            {item.type === "dm" ? (
              <div
                className="h-12 w-12 bg-gray-300 rounded-full"
                style={{
                  backgroundImage: `url(${item.profilePicture || "/default-avatar.png"})`,
                  backgroundSize: "cover",
                }}
              />
            ) : (
              <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center">
                #
              </div>
            )}

            {/* Text */}
            <div className="flex-1">
              <div className="flex justify-between">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">
                  {fmtShort(item.lastMessageAt)}
                </p>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-gray-600 text-sm line-clamp-1">
                  {item.lastMessage || "No messages yet"}
                </p>

                {item.unreadCount > 0 && (
                  <div className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                    {item.unreadCount}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
