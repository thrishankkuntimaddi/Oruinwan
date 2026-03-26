import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../../contexts/AuthContext";
import { API_BASE } from "../../services/api";
import { getErrorMessage } from "../../utils/apiHelpers";
import { getAvatarUrl } from "../../utils/avatarUtils";

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

        const token = accessToken || localStorage.getItem("accessToken");

        if (!token && !user) {
          setLoading(false);
          return;
        }

        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let res;

        if (debouncedQuery.trim()) {
          res = await axios.get(`${API_BASE}/api/search/contacts`, {
            params: { workspaceId, query: debouncedQuery },
            headers,
            withCredentials: true
          });
          setUsers(res.data.contacts || []);
        } else if (workspaceId) {
          res = await axios.get(`${API_BASE}/api/workspaces/${workspaceId}/members`, {
            headers,
            withCredentials: true
          });
          const membersList = res.data.members || [];
          const mapped = membersList.map(m => ({
            _id: m._id,
            username: m.username || m.email,
            email: m.email || "",
            about: m.profile?.about || m.about || "",
            profilePicture: m.profilePicture || null,
            status: m.status || "offline",
            userStatus: m.userStatus || null,
            role: m.role || "member",
          }));
          setUsers(mapped);
        } else {
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[520px] max-h-[640px] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700/50">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h3>
            <p className="text-xs text-gray-400 mt-0.5">Start a direct conversation</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search people across workspace..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white placeholder-gray-400"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
              <span className="text-sm">Loading members...</span>
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 py-8 px-4 text-sm">{error}</div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="text-3xl mb-2">👥</div>
              <p className="text-sm font-medium">No members found</p>
              {searchQuery && <p className="text-xs mt-1 text-gray-300">Try a different search term</p>}
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1.5 mb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {searchQuery ? "Results" : "Workspace Members"}
              </div>
              <div className="space-y-1">
                {users.map((u) => (
                  <div
                    key={u._id}
                    onClick={() => onStart(u)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl cursor-pointer transition-all group"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={getAvatarUrl(u)}
                        alt={u.username}
                        className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-900"
                        onError={(e) => {
                          e.target.src = getAvatarUrl({ username: u.username });
                        }}
                      />
                      {/* Online indicator */}
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                          u.status === "online" ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {u.username}
                        </span>
                        {u.role === "owner" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full flex-shrink-0">
                            Owner
                          </span>
                        )}
                        {u.role === "admin" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full flex-shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      {u.email && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {u.email}
                        </div>
                      )}
                      {u.about && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 italic">
                          {u.about}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onStart(u); }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all transform active:scale-95"
                    >
                      Message
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
