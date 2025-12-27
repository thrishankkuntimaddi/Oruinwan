import React, { useState, useEffect } from "react";
import { Mail, Phone, Info, X, User as UserIcon } from "lucide-react";
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

        const userId = chat.userId || chat.id;
        console.log('🔍 [ContactInfo] Looking for user:', userId);

        const user = members.find(m => String(m._id || m.id) === String(userId));
        console.log('👤 [ContactInfo] Found user:', user);

        if (user) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-[420px] rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-gray-100 animate-in zoom-in-95 duration-200">

        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10">
          <X size={20} />
        </button>

        <div className="relative h-32 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <div className="absolute -bottom-16 w-32 h-32 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden">
            {displayData.profilePicture ? (
              <img src={displayData.profilePicture} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <UserIcon size={48} className="text-white" />
              </div>
            )}
          </div>
        </div>

        <div className="pt-20 pb-6 px-6 text-center">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h2>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className={`w-2.5 h-2.5 rounded-full ${displayData.userStatus === "active" || (isOnline && !displayData.userStatus) ? "bg-green-500" :
                    displayData.userStatus === "away" ? "bg-yellow-500" :
                      displayData.userStatus === "dnd" ? "bg-red-500" :
                        "bg-gray-400"
                  }`}></span>
                <span className={`text-sm font-medium ${displayData.userStatus === "active" || (isOnline && !displayData.userStatus) ? "text-green-600" :
                    displayData.userStatus === "away" ? "text-yellow-600" :
                      displayData.userStatus === "dnd" ? "text-red-600" :
                        "text-gray-500"
                  }`}>
                  {displayData.userStatus ? displayData.userStatus.toUpperCase() : (isOnline ? 'ONLINE' : 'OFFLINE')}
                </span>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                  <Mail size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</div>
                    <div className="text-sm text-gray-900 break-all">{displayEmail}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                  <Phone size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</div>
                    <div className="text-sm text-gray-900">{displayPhone}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                  <Info size={20} className="text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">About</div>
                    <div className="text-sm text-gray-900 leading-relaxed">{displayAbout}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
