import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../../contexts/AuthContext";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

export default function NewDMModal({ onClose, onStart }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { accessToken, user } = useContext(AuthContext);
  const { workspaceId } = useParams();

  useEffect(() => {
    async function load() {
      try {
        console.log("🔄 Loading users for DM...");

        // Use token from context, or fallback to localStorage
        const token = accessToken || localStorage.getItem("accessToken");

        // If no token and no user in context, then truly not logged in
        if (!token && !user) {
          console.error("❌ No auth token found");
          setError("Please log in to continue");
          setLoading(false);
          return;
        }

        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        let res;
        if (workspaceId) {
          res = await axios.get(`${API_BASE}/api/workspaces/${workspaceId}/members`, {
            headers,
            withCredentials: true
          });
          const membersList = res.data.members || [];
          // Map workspace member format to DM user format
          const mapped = membersList.map(m => ({
            _id: m._id,
            username: m.username || m.email,
            profilePicture: m.profilePicture,
            isOnline: false
          }));
          setUsers(mapped);
        } else {
          res = await axios.get(`${API_BASE}/api/chat/contacts`, {
            headers,
            withCredentials: true
          });
          const contactsList = res.data.contacts || [];
          setUsers(contactsList);
        }
        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to load users:", err);
        console.error("Response:", err.response?.data);

        if (err.response?.status === 401) {
          setError("Authentication failed - please log in again");
        } else {
          setError("Failed to load users: " + (err.message || "Unknown error"));
        }
        setLoading(false);
      }
    }
    load();
  }, [accessToken, user, workspaceId]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[500px] h-[600px] flex flex-col overflow-hidden transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">✕</button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search for people..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading && (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading users...
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 py-8 px-4">
              {error}
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No users found.
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Suggested</div>
              {users.map((u) => (
                <div
                  key={u._id}
                  onClick={() => onStart(u)}
                  className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
                    {u.username ? u.username.charAt(0).toUpperCase() : "?"}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 dark:text-white">{u.username}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {/* Mock Status for now as backend might not send it yet */}
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Online
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all transform active:scale-95"
                  >
                    Message
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
