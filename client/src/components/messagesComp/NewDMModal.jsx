import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../../contexts/AuthContext";
import { API_BASE } from "../../services/api";
import { getErrorMessage } from "../../utils/apiHelpers";

export default function NewDMModal({ onClose, onStart }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { accessToken, user } = useContext(AuthContext);
  const { workspaceId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Use token from context, or fallback to localStorage
        const token = accessToken || localStorage.getItem("accessToken");

        if (!token && !user) {
          // ... (same auth check)
          setLoading(false);
          return;
        }

        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let res;

        // If searching, use the new company-wide search endpoint
        if (debouncedQuery.trim()) {
          res = await axios.get(`${API_BASE}/api/search/contacts`, {
            params: { workspaceId, query: debouncedQuery },
            headers,
            withCredentials: true
          });
          // Search returns expected format directly
          setUsers(res.data.contacts || []);
        }
        // If no search, load initial list (workspace members or recent)
        else if (workspaceId) {
          res = await axios.get(`${API_BASE}/api/workspaces/${workspaceId}/members`, {
            headers,
            withCredentials: true
          });
          const membersList = res.data.members || [];
          const mapped = membersList.map(m => ({
            _id: m._id,
            username: m.username || m.email,
            profilePicture: m.profilePicture,
            isOnline: false
          }));
          setUsers(mapped);
        } else {
          // Fallback context
          setUsers([]);
        }
        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to load users:", err);
        setError(getErrorMessage(err));
        setLoading(false);
      }
    }
    load();
  }, [accessToken, user, workspaceId, debouncedQuery]);

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
              placeholder="Search people across workspace..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
