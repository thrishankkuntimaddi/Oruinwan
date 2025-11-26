// src/components/Sidebar.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ProfileSidebar from "./ProfileSidebar";
import { useAuth } from "../../contexts/AuthContext";

const Sidebar = ({ onAIClick }) => {
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <div className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col justify-between shadow-sm">

        {/* Profile Section */}
        <div>
          <div
            className="flex items-center space-x-3 px-6 py-6 cursor-pointer"
            onClick={() => setShowProfile(true)}
          >
            <div
              className="h-12 w-12 rounded-full bg-center bg-cover shadow-md"
              style={{
                backgroundImage: `url(${user?.profilePicture || "/assets/kpnbg301.svg"
                  })`,
              }}
            />

            <div>
              <h2 className="text-sm font-bold text-[#0f172a]">
                {user?.username || "User"}
              </h2>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4">
            {[
              { label: "Home", path: "/" },
              { label: "Messages", path: "/messages" },
              { label: "MyTasks", path: "/tasks" },
              { label: "Blogs", path: "/blogs" },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full px-6 py-3 text-left transition-colors ${isActive(item.path)
                    ? "bg-gray-100 text-[#0c77f2] font-semibold"
                    : "text-gray-700 hover:bg-gray-100 hover:text-[#0c77f2]"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* AI Button */}
        <div className="p-6">
          <button
            onClick={onAIClick}
            className="w-full py-2 px-4 rounded-lg text-sm font-semibold text-white bg-[#0c77f2] hover:bg-[#065cd2]"
          >
            🤖 ChttrixAI
          </button>
        </div>
      </div>

      {/* Profile Sidebar */}
      {showProfile && <ProfileSidebar onClose={() => setShowProfile(false)} />}
    </>
  );
};

export default Sidebar;
