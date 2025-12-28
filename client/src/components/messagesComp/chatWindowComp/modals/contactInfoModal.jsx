import React, { useState, useEffect } from "react";
import { Mail, Phone, Info, X } from "lucide-react";
import api from "../../../../services/api";

export default function ContactInfoModal({ chat, onClose }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        console.log('🔍 [ContactInfo] Chat object:', chat);

        const workspaceId = chat.workspaceId;
        if (!workspaceId) {
          console.error('❌ [ContactInfo] No workspaceId in chat object');
          throw new Error('No workspace ID');
        }

        console.log('📡 [ContactInfo] Fetching members from workspace:', workspaceId);
        const res = await api.get(`/api/workspaces/${workspaceId}/members`);
        const members = res.data.members || [];
        console.log('📋 [ContactInfo] Members received:', members);
        console.log('📋 [ContactInfo] First member structure:', JSON.stringify(members[0], null, 2));

        const userId = chat.userId || chat.id;
        console.log('🔍 [ContactInfo] Looking for user:', userId);

        const user = members.find(m => String(m._id || m.id) === String(userId));
        console.log('👤 [ContactInfo] Found user:', user);
        console.log('📱 [ContactInfo] User phone:', user?.phone);
        console.log('📝 [ContactInfo] User profile:', user?.profile);
        console.log('ℹ️  [ContactInfo] User about:', user?.profile?.about);

        if (user) {
          console.log('✅ [ContactInfo] Setting userData with user:', {
            username: user.username,
            email: user.email,
            phone: user.phone,
            profile: user.profile,
            userStatus: user.userStatus
          });
          setUserData(user);
        } else {
          console.warn('⚠️ [ContactInfo] User not found, using fallback');
          setUserData({
            username: chat.name || chat.username,
            email: chat.email,
            phone: chat.phone,
            profilePicture: chat.image,
            isOnline: chat.status === "online",
            profile: chat.profile || {}
          });
        }
      } catch (err) {
        console.error("❌ [ContactInfo] Error:", err);
        setUserData({
          username: chat.name || chat.username,
          email: chat.email,
          phone: chat.phone,
          profilePicture: chat.image,
          isOnline: chat.status === "online",
          profile: {}
        });
      } finally {
        setLoading(false);
      }
    };

    if (chat) {
      fetchUserData();
    }
  }, [chat]);

  if (!chat) return null;

  const displayData = userData || chat;
  const displayName = displayData.username || displayData.name || "Unknown User";
  const displayEmail = displayData.email || "No email provided";
  const displayPhone = displayData.phone || "No phone provided";
  const displayAbout = displayData.profile?.about || displayData.about || "Hey there! I'm using Chttrix.";
  const isOnline = displayData.isOnline || chat.status === "online";

  // Get initials for avatar
  const getInitials = (name) => {
    return name?.charAt(0)?.toUpperCase() || "U";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-gray-800 w-[360px] rounded-xl shadow-2xl overflow-hidden relative z-10 border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-200">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
        >
          <X size={18} />
        </button>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Compact Header with Inline Profile */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {displayData.profilePicture ? (
                    <img
                      src={displayData.profilePicture}
                      alt={displayName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                      <span className="text-white font-bold text-lg">{getInitials(displayName)}</span>
                    </div>
                  )}
                  {/* Status Indicator */}
                  <span
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${displayData.userStatus === "active" || (isOnline && !displayData.userStatus) ? "bg-green-500" :
                      displayData.userStatus === "away" ? "bg-yellow-500" :
                        displayData.userStatus === "dnd" ? "bg-red-500" :
                          "bg-gray-400"
                      }`}
                  ></span>
                </div>

                {/* Name and Status */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
                  <p className={`text-xs font-medium ${displayData.userStatus === "active" || (isOnline && !displayData.userStatus) ? "text-green-600 dark:text-green-400" :
                    displayData.userStatus === "away" ? "text-yellow-600 dark:text-yellow-400" :
                      displayData.userStatus === "dnd" ? "text-red-600 dark:text-red-400" :
                        "text-gray-500 dark:text-gray-400"
                    }`}>
                    {displayData.userStatus ? displayData.userStatus.toUpperCase() : (isOnline ? 'ONLINE' : 'OFFLINE')}
                  </p>
                </div>
              </div>
            </div>

            {/* Info Sections - Compact List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Email */}
              <div className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <Mail size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Email</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 break-all">{displayEmail}</div>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <Phone size={18} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Phone</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{displayPhone}</div>
                </div>
              </div>

              {/* About */}
              <div className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <Info size={18} className="text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">About</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">{displayAbout}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
