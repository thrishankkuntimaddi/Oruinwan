import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useContacts } from "../../contexts/ContactsContext";

const ProfileMenu = ({ onClose }) => {
  const { user, updateProfile, updatePassword, logout } = useAuth();
  const { contacts } = useContacts();

  const [view, setView] = useState("menu"); // menu, profile, security, contacts
  const [formData, setFormData] = useState({ ...user });

  // Password State
  const [passData, setPassData] = useState({ old: "", new: "", confirm: "" });

  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(formData);
      alert("Profile updated!");
      setView("menu");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSavePassword = async () => {
    if (passData.new !== passData.confirm) return alert("Passwords do not match");
    try {
      await updatePassword(passData.old, passData.new);
      alert("Password updated!");
      setView("menu");
    } catch (err) {
      alert(err.message);
    }
  };

  // --- SUB-COMPONENTS ---

  const MainMenu = () => (
    <div className="w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center space-x-3 bg-gray-50">
        <div className="w-10 h-10 rounded-full bg-gray-300 bg-cover bg-center" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
        <div>
          <div className="font-bold text-gray-900 text-sm">{user?.username}</div>
          <div className="text-xs text-green-600 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span> Active
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        <button onClick={() => setView("profile")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center">
          <span className="mr-3">👤</span> Edit Profile
        </button>
        <button onClick={() => setView("security")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center">
          <span className="mr-3">🔒</span> Security
        </button>
        <button onClick={() => setView("contacts")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center">
          <span className="mr-3">👥</span> Contacts Info
        </button>
        <div className="border-t border-gray-100 my-1"></div>
        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
          <span className="mr-3">🚪</span> Sign Out
        </button>
      </div>
    </div>
  );

  const ProfileView = () => (
    <div className="w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[500px]">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900">← Back</button>
        <span className="font-semibold text-sm">Edit Profile</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 overflow-y-auto space-y-3 flex-1">
        <div>
          <label className="text-xs font-medium text-gray-500">Full Name</label>
          <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Phone</label>
          <input type="text" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">About</label>
          <textarea value={formData.about || ""} onChange={e => setFormData({ ...formData, about: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm mt-1" rows="2" />
        </div>
      </div>
      <div className="p-3 border-t bg-gray-50 flex justify-end">
        <button onClick={handleSaveProfile} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Save</button>
      </div>
    </div>
  );

  const SecurityView = () => (
    <div className="w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900">← Back</button>
        <span className="font-semibold text-sm">Security</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Current Password</label>
          <input type="password" value={passData.old} onChange={e => setPassData({ ...passData, old: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">New Password</label>
          <input type="password" value={passData.new} onChange={e => setPassData({ ...passData, new: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Confirm Password</label>
          <input type="password" value={passData.confirm} onChange={e => setPassData({ ...passData, confirm: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
        </div>
      </div>
      <div className="p-3 border-t bg-gray-50 flex justify-end">
        <button onClick={handleSavePassword} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Update Password</button>
      </div>
    </div>
  );

  const ContactsView = () => (
    <div className="w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[400px]">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900">← Back</button>
        <span className="font-semibold text-sm">Contacts</span>
        <div className="w-8"></div>
      </div>
      <div className="p-2 overflow-y-auto flex-1">
        {contacts.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">No contacts found.</p>
        ) : (
          contacts.map(c => (
            <div key={c._id} className="flex items-center p-2 hover:bg-gray-50 rounded">
              <div className="w-8 h-8 rounded-full bg-gray-200 mr-3"></div>
              <div>
                <div className="text-sm font-medium">{c.username}</div>
                <div className="text-xs text-gray-500">{c.email}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      {/* Popover Positioned Bottom-Left */}
      <div className="fixed bottom-16 left-16 z-50 animate-fade-in-up">
        {view === "menu" && <MainMenu />}
        {view === "profile" && <ProfileView />}
        {view === "security" && <SecurityView />}
        {view === "contacts" && <ContactsView />}
      </div>
    </>
  );
};

export default ProfileMenu;
