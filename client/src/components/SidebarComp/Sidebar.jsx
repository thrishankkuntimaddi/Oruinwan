// src/components/Sidebar.jsx
import React, { useState } from "react";
import ProfileSidebar from "./ProfileSidebar";

const Sidebar = ({ onNavigate, onAIClick }) => {
  const [showProfile, setShowProfile] = useState(false);

  const dummyUser = {
    name: "Thrishank Kuntimaddi",
    email: "thrishank@example.com",
    phone: "9876543210",
    dob: "2001-01-01",
    company: "OpenAI",
  };

  const handleSave = (updatedData) => {
    console.log("Updated Profile:", updatedData);
    // You can persist it later
  };

  return (
    <>
      <div className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col justify-between shadow-sm">
        {/* Profile & Workspace Info */}
        <div>
          <div
            className="flex items-center space-x-3 px-6 py-6 cursor-pointer"
            onClick={() => setShowProfile(true)}
          >
            <div
              className="h-12 w-12 rounded-full bg-center bg-cover shadow-md"
              style={{
                backgroundImage: "url('../../assests/kpnbg301.svg')",
              }}
            />
            <div>
              <h2 className="text-sm font-bold text-[#0f172a] tracking-tight">
                Thrishank Kuntimaddi
              </h2>
              <p className="text-xs text-gray-500">View Profile</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4">
            {["Home", "Messages", "MyTasks", "Blogs"].map((item) => (
              <button
                key={item}
                onClick={() => onNavigate(item)}
                className="w-full px-6 py-3 text-left text-gray-700 hover:bg-gray-100 hover:text-[#0c77f2] font-medium tracking-wide transition-colors"
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        {/* AI Assistant Button */}
        <div className="p-6">
          <button
            onClick={onAIClick}
            className="w-full py-2 px-4 rounded-lg text-sm font-semibold text-white bg-[#0c77f2] hover:bg-[#065cd2] transition"
          >
            🤖 ChttrixAI
          </button>
        </div>
      </div>

      {/* Slide-in Profile Sidebar */}
      {showProfile && (
        <ProfileSidebar
          user={dummyUser}
          onClose={() => setShowProfile(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
};

export default Sidebar;
