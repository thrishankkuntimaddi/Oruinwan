import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function NewDMModal({ onClose, onStart }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        console.log("🔄 Loading users for DM...");
        const token = localStorage.getItem("accessToken");

        // If no token, user is not logged in
        if (!token) {
          console.error("❌ No auth token found");
          setError("Please log in to continue");
          setLoading(false);
          return;
        }

        console.log("✅ Token found, fetching contacts...");
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });

        console.log("📦 Received data:", res.data);
        const contactsList = res.data.contacts || [];
        console.log(`✅ Found ${contactsList.length} users:`, contactsList);

        setUsers(contactsList);
        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to load users:", err);
        console.error("Response:", err.response?.data);

        if (err.response?.status === 401) {
          setError("Authentication failed - please log in again");
          localStorage.removeItem("accessToken");
        } else {
          setError("Failed to load users: " + (err.message || "Unknown error"));
        }
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-80 max-h-96 flex flex-col">
        <h2 className="text-lg font-bold mb-3">Start New DM</h2>

        <div className="flex-1 overflow-y-auto mb-3">
          {loading && (
            <div className="text-center text-gray-500 py-4">
              Loading users...
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 py-4">
              {error}
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No other users found. Create another account to start chatting!
            </div>
          )}

          {!loading && !error && users.length > 0 && users.map(u => (
            <div
              key={u._id}
              className="p-3 hover:bg-gray-100 cursor-pointer rounded mb-1 border border-gray-200"
              onClick={() => {
                console.log("Selected user:", u);
                onStart(u);
              }}
            >
              <div className="font-medium">{u.username}</div>
              <div className="text-sm text-gray-500">{u.email}</div>
            </div>
          ))}
        </div>

        <button
          className="w-full px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
